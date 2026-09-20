"""
GC AI engine - the reasoning pipeline that makes the assistant resilient.

Pipeline (each step is a safety net for the one before it):

    question
      1. NLP understanding        -> intent, subject, keywords
      2. Local deterministic      -> greetings, platform help, math, study plans
      3. Knowledge base recall    -> instant, offline, learned memories
      4. LLM reasoning            -> multi-provider chain (OpenRouter + others)
      5. Google / web research    -> search, read, answer, LEARN
      6. Offline synthesis        -> extractive answer from what it read/known

Whatever produced the answer, the result is written back to the knowledge
base, so GC AI keeps getting faster and less dependent on any single API.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Callable, Dict, List, Optional

from . import text as nlp
from .knowledge import KnowledgeBase
from .llm import ProviderChain
from .search import WebSearcher
from . import seed as seed_data

logger = logging.getLogger("gcsmart.gc_ai.engine")

# Retrieval thresholds. Above STRONG we answer straight from memory.
STRONG_MATCH = 0.50
WEAK_MATCH = 0.30

KNOWLEDGE_MODE = "knowledge"
REASONING_MODE = "reasoning"
WEB_MODE = "web"
OFFLINE_MODE = "offline"
LOCAL_MODE = "local"
WEB_READING_MODE = "web_reading"

MODE_LABELS = {
    KNOWLEDGE_MODE: "GC AI knowledge base",
    REASONING_MODE: "GC AI reasoning",
    WEB_MODE: "Learned from the web",
    WEB_READING_MODE: "Read from live web sources",
    LOCAL_MODE: "GC AI offline tutor",
    OFFLINE_MODE: "GC AI offline mode",
}


@dataclass
class AIAnswer:
    text: str
    mode: str = REASONING_MODE
    sources: List[Dict] = field(default_factory=list)
    confidence: float = 0.6
    intent: str = "general_question"
    intent_confidence: float = 0.0
    subject: str = "General"
    learned: bool = False
    learned_id: Optional[str] = None
    provider: str = ""
    knowledge_used: List[Dict] = field(default_factory=list)
    related: List[str] = field(default_factory=list)
    elapsed_ms: int = 0
    providers_tried: List[str] = field(default_factory=list)

    @property
    def mode_label(self) -> str:
        return MODE_LABELS.get(self.mode, self.mode)

    def as_dict(self) -> Dict:
        return {
            "answer": self.text,
            "mode": self.mode,
            "mode_label": self.mode_label,
            "sources": self.sources,
            "confidence": round(self.confidence, 3),
            "intent": self.intent,
            "intent_confidence": self.intent_confidence,
            "subject": self.subject,
            "learned": self.learned,
            "learned_id": self.learned_id,
            "provider": self.provider,
            "knowledge_used": self.knowledge_used,
            "related": self.related,
            "elapsed_ms": self.elapsed_ms,
            "providers_tried": self.providers_tried,
        }


class GCAIEngine:
    """Self-contained, self-improving assistant core for GCSHARP."""

    def __init__(
        self,
        db=None,
        math_solver: Optional[Callable[[str], Optional[str]]] = None,
        model_chain: Optional[List[str]] = None,
        enable_web: bool = True,
    ) -> None:
        self.db = db
        self.math_solver = math_solver
        self.enable_web = enable_web
        self.knowledge = KnowledgeBase(db=db)
        self.providers = ProviderChain(openrouter_models=model_chain)
        self.searcher = WebSearcher()
        self.classifier = nlp.IntentClassifier()
        self.initialized = False
        self.mode_counts: Dict[str, int] = {}
        self.learned_from_web = 0
        self.learned_from_llm = 0
        self.web_fallbacks_used = 0
        self.offline_answers = 0
        self._init_lock = asyncio.Lock()

    # ---------------------------------------------------------
    # Lifecycle
    # ---------------------------------------------------------

    async def initialize(self) -> "GCAIEngine":
        """Train the classifier, load memories and seed the offline corpus."""
        async with self._init_lock:
            if self.initialized:
                return self
            self.classifier.train(seed_data.INTENT_EXAMPLES)
            loaded = await self.knowledge.load()
            snapshot = await self.knowledge.load_state("intent_classifier")
            if snapshot:
                try:
                    self.classifier.load_state(snapshot)
                except Exception as exc:  # pragma: no cover - defensive
                    logger.warning(f"GC AI could not restore classifier snapshot: {exc}")

            seeded = 0
            if loaded == 0:
                seeded = await self._seed_curated_knowledge()
            self.initialized = True
            logger.info(
                f"GC AI ready: {len(self.classifier.labels)} intents, "
                f"{len(self.knowledge.entries)} memories "
                f"(seeded {seeded}, providers: {self.providers.configured_providers()}, "
                f"search: {self.searcher.providers()})"
            )
            return self

    async def _seed_curated_knowledge(self) -> int:
        records = [
            {
                "question": item["question"],
                "answer": item["answer"],
                "subject": item.get("subject", "General"),
                "source": "curated",
                "tags": item.get("tags", []),
                "confidence": item.get("confidence", 0.9),
            }
            for item in seed_data.CURATED_KNOWLEDGE
        ]
        return await self.knowledge.learn_many(records)

    async def save_snapshot(self) -> None:
        """Persist the learned classifier state (called after teaching)."""
        try:
            await self.knowledge.save_state("intent_classifier", self.classifier.state())
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug(f"GC AI snapshot failed: {exc}")

    async def close(self) -> None:
        await self.searcher.close()

    # ---------------------------------------------------------
    # Layer 2: local deterministic answers (no network at all)
    # ---------------------------------------------------------

    def _local_answer(self, question: str, intent: str, subject: str) -> Optional[str]:
        norm = nlp.normalize(question)
        handler = {
            "greeting": self._reply_greeting,
            "farewell": self._reply_farewell,
            "thanks": self._reply_thanks,
            "identity": self._reply_identity,
            "capabilities": self._reply_capabilities,
            "platform_help": self._reply_platform_help,
            "motivation": self._reply_motivation,
            "study_plan": self._reply_study_plan,
        }.get(intent)

        if handler is not None:
            try:
                return handler(question, subject)
            except Exception as exc:  # pragma: no cover - defensive
                logger.debug(f"GC AI local handler {intent} failed: {exc}")
                return None

        # Maths: the project's local solver first, then a built-in evaluator.
        if intent == "math_solve" or re.search(r"\d\s*[\+\-\*/^%]", norm):
            solved = self._try_math(question)
            if solved:
                return solved
        return None

    def _try_math(self, question: str) -> Optional[str]:
        if self.math_solver is not None:
            try:
                result = self.math_solver(question)
                if result:
                    return f"**Answer:** {result}\n\n_Solved with GC AI's built-in solver._"
            except Exception as exc:  # pragma: no cover - defensive
                logger.debug(f"GC AI math solver failed: {exc}")
        return self._simple_arithmetic(question)

    @staticmethod
    def _simple_arithmetic(question: str) -> Optional[str]:
        """Percentage-of and plain arithmetic, evaluated safely (no eval())."""
        norm = nlp.normalize(question)
        percent = re.search(r"(\d+(?:\.\d+)?)\s*(?:%|percent)\s*of\s*(\d+(?:\.\d+)?)", norm)
        if percent:
            pct, base = float(percent.group(1)), float(percent.group(2))
            return (
                f"**Answer:** {pct:g}% of {base:g} = **{(pct / 100) * base:g}**\n\n"
                f"Working: ({pct:g} / 100) x {base:g} = {(pct / 100) * base:g}"
            )

        expression = re.search(r"(-?\d+(?:\.\d+)?(?:\s*[\+\-\*/^]\s*-?\d+(?:\.\d+)?)+)", norm)
        if not expression:
            return None
        src = expression.group(1).replace("^", "**")
        try:
            value = _safe_eval(src)
        except Exception:
            return None
        if isinstance(value, float) and value.is_integer():
            value = int(value)
        return f"**Answer:** {expression.group(1).strip()} = **{value}**"

    # -- small deterministic responders ----------------------

    @staticmethod
    def _reply_greeting(question: str, subject: str) -> str:
        return (
            "Hello! 👋 I am **GC AI**, your exam coach for GCE O/A Level, HND and "
            "Concours.\n\n"
            "Ask me anything - a maths problem, a concept you do not understand, a "
            "past-paper question, or a study plan. If it is not something I already "
            "know, I will search the web, learn it and remember it for next time."
        )

    @staticmethod
    def _reply_farewell(question: str, subject: str) -> str:
        return (
            "Goodbye and good luck with your revision! 👋\n\n"
            "Come back any time - I remember everything we have worked on."
        )

    @staticmethod
    def _reply_thanks(question: str, subject: str) -> str:
        return "You are very welcome! 😊 Anything else you want to master before your exam?"

    @staticmethod
    def _reply_identity(question: str, subject: str) -> str:
        return (
            "I am **GC AI**, the built-in tutor of GCSHARP.\n\n"
            "I combine four things:\n"
            "1. A **knowledge base** of everything I have learned, stored in this "
            "app's database.\n"
            "2. A **NLP engine** that understands your question, its subject and "
            "your intent.\n"
            "3. **Reasoning models** (OpenRouter plus other providers) when a "
            "problem needs real thinking.\n"
            "4. **Web search** - when something is outside my knowledge, I look it "
            "up, read the sources, answer you and store what I learned.\n\n"
            "I am independent: if every AI service is down, I still answer from my "
            "own knowledge and from live web sources."
        )


    @staticmethod
    def _reply_capabilities(question: str, subject: str) -> str:
        return (
            "Here is what I can do:\n\n"
            "- **Solve mathematics** step by step (algebra, calculus, trig, "
            "matrices, statistics, probability).\n"
            "- **Explain concepts** in Physics, Chemistry, Biology, Mathematics, "
            "Economics, English, French, Computer Science, Geography and History.\n"
            "- **Search the web and learn** anything I do not already know.\n"
            "- **Build study plans**, generate quizzes and flashcards from my "
            "knowledge base, and summarise topics.\n"
            "- **Work through past-paper questions** with mark-scheme style "
            "answers.\n"
            "- **Translate** between English and French.\n"
            "- **Coach you** on exam technique, grading and careers.\n\n"
            "Just ask in your own words - formal or informal."
        )

    @staticmethod
    def _reply_platform_help(question: str, subject: str) -> str:
        return (
            "Here is how to get around GCSHARP:\n\n"
            "- **Papers**: read GCE/HND past papers, then generate worked solutions "
            "or a video walkthrough.\n"
            "- **Exam Mode**: timed practice with instant marking and XP.\n"
            "- **Study Center**: practise question-by-question by subject and year.\n"
            "- **AI Tutor**: this chat - ask anything, or use the quick actions.\n"
            "- **Analytics**: your weak and strong topics plus study time.\n"
            "- **Streaks & XP**: study daily to protect your streak; XP counts "
            "towards the leaderboard.\n"
            "- **Settings**: change subject, level, notifications and theme.\n\n"
            "Tip: tap the **GC AI Brain** button on this page to see what I have "
            "learned, search it, or teach me something new."
        )

    @staticmethod
    def _reply_motivation(question: str, subject: str) -> str:
        return (
            "Let us turn that feeling into progress. Three rules that work:\n\n"
            "1. **Shrink the task.** Do not \"study Physics\" - do 10 questions on "
            "projectiles. A task you can finish in 20 minutes beats a vague one.\n"
            "2. **Do the first five minutes badly.** Momentum comes after starting, "
            "not before.\n"
            "3. **Track visible wins.** Every topic you close out is a mark you "
            "bought for exam day.\n\n"
            "Tell me the exact topic worrying you and I will break it into a plan "
            "you can finish this week."
        )

    @staticmethod
    def _reply_study_plan(question: str, subject: str) -> str:
        topic = subject if subject and subject != "General" else "your subjects"
        days = 7
        match = re.search(r"(\d{1,2})\s*(day|week)", nlp.normalize(question))
        if match:
            count = int(match.group(1))
            days = count * 7 if match.group(2).startswith("week") else count
        days = max(3, min(days, 30))

        lines = [f"**{days}-day plan for {topic}**", ""]
        for day in range(1, days + 1):
            if day % 4 == 0:
                focus = "Full past paper under timed conditions, then mark it."
            elif day % 4 == 1:
                focus = "Re-learn 2 weak topics using active recall."
            elif day % 4 == 2:
                focus = "Past-paper questions on yesterday's topics (30 questions)."
            else:
                focus = "Redo every question you got wrong + write 10 flashcards."
            lines.append(f"**Day {day}** - 90 minutes: {focus}")
        lines += [
            "",
            "Rules: no phone during blocks, 45-minute sessions with 10-minute "
            "breaks, and finish each day by writing one line on what you learned.",
        ]
        return "\n".join(lines)


    # ---------------------------------------------------------
    # Prompt construction
    # ---------------------------------------------------------

    def _system_prompt(
        self,
        subject: str,
        grounding: str = "",
        research: str = "",
        intent: str = "general_question",
        extra: str = "",
    ) -> str:
        parts = [
            "You are GC AI, an expert, patient tutor for Cameroon students "
            "preparing for GCE Ordinary Level, GCE Advanced Level, HND and "
            f"Concours examinations. Current subject focus: {subject}.",
            "Explain step by step with clear structure. Use short paragraphs, "
            "numbered steps and markdown. Use $...$ for inline maths and $$...$$ "
            "for equations. Give worked examples and end with a short "
            "'Related topics' line when it helps revision.",
            "Be accurate and exam-focused. If you are unsure of a fact, say so "
            "plainly instead of inventing it. Never describe your internal "
            "reasoning process - output the final teaching answer only.",
        ]
        if intent in ("quiz_request", "flashcards"):
            parts.append(
                "The student wants practice material: produce exam-standard items "
                "with answers hidden in a clearly marked section at the end."
            )
        if grounding:
            parts.append(
                "Reference material already stored in the GC AI knowledge base - "
                "prefer it, correct it if it is wrong, and stay consistent with "
                "it:\n" + grounding
            )
        if research:
            parts.append(
                "Fresh web research (use it to answer, and mention the source "
                "names you relied on):\n" + research
            )
        if extra:
            parts.append(extra)
        return "\n\n".join(parts)

    @staticmethod
    def _grounding_block(matches: List) -> str:
        if not matches:
            return ""
        lines = []
        for match in matches[:4]:
            entry = match.entry
            lines.append(f"- Q: {entry.question}\n  A: {entry.answer[:900]}")
        return "\n".join(lines)

    @staticmethod
    def _history_messages(history: Optional[List[Dict]], limit: int = 6) -> List[Dict]:
        messages: List[Dict] = []
        for item in (history or [])[-limit:]:
            role = item.get("role")
            content = (item.get("content") or "").strip()
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content[:2000]})
        return messages

    # ---------------------------------------------------------
    # Layer 4: LLM reasoning
    # ---------------------------------------------------------

    async def _ask_llm(
        self,
        question: str,
        subject: str,
        intent: str,
        grounding: str = "",
        research: str = "",
        history: Optional[List[Dict]] = None,
        system_override: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ):
        system = system_override or self._system_prompt(
            subject, grounding=grounding, research=research, intent=intent
        )
        messages = self._history_messages(history)
        messages.append({"role": "user", "content": question})
        return await self.providers.chat(
            system=system, messages=messages, temperature=temperature, max_tokens=max_tokens
        )


    # ---------------------------------------------------------
    # The pipeline
    # ---------------------------------------------------------

    async def run(
        self,
        question: str,
        subject: str = "General",
        history: Optional[List[Dict]] = None,
        use_knowledge: bool = True,
        use_llm: bool = True,
        use_web: Optional[bool] = None,
        system_override: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 2000,
        learn: bool = True,
        min_knowledge_score: float = STRONG_MATCH,
    ) -> AsyncIterator[Dict]:
        """Yield SSE-ready events: status, meta, delta, done."""
        started = time.time()
        q = (question or "").strip()
        if not q:
            yield {"meta": self._meta(None, OFFLINE_MODE, started)}
            yield {"delta": "Please type a question and I will help you straight away."}
            yield {"done": True}
            return

        if not self.initialized:
            await self.initialize()

        web_allowed = self.enable_web if use_web is None else bool(use_web)

        # ---- 1. NLP understanding -------------------------------------
        yield {"status": "Understanding your question"}
        effective_subject = subject if subject and subject != "General" else nlp.detect_subject(q)
        intent, intent_conf = self.classifier.predict(q)
        keywords = nlp.keywords(q, 8)

        text: Optional[str] = None
        mode = REASONING_MODE
        sources: List[Dict] = []
        confidence = 0.6
        provider = ""
        learned_id: Optional[str] = None
        learned = False
        knowledge_used: List[Dict] = []
        related: List[str] = []

        # ---- 2. Local deterministic layer -----------------------------
        local = self._local_answer(q, intent, effective_subject)
        if local:
            text = local
            mode = LOCAL_MODE
            confidence = 0.9

        # ---- 3. Knowledge base recall ---------------------------------
        matches: List = []
        if text is None and use_knowledge:
            matches = self.knowledge.search(q, top_k=4)
            if matches:
                top = matches[0]
                knowledge_used = [
                    {
                        "entry_id": m.entry.entry_id,
                        "question": m.entry.question,
                        "score": round(m.score, 3),
                        "source": m.entry.source,
                        "source_url": m.entry.source_url,
                    }
                    for m in matches[:3]
                ]
                if top.score >= min_knowledge_score:
                    yield {"status": "Answering from my knowledge base"}
                    self.knowledge.mark_used(top.entry.entry_id)
                    text = top.entry.answer
                    mode = KNOWLEDGE_MODE
                    confidence = min(0.97, 0.55 + top.score)
                    # Surface the memory id so the UI can offer feedback on it.
                    learned_id = top.entry.entry_id
                    if top.entry.source_url:
                        sources = [{"title": top.entry.question[:80], "url": top.entry.source_url, "provider": top.entry.source}]
                    related = [m.entry.question for m in matches[1:4]]

        grounding = ""
        if matches and text is None:
            grounding = self._grounding_block(matches)
        elif matches:
            grounding = ""

        # ---- 4. LLM reasoning -----------------------------------------
        llm_error = ""
        if text is None and use_llm:
            configured = self.providers.configured_providers()
            if configured:
                yield {"status": "GC AI is thinking through your question" if not grounding else "Checking my notes and thinking"}
                resp = await self._ask_llm(
                    q,
                    effective_subject,
                    intent,
                    grounding=grounding,
                    history=history,
                    system_override=system_override,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                if resp and resp.text.strip():
                    text = resp.text
                    mode = REASONING_MODE
                    provider = resp.provider
                    confidence = 0.86 if grounding else 0.8
                    related = [m.entry.question for m in matches[1:4]]
                else:
                    llm_error = "all providers failed"
                    yield {"status": "AI models are busy - searching the web instead"}

        # ---- 5. Live web research + learning ---------------------------
        research_context = ""
        research_bundle = None
        if text is None and web_allowed:
            yield {"status": "Searching the web for this topic"}
            try:
                research_bundle = await self.searcher.research(q, limit=5, fetch_top=3)
            except Exception as exc:
                logger.warning(f"GC AI web research failed: {exc}")
                research_bundle = None

            if research_bundle is not None and research_bundle.ok:
                self.web_fallbacks_used += 1
                research_context = research_bundle.context
                sources = research_bundle.citations()
                yield {"status": "Reading my sources and composing the answer"}

                if use_llm and self.providers.configured_providers():
                    resp = await self._ask_llm(
                        q,
                        effective_subject,
                        intent,
                        grounding=grounding,
                        research=research_context,
                        history=history,
                        system_override=system_override,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                    if resp and resp.text.strip():
                        text = resp.text
                        mode = WEB_MODE
                        provider = resp.provider
                        confidence = 0.82

                if text is None:
                    # No model reachable: answer ourselves from what we read.
                    summary = nlp.summarize(research_context, max_sentences=8, query=q)
                    if summary:
                        text = self._compose_web_reading(q, summary, sources)
                        mode = WEB_READING_MODE
                        confidence = 0.62

        # ---- 6. Offline synthesis from memory --------------------------
        if text is None and matches:
            yield {"status": "Answering offline from what I already know"}
            text = self._compose_offline(q, matches)
            mode = OFFLINE_MODE
            confidence = 0.45

        # ---- 7. Never fail: helpful last resort ------------------------
        if text is None:
            self.offline_answers += 1
            text = self._compose_fallback(q, effective_subject, sources)
            mode = OFFLINE_MODE
            confidence = 0.3

        elapsed_ms = int((time.time() - started) * 1000)

        # ---- Learning: store whatever we just produced -----------------
        if learn and mode in (REASONING_MODE, WEB_MODE, WEB_READING_MODE, OFFLINE_MODE, LOCAL_MODE):
            entry = await self.knowledge.learn(
                question=q,
                answer=text,
                subject=effective_subject,
                source={
                    REASONING_MODE: "llm",
                    WEB_MODE: "web",
                    WEB_READING_MODE: "web_reading",
                    OFFLINE_MODE: "offline",
                    LOCAL_MODE: "local",
                }.get(mode, "conversation"),
                source_url=(sources[0]["url"] if sources else ""),
                tags=keywords,
                confidence=confidence,
                meta={
                    "intent": intent,
                    "provider": provider,
                    "mode": mode,
                    "llm_error": llm_error,
                },
            )
            if entry is not None:
                learned = True
                learned_id = entry.entry_id
                if mode == WEB_MODE:
                    self.learned_from_web += 1
                elif mode == REASONING_MODE:
                    self.learned_from_llm += 1

        self.mode_counts[mode] = self.mode_counts.get(mode, 0) + 1

        meta = {
            "mode": mode,
            "mode_label": MODE_LABELS.get(mode, mode),
            "subject": effective_subject,
            "intent": intent,
            "intent_confidence": intent_conf,
            "confidence": round(confidence, 3),
            "provider": provider,
            "sources": sources,
            "knowledge_used": knowledge_used,
            "related": related,
            "learned": learned,
            "learned_id": learned_id,
            "elapsed_ms": elapsed_ms,
            "providers_tried": self.providers.provider_report(),
            "web_searched": bool(research_context),
        }
        if not use_llm and mode == OFFLINE_MODE:
            meta["note"] = "Language models were disabled for this request."

        yield {"meta": meta}
        for chunk in _chunk_text(text):
            yield {"delta": chunk}
        yield {"done": True, "session_id": None}

    def _meta(self, *args, **kwargs) -> Dict:  # pragma: no cover - kept for clarity
        return {"mode": OFFLINE_MODE, "mode_label": MODE_LABELS[OFFLINE_MODE]}

    # ---------------------------------------------------------
    # Answer composers (used when no model is reachable)
    # ---------------------------------------------------------

    @staticmethod
    def _compose_web_reading(question: str, summary: str, sources: List[Dict]) -> str:
        body = [
            f"**Here is what I found on the web for:** _{question}_",
            "",
            summary,
        ]
        if sources:
            body += ["", "**Sources I read**"]
            for src in sources[:4]:
                title = src.get("title") or src.get("url")
                body.append(f"- [{title}]({src.get('url')})")
        body += [
            "",
            "---",
            "_I saved this answer in my knowledge base, so next time it will be "
            "instant and I will not need the web._",
        ]
        return "\n".join(body)

    @staticmethod
    def _compose_offline(question: str, matches: List) -> str:
        lines = [f"**What I know about:** _{question}_", ""]
        best = matches[0]
        lines.append(f"### {best.entry.question}")
        lines.append(best.entry.answer)
        if len(matches) > 1:
            lines += ["", "### Related things I have learned"]
            for match in matches[1:4]:
                snippet = nlp.summarize(match.entry.answer, max_sentences=2, query=question)
                lines.append(f"- **{match.entry.question}** - {snippet[:280]}")
        lines += [
            "",
            "---",
            "_This came from my own knowledge base while the AI models and web "
            "search were unavailable. Ask a follow-up and I will go deeper._",
        ]
        return "\n".join(lines)

    def _compose_fallback(self, question: str, subject: str, sources: List[Dict]) -> str:
        topic = subject if subject != "General" else "your subjects"
        lines = [
            f"I could not fully work that one out right now: _{question}_",
            "",
            "Here is what is available to you immediately:",
            "",
            "- **Try me again in a few seconds** - I retry every AI provider, then "
            "the web, then my own memory, so a second attempt often lands.",
            "- **Rephrase it slightly** (for example \"explain the mole concept\" "
            "or \"solve 2x + 5 = 15\") and I will route it more precisely.",
            f"- **Use my knowledge base** - open the **GC AI Brain** panel to see "
            f"everything I already know about {topic}.",
        ]
        if sources:
            lines += ["", "**Sources I did reach**"]
            for src in sources[:3]:
                lines.append(f"- [{src.get('title') or src.get('url')}]({src.get('url')})")
        known = self.knowledge.recent(3)
        if known:
            lines += ["", "**Recently learned topics**"]
            for item in known:
                lines.append(f"- {item['question']}")
        lines += [
            "",
            "_You can also teach me: open **GC AI Brain -> Teach GC AI** and paste "
            "the correct answer. I will remember it permanently._",
        ]
        return "\n".join(lines)


    # ---------------------------------------------------------
    # Public API
    # ---------------------------------------------------------

    async def answer(
        self,
        question: str,
        subject: str = "General",
        history: Optional[List[Dict]] = None,
        **kwargs,
    ) -> AIAnswer:
        """Run the full pipeline and return the assembled answer."""
        started = time.time()
        meta: Dict = {}
        chunks: List[str] = []
        async for event in self.run(question, subject=subject, history=history, **kwargs):
            if "meta" in event:
                meta = event["meta"]
            elif "delta" in event:
                chunks.append(event["delta"])

        return AIAnswer(
            text="".join(chunks),
            mode=meta.get("mode", REASONING_MODE),
            sources=meta.get("sources", []),
            confidence=float(meta.get("confidence", 0.5)),
            intent=meta.get("intent", "general_question"),
            intent_confidence=float(meta.get("intent_confidence", 0.0)),
            subject=meta.get("subject", subject),
            learned=bool(meta.get("learned")),
            learned_id=meta.get("learned_id"),
            provider=meta.get("provider", ""),
            knowledge_used=meta.get("knowledge_used", []),
            related=meta.get("related", []),
            elapsed_ms=int(meta.get("elapsed_ms") or (time.time() - started) * 1000),
        )

    async def teach(
        self,
        question: str,
        answer: str,
        subject: str = "General",
        tags: Optional[List[str]] = None,
        intent: str = "general_question",
    ) -> Optional[Dict]:
        """Explicitly teach GC AI a fact (used by the GC AI Brain panel)."""
        entry = await self.knowledge.learn(
            question=question,
            answer=answer,
            subject=subject if subject and subject != "General" else nlp.detect_subject(question),
            source="user_taught",
            tags=tags or nlp.keywords(question, 8),
            confidence=0.95,
        )
        # The utterance itself also improves intent routing over time.
        self.classifier.learn(intent, question)
        await self.save_snapshot()
        return entry.as_public() if entry else None

    async def feedback(self, entry_id: str, helpful: bool, note: str = "") -> Optional[Dict]:
        entry = await self.knowledge.record_feedback(entry_id, helpful, note=note)
        return entry.as_public() if entry else None

    async def research(self, query: str, limit: int = 5, fetch_top: int = 3) -> Dict:
        bundle = await self.searcher.research(query, limit=limit, fetch_top=fetch_top)
        payload = bundle.as_dict()
        payload["context_preview"] = bundle.context[:1500]
        return payload

    def stats(self) -> Dict:
        return {
            "initialized": self.initialized,
            "intents": len(self.classifier.labels),
            "intent_labels": self.classifier.labels,
            "knowledge": self.knowledge.stats(),
            "providers": self.providers.report(),
            "search": {
                "providers": self.searcher.providers(),
                "google_configured": self.searcher.google_enabled,
                **self.searcher.stats,
            },
            "learning": {
                "learned_from_llm": self.learned_from_llm,
                "learned_from_web": self.learned_from_web,
                "web_fallbacks_used": self.web_fallbacks_used,
                "offline_answers": self.offline_answers,
            },
            "answer_modes": dict(self.mode_counts),
        }

    def health(self) -> Dict:
        return {
            "ready": self.initialized,
            "independent_of_any_single_api": True,
            "llm_providers_configured": [p["name"] for p in self.providers.providers],
            "llm_providers_available": self.providers.configured_providers(),
            "can_answer_offline": len(self.knowledge.entries) > 0,
            "web_search_enabled": self.enable_web,
            "web_search_providers": self.searcher.providers(),
            "google_search_configured": self.searcher.google_enabled,
            "knowledge_memories": len(self.knowledge.entries),
            "verdict": (
                "GC AI can answer with no external service (knowledge base + NLP)."
                if self.knowledge.entries
                else "Knowledge base is empty - it seeds itself on the first request."
            ),
        }


# ============================================================
# Module helpers
# ============================================================

def _chunk_text(text: str, size: int = 48) -> List[str]:
    """Split text into stream-friendly chunks, preferring word boundaries."""
    if not text:
        return []
    words = text.split(" ")
    chunks: List[str] = []
    buffer = ""
    for word in words:
        if len(buffer) + len(word) + 1 > size and buffer:
            chunks.append(buffer)
            buffer = word
        else:
            buffer = f"{buffer} {word}".strip()
    if buffer:
        chunks.append(buffer)
    # Put the spaces back so the client reassembles the original text exactly.
    return [chunk + " " for chunk in chunks[:-1]] + [chunks[-1]]


_MATH_ALLOWED = re.compile(r"^[0-9\.\s\+\-\*/\(\)\*]+$")


def _safe_eval(expression: str) -> float:
    """Evaluate a plain arithmetic expression without using eval()."""
    if not _MATH_ALLOWED.match(expression):
        raise ValueError("unsupported expression")
    import ast

    node = ast.parse(expression, mode="eval")

    def _walk(item):
        if isinstance(item, ast.Expression):
            return _walk(item.body)
        if isinstance(item, ast.BinOp):
            left, right = _walk(item.left), _walk(item.right)
            if isinstance(item.op, ast.Add):
                return left + right
            if isinstance(item.op, ast.Sub):
                return left - right
            if isinstance(item.op, ast.Mult):
                return left * right
            if isinstance(item.op, ast.Div):
                return left / right
            if isinstance(item.op, ast.Pow):
                return left ** right
            raise ValueError("unsupported operator")
        if isinstance(item, ast.UnaryOp):
            operand = _walk(item.operand)
            return -operand if isinstance(item.op, ast.USub) else operand
        if isinstance(item, ast.Constant) and isinstance(item.value, (int, float)):
            return item.value
        raise ValueError("unsupported expression element")

    return _walk(node)


# ============================================================
# Singleton accessor used by the FastAPI layer
# ============================================================

_ENGINE: Optional[GCAIEngine] = None


def get_engine() -> Optional[GCAIEngine]:
    return _ENGINE


async def init_engine(
    db=None,
    math_solver: Optional[Callable[[str], Optional[str]]] = None,
    model_chain: Optional[List[str]] = None,
    enable_web: bool = True,
) -> GCAIEngine:
    """Create (once) and initialise the shared GC AI engine."""
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = GCAIEngine(
            db=db,
            math_solver=math_solver,
            model_chain=model_chain,
            enable_web=enable_web,
        )
    await _ENGINE.initialize()
    return _ENGINE
