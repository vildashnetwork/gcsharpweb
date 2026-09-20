"""Check page fetching + Wikipedia extracts used for learning."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from gc_ai.search import WebSearcher  # noqa: E402

TARGETS = [
    "https://en.wikipedia.org/wiki/Photosynthesis",
    "https://www.britannica.com/science/photosynthesis",
    "https://simple.wikipedia.org/wiki/Photosynthesis",
]


async def main() -> int:
    searcher = WebSearcher()
    print("wiki summary:", repr((await searcher.wikipedia_summary("Photosynthesis"))[:200]))
    for url in TARGETS:
        text = await searcher.fetch_page(url, max_chars=4000)
        print(f"{url} -> {len(text)} chars :: {text[:120]!r}")
    await searcher.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
