# GCSHARP

AI-powered exam platform for Cameroon students: GCE Ordinary Level, GCE Advanced
Level, HND and Concours.

- `backend/` — FastAPI + MongoDB API (`server_working.py` is the app entry point)
- `frontend/` — React (CRA + craco) single page app
- `backend/gc_ai/` — **GC AI**, the self-contained intelligence layer

---

## GC AI

GC AI never depends on a single AI provider. Every question flows through a
multi-layer pipeline and each layer is a safety net for the one before it:

| Layer | What it does | Needs a key? |
|-------|--------------|--------------|
| 1. NLP understanding | tokenising, stemming, TF-IDF + feature-hashed vectors, Naive-Bayes intent classification (21 intents), subject detection, keyword extraction | no |
| 2. Local deterministic answer | greetings, platform help, study plans, math/percentages via the local sympy solver + a safe arithmetic evaluator | no |
| 3. Knowledge base recall | hybrid TF-IDF + hashed-vector retrieval over everything GC AI has learned (MongoDB `gc_ai_knowledge`) | no |
| 4. LLM reasoning | provider chain: OpenRouter → Groq → Gemini → DeepSeek → Mistral → Together → OpenAI → any OpenAI-compatible endpoint, with per-provider circuit breakers | optional |
| 5. Web research + learning | Google Programmable Search (or SerpAPI), then DuckDuckGo HTML, Wikipedia and the DuckDuckGo Instant Answer API; fetches pages/PDFs, ranks sentences and composes the answer | no (keyless works) |
| 6. Offline synthesis | extractive summarisation from what it already read/knows, plus an actionable fallback. **A bare "connection failed" message is never returned.** | no |

Whatever produced the answer, GC AI writes it back into its knowledge base, so
the next identical question is answered instantly from memory.

### Configure it (all optional)

Add any of these to `backend/.env` (and to Render's environment variables):

```bash
# True Google results (https://programmablesearchengine.google.com/)
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_ENGINE_ID=
# or SerpAPI
SERPAPI_KEY=
# Turn live web research off entirely
GC_AI_WEB_SEARCH=1

# Extra reasoning providers
GROQ_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
MISTRAL_API_KEY=
TOGETHER_API_KEY=
OPENAI_API_KEY=
# Any OpenAI-compatible server (Ollama, vLLM, Azure...)
GC_AI_BASE_URL=
GC_AI_API_KEY=
GC_AI_MODEL=
```

Without any of them GC AI still answers: layers 1, 2, 3, 5 and 6 all work with
no keys at all.

### API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ai/chat` | streaming tutor chat (SSE: `status`, `meta`, `delta`, `done`) |
| POST | `/api/ai/ask` | same pipeline, non-streaming JSON with mode/sources/confidence |
| POST | `/api/ai/explain` | quick explanation |
| POST | `/api/ai/research` | search the web and optionally learn from it |
| GET | `/api/ai/brain/stats` | memories, hit-rate, providers, search providers |
| GET | `/api/ai/brain/search?q=` | semantic search GC AI's memory |
| GET | `/api/ai/brain/recent` | recently learned memories |
| POST | `/api/ai/brain/teach` | teach GC AI a fact permanently |
| POST | `/api/ai/brain/feedback` | 👍/👎 feedback (adjusts memory confidence) |
| DELETE | `/api/ai/brain/{entry_id}` | forget a memory |
| GET | `/api/ai/health` | diagnostics across every layer |

### Frontend

- **AI Tutor** (`/ai`) shows how each answer was produced (knowledge base /
  reasoning / learned from the web), links its sources, flags when an answer was
  saved to memory, and offers 👍/👎 feedback.
- **GC AI Brain** panel (button in the AI Tutor header) shows what GC AI has
  learned, lets you search those memories and teach it new facts.

### Verifying it locally

```bash
cd backend
python -m pytest tests/test_gc_ai.py -q          # offline unit tests
python tests/check_web_search.py                 # live web search providers
python tests/check_gc_ai_web_learning.py         # full learn-from-web loop
python tests/gc_ai_server_smoke.py               # API wiring + legacy client
```

