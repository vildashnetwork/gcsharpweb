"""
GC AI - the self-contained intelligence layer for GCSHARP.

GC AI is designed so that it NEVER hard-fails:

    question
      -> NLP understanding (intent + subject + entities)
      -> local deterministic solvers (math, definitions, platform help)
      -> GC AI knowledge base (learned facts, offline + persisted in MongoDB)
      -> LLM reasoning via a multi-provider chain (OpenRouter is one of many,
         used to learn new material, never a single point of failure)
      -> Google / web search, then read the pages, learn and store them
      -> extractive offline synthesis from everything already known

Every successful answer is written back into the knowledge base, so the
assistant gets faster and more independent the more it is used.
"""

__all__ = ["GCAIEngine", "get_engine", "init_engine", "AIAnswer"]
__version__ = "1.0.0"

# The engine pulls in the knowledge base, the provider chain and the web
# searcher. Importing it lazily keeps `import gc_ai.text` cheap and means a
# missing optional piece can never break the FastAPI app at import time.
_LAZY = {"GCAIEngine", "get_engine", "init_engine", "AIAnswer"}


def __getattr__(name):
    if name in _LAZY:
        from . import engine as _engine  # noqa: WPS433 (intentional lazy import)

        return getattr(_engine, name)
    raise AttributeError(f"module 'gc_ai' has no attribute {name!r}")
