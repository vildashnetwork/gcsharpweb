"""End-to-end check of GC AI's web learning loop.

    python tests/check_gc_ai_web_learning.py

1. Ask something that is NOT in the knowledge base.
2. GC AI searches the web, reads the sources, answers, and stores what it learned.
3. Ask the exact same thing again - it must be instant, from the knowledge base.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from gc_ai.engine import GCAIEngine  # noqa: E402

QUESTION = "what is the role of the GCE board in Cameroon"


async def main() -> int:
    engine = GCAIEngine(db=None, enable_web=True)
    await engine.initialize()

    print("--- 1. unknown question (LLM off, web on: pure web learning path) ---")
    first = await engine.answer(QUESTION, subject="General", use_llm=False, use_web=True)
    print(f"mode      : {first.mode} ({first.mode_label})")
    print(f"learned   : {first.learned} id={first.learned_id}")
    print(f"sources   : {[s.get('url', '')[:60] for s in first.sources][:3]}")
    print(f"answer    : {first.text[:400]!r}")

    print("\n--- 2. same question again (must come from the knowledge base) ---")
    second = await engine.answer(QUESTION, subject="General", use_llm=False, use_web=True)
    print(f"mode      : {second.mode} ({second.mode_label})")
    print(f"same memory: {second.learned_id == first.learned_id}")
    print(f"web hit   : {any(s.get('provider') for s in second.sources)}")

    print("\n--- 3. engine stats ---")
    stats = engine.stats()
    print(f"memories  : {stats['knowledge']['memories']}")
    print(f"modes     : {stats['answer_modes']}")
    print(f"learning  : {stats['learning']}")

    ok = first.text.strip() and first.learned and second.mode in ("knowledge", "offline")
    await engine.close()
    print("WEB LEARNING LOOP:", "PASSED" if ok else "CHECK OUTPUT ABOVE")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
