"""
GC AI knowledge base.

Every question GC AI answers (from the local corpus, from an LLM or from the
open web) is stored as a *learned memory*: the question, its normalised form,
the answer, where it came from, how confident we are and how useful students
found it.

Storage layout:

  * MongoDB collection ``gc_ai_knowledge`` (durable, survives restarts)
  * an in-process TF-IDF + hashed vector index for instant retrieval

If MongoDB is unreachable the knowledge base degrades gracefully to purely
in-process memory, so GC AI never stops learning within a running instance.
"""

from __future__ import annotations

import hashlib
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from . import text as nlp

logger = logging.getLogger("gcsmart.gc_ai.knowledge")

COLLECTION = "gc_ai_knowledge"
META_COLLECTION = "gc_ai_meta"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fingerprint(question: str) -> str:
    """Stable identity for a question so repeated asks update one memory."""
    norm = re.sub(r"[^a-z0-9 ]+", " ", nlp.normalize(question))
    norm = " ".join(sorted(nlp.tokenize(norm))) or norm.strip()
    return hashlib.sha1(norm.encode("utf-8", "ignore")).hexdigest()


@dataclass
class KnowledgeEntry:
    entry_id: str
    question: str
    answer: str
    subject: str = "General"
    source: str = "conversation"
    source_url: str = ""
    tags: List[str] = field(default_factory=list)
    confidence: float = 0.7
    language: str = "en"
    times_used: int = 0
    helpful: int = 0
    not_helpful: int = 0
    fingerprint: str = ""
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)
    meta: Dict = field(default_factory=dict)

    def to_doc(self) -> Dict:
        doc = dict(self.__dict__)
        return doc

    @classmethod
    def from_doc(cls, doc: Dict) -> "KnowledgeEntry":
        doc = dict(doc or {})
        doc.pop("_id", None)
        known = {f for f in cls.__dataclass_fields__}  # type: ignore[attr-defined]
        clean = {k: v for k, v in doc.items() if k in known}
        clean.setdefault("entry_id", f"kb_{uuid.uuid4().hex[:12]}")
        clean.setdefault("question", "")
        clean.setdefault("answer", "")
        return cls(**clean)  # type: ignore[arg-type]

    def searchable_text(self) -> str:
        return f"{self.question}\n{self.question}\n{self.answer}\n{self.subject}\n{' '.join(self.tags)}"

    def as_public(self) -> Dict:
        return {
            "entry_id": self.entry_id,
            "question": self.question,
            "answer": self.answer,
            "subject": self.subject,
            "source": self.source,
            "source_url": self.source_url,
            "tags": self.tags,
            "confidence": round(self.confidence, 3),
            "times_used": self.times_used,
            "helpful": self.helpful,
            "not_helpful": self.not_helpful,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass
class KnowledgeMatch:
    entry: KnowledgeEntry
    score: float


class KnowledgeBase:
    """Hybrid (MongoDB + in-memory index) long term memory for GC AI."""

    def __init__(self, db=None, max_memories: int = 20000, vector_dims: int = 1024) -> None:
        self.db = db
        self.max_memories = max_memories
        self.vector_dims = vector_dims
        self.entries: Dict[str, KnowledgeEntry] = {}
        self.by_fingerprint: Dict[str, str] = {}
        self._index = nlp.TfidfIndex()
        self._vectors: Dict[str, Dict[int, float]] = {}
        self.persistent = False
        self.loaded = False
        self.learned_this_run = 0
        self.hits = 0
        self.misses = 0

    # ---------------------------------------------------------
    # Persistence
    # ---------------------------------------------------------

    async def load(self, limit: int = 8000) -> int:
        """Pull the stored memories into memory and build the vector index."""
        if self.db is None:
            self.loaded = True
            return 0
        try:
            cursor = self.db[COLLECTION].find({}, {"_id": 0}).sort("updated_at", -1).limit(limit)
            docs = await cursor.to_list(length=limit)
        except Exception as exc:
            logger.warning(f"GC AI knowledge base unavailable, running in-memory only: {exc}")
            self.loaded = True
            return 0

        for doc in docs:
            entry = KnowledgeEntry.from_doc(doc)
            self._insert_memory(entry)
        self.persistent = True
        self.loaded = True
        logger.info(f"GC AI knowledge base loaded {len(self.entries)} memories from MongoDB")
        return len(self.entries)

    async def save_state(self, key: str, value: Dict) -> None:
        """Persist engine metadata (classifier snapshot, counters, ...)."""
        if self.db is None:
            return
        try:
            await self.db[META_COLLECTION].update_one(
                {"key": key},
                {"$set": {"key": key, "value": value, "updated_at": _now()}},
                upsert=True,
            )
        except Exception as exc:
            logger.debug(f"GC AI meta save failed for {key}: {exc}")

    async def load_state(self, key: str) -> Optional[Dict]:
        if self.db is None:
            return None
        try:
            doc = await self.db[META_COLLECTION].find_one({"key": key}, {"_id": 0})
            return (doc or {}).get("value")
        except Exception as exc:
            logger.debug(f"GC AI meta load failed for {key}: {exc}")
            return None

    # ---------------------------------------------------------
    # Index maintenance
    # ---------------------------------------------------------

    def _insert_memory(self, entry: KnowledgeEntry) -> None:
        if not entry.fingerprint:
            entry.fingerprint = _fingerprint(entry.question)
        self.entries[entry.entry_id] = entry
        self.by_fingerprint[entry.fingerprint] = entry.entry_id
        self._index.add(entry.entry_id, entry.searchable_text())
        self._vectors[entry.entry_id] = nlp.hashing_vector(
            entry.searchable_text(), dims=self.vector_dims
        )

    def _evict_if_needed(self) -> None:
        if len(self.entries) <= self.max_memories:
            return
        # Drop the weakest, least used memories (keep curated / user taught).
        ranked = sorted(
            self.entries.values(),
            key=lambda e: (
                e.source in ("user_taught", "seed", "curated"),
                e.helpful - e.not_helpful,
                e.confidence,
                e.updated_at,
            ),
        )
        for entry in ranked[: max(1, len(self.entries) - self.max_memories)]:
            self.remove(entry.entry_id)

    # ---------------------------------------------------------
    # Learning
    # ---------------------------------------------------------

    async def learn(
        self,
        question: str,
        answer: str,
        subject: str = "General",
        source: str = "conversation",
        source_url: str = "",
        tags: Optional[List[str]] = None,
        confidence: float = 0.7,
        meta: Optional[Dict] = None,
    ) -> Optional[KnowledgeEntry]:
        """Store (or upgrade) a memory. Returns the entry, or None if rejected."""
        question = (question or "").strip()
        answer = (answer or "").strip()
        if len(question) < 3 or len(answer) < 8:
            return None
        # Never memorise our own failure notices.
        low = answer.lower()
        if "trouble reaching the ai" in low or "couldn't reach the ai" in low:
            return None

        fingerprint = _fingerprint(question)
        existing_id = self.by_fingerprint.get(fingerprint)
        tags = tags or nlp.keywords(question, 8)
        if not subject or subject == "General":
            subject = nlp.detect_subject(question)

        if existing_id and existing_id in self.entries:
            entry = self.entries[existing_id]
            # Prefer richer / more confident answers.
            if len(answer) > len(entry.answer) or confidence >= entry.confidence:
                entry.answer = answer
                entry.source = source or entry.source
                entry.source_url = source_url or entry.source_url
                entry.confidence = max(entry.confidence, confidence)
                entry.tags = sorted(set(entry.tags) | set(tags))
                entry.updated_at = _now()
                self._index.add(entry.entry_id, entry.searchable_text())
                self._vectors[entry.entry_id] = nlp.hashing_vector(
                    entry.searchable_text(), dims=self.vector_dims
                )
                await self._persist(entry, update=True)
            return entry

        entry = KnowledgeEntry(
            entry_id=f"kb_{uuid.uuid4().hex[:12]}",
            question=question,
            answer=answer,
            subject=subject,
            source=source,
            source_url=source_url,
            tags=tags,
            confidence=max(0.05, min(0.99, confidence)),
            fingerprint=fingerprint,
            meta=meta or {},
        )
        self._insert_memory(entry)
        self._evict_if_needed()
        self.learned_this_run += 1
        await self._persist(entry, update=False)
        return entry

    async def _persist(self, entry: KnowledgeEntry, update: bool = False) -> None:
        if self.db is None:
            return
        try:
            doc = entry.to_doc()
            if update:
                await self.db[COLLECTION].update_one(
                    {"entry_id": entry.entry_id}, {"$set": doc}, upsert=True
                )
            else:
                await self.db[COLLECTION].update_one(
                    {"entry_id": entry.entry_id}, {"$set": doc}, upsert=True
                )
            self.persistent = True
        except Exception as exc:
            logger.debug(f"GC AI could not persist memory {entry.entry_id}: {exc}")

    async def learn_many(self, records: List[Dict]) -> int:
        count = 0
        for record in records:
            entry = await self.learn(**record)
            if entry:
                count += 1
        return count

    # ---------------------------------------------------------
    # Retrieval
    # ---------------------------------------------------------

    def search(self, query: str, top_k: int = 5, min_score: float = 0.22) -> List[KnowledgeMatch]:
        """Hybrid retrieval: TF-IDF cosine + hashed vector cosine."""
        if not self.entries:
            self.misses += 1
            return []
        lexical = dict(self._index.search(query, top_k=max(top_k * 3, 12), min_score=0.02))
        qvec = nlp.hashing_vector(query, dims=self.vector_dims)

        candidates = set(lexical)
        # Hashed-vector sweep keeps working for typos / paraphrases.
        if len(self.entries) <= 6000:
            for entry_id in list(self._vectors)[:6000]:
                candidates.add(entry_id)

        matches: List[KnowledgeMatch] = []
        for entry_id in candidates:
            entry = self.entries.get(entry_id)
            if entry is None:
                continue
            lex = lexical.get(entry_id, 0.0)
            dense = nlp.cosine_sparse(qvec, self._vectors.get(entry_id, {}))
            coverage = nlp.answer_overlap(query, entry.question)
            score = 0.45 * lex + 0.35 * dense + 0.20 * coverage
            score *= 0.85 + 0.3 * entry.confidence
            if entry.helpful:
                score *= 1.0 + min(0.15, 0.03 * entry.helpful)
            if entry.not_helpful:
                score *= max(0.6, 1.0 - 0.08 * entry.not_helpful)
            if score >= min_score:
                matches.append(KnowledgeMatch(entry=entry, score=score))

        matches.sort(key=lambda m: m.score, reverse=True)
        if matches:
            self.hits += 1
        else:
            self.misses += 1
        return matches[:top_k]

    def search_sync(self, query: str, top_k: int = 5, min_score: float = 0.1) -> List[KnowledgeMatch]:
        return self.search(query, top_k=top_k, min_score=min_score)

    def mark_used(self, entry_id: str) -> None:
        entry = self.entries.get(entry_id)
        if entry:
            entry.times_used += 1

    async def record_feedback(self, entry_id: str, helpful: bool, note: str = "") -> Optional[KnowledgeEntry]:
        entry = self.entries.get(entry_id)
        if entry is None:
            return None
        if helpful:
            entry.helpful += 1
            entry.confidence = min(0.99, entry.confidence + 0.05)
        else:
            entry.not_helpful += 1
            entry.confidence = max(0.05, entry.confidence - 0.15)
        entry.updated_at = _now()
        if note:
            entry.meta = {**(entry.meta or {}), "last_feedback": note[:400]}
        await self._persist(entry, update=True)
        return entry

    def remove(self, entry_id: str) -> bool:
        entry = self.entries.pop(entry_id, None)
        if entry is None:
            return False
        self._index.remove(entry_id)
        self._vectors.pop(entry_id, None)
        if self.by_fingerprint.get(entry.fingerprint) == entry_id:
            self.by_fingerprint.pop(entry.fingerprint, None)
        return True

    async def delete(self, entry_id: str) -> bool:
        removed = self.remove(entry_id)
        if removed and self.db is not None:
            try:
                await self.db[COLLECTION].delete_one({"entry_id": entry_id})
            except Exception as exc:
                logger.debug(f"GC AI delete failed for {entry_id}: {exc}")
        return removed

    async def clear(self, keep_curated: bool = True) -> int:
        targets = [
            e.entry_id
            for e in self.entries.values()
            if not (keep_curated and e.source in ("seed", "curated", "user_taught"))
        ]
        for entry_id in targets:
            await self.delete(entry_id)
        return len(targets)

    # ---------------------------------------------------------
    # Reporting
    # ---------------------------------------------------------

    def recent(self, limit: int = 25) -> List[Dict]:
        items = sorted(self.entries.values(), key=lambda e: e.updated_at, reverse=True)
        return [e.as_public() for e in items[:limit]]

    def top(self, limit: int = 10) -> List[Dict]:
        items = sorted(self.entries.values(), key=lambda e: e.times_used, reverse=True)
        return [e.as_public() for e in items[:limit]]

    def by_source(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for entry in self.entries.values():
            counts[entry.source] = counts.get(entry.source, 0) + 1
        return counts

    def stats(self) -> Dict:
        total = len(self.entries)
        helpful = sum(e.helpful for e in self.entries.values())
        avg_conf = round(sum(e.confidence for e in self.entries.values()) / total, 3) if total else 0.0
        return {
            "memories": total,
            "learned_this_run": self.learned_this_run,
            "persistent": self.persistent,
            "storage": "mongodb" if self.db is not None else "memory",
            "retrieval_hits": self.hits,
            "retrieval_misses": self.misses,
            "hit_rate": round(self.hits / max(self.hits + self.misses, 1), 3),
            "average_confidence": avg_conf,
            "student_helpful_votes": helpful,
            "by_source": self.by_source(),
        }
