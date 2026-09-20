"""Smoke test for the Study Groups router (routes + WS + hub logic).

Run from the backend folder:

    python tests/study_groups_smoke.py

Imports server_working inside a running event loop, checks every REST route and
the WebSocket route are mounted, then exercises the in-process hub directly
(broadcast, presence and last-socket detection) with no database needed.
"""
import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


class FakeSocket:
    """Minimal stand-in for a Starlette websocket."""

    def __init__(self, name):
        self.name = name
        self.received = []
        self.closed = False

    async def send_json(self, payload):
        if self.closed:
            raise RuntimeError("socket closed")
        self.received.append(payload)


async def main() -> int:
    import server_working as server
    from study_groups import hub

    routes = {getattr(r, "path", "") for r in server.app.routes}
    expected_rest = {
        "/api/groups",
        "/api/groups/discover",
        "/api/groups/summary/badges",
        "/api/groups/{group_id}",
        "/api/groups/{group_id}/messages",
        "/api/groups/{group_id}/read",
        "/api/groups/{group_id}/typing",
        "/api/groups/{group_id}/react",
        "/api/groups/{group_id}/messages/delete",
        "/api/groups/{group_id}/join",
        "/api/groups/{group_id}/requests",
        "/api/groups/{group_id}/requests/decide",
        "/api/groups/{group_id}/candidates",
        "/api/groups/{group_id}/members",
        "/api/groups/{group_id}/members/{member_id}",
        "/api/groups/{group_id}/members/{member_id}/promote",
        "/api/groups/{group_id}/mute",
        "/api/groups/{group_id}/voice",
        "/api/groups/voice/{audio_id}",
        "/api/groups/{group_id}/papers",
        "/api/groups/{group_id}/papers/{paper_id}",
        "/api/groups/{group_id}/ai",
    }
    missing = sorted(expected_rest - routes)
    print(f"REST routes mounted: {len(expected_rest) - len(missing)}/{len(expected_rest)}")
    if missing:
        print("MISSING REST:", missing)
        return 1

    ws_present = any(
        getattr(r, "path", "") == "/api/ws/groups/{group_id}" for r in server.app.routes
    )
    print(f"WebSocket route mounted: {ws_present}")
    if not ws_present:
        return 1

    # --- hub behaviour -------------------------------------------------
    socket_a, socket_b = FakeSocket("a"), FakeSocket("b")
    await hub.join("grp_test", "user_a", socket_a)
    await hub.join("grp_test", "user_b", socket_b)
    assert hub.online_members("grp_test") == ["user_a", "user_b"]
    assert hub.is_online("user_a") and hub.is_online("user_b")

    sent = await hub.broadcast("grp_test", {"event": "message", "text": "hello"})
    print(f"broadcast reached {sent} sockets")
    assert sent == 2
    assert socket_a.received[-1]["event"] == "message"

    skipped = await hub.broadcast("grp_test", {"event": "typing"}, skip_user="user_a")
    assert skipped == 1, skipped
    assert socket_a.received[-1]["event"] == "message"  # a did not get the typing event

    last = await hub.leave("grp_test", "user_a", socket_a)
    assert last is True and not hub.is_online("user_a")
    last = await hub.leave("grp_test", "user_b", socket_b)
    assert last is True and not hub.is_online("user_b")
    print("hub fan-out, skip, presence and last-socket detection OK")

    # personal events
    socket_c = FakeSocket("c")
    await hub.join("grp_test", "user_c", socket_c)
    await hub.send_to_user("user_c", {"event": "added_to_group"})
    assert socket_c.received[-1]["event"] == "added_to_group"
    await hub.leave("grp_test", "user_c", socket_c)
    print("personal event delivery OK")

    print("STUDY GROUPS SMOKE TEST PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
