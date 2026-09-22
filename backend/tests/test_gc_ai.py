"""GC AI core regression tests (pure offline, no network, no LLM keys)."""
import asyncio
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from gc_ai import text as nlp                      # noqa: E402
from gc_ai import seed as seed_data                # noqa: E402
from gc_ai.engine import (                                      # noqa: E402
    GCAIEngine, _safe_eval, _chunk_text,
    _is_real_smalltalk, _forced_smalltalk_intent,
)
from gc_ai.knowledge import KnowledgeBase          # noqa: E402


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@pytest.fixture(scope="module")
def engine():
    eng = GCAIEngine(db=None, enable_web=False)
    run(eng.initialize())
    return eng


# ---------------------------------------------------------------- NLP layer

class TestTextTools:
    def test_tokenize_stems_and_drops_stopwords(self):
        tokens = nlp.tokenize("What is the derivative of the quadratic equation?")
        assert "quadratic" in tokens
        assert "equation" in tokens
        assert "the" not in tokens

    def test_stemmer_normalises_plurals(self):
        assert nlp.stem("vectors") == nlp.stem("vector")
        assert nlp.stem("reactions") == nlp.stem("reaction")
        assert nlp.stem("studies") == nlp.stem("study")

    def test_abbreviations_are_expanded(self):
        assert "general certificate of education" in nlp.normalize("GCE past papers")
        assert "mathematics" in nlp.normalize("my maths homework")

    def test_subject_detection(self):
        assert nlp.detect_subject("state newtons second law of motion") == "Physics"
        assert nlp.detect_subject("what is a mole in titration") == "Chemistry"
        assert nlp.detect_subject("solve the quadratic equation") == "Mathematics"

    def test_summarize_prefers_query_relevant_sentences(self):
        body = (
            "Cameroon is a country in Central Africa. "
            "The capital is Yaounde. "
            "Photosynthesis converts light into glucose. "
            "Chlorophyll absorbs light energy. "
            "Douala is the economic capital."
        )
        summary = nlp.summarize(body, max_sentences=2, query="photosynthesis chlorophyll")
        assert "Photosynthesis" in summary or "Chlorophyll" in summary

    def test_hashing_vector_matches_paraphrase(self):
        a = nlp.hashing_vector("solve for x in the equation 2x + 4 = 10")
        b = nlp.hashing_vector("find the value of x in 2x + 4 = 10")
        c = nlp.hashing_vector("the history of the roman empire")
        assert nlp.cosine_sparse(a, b) > nlp.cosine_sparse(a, c)


class TestIntentClassifier:
    def test_trains_on_seed_corpus(self, engine):
        assert len(engine.classifier.labels) >= 15

    @pytest.mark.parametrize("phrase,expected", [
        ("solve for x 3x + 2 = 11", "math_solve"),
        ("who are you", "identity"),
        ("make a study plan for me", "study_plan"),
        ("thanks a lot", "thanks"),
        ("i failed my mock exam", "motivation"),
    ])
    def test_predicts_expected_intent(self, engine, phrase, expected):
        label, confidence = engine.classifier.predict(phrase)
        assert label == expected
        assert confidence > 0.5

    @pytest.mark.parametrize("phrase", [
        "bye",
        "goodbye and good luck",
        "ok bye, see you tomorrow",
        "hello",
    ])
    def test_real_smalltalk_still_routed_to_smalltalk(self, engine, phrase):
        label, _confidence = engine.classifier.predict(phrase)
        assert label in {"greeting", "farewell", "thanks"}

    @pytest.mark.parametrize("phrase", [
        "(a) (i) List eight (8) characteristics common to insects.",
        "State five reasons why farmers should plant legumes.",
        "Outline the stages of mitosis and describe each one.",
        "With the aid of a diagram, describe the digestive system.",
    ])
    def test_exam_style_questions_never_route_to_smalltalk(self, engine, phrase):
        label, _confidence = engine.classifier.predict(phrase)
        assert label not in {"greeting", "farewell", "thanks", "identity"}

    def test_out_of_vocabulary_text_gives_general_with_zero_confidence(self, engine):
        label, confidence = engine.classifier.predict("zzqwx sploinb frumplekit")
        assert label == "general_question"
        assert confidence == 0.0


# ---------------------------------------------------------- Knowledge base

class TestKnowledgeBase:
    def test_learns_and_retrieves(self):
        kb = KnowledgeBase(db=None)
        run(kb.learn("what is photosynthesis", "Plants convert light to glucose.", subject="Biology"))
        matches = kb.search("explain photosynthesis to me", top_k=3)
        assert matches
        assert matches[0].entry.subject == "Biology"

    def test_never_stores_failure_notices(self):
        kb = KnowledgeBase(db=None)
        entry = run(kb.learn(
            "some question",
            "I'm having trouble reaching the AI service right now.",
        ))
        assert entry is None

    def test_duplicate_question_updates_single_memory(self):
        kb = KnowledgeBase(db=None)
        run(kb.learn("define momentum", "Momentum is mass times velocity.", subject="Physics"))
        run(kb.learn(
            "define momentum",
            "Momentum is the product of mass and velocity, a vector quantity.",
            subject="Physics",
        ))
        assert len(kb.entries) == 1
        assert "vector" in next(iter(kb.entries.values())).answer

    def test_feedback_adjusts_confidence(self):
        kb = KnowledgeBase(db=None)
        entry = run(kb.learn("what is ohms law", "V = IR, valid at constant temperature."))
        before = entry.confidence
        run(kb.record_feedback(entry.entry_id, helpful=True))
        assert entry.confidence > before


# ------------------------------------------------------------- The engine

class TestEngineOffline:
    def test_seeds_curated_knowledge(self, engine):
        assert len(engine.knowledge.entries) >= 15

    def test_greeting_answered_locally(self, engine):
        answer = run(engine.answer("hi there", use_llm=False, use_web=False))
        assert answer.mode == "local"
        assert "GC AI" in answer.text

    def test_percentage_math_answered_locally(self, engine):
        answer = run(engine.answer("what is 15 percent of 240", use_llm=False, use_web=False))
        assert answer.mode == "local"
        assert "36" in answer.text

    def test_known_fact_answered_from_knowledge_base(self, engine):
        answer = run(engine.answer(
            "state newton's laws of motion", subject="Physics", use_llm=False, use_web=False
        ))
        assert answer.mode == "knowledge"
        assert "First Law" in answer.text

    def test_unknown_question_never_returns_bare_failure(self, engine):
        answer = run(engine.answer(
            "explain the zurich quantum flux capacitor of 1997",
            use_llm=False, use_web=False,
        ))
        assert answer.text.strip()
        assert "trouble reaching the ai" not in answer.text.lower()
        assert answer.mode in ("offline", "knowledge", "local")

    def test_answer_is_learned_for_next_time(self, engine):
        question = "what is the zurich flux constant"
        first = run(engine.answer(question, use_llm=False, use_web=False))
        assert first.learned is True
        second = run(engine.answer(question, use_llm=False, use_web=False))
        assert second.mode in ("knowledge", "offline")
        assert second.learned_id == first.learned_id

    def test_stream_emits_meta_then_deltas(self, engine):
        events = []

        async def collect():
            async for event in engine.run("hello", use_llm=False, use_web=False):
                events.append(event)

        run(collect())
        kinds = [list(event.keys())[0] for event in events]
        assert "status" in kinds
        assert "meta" in kinds
        assert "delta" in kinds
        assert "done" in kinds
        joined = "".join(event.get("delta", "") for event in events)
        assert "GC AI" in joined

    def test_teach_persists_a_memory(self, engine):
        entry = run(engine.teach(
            "what is the gcsharp marking scheme",
            "Marks are awarded for method, accuracy and correct units.",
            subject="General",
        ))
        assert entry and entry["source"] == "user_taught"
        matches = engine.knowledge.search("gcsharp marking scheme")
        assert any(m.entry.entry_id == entry["entry_id"] for m in matches)

    def test_stats_reports_layers(self, engine):
        stats = engine.stats()
        assert stats["knowledge"]["memories"] >= 15
        assert "providers" in stats
        assert "search" in stats
        assert stats["intents"] >= 15
        health = engine.health()
        assert health["ready"] is True
        assert health["independent_of_any_single_api"] is True
        assert health["knowledge_memories"] >= 15


class TestExamQuestionSafety:
    """Regression: exam questions must never be answered with smalltalk."""

    def test_insect_exam_question_gets_substantive_answer(self, engine):
        answer = run(engine.answer(
            "(a) (i) List eight (8) characteristics common to insects.",
            use_llm=False, use_web=False,
        ))
        assert answer.text.strip()
        assert "Goodbye" not in answer.text
        assert answer.intent not in {"greeting", "farewell", "thanks"}

    def test_real_farewell_still_gets_the_farewell_reply(self, engine):
        answer = run(engine.answer("ok bye, see you tomorrow", use_llm=False, use_web=False))
        assert answer.intent == "farewell"
        assert "Goodbye" in answer.text

    def test_real_greeting_still_gets_the_greeting_reply(self, engine):
        answer = run(engine.answer("hi there", use_llm=False, use_web=False))
        assert answer.intent == "greeting"
        assert "Hello" in answer.text

    def test_smalltalk_gate_helpers(self):
        assert _is_real_smalltalk("bye") is True
        assert _is_real_smalltalk("thanks a lot") is True
        assert _is_real_smalltalk(
            "(a) (i) List eight characteristics common to insects."
        ) is False
        assert _forced_smalltalk_intent("ok bye, see you tomorrow") == "farewell"
        assert _forced_smalltalk_intent("goodbye and good luck") == "farewell"
        assert _forced_smalltalk_intent("take care") == "farewell"
        assert _forced_smalltalk_intent("thanks a lot") == "thanks"
        assert _forced_smalltalk_intent("good morning") == "greeting"
        assert _forced_smalltalk_intent(
            "list eight characteristics common to insects"
        ) is None
        assert _forced_smalltalk_intent("what is climate change") is None


class TestHelpers:
    def test_safe_eval(self):
        assert _safe_eval("2 + 3 * 4") == 14
        assert _safe_eval("(2 + 3) * 4") == 20

    def test_safe_eval_rejects_code(self):
        with pytest.raises(ValueError):
            _safe_eval("__import__('os').system('echo hi')")

    def test_chunk_text_reassembles(self):
        original = "GC AI answers step by step with worked examples for GCE students."
        assert "".join(_chunk_text(original)) == original

    def test_seed_corpus_is_complete(self):
        assert len(seed_data.INTENT_EXAMPLES) >= 15
        assert len(seed_data.CURATED_KNOWLEDGE) >= 15
        for item in seed_data.CURATED_KNOWLEDGE:
            assert item["question"] and item["answer"]
