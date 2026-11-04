"""
Multi-provider LLM access for GC AI.

OpenRouter is used to *learn* new material, but it is never the only path and
never a single point of failure. Every provider below speaks the OpenAI chat
completions protocol (except Gemini, which is adapted), and each one has its
own circuit breaker so a dead/rate-limited provider is skipped quickly
instead of burning the request budget.

Environment variables (all optional - the engine still works with none):
  OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_MODEL_FALLBACKS
  GROQ_API_KEY, GROQ_MODEL
  GEMINI_API_KEY or GOOGLE_AI_API_KEY, GEMINI_MODEL
  DEEPSEEK_API_KEY, DEEPSEEK_MODEL
  MISTRAL_API_KEY, MISTRAL_MODEL
  TOGETHER_API_KEY, TOGETHER_MODEL
  OPENAI_API_KEY, OPENAI_MODEL
  GC_AI_BASE_URL + GC_AI_API_KEY + GC_AI_MODEL  (any OpenAI compatible endpoint)
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

import httpx

logger = logging.getLogger("gcsmart.gc_ai.llm")

OPENROUTER_FREE_CHAIN = [
    "google/gemma-2-9b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen-2.5-72b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "openrouter/auto",
]


@dataclass
class LLMResponse:
    text: str
    provider: str
    model: str
    latency_ms: int = 0


@dataclass
class ProviderState:
    name: str
    failures: int = 0
    successes: int = 0
    blocked_until: float = 0.0
    last_error: str = ""
    last_latency_ms: int = 0
    models: List[str] = field(default_factory=list)

    @property
    def available(self) -> bool:
        return time.time() >= self.blocked_until

    def note_failure(self, error: str, cooldown: float = 180.0) -> None:
        self.failures += 1
        self.last_error = error[:300]
        # Two misses in a row: park this provider for a few minutes.
        if self.failures % 2 == 0:
            self.blocked_until = time.time() + cooldown

    def note_success(self, latency_ms: int) -> None:
        self.failures = 0
        self.successes += 1
        self.last_latency_ms = latency_ms
        self.blocked_until = 0.0


def _sanitize_model_id(raw: str) -> str:
    """Tolerate Render env vars that accidentally contain 'KEY=value' lines."""
    value = (raw or "").strip()
    match = re.match(r"^[A-Z][A-Z0-9_]*=(.+)$", value)
    if match:
        logger.warning(f"GC AI: stripping 'KEY=' prefix from model env value ({value!r})")
        value = match.group(1).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        value = value[1:-1].strip()
    return value


class ProviderChain:
    """Ordered provider chain with per-provider circuit breaking."""

    def __init__(self, openrouter_models: Optional[Sequence[str]] = None) -> None:
        self.providers: List[Dict] = []
        self.state: Dict[str, ProviderState] = {}
        self._build(openrouter_models)
        self.total_calls = 0
        self.total_failures = 0
        self.last_provider = ""

    # ---------------------------------------------------------
    # Configuration
    # ---------------------------------------------------------

    def _build(self, openrouter_models: Optional[Sequence[str]] = None) -> None:
        def env(*names: str) -> str:
            for name in names:
                value = os.environ.get(name, "").strip()
                if value:
                    return value
            return ""

        # 1. OpenRouter (learner)
        or_key = env("OPENROUTER_API_KEY")
        if or_key:
            models = list(openrouter_models or [])
            if not models:
                primary = _sanitize_model_id(env("OPENROUTER_MODEL"))
                extra = [
                    _sanitize_model_id(m)
                    for m in env("OPENROUTER_MODEL_FALLBACKS").split(",")
                    if m.strip()
                ]
                models = [m for m in [primary] + extra if m] + OPENROUTER_FREE_CHAIN
            seen, ordered = set(), []
            for model in models + OPENROUTER_FREE_CHAIN:
                if model and model not in seen:
                    seen.add(model)
                    ordered.append(model)
            self._register(
                "openrouter",
                "https://openrouter.ai/api/v1/chat/completions",
                or_key,
                ordered,
                extra_headers={
                    "HTTP-Referer": os.environ.get("APP_URL", "https://gcsharp.com"),
                    "X-Title": os.environ.get("APP_NAME", "GCSMART AI"),
                },
            )

        # 2. Groq - very fast, generous free tier
        groq_key = env("GROQ_API_KEY")
        if groq_key:
            self._register(
                "groq",
                "https://api.groq.com/openai/v1/chat/completions",
                groq_key,
                [env("GROQ_MODEL") or "llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
            )

        # 3. Gemini
        gemini_key = env("GEMINI_API_KEY", "GOOGLE_AI_API_KEY")
        if gemini_key:
            # "gemini-flash-latest" always points at the current flash model, so
            # this keeps working when Google retires a version.
            self._register(
                "gemini",
                "gemini://v1beta",
                gemini_key,
                [
                    env("GEMINI_MODEL"),
                    "gemini-flash-latest",
                    "gemini-2.5-flash",
                    "gemini-2.0-flash",
                    "gemini-1.5-flash",
                ],
                protocol="gemini",
            )

        # 4. DeepSeek
        deepseek_key = env("DEEPSEEK_API_KEY")
        if deepseek_key:
            self._register(
                "deepseek",
                "https://api.deepseek.com/chat/completions",
                deepseek_key,
                [env("DEEPSEEK_MODEL") or "deepseek-chat"],
            )

        # 5. Mistral
        mistral_key = env("MISTRAL_API_KEY")
        if mistral_key:
            self._register(
                "mistral",
                "https://api.mistral.ai/v1/chat/completions",
                mistral_key,
                [env("MISTRAL_MODEL") or "mistral-large-latest", "open-mistral-nemo"],
            )

        # 6. Together
        together_key = env("TOGETHER_API_KEY")
        if together_key:
            self._register(
                "together",
                "https://api.together.xyz/v1/chat/completions",
                together_key,
                [env("TOGETHER_MODEL") or "meta-llama/Llama-3.3-70B-Instruct-Turbo"],
            )

        # 7. OpenAI
        openai_key = env("OPENAI_API_KEY")
        if openai_key:
            self._register(
                "openai",
                "https://api.openai.com/v1/chat/completions",
                openai_key,
                [env("OPENAI_MODEL") or "gpt-4o-mini"],
            )

        # 8. Any custom OpenAI-compatible endpoint (Ollama, vLLM, Azure proxy...)
        custom_key = env("GC_AI_API_KEY", "OPENAI_COMPATIBLE_API_KEY")
        custom_base = env("GC_AI_BASE_URL", "OPENAI_COMPATIBLE_BASE_URL")
        if custom_base:
            url = custom_base.rstrip("/")
            if not url.endswith("/chat/completions"):
                url = f"{url}/chat/completions"
            self._register(
                "custom",
                url,
                custom_key or "not-needed",
                [env("GC_AI_MODEL", "OPENAI_COMPATIBLE_MODEL") or "local-model"],
            )

    def _register(
        self,
        name: str,
        url: str,
        api_key: str,
        models: Sequence[str],
        extra_headers: Optional[Dict[str, str]] = None,
        protocol: str = "openai",
    ) -> None:
        models = [m for m in models if m]
        if not models:
            return
        self.providers.append(
            {
                "name": name,
                "url": url,
                "key": api_key,
                "models": models,
                "headers": extra_headers or {},
                "protocol": protocol,
            }
        )
        self.state[name] = ProviderState(name=name, models=list(models))

    def configured_providers(self) -> List[str]:
        return [p["name"] for p in self.providers if self.state[p["name"]].available]

    def provider_report(self) -> List[Dict]:
        return [
            {
                "name": state.name,
                "models": state.models,
                "available": state.available,
                "successes": state.successes,
                "failures": state.failures,
                "last_error": state.last_error,
                "last_latency_ms": state.last_latency_ms,
            }
            for state in self.state.values()
        ]

    # ---------------------------------------------------------
    # Invocation
    # ---------------------------------------------------------

    async def _call_openai_compatible(
        self,
        client: httpx.AsyncClient,
        provider: Dict,
        model: str,
        messages: List[Dict],
        temperature: float,
        max_tokens: int,
    ) -> str:
        headers = {
            "Authorization": f"Bearer {provider['key']}",
            "Content-Type": "application/json",
        }
        headers.update(provider.get("headers") or {})
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        resp = await client.post(provider["url"], headers=headers, json=payload)
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        choices = data.get("choices") or []
        if not choices:
            raise RuntimeError(f"no choices in response: {str(data)[:200]}")
        message = choices[0].get("message") or {}
        content = message.get("content") or ""
        if not content:
            content = message.get("reasoning_content") or ""
        if not content.strip():
            raise RuntimeError("empty completion")
        return content.strip()

    async def _call_gemini(
        self,
        client: httpx.AsyncClient,
        provider: Dict,
        model: str,
        messages: List[Dict],
        temperature: float,
        max_tokens: int,
    ) -> str:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            f"?key={provider['key']}"
        )
        system_parts = [m["content"] for m in messages if m.get("role") == "system"]
        contents = [
            {"role": "user", "parts": [{"text": m["content"]}]}
            for m in messages
            if m.get("role") != "system"
        ]
        payload: Dict = {
            "contents": contents,
            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
        }
        if system_parts:
            payload["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_parts)}]}
        resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")
        candidates = resp.json().get("candidates") or []
        if not candidates:
            raise RuntimeError("no candidates in Gemini response")
        parts = (candidates[0].get("content") or {}).get("parts") or []
        text = "".join(part.get("text", "") for part in parts).strip()
        if not text:
            raise RuntimeError("empty Gemini completion")
        return text

    async def chat(
        self,
        system: str,
        messages: List[Dict],
        temperature: float = 0.3,
        max_tokens: int = 2000,
        timeout: float = 30.0,
    ) -> Optional[LLMResponse]:
        """Try every configured provider/model until one answers."""
        payload_messages = [{"role": "system", "content": system}] + list(messages)
        self.total_calls += 1

        async with httpx.AsyncClient(timeout=timeout) as client:
            for provider in self.providers:
                state = self.state[provider["name"]]
                if not state.available:
                    continue
                for model in provider["models"]:
                    started = time.time()
                    try:
                        if provider["protocol"] == "gemini":
                            text = await self._call_gemini(
                                client, provider, model, payload_messages, temperature, max_tokens
                            )
                        else:
                            text = await self._call_openai_compatible(
                                client, provider, model, payload_messages, temperature, max_tokens
                            )
                    except Exception as exc:
                        logger.warning(f"GC AI provider {provider['name']}/{model} failed: {exc}")
                        state.note_failure(str(exc))
                        continue

                    latency = int((time.time() - started) * 1000)
                    state.note_success(latency)
                    self.last_provider = provider["name"]
                    logger.info(f"GC AI answered via {provider['name']}/{model} in {latency}ms")
                    return LLMResponse(text=text, provider=provider["name"], model=model, latency_ms=latency)

                # small pause before the next provider so we do not hammer out
                await asyncio.sleep(0.05)

        self.total_failures += 1
        logger.error("GC AI: every configured LLM provider failed")
        return None

    def report(self) -> Dict:
        return {
            "configured": [p["name"] for p in self.providers],
            "available": self.configured_providers(),
            "total_calls": self.total_calls,
            "total_failures": self.total_failures,
            "last_provider": self.last_provider,
            "providers": self.provider_report(),
        }
