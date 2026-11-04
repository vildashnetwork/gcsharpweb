"""
Web research layer for GC AI.

GC AI has real access to search engines. Providers are tried in order of
quality and availability, and *any one* of them is enough to work:

  1. Google Programmable Search (Custom Search JSON API)
     -> needs GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID
  2. SerpAPI google driver
     -> needs SERPAPI_KEY
  3. DuckDuckGo HTML endpoint (no key, no quota)
  4. Wikipedia REST API (no key) - excellent for definitions and concepts

Results are then fetched, converted to readable text and ranked, so the
engine can learn from them and store them in the knowledge base.
"""

from __future__ import annotations

import asyncio
import html as html_lib
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

import httpx

from . import text as nlp

logger = logging.getLogger("gcsmart.gc_ai.search")

# DuckDuckGo/Mojeek style sites block generic browser UAs inconsistently, while
# Wikimedia's API policy requires a descriptive UA with a contact URL.
_UA_BROWSER = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
_UA_WIKI = "GCSharp-GCAI/1.0 (+https://gcsharp.com; support@gcsharp.com)"

_TAG_RE = re.compile(r"<(script|style|noscript|svg|iframe)[^>]*>.*?</\1>", re.DOTALL | re.IGNORECASE)
_BLOCK_RE = re.compile(r"</(p|div|li|h[1-6]|tr|section|article|br)>", re.IGNORECASE)
_ANY_TAG_RE = re.compile(r"<[^>]+>")
# DuckDuckGo HTML endpoint result markup (works for both GET and POST).
_DDG_RESULT_RE = re.compile(
    r'class="result__a"[^>]*href="(?P<url>[^"]+)"[^>]*>(?P<title>.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_DDG_SNIPPET_RE = re.compile(
    r'class="result__snippet"[^>]*>(?P<snippet>.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_GOOGLE_BLOCK_RE = re.compile(r'<div class="[^"]*result__snippet[^"]*"')


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str = ""
    provider: str = ""
    content: str = ""
    score: float = 0.0
    rank: int = 0

    def as_dict(self) -> Dict:
        return {
            "title": self.title,
            "url": self.url,
            "snippet": self.snippet,
            "provider": self.provider,
            "score": round(self.score, 3),
        }


@dataclass
class ResearchBundle:
    """Everything GC AI managed to find on the open web for a question."""

    query: str
    results: List[SearchResult] = field(default_factory=list)
    context: str = ""
    providers: List[str] = field(default_factory=list)
    error: Optional[str] = None

    @property
    def ok(self) -> bool:
        return bool(self.context.strip())

    def citations(self) -> List[Dict]:
        out = []
        for res in self.results:
            if res.content or res.snippet:
                out.append({"title": res.title, "url": res.url, "provider": res.provider})
        return out[:6]

    def as_dict(self) -> Dict:
        return {
            "query": self.query,
            "providers": self.providers,
            "sources": self.citations(),
            "context_length": len(self.context),
            "error": self.error,
        }


def html_to_text(raw: str) -> str:
    """Turn an HTML document into readable plain text."""
    if not raw:
        return ""
    cleaned = _TAG_RE.sub(" ", raw)
    cleaned = _BLOCK_RE.sub("\n", cleaned)
    cleaned = _ANY_TAG_RE.sub(" ", cleaned)
    cleaned = html_lib.unescape(cleaned)
    cleaned = re.sub(r"[ \t\u00a0]+", " ", cleaned)
    cleaned = re.sub(r"\n\s*\n+", "\n", cleaned)
    lines = [line.strip() for line in cleaned.split("\n")]
    body = "\n".join(line for line in lines if len(line) > 30)
    return body.strip()


def strip_noise(text: str) -> str:
    """Remove the boilerplate that survives HTML extraction."""
    if not text:
        return ""
    patterns = (
        r"cookie[s]? (policy|settings|preferences)",
        r"accept all cookies",
        r"subscribe to our newsletter",
        r"sign in to continue",
        r"privacy policy",
        r"terms of (use|service)",
        r"advertisement",
        r"all rights reserved",
    )
    kept = []
    for line in text.split("\n"):
        low = line.lower()
        if any(re.search(pat, low) for pat in patterns):
            continue
        kept.append(line)
    return "\n".join(kept).strip()


def _canonical(url: str) -> str:
    url = html_lib.unescape(url.strip())
    if url.startswith("//"):
        url = "https:" + url
    if url.startswith("/l/?uddg="):
        url = "https://duckduckgo.com" + url
    if "uddg=" in url:
        match = re.search(r"uddg=([^&]+)", url)
        if match:
            from urllib.parse import unquote

            url = unquote(match.group(1))
    return url


class WebSearcher:
    """Keyless-first web searcher with Google support when keys are provided."""

    def __init__(
        self,
        google_api_key: Optional[str] = None,
        google_cx: Optional[str] = None,
        serpapi_key: Optional[str] = None,
        timeout: float = 12.0,
    ) -> None:
        self.google_api_key = google_api_key or os.environ.get("GOOGLE_SEARCH_API_KEY", "")
        self.google_cx = google_cx or os.environ.get("GOOGLE_SEARCH_ENGINE_ID", "") or os.environ.get("GOOGLE_CSE_ID", "")
        self.serpapi_key = serpapi_key or os.environ.get("SERPAPI_KEY", "")
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
        self.stats: Dict[str, int] = {"searches": 0, "pages_fetched": 0, "failures": 0}

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_api_key and self.google_cx)

    def providers(self) -> List[str]:
        names = []
        if self.google_enabled:
            names.append("google")
        if self.serpapi_key:
            names.append("serpapi")
        names.extend(["duckduckgo", "wikipedia", "duckduckgo-instant"])
        return names

    async def _http(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                headers={"User-Agent": _UA_BROWSER, "Accept-Language": "en-US,en;q=0.9"},
            )
        return self._client

    async def close(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
        self._client = None

    # ---------------------------------------------------------
    # Providers
    # ---------------------------------------------------------

    async def _search_google(self, query: str, limit: int) -> List[SearchResult]:
        client = await self._http()
        resp = await client.get(
            "https://www.googleapis.com/customsearch/v1",
            params={
                "key": self.google_api_key,
                "cx": self.google_cx,
                "q": query,
                "num": min(limit, 10),
                "safe": "off",
            },
        )
        if resp.status_code != 200:
            raise RuntimeError(f"google {resp.status_code}: {resp.text[:160]}")
        items = resp.json().get("items", [])[:limit]
        return [
            SearchResult(
                title=item.get("title", ""),
                url=item.get("link", ""),
                snippet=item.get("snippet", ""),
                provider="google",
            )
            for item in items
        ]

    async def _search_serpapi(self, query: str, limit: int) -> List[SearchResult]:
        client = await self._http()
        resp = await client.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google",
                "q": query,
                "num": min(limit, 10),
                "api_key": self.serpapi_key,
            },
        )
        if resp.status_code != 200:
            raise RuntimeError(f"serpapi {resp.status_code}: {resp.text[:160]}")
        data = resp.json()
        results = []
        for item in (data.get("organic_results") or [])[:limit]:
            results.append(
                SearchResult(
                    title=item.get("title", ""),
                    url=item.get("link", ""),
                    snippet=item.get("snippet", ""),
                    provider="serpapi",
                )
            )
        if not results and data.get("answer_box"):
            box = data["answer_box"]
            results.append(
                SearchResult(
                    title=box.get("title", query),
                    url=box.get("link", "https://serpapi.com"),
                    snippet=box.get("answer") or box.get("snippet", ""),
                    provider="serpapi",
                )
            )
        return results


    async def _search_duckduckgo(self, query: str, limit: int) -> List[SearchResult]:
        """DuckDuckGo HTML endpoint. GET works reliably; POST is the fallback."""
        client = await self._http()
        body = ""
        last_status = 0
        try:
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query, "kl": "wt-wt"},
            )
            last_status = resp.status_code
            if resp.status_code == 200:
                body = resp.text
        except Exception as exc:
            logger.debug(f"GC AI duckduckgo GET failed: {exc}")

        if "result__a" not in body:
            try:
                resp = await client.post(
                    "https://html.duckduckgo.com/html/",
                    data={"q": query, "kl": "wt-wt"},
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                last_status = resp.status_code
                if resp.status_code == 200:
                    body = resp.text
            except Exception as exc:
                logger.debug(f"GC AI duckduckgo POST failed: {exc}")

        matches = list(_DDG_RESULT_RE.finditer(body))
        if not matches:
            raise RuntimeError(
                f"duckduckgo returned no parseable results (last status {last_status})"
            )

        snippets = [
            html_to_text(m.group("snippet")).strip()
            for m in _DDG_SNIPPET_RE.finditer(body)
        ]
        results: List[SearchResult] = []
        for idx, match in enumerate(matches[:limit]):
            url = _canonical(match.group("url"))
            if not url.startswith("http"):
                continue
            title = html_to_text(match.group("title")).split("\n")[0].strip()
            results.append(
                SearchResult(
                    title=(title or url)[:200],
                    url=url,
                    snippet=(snippets[idx] if idx < len(snippets) else "")[:400],
                    provider="duckduckgo",
                )
            )
        if not results:
            raise RuntimeError("duckduckgo returned no usable links")
        return results

    async def _search_ddg_instant(self, query: str, limit: int) -> List[SearchResult]:
        """DuckDuckGo Instant Answer API - great for definitions and concepts."""
        client = await self._http()
        resp = await client.get(
            "https://api.duckduckgo.com/",
            params={
                "q": query,
                "format": "json",
                "no_html": 1,
                "skip_disambig": 1,
                "no_redirect": 1,
            },
        )
        if resp.status_code != 200:
            raise RuntimeError(f"duckduckgo instant {resp.status_code}")
        data = resp.json()
        results: List[SearchResult] = []

        text = (data.get("AbstractText") or data.get("Answer") or "").strip()
        if text:
            results.append(
                SearchResult(
                    title=data.get("Heading") or data.get("AbstractSource") or query,
                    url=data.get("AbstractURL") or f"https://duckduckgo.com/?q={query}",
                    snippet=text[:400],
                    provider="duckduckgo-instant",
                    content=text,
                )
            )
        for topic in (data.get("RelatedTopics") or [])[: max(limit - 1, 1)]:
            if not isinstance(topic, dict) or not topic.get("Text"):
                continue
            results.append(
                SearchResult(
                    title=(topic.get("Text") or "")[:80],
                    url=topic.get("FirstURL") or "",
                    snippet=topic["Text"][:300],
                    provider="duckduckgo-instant",
                )
            )
        if not results:
            raise RuntimeError("duckduckgo instant returned nothing usable")
        return results

    async def _search_wikipedia(self, query: str, limit: int) -> List[SearchResult]:
        """Wikipedia search. The Wikimedia API requires a descriptive UA."""
        client = await self._http()
        resp = await client.get(
            "https://en.wikipedia.org/w/rest.php/v1/search/page",
            params={"q": query, "limit": min(max(limit, 1), 10)},
            headers={"User-Agent": _UA_WIKI},
        )
        if resp.status_code != 200:
            raise RuntimeError(f"wikipedia {resp.status_code}")
        results = []
        for page in resp.json().get("pages", [])[:limit]:
            title = page.get("title", "")
            if not title:
                continue
            snippet = html_to_text(page.get("excerpt") or "") or (page.get("description") or "")
            results.append(
                SearchResult(
                    title=title,
                    url=f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}",
                    snippet=snippet[:300],
                    provider="wikipedia",
                )
            )
        if not results:
            raise RuntimeError("wikipedia returned no results")
        return results

    async def wikipedia_summary(self, title: str) -> str:
        """Full plain-text extract of a Wikipedia article (used for learning)."""
        client = await self._http()
        try:
            resp = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "prop": "extracts",
                    "explaintext": 1,
                    "exintro": 1,
                    "redirects": 1,
                    "format": "json",
                    "titles": title,
                },
                headers={"User-Agent": _UA_WIKI},
            )
            pages = resp.json().get("query", {}).get("pages", {})
            for page in pages.values():
                extract = page.get("extract") or ""
                if extract:
                    return extract.strip()
        except Exception as exc:  # pragma: no cover - network dependent
            logger.debug(f"wikipedia summary failed for {title!r}: {exc}")

        # Secondary: the dedicated summary endpoint (no key, very fast).
        try:
            resp = await client.get(
                "https://en.wikipedia.org/api/rest_v1/page/summary/"
                + title.replace(" ", "_"),
                headers={"User-Agent": _UA_WIKI},
            )
            if resp.status_code == 200:
                return (resp.json().get("extract") or "").strip()
        except Exception as exc:  # pragma: no cover - network dependent
            logger.debug(f"wikipedia REST summary failed for {title!r}: {exc}")
        return ""

    # ---------------------------------------------------------
    # Public API
    # ---------------------------------------------------------

    async def search(self, query: str, limit: int = 5) -> Tuple[List[SearchResult], List[str]]:
        """Try every configured provider; return the first non-empty result set."""
        query = (query or "").strip()
        if not query:
            return [], []

        ordered = []
        if self.google_enabled:
            ordered.append(("google", self._search_google))
        if self.serpapi_key:
            ordered.append(("serpapi", self._search_serpapi))
        ordered.append(("duckduckgo", self._search_duckduckgo))
        ordered.append(("wikipedia", self._search_wikipedia))
        ordered.append(("duckduckgo-instant", self._search_ddg_instant))

        self.stats["searches"] += 1
        tried: List[str] = []
        for name, fn in ordered:
            tried.append(name)
            try:
                results = await fn(query, limit)
                if results:
                    for rank, res in enumerate(results):
                        res.rank = rank
                    logger.info(f"GC AI web search via {name}: {len(results)} results for {query[:60]!r}")
                    return results, tried
            except Exception as exc:
                logger.warning(f"GC AI search provider '{name}' failed: {exc}")
                self.stats["failures"] += 1

        # Everything keyed failed - fall back to plain Wikipedia lookup by title.
        try:
            summary = await self.wikipedia_summary(query)
            if summary:
                return [
                    SearchResult(
                        title=query,
                        url=f"https://en.wikipedia.org/wiki/{query.replace(' ', '_')}",
                        snippet=summary[:400],
                        provider="wikipedia",
                        content=summary,
                    )
                ], tried + ["wikipedia-extract"]
        except Exception as exc:
            logger.warning(f"GC AI wikipedia fallback failed: {exc}")

        return [], tried

    @staticmethod
    def _pdf_to_text(data: bytes, max_chars: int = 9000) -> str:
        """Extract text from a PDF using pypdf (already a project dependency)."""
        try:
            import io as _io

            from pypdf import PdfReader

            reader = PdfReader(_io.BytesIO(data))
            chunks: List[str] = []
            for page in reader.pages[:15]:
                try:
                    chunks.append(page.extract_text() or "")
                except Exception:
                    continue
            text = "\n".join(chunks)
            text = re.sub(r"[ \t\u00a0]+", " ", text)
            text = re.sub(r"\n\s*\n+", "\n", text)
            return text.strip()[:max_chars]
        except Exception as exc:  # pragma: no cover - malformed PDFs
            logger.debug(f"GC AI PDF extraction failed: {exc}")
            return ""

    async def fetch_page(self, url: str, max_chars: int = 9000) -> str:
        """Download a page/PDF and return its readable text (best effort).

        Many large study sites (Wikipedia included) reject generic browser
        user agents, so a 403 triggers one retry with the polite UA.
        """
        if not url or not url.startswith("http"):
            return ""
        if url.lower().endswith((".zip", ".mp4", ".jpg", ".jpeg", ".png", ".gif")):
            return ""

        client = await self._http()
        accept = "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8"
        try:
            resp = await client.get(url, headers={"Accept": accept})
            if resp.status_code == 403:
                resp = await client.get(url, headers={"User-Agent": _UA_WIKI, "Accept": accept})
            if resp.status_code != 200:
                self.stats["failures"] += 1
                return ""

            content_type = (resp.headers.get("content-type") or "").lower()
            is_pdf = "pdf" in content_type or url.lower().endswith(".pdf") or resp.content[:4] == b"%PDF"
            if is_pdf:
                text = self._pdf_to_text(resp.content, max_chars=max_chars)
            elif "html" in content_type or "text" in content_type:
                text = strip_noise(html_to_text(resp.text))
            else:
                return ""

            if not text:
                return ""
            self.stats["pages_fetched"] += 1
            return text[:max_chars]
        except Exception as exc:
            logger.debug(f"GC AI failed to fetch {url}: {exc}")
            self.stats["failures"] += 1
            return ""

    async def research(
        self,
        query: str,
        limit: int = 5,
        fetch_top: int = 3,
        max_chars_per_page: int = 7000,
    ) -> ResearchBundle:
        """Search + read the top pages + rank the useful sentences.

        This is what makes GC AI able to answer questions it has never seen:
        it looks the topic up on the web, reads the best sources and returns a
        compact, quotable context block together with its citations.
        """
        bundle = ResearchBundle(query=query)
        results, tried = await self.search(query, limit=limit)
        bundle.providers = tried
        if not results:
            bundle.error = "no search provider returned results"
            return bundle

        # Only fetch the pages that are not Wikipedia-instant answers.
        fetch_targets = [r for r in results[: max(fetch_top, 1)] if not r.content]
        if fetch_targets:
            pages = await asyncio.gather(
                *(self.fetch_page(r.url, max_chars=max_chars_per_page) for r in fetch_targets),
                return_exceptions=True,
            )
            for res, page in zip(fetch_targets, pages):
                if isinstance(page, str) and page:
                    res.content = page

        # Enrich with the full Wikipedia intro when the top hit is Wikipedia.
        wiki_hit = next((r for r in results if r.provider == "wikipedia" and not r.content), None)
        if wiki_hit:
            summary = await self.wikipedia_summary(wiki_hit.title)
            if summary:
                wiki_hit.content = summary[:max_chars_per_page]

        for res in results:
            haystack = f"{res.title}\n{res.snippet}\n{res.content}"
            res.score = nlp.answer_overlap(query, haystack) + (0.05 if res.content else 0.0) - res.rank * 0.01

        results.sort(key=lambda r: r.score, reverse=True)
        bundle.results = results

        documents: List[Tuple[str, str]] = []
        for res in results:
            body = res.content or res.snippet
            if body:
                documents.append((res.url, body))
        bundle.context = nlp.best_passages(documents, query, max_sentences=10)
        return bundle
