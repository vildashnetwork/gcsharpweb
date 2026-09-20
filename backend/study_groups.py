"""
GCSHARP Study Groups - real-time group study rooms.

Features
--------
* Students create groups tied to their exam level; classmates at the same level
  are discoverable and can be added or asked to join (request/approve flow).
* WhatsApp-style chat: read receipts (ticks), typing indicators, presence,
  replies/quotes, emoji reactions, delete for me / delete for everyone,
  pagination, unread badges and per-group mute.
* Share past papers, highlighted passages and questions straight from the
  Paper Reader; tap any shared paper to open it.
* Voice notes recorded in the browser, uploaded over HTTPS and streamed back.
* GC AI sits inside every group: answer a question in the group thread, read
  the attached paper, and (optionally) answer new questions automatically.

Transport
---------
Signalling and messages travel over a raw WebSocket (TCP) at
``/api/ws/groups/{group_id}?token=<session_token>``. Audio and images use HTTPS
uploads so the socket stays small and responsive; if the socket is down the
client can still POST a message and the server fans it out to everyone else.

The hub is in-process, which matches the single-worker deployment this app uses.
If it is ever scaled to multiple workers, swap ``StudyGroupHub`` for a Redis
pub/sub backed implementation.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Set

from fastapi import (APIRouter, Depends, Form, HTTPException, Query, Request,
                     Response, UploadFile, File, WebSocket, WebSocketDisconnect)
from pydantic import BaseModel

logger = logging.getLogger("gcsmart.study_groups")

MESSAGE_TYPES = {"text", "voice", "paper", "highlight", "question", "ai", "image", "system"}
MAX_VOICE_BYTES = 5 * 1024 * 1024      # 5 MB per voice note (~4 minutes of Opus)
MAX_IMAGE_BYTES = 4 * 1024 * 1024
MAX_MESSAGE_CHARS = 6000
HISTORY_PAGE = 40

GROUP_COLORS = ["#2563eb", "#059669", "#db2777", "#f59e0b", "#7c3aed", "#0891b2"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _clean(text: Optional[str], limit: int = MAX_MESSAGE_CHARS) -> str:
    if not text:
        return ""
    value = str(text).replace("\x00", "").strip()
    return value[:limit]


# ============================================================
# WebSocket hub
# ============================================================

class StudyGroupHub:
    """Tracks live sockets per group and per user, and fans messages out."""

    def __init__(self) -> None:
        self.group_sockets: Dict[str, Dict[str, Set[WebSocket]]] = {}
        self.user_groups: Dict[str, Set[str]] = {}
        self.lock = asyncio.Lock()

    async def join(self, group_id: str, user_id: str, websocket: WebSocket) -> None:
        async with self.lock:
            self.group_sockets.setdefault(group_id, {}).setdefault(user_id, set()).add(websocket)
            self.user_groups.setdefault(user_id, set()).add(group_id)

    async def leave(self, group_id: str, user_id: str, websocket: WebSocket) -> bool:
        """Returns True when this was the user's last socket in the group."""
        async with self.lock:
            sockets = self.group_sockets.get(group_id, {}).get(user_id)
            if sockets:
                sockets.discard(websocket)
                if not sockets:
                    self.group_sockets[group_id].pop(user_id, None)
            if not self.group_sockets.get(group_id):
                self.group_sockets.pop(group_id, None)
            still_here = any(
                user_id in members for members in self.group_sockets.values()
            )
            if not still_here:
                self.user_groups.get(user_id, set()).discard(group_id)
            return not still_here

    def online_members(self, group_id: str) -> List[str]:
        return sorted(self.group_sockets.get(group_id, {}).keys())

    def is_online(self, user_id: str) -> bool:
        return bool(self.user_groups.get(user_id))

    async def broadcast(self, group_id: str, payload: Dict, skip_user: Optional[str] = None) -> int:
        """Send an event to every socket connected to the group."""
        members = dict(self.group_sockets.get(group_id, {}))
        sent = 0
        dead: List[tuple] = []
        for user_id, sockets in members.items():
            if skip_user and user_id == skip_user:
                continue
            for socket in list(sockets):
                try:
                    await socket.send_json(payload)
                    sent += 1
                except Exception:
                    dead.append((group_id, user_id, socket))
        for group, user, socket in dead:
            await self.leave(group, user, socket)
        return sent

    async def send_to_user(self, user_id: str, payload: Dict) -> int:
        """Send a personal event to every socket this user has open."""
        sent = 0
        dead: List[tuple] = []
        async with self.lock:
            snapshot = [
                (group_id, user_id, socket)
                for group_id, members in self.group_sockets.items()
                for socket in members.get(user_id, set())
            ]
        for group_id, user, socket in snapshot:
            try:
                await socket.send_json(payload)
                sent += 1
            except Exception:
                dead.append((group_id, user, socket))
        for group, user, socket in dead:
            await self.leave(group, user, socket)
        return sent


hub = StudyGroupHub()


# ============================================================
# Request models
# ============================================================

class GroupCreateRequest(BaseModel):
    name: str
    subject: Optional[str] = "General"
    level: Optional[str] = None
    description: Optional[str] = ""
    emoji: Optional[str] = "📚"
    color: Optional[str] = None
    join_policy: Optional[str] = "request"     # "request" | "open"
    max_members: Optional[int] = 30
    ai_enabled: Optional[bool] = True
    ai_auto_answer: Optional[bool] = False


class GroupUpdateRequest(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    emoji: Optional[str] = None
    color: Optional[str] = None
    join_policy: Optional[str] = None
    max_members: Optional[int] = None
    ai_enabled: Optional[bool] = None
    ai_auto_answer: Optional[bool] = None


class JoinDecisionRequest(BaseModel):
    request_id: str
    action: str                                  # "accept" | "reject"


class AddMembersRequest(BaseModel):
    user_ids: List[str]
    role: Optional[str] = "member"


class MessageRequest(BaseModel):
    text: Optional[str] = ""
    type: Optional[str] = "text"                 # text | paper | highlight | question
    client_id: Optional[str] = None              # optimistic UI de-duplication
    reply_to: Optional[str] = None
    paper: Optional[Dict] = None                 # {paper_id, title, subject, level, year}
    highlight: Optional[Dict] = None             # {paper_id, text, page, title}
    image: Optional[Dict] = None                 # {url, name}


class AskAIRequest(BaseModel):
    question: Optional[str] = None
    message_id: Optional[str] = None             # answer an existing group message
    paper_id: Optional[str] = None


class TypingRequest(BaseModel):
    typing: bool = True


class ReadRequest(BaseModel):
    upto_seq: Optional[int] = None               # mark everything up to this seq as read


class ReactionRequest(BaseModel):
    message_id: str
    emoji: str


class DeleteMessageRequest(BaseModel):
    message_id: str
    for_everyone: bool = False


# ============================================================
# Wiring - server_working.py calls configure() after its helpers exist
# ============================================================

class Deps:
    """Collaborators injected by server_working.py (avoids circular imports)."""

    db: Any = None
    get_current_user: Any = None
    create_notification: Any = None
    get_engine: Any = None
    fetch_pdf_text: Any = None


DEPS = Deps()


def configure(
    *,
    db,
    get_current_user,
    create_notification,
    get_engine,
    fetch_pdf_text,
) -> APIRouter:
    """Build and return the study-groups router (REST + WebSocket)."""
    DEPS.db = db
    DEPS.get_current_user = get_current_user
    DEPS.create_notification = create_notification
    DEPS.get_engine = get_engine
    DEPS.fetch_pdf_text = fetch_pdf_text
    return router


router = APIRouter(prefix="/api", tags=["study-groups"])


# ============================================================
# Internal helpers
# ============================================================

def _public_group(group: Dict, user_id: Optional[str] = None) -> Dict:
    """Group shape sent to clients (never exposes invite codes to non-members)."""
    members = group.get("members", [])
    is_member = any(m.get("user_id") == user_id for m in members)
    last = group.get("last_message") or {}
    return {
        "group_id": group.get("group_id"),
        "name": group.get("name"),
        "subject": group.get("subject", "General"),
        "level": group.get("level", ""),
        "description": group.get("description", ""),
        "emoji": group.get("emoji", "📚"),
        "color": group.get("color", GROUP_COLORS[0]),
        "created_by": group.get("created_by"),
        "created_at": group.get("created_at"),
        "updated_at": group.get("updated_at"),
        "join_policy": group.get("join_policy", "request"),
        "max_members": group.get("max_members", 30),
        "ai_enabled": group.get("ai_enabled", True),
        "ai_auto_answer": group.get("ai_auto_answer", False),
        "member_count": len(members),
        "is_member": is_member,
        "is_admin": _is_admin(group, user_id) if user_id else False,
        "members": [
            {
                "user_id": m.get("user_id"),
                "name": m.get("name", "Student"),
                "picture": m.get("picture", ""),
                "role": m.get("role", "member"),
                "joined_at": m.get("joined_at"),
                "online": hub.is_online(m.get("user_id", "")),
            }
            for m in members
        ],
        "last_message": {
            "text": last.get("text", ""),
            "type": last.get("type", "text"),
            "sender_name": last.get("sender_name", ""),
            "created_at": last.get("created_at"),
        } if last else None,
    }


def _is_admin(group: Dict, user_id: Optional[str]) -> bool:
    if not user_id:
        return False
    for member in group.get("members", []):
        if member.get("user_id") == user_id:
            return member.get("role") == "admin"
    return False


def _member_ids(group: Dict) -> List[str]:
    return [m.get("user_id") for m in group.get("members", []) if m.get("user_id")]


def _find_member(group: Dict, user_id: str) -> Optional[Dict]:
    for member in group.get("members", []):
        if member.get("user_id") == user_id:
            return member
    return None


async def _get_group(group_id: str, *, require_member: Optional[str] = None) -> Dict:
    group = await DEPS.db.study_groups.find_one({"group_id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Study group not found")
    if require_member and require_member not in _member_ids(group):
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    return group


def _require_admin(group: Dict, user_id: str) -> None:
    if not _is_admin(group, user_id):
        raise HTTPException(status_code=403, detail="Only group admins can do that")


async def _next_seq(group_id: str) -> int:
    """Monotonic per-group message counter (also used for resync + read state)."""
    result = await DEPS.db.study_groups.find_one_and_update(
        {"group_id": group_id},
        {"$inc": {"message_seq": 1}},
        projection={"message_seq": 1, "_id": 0},
        return_document=True,
    )
    return int((result or {}).get("message_seq", 1))


async def _broadcast(group_id: str, event: Dict, skip_user: Optional[str] = None) -> None:
    try:
        await hub.broadcast(group_id, {"group_id": group_id, **event}, skip_user=skip_user)
    except Exception as exc:  # pragma: no cover - socket errors must not break REST
        logger.debug(f"study group broadcast failed for {group_id}: {exc}")


def _message_preview(message: Dict) -> str:
    kind = message.get("type", "text")
    if kind == "voice":
        return "🎤 Voice note"
    if kind == "paper":
        return f"📄 {(message.get('paper') or {}).get('title', 'Past paper')}"
    if kind == "highlight":
        return "🖍️ Highlighted passage"
    if kind == "question":
        return f"❓ {message.get('text', 'Question')}"
    if kind == "ai":
        return "✨ GC AI answered"
    if kind == "image":
        return "🖼️ Photo"
    return message.get("text", "")


async def _notify_offline_members(group: Dict, message: Dict, sender_id: str) -> None:
    """Push an in-app notification to members who are not connected right now."""
    if DEPS.create_notification is None:
        return
    mentions = {
        m.get("user_id")
        for m in group.get("members", [])
        if m.get("user_id") and f"@{m.get('name', '')}".lower() in (message.get("text") or "").lower()
    }
    for user_id in _member_ids(group):
        if user_id == sender_id:
            continue
        mentioned = user_id in mentions
        if hub.is_online(user_id) and not mentioned:
            continue
        try:
            await DEPS.create_notification(
                user_id,
                (
                    f"{message.get('sender_name', 'A classmate')} mentioned you in "
                    f"{group.get('name')}: {_message_preview(message)[:90]}"
                    if mentioned else
                    f"{group.get('name')}: {message.get('sender_name', 'A classmate')} - "
                    f"{_message_preview(message)[:90]}"
                ),
                type="group_message",
                link=f"/groups/{group.get('group_id')}",
            )
        except Exception as exc:  # pragma: no cover - notifications are best effort
            logger.debug(f"group notification failed: {exc}")


# ============================================================
# Groups: create / list / discover / manage
# ============================================================

# ============================================================
# Auth dependency (resolved at request time so configure() can run later)
# ============================================================

async def require_user(request: Request) -> dict:
    if DEPS.get_current_user is None:
        raise HTTPException(status_code=503, detail="Study groups are not configured")
    return await DEPS.get_current_user(request)


# ============================================================
# Groups: create / list / discover / manage
# ============================================================

@router.post("/groups")
async def create_group(req: GroupCreateRequest, user: dict = Depends(require_user)):
    name = _clean(req.name, 60)
    if len(name) < 3:
        raise HTTPException(status_code=400, detail="Give the group a name of at least 3 characters")

    level = _clean(req.level or user.get("exam_level") or "General", 40) or "General"
    max_members = max(2, min(int(req.max_members or 30), 100))
    policy = req.join_policy if req.join_policy in ("request", "open") else "request"

    group = {
        "group_id": _new_id("grp"),
        "name": name,
        "subject": _clean(req.subject or "General", 60) or "General",
        "level": level,
        "description": _clean(req.description, 400),
        "emoji": (req.emoji or "📚")[:4],
        "color": req.color or GROUP_COLORS[len(name) % len(GROUP_COLORS)],
        "created_by": user["user_id"],
        "created_at": _now(),
        "updated_at": _now(),
        "join_policy": policy,
        "max_members": max_members,
        "ai_enabled": bool(req.ai_enabled is not False),
        "ai_auto_answer": bool(req.ai_auto_answer),
        "invite_code": uuid.uuid4().hex[:8].upper(),
        "message_seq": 0,
        "members": [
            {
                "user_id": user["user_id"],
                "name": user.get("name", "Student"),
                "picture": user.get("picture", ""),
                "role": "admin",
                "joined_at": _now(),
                "last_read_seq": 0,
                "muted": False,
            }
        ],
        "last_message": None,
    }
    await DEPS.db.study_groups.insert_one(dict(group))

    system_message = await _store_message(
        group_id=group["group_id"],
        sender={"user_id": "system", "name": "GCSHARP", "picture": ""},
        payload={
            "text": (
                f"{user.get('name', 'A student')} created this study group for "
                f"{group['level']} {group['subject']}. Share papers, ask questions and "
                "use ✨ Ask GC AI whenever you are stuck."
            ),
            "type": "system",
        },
    )
    await _broadcast(group["group_id"], {"event": "message", "message": system_message})
    return _public_group(await _get_group(group["group_id"]), user["user_id"])


@router.get("/groups")
async def list_my_groups(user: dict = Depends(require_user)):
    """Every group the student belongs to, newest activity first."""
    groups = await DEPS.db.study_groups.find(
        {"members.user_id": user["user_id"]}, {"_id": 0}
    ).sort("updated_at", -1).to_list(200)

    unread_map = await _unread_counts(groups, user["user_id"])
    payload = []
    for group in groups:
        item = _public_group(group, user["user_id"])
        item["unread"] = unread_map.get(group["group_id"], 0)
        payload.append(item)
    return {"groups": payload}


@router.get("/groups/discover")
async def discover_groups(
    q: Optional[str] = None,
    subject: Optional[str] = None,
    limit: int = 30,
    user: dict = Depends(require_user),
):
    """Groups at the student's own exam level that they have not joined yet."""
    level = user.get("exam_level") or None
    query: Dict = {"members.user_id": {"$ne": user["user_id"]}}
    if level:
        query["level"] = level
    if subject:
        query["subject"] = subject
    if q:
        query["$or"] = [
            {"name": {"$regex": re.escape(q), "$options": "i"}},
            {"description": {"$regex": re.escape(q), "$options": "i"}},
            {"subject": {"$regex": re.escape(q), "$options": "i"}},
        ]

    groups = await DEPS.db.study_groups.find(query, {"_id": 0}) \
        .sort("updated_at", -1).to_list(max(1, min(limit, 60)))
    pending = await DEPS.db.study_group_requests.find(
        {"user_id": user["user_id"], "status": "pending"}, {"_id": 0, "group_id": 1}
    ).to_list(200)
    requested = {p["group_id"] for p in pending}

    items = []
    for group in groups:
        item = _public_group(group, user["user_id"])
        item["requested"] = group["group_id"] in requested
        item["full"] = item["member_count"] >= item["max_members"]
        items.append(item)
    return {"groups": items, "level": level}


@router.get("/groups/{group_id}")
async def get_group(group_id: str, user: dict = Depends(require_user)):
    group = await _get_group(group_id)
    item = _public_group(group, user["user_id"])
    item["unread"] = (await _unread_counts([group], user["user_id"])).get(group_id, 0)
    return item


@router.patch("/groups/{group_id}")
async def update_group(group_id: str, req: GroupUpdateRequest, user: dict = Depends(require_user)):
    group = await _get_group(group_id, require_member=user["user_id"])
    _require_admin(group, user["user_id"])

    updates: Dict = {}
    if req.name is not None:
        name = _clean(req.name, 60)
        if len(name) < 3:
            raise HTTPException(status_code=400, detail="Group name is too short")
        updates["name"] = name
    if req.subject is not None:
        updates["subject"] = _clean(req.subject, 60) or "General"
    if req.description is not None:
        updates["description"] = _clean(req.description, 400)
    if req.emoji is not None:
        updates["emoji"] = (req.emoji or "📚")[:4]
    if req.color is not None:
        updates["color"] = req.color
    if req.join_policy in ("request", "open"):
        updates["join_policy"] = req.join_policy
    if req.max_members is not None:
        updates["max_members"] = max(len(group.get("members", [])), min(int(req.max_members), 100))
    if req.ai_enabled is not None:
        updates["ai_enabled"] = bool(req.ai_enabled)
    if req.ai_auto_answer is not None:
        updates["ai_auto_answer"] = bool(req.ai_auto_answer)

    if updates:
        updates["updated_at"] = _now()
        await DEPS.db.study_groups.update_one({"group_id": group_id}, {"$set": updates})
        await _broadcast(group_id, {"event": "group_updated", "updates": updates})

    return _public_group(await _get_group(group_id), user["user_id"])


@router.delete("/groups/{group_id}")
async def delete_group(group_id: str, user: dict = Depends(require_user)):
    group = await _get_group(group_id, require_member=user["user_id"])
    _require_admin(group, user["user_id"])
    await DEPS.db.study_groups.delete_one({"group_id": group_id})
    await DEPS.db.study_group_messages.delete_many({"group_id": group_id})
    await DEPS.db.study_group_requests.delete_many({"group_id": group_id})
    await DEPS.db.study_group_voice.delete_many({"group_id": group_id})
    await _broadcast(group_id, {"event": "group_deleted", "group_id": group_id})
    return {"ok": True, "deleted": group_id}


# ============================================================
# Membership: join / requests / add classmates / leave
# ============================================================

@router.post("/groups/{group_id}/join")
async def join_group(group_id: str, request: Request, user: dict = Depends(require_user)):
    group = await _get_group(group_id)
    if user["user_id"] in _member_ids(group):
        return {"ok": True, "joined": True, "group": _public_group(group, user["user_id"])}
    if len(group.get("members", [])) >= group.get("max_members", 30):
        raise HTTPException(status_code=400, detail="This group is already full")

    level = group.get("level")
    my_level = user.get("exam_level")
    if level and my_level and level != my_level:
        raise HTTPException(
            status_code=403,
            detail=f"This group is for {level} students. You are set to {my_level}.",
        )

    try:
        body = await request.json()
    except Exception:
        body = {}
    note = _clean(body.get("message"), 200) if isinstance(body, dict) else ""

    if group.get("join_policy") == "open":
        await _add_member(group_id, user, role="member")
        await _post_system(group_id, f"{user.get('name', 'A student')} joined the group 👋")
        await _broadcast(group_id, {"event": "members_changed"})
        return {
            "ok": True,
            "joined": True,
            "group": _public_group(await _get_group(group_id), user["user_id"]),
        }

    existing = await DEPS.db.study_group_requests.find_one(
        {"group_id": group_id, "user_id": user["user_id"], "status": "pending"}, {"_id": 0}
    )
    if existing:
        return {"ok": True, "joined": False, "pending": True, "request": existing}

    join_request = {
        "request_id": _new_id("req"),
        "group_id": group_id,
        "group_name": group.get("name"),
        "user_id": user["user_id"],
        "name": user.get("name", "Student"),
        "picture": user.get("picture", ""),
        "level": user.get("exam_level", ""),
        "subjects": user.get("subjects", []),
        "message": note,
        "status": "pending",
        "created_at": _now(),
    }
    await DEPS.db.study_group_requests.insert_one(dict(join_request))

    if DEPS.create_notification is not None:
        for admin in group.get("members", []):
            if admin.get("role") != "admin":
                continue
            try:
                await DEPS.create_notification(
                    admin["user_id"],
                    f"{join_request['name']} asked to join {group.get('name')}",
                    type="group_request",
                    link=f"/groups/{group_id}",
                )
            except Exception as exc:  # pragma: no cover
                logger.debug(f"join notification failed: {exc}")

    await hub.broadcast(
        group_id,
        {"group_id": group_id, "event": "join_request", "request": join_request},
    )
    return {"ok": True, "joined": False, "pending": True, "request": join_request}


@router.get("/groups/{group_id}/requests")
async def list_join_requests(group_id: str, user: dict = Depends(require_user)):
    group = await _get_group(group_id, require_member=user["user_id"])
    _require_admin(group, user["user_id"])
    items = await DEPS.db.study_group_requests.find(
        {"group_id": group_id, "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return {"requests": items}


@router.post("/groups/{group_id}/requests/decide")
async def decide_join_request(group_id: str, req: JoinDecisionRequest, user: dict = Depends(require_user)):
    group = await _get_group(group_id, require_member=user["user_id"])
    _require_admin(group, user["user_id"])

    join_request = await DEPS.db.study_group_requests.find_one(
        {"request_id": req.request_id, "group_id": group_id}, {"_id": 0}
    )
    if not join_request:
        raise HTTPException(status_code=404, detail="Join request not found")
    if join_request.get("status") != "pending":
        return {"ok": True, "status": join_request.get("status")}

    status = "accepted" if req.action == "accept" else "rejected"
    await DEPS.db.study_group_requests.update_one(
        {"request_id": req.request_id},
        {"$set": {"status": status, "decided_at": _now(), "decided_by": user["user_id"]}},
    )

    if status == "accepted":
        applicant = await DEPS.db.users.find_one(
            {"user_id": join_request["user_id"]},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "exam_level": 1},
        ) or {"user_id": join_request["user_id"], "name": join_request.get("name", "Student")}
        await _add_member(group_id, applicant, role="member")
        await _post_system(group_id, f"{applicant.get('name', 'A student')} joined the group 👋")
        await _broadcast(group_id, {"event": "members_changed"})

    if DEPS.create_notification is not None:
        try:
            await DEPS.create_notification(
                join_request["user_id"],
                (
                    f"Your request to join {group.get('name')} was accepted 🎉"
                    if status == "accepted"
                    else f"Your request to join {group.get('name')} was declined"
                ),
                type="group_request",
                link=f"/groups/{group_id}",
            )
        except Exception as exc:  # pragma: no cover
            logger.debug(f"decision notification failed: {exc}")

    await hub.send_to_user(
        join_request["user_id"],
        {"group_id": group_id, "event": "request_decided", "status": status},
    )
    return {"ok": True, "status": status}


@router.get("/groups/{group_id}/candidates")
async def candidate_classmates(
    group_id: str,
    q: Optional[str] = None,
    limit: int = 40,
    user: dict = Depends(require_user),
):
    """Students at the same exam level to invite into this group."""
    group = await _get_group(group_id, require_member=user["user_id"])
    members = set(_member_ids(group))
    level = group.get("level") or user.get("exam_level")

    query: Dict = {"role": "student"}
    if level:
        query["exam_level"] = level
    if q:
        query["$or"] = [
            {"name": {"$regex": re.escape(q), "$options": "i"}},
            {"email": {"$regex": re.escape(q), "$options": "i"}},
        ]
    students = await DEPS.db.users.find(
        query,
        {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "exam_level": 1,
         "subjects": 1, "institution": 1},
    ).limit(max(1, min(limit * 2, 120))).to_list(120)

    return {
        "level": level,
        "group_subject": group.get("subject"),
        "students": [
            {
                "user_id": s["user_id"],
                "name": s.get("name", "Student"),
                "picture": s.get("picture", ""),
                "exam_level": s.get("exam_level", ""),
                "subjects": s.get("subjects", []),
                "institution": s.get("institution", ""),
                "same_subjects": group.get("subject") in (s.get("subjects") or []),
            }
            for s in students
            if s.get("user_id") not in members
        ][: max(1, min(limit, 60))],
    }


@router.post("/groups/{group_id}/members")
async def add_members(group_id: str, req: AddMembersRequest, user: dict = Depends(require_user)):
    """Admin adds classmates directly; the group's exam level is enforced."""
    group = await _get_group(group_id, require_member=user["user_id"])
    _require_admin(group, user["user_id"])
    if not req.user_ids:
        raise HTTPException(status_code=400, detail="Select at least one classmate")

    members = set(_member_ids(group))
    role = "admin" if req.role == "admin" else "member"
    added, skipped = [], []
    capacity = group.get("max_members", 30)

    for member_id in req.user_ids[:50]:
        if member_id in members:
            skipped.append({"user_id": member_id, "reason": "already a member"})
            continue
        if len(members) >= capacity:
            skipped.append({"user_id": member_id, "reason": "group is full"})
            continue
        student = await DEPS.db.users.find_one(
            {"user_id": member_id},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "exam_level": 1},
        )
        if not student:
            skipped.append({"user_id": member_id, "reason": "student not found"})
            continue
        if group.get("level") and student.get("exam_level") and student["exam_level"] != group["level"]:
            skipped.append({"user_id": member_id, "reason": "different exam level"})
            continue

        await _add_member(group_id, student, role=role)
        members.add(member_id)
        added.append({"user_id": member_id, "name": student.get("name", "Student")})

        await hub.send_to_user(
            member_id,
            {
                "event": "added_to_group",
                "group_id": group_id,
                "group_name": group.get("name"),
                "added_by": user.get("name", "A classmate"),
            },
        )
        if DEPS.create_notification is not None:
            try:
                await DEPS.create_notification(
                    member_id,
                    f"{user.get('name', 'A classmate')} added you to the study group {group.get('name')}",
                    type="group_invite",
                    link=f"/groups/{group_id}",
                )
            except Exception as exc:  # pragma: no cover
                logger.debug(f"add-member notification failed: {exc}")

    if added:
        names = ", ".join(item["name"] for item in added[:5])
        await _post_system(group_id, f"{names} joined the group 👋")
        await _broadcast(group_id, {"event": "members_changed"})

    return {
        "ok": True,
        "added": added,
        "skipped": skipped,
        "group": _public_group(await _get_group(group_id), user["user_id"]),
    }


@router.delete("/groups/{group_id}/members/{member_id}")
async def remove_member(group_id: str, member_id: str, user: dict = Depends(require_user)):
    group = await _get_group(group_id, require_member=user["user_id"])
    is_self = member_id == user["user_id"]
    if not is_self:
        _require_admin(group, user["user_id"])

    target = _find_member(group, member_id)
    if not target:
        raise HTTPException(status_code=404, detail="That student is not in this group")
    if target.get("role") == "admin" and not is_self:
        others = [
            m for m in group.get("members", [])
            if m.get("role") == "admin" and m.get("user_id") != member_id
        ]
        if not others:
            raise HTTPException(status_code=400, detail="A group needs at least one admin")

    await DEPS.db.study_groups.update_one(
        {"group_id": group_id},
        {"$pull": {"members": {"user_id": member_id}}, "$set": {"updated_at": _now()}},
    )
    await _post_system(
        group_id,
        f"{target.get('name', 'A student')} "
        f"{'left' if is_self else 'was removed from'} the group",
    )
    await _broadcast(group_id, {"event": "members_changed"})
    return {"ok": True, "removed": member_id}


@router.post("/groups/{group_id}/members/{member_id}/promote")
async def promote_member(group_id: str, member_id: str, user: dict = Depends(require_user)):
    group = await _get_group(group_id, require_member=user["user_id"])
    _require_admin(group, user["user_id"])
    result = await DEPS.db.study_groups.update_one(
        {"group_id": group_id, "members.user_id": member_id},
        {"$set": {"members.$.role": "admin", "updated_at": _now()}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="That student is not in this group")
    await _broadcast(group_id, {"event": "members_changed"})
    return {"ok": True}


@router.post("/groups/{group_id}/mute")
async def toggle_mute(group_id: str, user: dict = Depends(require_user)):
    group = await _get_group(group_id, require_member=user["user_id"])
    member = _find_member(group, user["user_id"]) or {}
    muted = not bool(member.get("muted"))
    await DEPS.db.study_groups.update_one(
        {"group_id": group_id, "members.user_id": user["user_id"]},
        {"$set": {"members.$.muted": muted}},
    )
    return {"ok": True, "muted": muted}


# ============================================================
# Internal mechanics used by the endpoints above
# ============================================================

async def _add_member(group_id: str, student: Dict, role: str = "member") -> None:
    """Add a student to a group (idempotent)."""
    member = {
        "user_id": student["user_id"],
        "name": student.get("name", "Student"),
        "picture": student.get("picture", ""),
        "role": "admin" if role == "admin" else "member",
        "joined_at": _now(),
        "last_read_seq": 0,
        "muted": False,
    }
    existing = await DEPS.db.study_groups.find_one(
        {"group_id": group_id, "members.user_id": student["user_id"]},
        {"_id": 0, "group_id": 1},
    )
    if existing:
        return
    await DEPS.db.study_groups.update_one(
        {"group_id": group_id},
        {"$push": {"members": member}, "$set": {"updated_at": _now()}},
    )


async def _store_message(
    *,
    group_id: str,
    sender: Dict,
    payload: Dict,
    reply_to: Optional[str] = None,
) -> Dict:
    """Persist a message, refresh the group preview and return the stored doc."""
    kind = payload.get("type", "text")
    if kind not in MESSAGE_TYPES:
        kind = "text"
    seq = await _next_seq(group_id)

    message = {
        "message_id": _new_id("msg"),
        "group_id": group_id,
        "seq": seq,
        "sender_id": sender.get("user_id", "system"),
        "sender_name": sender.get("name", "Student"),
        "sender_picture": sender.get("picture", ""),
        "type": kind,
        "text": _clean(payload.get("text")),
        "client_id": payload.get("client_id"),
        "paper": payload.get("paper") or None,
        "highlight": payload.get("highlight") or None,
        "image": payload.get("image") or None,
        "audio": payload.get("audio") or None,
        "ai": payload.get("ai") or None,
        "reply_to": reply_to or None,
        "reactions": {},
        "read_by": [sender.get("user_id", "system")],
        "deleted_for": [],
        "deleted_everyone": False,
        "edited": False,
        "created_at": _now(),
    }
    if not message["text"] and kind in ("text", "question"):
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    await DEPS.db.study_group_messages.insert_one(dict(message))
    await DEPS.db.study_groups.update_one(
        {"group_id": group_id},
        {
            "$set": {
                "updated_at": _now(),
                "last_message": {
                    "text": _message_preview(message),
                    "type": kind,
                    "sender_id": message["sender_id"],
                    "sender_name": message["sender_name"],
                    "created_at": message["created_at"],
                },
            }
        },
    )
    return message


async def _post_system(group_id: str, text: str) -> Dict:
    message = await _store_message(
        group_id=group_id,
        sender={"user_id": "system", "name": "GCSHARP", "picture": ""},
        payload={"text": text, "type": "system"},
    )
    await _broadcast(group_id, {"event": "message", "message": message})
    return message


async def _unread_counts(groups: List[Dict], user_id: str) -> Dict[str, int]:
    """Messages after the member's last_read_seq, per group."""
    counts: Dict[str, int] = {}
    for group in groups:
        member = _find_member(group, user_id)
        if not member:
            continue
        last_read = int(member.get("last_read_seq") or 0)
        try:
            counts[group["group_id"]] = await DEPS.db.study_group_messages.count_documents({
                "group_id": group["group_id"],
                "seq": {"$gt": last_read},
                "sender_id": {"$ne": user_id},
                "deleted_everyone": False,
                "deleted_for": {"$ne": user_id},
            })
        except Exception:  # pragma: no cover - counts must never break the list
            counts[group["group_id"]] = 0
    return counts





# ============================================================
# Messages: history, sending, receipts, typing
# ============================================================

@router.get("/groups/{group_id}/messages")
async def group_messages(
    group_id: str,
    before_seq: Optional[int] = None,
    after_seq: Optional[int] = None,
    limit: int = HISTORY_PAGE,
    user: dict = Depends(require_user),
):
    """Paginated history. before_seq scrolls up, after_seq resyncs missed ones."""
    await _get_group(group_id, require_member=user["user_id"])
    limit = max(1, min(limit, 100))

    query: Dict = {"group_id": group_id, "deleted_for": {"$ne": user["user_id"]}}
    if before_seq is not None:
        query["seq"] = {"$lt": int(before_seq)}
    elif after_seq is not None:
        query["seq"] = {"$gt": int(after_seq)}

    cursor = DEPS.db.study_group_messages.find(query, {"_id": 0})
    if before_seq is not None or after_seq is None:
        cursor = cursor.sort("seq", -1)
    else:
        cursor = cursor.sort("seq", 1)
    items = await cursor.to_list(limit)
    if before_seq is not None or after_seq is None:
        items.reverse()

    return {
        "messages": items,
        "has_more": len(items) == limit,
        "oldest_seq": items[0]["seq"] if items else None,
        "latest_seq": items[-1]["seq"] if items else None,
        "online": hub.online_members(group_id),
    }


@router.post("/groups/{group_id}/messages")
async def send_group_message(group_id: str, req: MessageRequest, user: dict = Depends(require_user)):
    """REST path for sending - also the fallback used when the socket is down."""
    group = await _get_group(group_id, require_member=user["user_id"])

    payload = {
        "text": req.text,
        "type": req.type or "text",
        "client_id": req.client_id,
        "paper": req.paper,
        "highlight": req.highlight,
        "image": req.image,
    }
    if payload["type"] in ("paper", "highlight", "image") and not (
        payload.get("paper") or payload.get("highlight") or payload.get("image")
    ):
        raise HTTPException(status_code=400, detail="Nothing to attach")

    message = await _store_message(
        group_id=group_id,
        sender=user,
        payload=payload,
        reply_to=req.reply_to,
    )
    # Fan out to everyone including the sender (their client de-dupes on client_id).
    await _broadcast(group_id, {"event": "message", "message": message})
    await _notify_offline_members(group, message, user["user_id"])

    if group.get("ai_enabled") and group.get("ai_auto_answer") and message["type"] == "question":
        asyncio.create_task(_answer_with_ai(group_id, message["text"], message, group))

    return {"ok": True, "message": message}


@router.post("/groups/{group_id}/read")
async def mark_group_read(group_id: str, req: ReadRequest, user: dict = Depends(require_user)):
    group = await _get_group(group_id, require_member=user["user_id"])
    upto = int(req.upto_seq or group.get("message_seq") or 0)
    await DEPS.db.study_groups.update_one(
        {"group_id": group_id, "members.user_id": user["user_id"]},
        {"$set": {"members.$.last_read_seq": upto}},
    )
    await DEPS.db.study_group_messages.update_many(
        {"group_id": group_id, "seq": {"$lte": upto}, "read_by": {"$ne": user["user_id"]}},
        {"$push": {"read_by": user["user_id"]}},
    )
    # Tell the authors their messages were read (blue ticks).
    await _broadcast(
        group_id,
        {"event": "read", "user_id": user["user_id"], "upto_seq": upto,
         "name": user.get("name", "Student")},
        skip_user=user["user_id"],
    )
    return {"ok": True, "upto_seq": upto}


@router.post("/groups/{group_id}/typing")
async def group_typing(group_id: str, req: TypingRequest, user: dict = Depends(require_user)):
    await _get_group(group_id, require_member=user["user_id"])
    await _broadcast(
        group_id,
        {
            "event": "typing",
            "user_id": user["user_id"],
            "name": user.get("name", "Student"),
            "typing": bool(req.typing),
        },
        skip_user=user["user_id"],
    )
    return {"ok": True}




@router.post("/groups/{group_id}/react")
async def react_to_message(group_id: str, req: ReactionRequest, user: dict = Depends(require_user)):
    await _get_group(group_id, require_member=user["user_id"])
    emoji = (req.emoji or "")[:4]
    if not emoji:
        raise HTTPException(status_code=400, detail="Pick an emoji")

    message = await DEPS.db.study_group_messages.find_one(
        {"message_id": req.message_id, "group_id": group_id}, {"_id": 0}
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    reactions = dict(message.get("reactions") or {})
    users = set(reactions.get(emoji) or [])
    if user["user_id"] in users:
        users.discard(user["user_id"])
    else:
        users.add(user["user_id"])
    if users:
        reactions[emoji] = sorted(users)
    else:
        reactions.pop(emoji, None)

    await DEPS.db.study_group_messages.update_one(
        {"message_id": req.message_id}, {"$set": {"reactions": reactions}}
    )
    await _broadcast(
        group_id,
        {"event": "reaction", "message_id": req.message_id, "reactions": reactions,
         "user_id": user["user_id"]},
    )
    return {"ok": True, "reactions": reactions}


@router.post("/groups/{group_id}/messages/delete")
async def delete_group_message(group_id: str, req: DeleteMessageRequest, user: dict = Depends(require_user)):
    group = await _get_group(group_id, require_member=user["user_id"])
    message = await DEPS.db.study_group_messages.find_one(
        {"message_id": req.message_id, "group_id": group_id}, {"_id": 0}
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    mine = message.get("sender_id") == user["user_id"]
    if req.for_everyone:
        if not (mine or _is_admin(group, user["user_id"])):
            raise HTTPException(
                status_code=403,
                detail="You can only delete your own messages for everyone",
            )
        await DEPS.db.study_group_messages.update_one(
            {"message_id": req.message_id},
            {"$set": {"deleted_everyone": True, "text": "", "paper": None,
                      "highlight": None, "image": None, "audio": None}},
        )
        await _broadcast(
            group_id,
            {"event": "message_deleted", "message_id": req.message_id, "for_everyone": True},
        )
        return {"ok": True, "for_everyone": True}

    await DEPS.db.study_group_messages.update_one(
        {"message_id": req.message_id}, {"$addToSet": {"deleted_for": user["user_id"]}}
    )
    return {"ok": True, "for_everyone": False}



# ============================================================
# Voice notes
# ============================================================

@router.post("/groups/{group_id}/voice")
async def upload_voice_note(
    group_id: str,
    file: UploadFile = File(...),
    duration: float = Form(0),
    client_id: Optional[str] = Form(None),
    reply_to: Optional[str] = Form(None),
    user: dict = Depends(require_user),
):
    """Store a recorded voice note and post it to the group."""
    await _get_group(group_id, require_member=user["user_id"])
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The recording was empty")
    if len(raw) > MAX_VOICE_BYTES:
        raise HTTPException(status_code=413, detail="Voice notes are limited to 5 MB")

    audio_id = _new_id("aud")
    await DEPS.db.study_group_voice.insert_one({
        "audio_id": audio_id,
        "group_id": group_id,
        "user_id": user["user_id"],
        "mime": file.content_type or "audio/webm",
        "size": len(raw),
        "data": base64.b64encode(raw).decode("ascii"),
        "created_at": _now(),
    })

    message = await _store_message(
        group_id=group_id,
        sender=user,
        payload={
            "type": "voice",
            "client_id": client_id,
            "text": "",
            "audio": {
                "audio_id": audio_id,
                "duration": round(float(duration or 0), 1),
                "mime": file.content_type or "audio/webm",
                "size": len(raw),
            },
        },
        reply_to=reply_to,
    )
    await _broadcast(group_id, {"event": "message", "message": message})
    await _notify_offline_members(group, message, user["user_id"])
    return {"ok": True, "message": message}


@router.get("/groups/voice/{audio_id}")
async def stream_voice_note(audio_id: str, request: Request):
    """Stream a voice note back. Auth via bearer token or ?token= (for audio tags)."""
    token = request.query_params.get("token")
    if token:
        session = await DEPS.db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=401, detail="Invalid session")
        user_id = session["user_id"]
    else:
        user = await DEPS.get_current_user(request)
        user_id = user["user_id"]

    note = await DEPS.db.study_group_voice.find_one({"audio_id": audio_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Voice note not found")
    await _get_group(note["group_id"], require_member=user_id)

    data = base64.b64decode(note["data"])
    return Response(
        content=data,
        media_type=note.get("mime", "audio/webm"),
        headers={
            "Cache-Control": "private, max-age=86400",
            "Content-Length": str(len(data)),
            "Content-Disposition": "inline",
        },
    )



# ============================================================
# Shared papers
# ============================================================

@router.post("/groups/{group_id}/papers/{paper_id}")
async def share_paper(
    group_id: str,
    paper_id: str,
    user: dict = Depends(require_user),
    note: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
):
    """Share a past paper into the group with an optional note."""
    await _get_group(group_id, require_member=user["user_id"])
    paper = await DEPS.db.papers.find_one({"paper_id": paper_id}, {"_id": 0})
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    message = await _store_message(
        group_id=group_id,
        sender=user,
        payload={
            "type": "paper",
            "text": _clean(note, 400),
            "client_id": client_id,
            "paper": {
                "paper_id": paper.get("paper_id"),
                "title": paper.get("title", "Past paper"),
                "subject": paper.get("subject", ""),
                "level": paper.get("level", ""),
                "year": paper.get("year"),
                "paper_number": paper.get("paper_number"),
            },
        },
    )
    await _broadcast(group_id, {"event": "message", "message": message})
    await _notify_offline_members(group, message, user["user_id"])
    return {"ok": True, "message": message}


@router.get("/groups/{group_id}/papers")
async def group_paper_shelf(
    group_id: str,
    q: Optional[str] = None,
    limit: int = 40,
    user: dict = Depends(require_user),
):
    """Papers shared in this group, plus papers matching its level/subject."""
    group = await _get_group(group_id, require_member=user["user_id"])

    shared = await DEPS.db.study_group_messages.find(
        {"group_id": group_id, "type": "paper", "deleted_everyone": False}, {"_id": 0}
    ).sort("seq", -1).to_list(100)
    shared_papers: List[Dict] = []
    seen: Set[str] = set()
    for message in shared:
        paper = message.get("paper") or {}
        paper_id = paper.get("paper_id")
        if paper_id and paper_id not in seen:
            seen.add(paper_id)
            shared_papers.append({
                **paper,
                "shared_by": message.get("sender_name"),
                "shared_at": message.get("created_at"),
                "message_id": message.get("message_id"),
            })

    query: Dict = {}
    if group.get("level"):
        query["level"] = group["level"]
    if group.get("subject") and group["subject"] != "General":
        query["subject"] = group["subject"]
    if q:
        query["title"] = {"$regex": re.escape(q), "$options": "i"}

    available = await DEPS.db.papers.find(query, {"_id": 0}).sort("year", -1).to_list(
        max(1, min(limit, 80))
    )
    return {
        "group_subject": group.get("subject"),
        "group_level": group.get("level"),
        "shared": shared_papers[:30],
        "available": [
            {
                "paper_id": p.get("paper_id"),
                "title": p.get("title", "Past paper"),
                "subject": p.get("subject", ""),
                "level": p.get("level", ""),
                "year": p.get("year"),
                "paper_number": p.get("paper_number"),
            }
            for p in available
        ],
    }


# ============================================================
# GC AI inside the group
# ============================================================

async def _paper_context(paper_id: Optional[str]) -> str:
    """Extract readable text from a shared paper so GC AI can read it."""
    if not paper_id or DEPS.fetch_pdf_text is None:
        return ""
    try:
        paper = await DEPS.db.papers.find_one({"paper_id": paper_id}, {"_id": 0})
        if not paper:
            return ""
        text = await DEPS.fetch_pdf_text(paper.get("pdf_url"), max_chars=6000)
        header = (
            f"[Past paper: {paper.get('level')} {paper.get('subject')} "
            f"{paper.get('year')} Paper {paper.get('paper_number')}]"
        )
        return f"{header}\n{text}" if text else ""
    except Exception as exc:  # pragma: no cover - PDF/network dependent
        logger.debug(f"group AI paper context failed: {exc}")
        return ""


async def _group_history(group_id: str, limit: int = 10) -> List[Dict]:
    items = await DEPS.db.study_group_messages.find(
        {"group_id": group_id, "deleted_everyone": False, "type": {"$ne": "system"}},
        {"_id": 0, "sender_name": 1, "text": 1, "type": 1},
    ).sort("seq", -1).to_list(limit)
    items.reverse()
    history = []
    for item in items:
        body = item.get("text") or ""
        if not body:
            continue
        history.append({
            "role": "assistant" if item.get("type") == "ai" else "user",
            "content": f"{item.get('sender_name', 'Student')}: {body}"[:1500],
        })
    return history


async def _resolve_engine():
    """The engine getter may be sync, async or a coroutine already scheduled."""
    if not DEPS.get_engine:
        return None
    try:
        engine = DEPS.get_engine()
        if hasattr(engine, "__await__"):
            engine = await engine
        return engine
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug(f"group AI engine unavailable: {exc}")
        return None


async def _answer_with_ai(
    group_id: str,
    question: str,
    source_message: Optional[Dict],
    group: Optional[Dict] = None,
) -> Optional[Dict]:
    """Ask GC AI inside the group and post its answer as a group member."""
    question = _clean(question, 1500)
    if len(question) < 3:
        return None

    group = group or await DEPS.db.study_groups.find_one({"group_id": group_id}, {"_id": 0})
    if not group:
        return None

    await _broadcast(group_id, {
        "event": "ai_thinking",
        "state": True,
        "question": question,
        "message_id": (source_message or {}).get("message_id"),
    })

    try:
        engine = await _resolve_engine()
        paper = (source_message or {}).get("paper") or {}
        paper_context = await _paper_context(paper.get("paper_id"))
        history = await _group_history(group_id)

        subject = group.get("subject") or "General"
        level = group.get("level") or ""
        prefix = (
            f"You are GC AI, the study helper inside the GCSHARP study group "
            f"'{group.get('name')}' for {level} {subject} students. Answer for the whole "
            "group: be concise, exam-focused, and use markdown with short steps. "
        )
        if paper_context:
            prefix += (
                "The group shared the past paper below - refer to its question numbers "
                "when relevant.\n\n" + paper_context + "\n\n"
            )
        prompt = prefix + f"Student question:\n{question}"

        if engine is not None:
            answer = await engine.answer(
                prompt,
                subject=subject,
                history=history[-6:] if history else None,
            )
            text = (answer.text or "").strip()
            meta = {
                "mode": answer.mode,
                "mode_label": answer.mode_label,
                "sources": answer.sources,
                "confidence": round(answer.confidence, 3),
                "provider": answer.provider,
                "learned": answer.learned,
            }
        else:
            text = ""
            meta = {}

        if not text:
            text = (
                "I could not build an answer for that one right now. Ask me again - I retry "
                "every AI provider, then search the web, then use my own knowledge base."
            )
            meta = {"mode": "offline", "mode_label": "GC AI offline mode", "sources": []}

    except Exception as exc:
        logger.error(f"group AI answer failed for {group_id}: {exc}")
        text = (
            "I hit a problem answering that in the group. Please ask again, or rephrase it "
            "slightly and I will try another route."
        )
        meta = {"mode": "offline", "mode_label": "GC AI offline mode", "sources": []}

    message = await _store_message(
        group_id=group_id,
        sender={"user_id": "gc_ai", "name": "GC AI", "picture": ""},
        payload={"type": "ai", "text": text, "ai": meta},
        reply_to=(source_message or {}).get("message_id"),
    )
    await _broadcast(group_id, {"event": "ai_thinking", "state": False})
    await _broadcast(group_id, {"event": "message", "message": message})
    await _notify_offline_members(group, message, "gc_ai")
    return message


@router.post("/groups/{group_id}/ai")
async def ask_group_ai(group_id: str, req: AskAIRequest, user: dict = Depends(require_user)):
    """Ask GC AI inside the group (optionally about a shared message or paper)."""
    group = await _get_group(group_id, require_member=user["user_id"])
    if not group.get("ai_enabled", True):
        raise HTTPException(status_code=403, detail="GC AI is turned off for this group")

    source_message = None
    question = _clean(req.question, 1500)

    if req.message_id:
        source_message = await DEPS.db.study_group_messages.find_one(
            {"message_id": req.message_id, "group_id": group_id}, {"_id": 0}
        )
        if not source_message:
            raise HTTPException(status_code=404, detail="Message not found")
        if not question:
            highlight = source_message.get("highlight") or {}
            paper = source_message.get("paper") or {}
            if highlight.get("text") and source_message.get("text"):
                question = (
                    f"{source_message['text']}\n\n"
                    f"Highlighted from the paper:\n{highlight['text']}"
                )
            else:
                question = (
                    source_message.get("text")
                    or highlight.get("text")
                    or f"Solve and explain this past paper: {paper.get('title', '')}"
                )

    if not question:
        raise HTTPException(status_code=400, detail="Ask GC AI something first")

    message = await _answer_with_ai(group_id, question, source_message, group)
    if message is None:
        raise HTTPException(status_code=400, detail="That question was too short for GC AI")
    return {"ok": True, "message": message}


@router.get("/groups/summary/badges")
async def groups_summary(user: dict = Depends(require_user)):
    """Unread totals used by the bottom tab badge."""
    groups = await DEPS.db.study_groups.find(
        {"members.user_id": user["user_id"]}, {"_id": 0}
    ).to_list(200)
    unread_map = await _unread_counts(groups, user["user_id"])
    admin_of = [g["group_id"] for g in groups if _is_admin(g, user["user_id"])]
    requests_waiting = 0
    if admin_of:
        requests_waiting = await DEPS.db.study_group_requests.count_documents(
            {"group_id": {"$in": admin_of}, "status": "pending"}
        )
    return {
        "groups": len(groups),
        "unread": sum(unread_map.values()),
        "requests_waiting": requests_waiting,
        "unread_by_group": unread_map,
    }



# ============================================================
# WebSocket - real time transport (TCP)
# ============================================================
# Connect with the native browser WebSocket API (NOT socket.io):
#     new WebSocket(`wss://<host>/api/ws/groups/<group_id>?token=<session_token>`)
# Server -> client events:
#   ready | message | typing | read | presence | reaction | message_deleted
#   members_changed | group_updated | group_deleted | join_request | ai_thinking | pong | error
# Client -> server events:
#   ping | typing | read | message | ask_ai

@router.websocket("/ws/groups/{group_id}")
async def group_socket(websocket: WebSocket, group_id: str, token: str = None):
    """Live group socket: messages, typing, receipts, presence and GC AI."""
    session = None
    if token:
        session = await DEPS.db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        cookie_token = websocket.cookies.get("session_token")
        if cookie_token:
            session = await DEPS.db.user_sessions.find_one(
                {"session_token": cookie_token}, {"_id": 0}
            )
    if not session:
        await websocket.close(code=1008)
        return

    user = await DEPS.db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        await websocket.close(code=1008)
        return

    group = await DEPS.db.study_groups.find_one({"group_id": group_id}, {"_id": 0})
    if not group or user["user_id"] not in _member_ids(group):
        await websocket.close(code=1008)
        return

    await websocket.accept()
    user_id = user["user_id"]
    await hub.join(group_id, user_id, websocket)
    try:
        await websocket.send_json({
            "group_id": group_id,
            "event": "ready",
            "you": user_id,
            "user_name": user.get("name", "Student"),
            "online": hub.online_members(group_id),
            "latest_seq": group.get("message_seq", 0),
            "server_time": _now(),
        })
        await _broadcast(
            group_id,
            {"event": "presence", "user_id": user_id, "name": user.get("name", "Student"),
             "online": True, "online_users": hub.online_members(group_id)},
            skip_user=user_id,
        )

        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue

            kind = (data.get("type") or "").lower()

            if kind == "ping":
                await websocket.send_json({"event": "pong", "server_time": _now()})
                continue

            if kind == "typing":
                await _broadcast(
                    group_id,
                    {"event": "typing", "user_id": user_id,
                     "name": user.get("name", "Student"),
                     "typing": bool(data.get("typing", True))},
                    skip_user=user_id,
                )
                continue

            if kind == "read":
                upto = int(data.get("upto_seq") or 0)
                if upto > 0:
                    await DEPS.db.study_groups.update_one(
                        {"group_id": group_id, "members.user_id": user_id},
                        {"$set": {"members.$.last_read_seq": upto}},
                    )
                    await DEPS.db.study_group_messages.update_many(
                        {"group_id": group_id, "seq": {"$lte": upto},
                         "read_by": {"$ne": user_id}},
                        {"$push": {"read_by": user_id}},
                    )
                    await _broadcast(
                        group_id,
                        {"event": "read", "user_id": user_id, "upto_seq": upto},
                        skip_user=user_id,
                    )
                continue

            if kind == "message":
                payload = data.get("payload") or {}
                try:
                    message = await _store_message(
                        group_id=group_id,
                        sender=user,
                        payload=payload,
                        reply_to=data.get("reply_to"),
                    )
                except HTTPException as exc:
                    await websocket.send_json({"event": "error", "detail": exc.detail})
                    continue
                await _broadcast(group_id, {"event": "message", "message": message})
                asyncio.create_task(_notify_offline_members(group, message, user_id))
                if group.get("ai_enabled") and group.get("ai_auto_answer") \
                        and message["type"] == "question":
                    asyncio.create_task(
                        _answer_with_ai(group_id, message["text"], message, group)
                    )
                continue

            if kind == "ask_ai":
                question = _clean(data.get("question"), 1500)
                if question:
                    asyncio.create_task(_answer_with_ai(group_id, question, None, group))
                continue

    except WebSocketDisconnect:
        pass
    except Exception as exc:  # pragma: no cover - connection level errors
        logger.debug(f"group socket error ({group_id}/{user_id}): {exc}")
    finally:
        became_offline = await hub.leave(group_id, user_id, websocket)
        if became_offline:
            await _broadcast(
                group_id,
                {"event": "presence", "user_id": user_id,
                 "name": user.get("name", "Student"),
                 "online": False, "online_users": hub.online_members(group_id)},
            )

