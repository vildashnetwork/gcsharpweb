"""Manual smoke test for the GC AI <-> FastAPI integration.

Run it from the backend folder:

    python tests/gc_ai_server_smoke.py

It imports server_working.py inside a running event loop (the module starts
APScheduler at import time), checks that the GC AI routes are registered and
exercises the SimpleLLM -> GC AI engine delegation without touching the
network (`use_web=False`).
"""
import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


async def main() -> int:
    import server_working as server

    print(f"GC_AI_AVAILABLE = {server.GC_AI_AVAILABLE}")

    ai_routes = sorted({
        r.path for r in server.app.routes if "/ai/" in getattr(r, "path", "")
    })
    for route in ai_routes:
        print(f"  route {route}")

    expected = {
        "/api/ai/chat",
        "/api/ai/ask",
        "/api/ai/explain",
        "/api/ai/health",
        "/api/ai/research",
        "/api/ai/brain/stats",
        "/api/ai/brain/search",
        "/api/ai/brain/recent",
        "/api/ai/brain/teach",
        "/api/ai/brain/feedback",
        "/api/ai/brain/{entry_id}",
    }
    missing = expected - set(ai_routes)
    if missing:
        print(f"FAIL: missing routes {sorted(missing)}")
        return 1

    engine = await server._ensure_gc_ai_engine()
    if engine is None:
        print("FAIL: engine could not be initialised")
        return 1

    health = engine.health()
    print(f"engine ready={health['ready']} memories={health['knowledge_memories']} "
          f"llm={health['llm_providers_available']} search={health['web_search_providers']}")

    # SimpleLLM must now route through the engine and never return a bare error.
    chat = server._new_chat("smoke_test", "You are a test tutor.", subject="Physics",
                            use_web=False, use_knowledge=True)
    reply = await chat.send_message("state newtons laws of motion")
    print(f"legacy SimpleLLM reply ({len(reply)} chars): {reply[:120]!r}")

    if not reply.strip():
        print("FAIL: empty reply from SimpleLLM")
        return 1
    if "trouble reaching the ai" in reply.lower():
        print("FAIL: legacy failure message resurfaced")
        return 1

    emergency = await server._gc_ai_emergency_answer("explain osmosis", "Biology")
    print(f"emergency answer ({len(emergency)} chars) OK: {emergency[:80]!r}")

    await engine.close()
    print("SMOKE TEST PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
