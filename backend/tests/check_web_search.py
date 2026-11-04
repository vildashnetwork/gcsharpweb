"""Manual check of GC AI live web search (run: python tests/check_web_search.py)."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from gc_ai.search import WebSearcher  # noqa: E402


async def main() -> int:
    searcher = WebSearcher()
    print("providers:", searcher.providers())
    for query in ("what is photosynthesis", "GCE advanced level mathematics syllabus"):
        bundle = await searcher.research(query, limit=4, fetch_top=2)
        print(f"\nquery={query!r}")
        print(f"  providers tried: {bundle.providers}")
        print(f"  results: {len(bundle.results)} | usable context: {bundle.ok} "
              f"({len(bundle.context)} chars)")
        print(f"  error: {bundle.error}")
        for result in bundle.results[:3]:
            print(f"   - [{result.provider}] {result.title[:60]!r} "
                  f"content={len(result.content)} score={result.score:.3f}")
        if bundle.context:
            print(f"  preview: {bundle.context[:180]!r}")
    await searcher.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
