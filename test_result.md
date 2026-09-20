#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: >-
  "The AI in this project is having a big problem: it returns a failed error when
  the AI denies to connect or give a response. It should not fully depend on
  OpenRouter. GC AI using OpenRouter is to learn, and it should also have access
  to a Google search engine. It should have a knowledge base that stores
  everything it has learned; any question not there it searches Google, learns it
  and stores it. I want a full NLP/machine learning implementation, and it should
  be fully integrated into the app."

backend:
  - task: "GC AI core: NLP + ML engine package (gc_ai)"
    implemented: true
    working: true
    file: "backend/gc_ai/text.py, backend/gc_ai/seed.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: >-
          Added a dependency-free NLP stack: normalisation + abbreviation
          expansion, light deterministic stemmer, stopword handling, TF-IDF
          vector index, feature-hashed vectors (word/bigram/trigram/char-3gram),
          sparse cosine, extractive summariser (TF-IDF + query overlap +
          position), keyword extraction and a trainable Multinomial Naive Bayes
          intent classifier. Seeded with 21 intents x 5-13 utterances and 22
          curated exam answers so the assistant works with zero network.

  - task: "GC AI knowledge base (persistent learning)"
    implemented: true
    working: true
    file: "backend/gc_ai/knowledge.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: >-
          MongoDB collection gc_ai_knowledge + in-memory vector index. Learns
          every answer (curated, LLM, web, user-taught), dedupes by normalised
          question fingerprint, hybrid retrieval (0.45 TF-IDF + 0.35 hashed
          vector + 0.20 term coverage, weighted by confidence/feedback), feedback
          adjusts confidence, evicts weak memories past the cap, and falls back
          to in-memory only if Mongo is unreachable.

  - task: "GC AI web/Google search + page reading"
    implemented: true
    working: true
    file: "backend/gc_ai/search.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: >-
          Provider chain: Google Programmable Search and SerpAPI when keys are
          configured, then keyless DuckDuckGo HTML (GET - verified working),
          Wikipedia REST search and the DuckDuckGo Instant Answer API. Verified
          live: DuckDuckGo returns 4 results and Wikipedia returns usable
          context; pages and PDFs (pypdf, already a dependency) are fetched for
          learning. Wikimedia APIs 403 on generic browser UAs, so requests retry
          with a compliant descriptive UA - verified 200 OK afterwards.

  - task: "GC AI multi-provider LLM chain (OpenRouter is not a single point of failure)"
    implemented: true
    working: true
    file: "backend/gc_ai/llm.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: >-
          OpenRouter, Groq, Gemini (dynamic 'gemini-flash-latest' ladder so
          retired models do not break it), DeepSeek, Mistral, Together, OpenAI
          and any OpenAI-compatible endpoint. Per-provider circuit breaker parks
          a failing provider for 180s after two consecutive failures.

  - task: "GC AI answer pipeline + never-fail fallback"
    implemented: true
    working: true
    file: "backend/gc_ai/engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: >-
          Pipeline: NLP -> local deterministic -> knowledge base -> LLM ->
          web search + learn -> offline synthesis -> actionable fallback. Emits
          status/meta/delta/done events for SSE. Verified live that with a 401
          OpenRouter key and a 404 Gemini model the engine still returns a full,
          correct Newton's laws answer instead of an error string.

  - task: "Backend integration (server_working.py)"
    implemented: true
    working: true
    file: "backend/server_working.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: >-
          SimpleLLM.send_message now routes through GC AI, so /solve,
          /questions/generate, /papers/ask, /papers/{id}/qa,
          /papers/{id}/video, the highlight video and /ai/explain all inherit
          the fallback chain and learning. /ai/chat streams status/meta/delta
          with sources and mode. New endpoints: /ai/ask, /ai/research,
          /ai/brain/{stats,search,recent,teach,feedback,{id}}. /ai/health now
          reports every layer. Startup warm-up added; the legacy OpenRouter path
          is retained as a last resort. Also replaced the stale, non-existent
          DEFAULT_MODEL_CHAIN model ids.

  - task: "GC AI test suite + diagnostics"
    implemented: true
    working: true
    file: "backend/tests/test_gc_ai.py, backend/tests/gc_ai_server_smoke.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: >-
          29 offline tests pass (NLP, classifier, knowledge base, pipeline,
          learning loop, safe evaluator). The smoke test confirms all GC AI
          routes and the legacy client. Check scripts verify live web search and
          the learn-from-web loop. Two real bugs were found and fixed by the
          tests: an inconsistent stemmer (reaction vs reactions) and a missing
          memory id on knowledge-base answers.

frontend:
  - task: "AI Tutor: answer provenance, sources and feedback"
    implemented: true
    working: true
    file: "frontend/src/pages/AITutor.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: >-
          Streams status lines while GC AI thinks/searches, renders a mode badge
          (knowledge base / offline tutor / reasoning / learned from the web),
          confidence, source links, a "saved to my knowledge base" note and
          thumbs up/down feedback. Added bearer-token headers alongside cookies
          and replaced every failure string with actionable copy. Verified with a
          production craco build (compiled successfully, +4 kB gzip).

  - task: "GC AI Brain panel"
    implemented: true
    working: true
    file: "frontend/src/components/AIKnowledgePanel.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: >-
          Slide-over panel reachable from the AI Tutor header: live stats
          (memories, recall accuracy, web learning, live providers), memory
          search with source badges and feedback, a "Teach GC AI" form, a
          recently-learned list and forget/delete actions.

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "GC AI offline fallback never returns a bare failure"
    - "Web search + learning loop (search -> answer -> store -> instant recall)"
    - "AI Tutor answer provenance UI and GC AI Brain panel"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: >-
      Root cause of the reported failures: SimpleLLM only ever called OpenRouter
      free models, and the configured key now returns 401 "User not found"
      (verified live), so every request ended in the canned "trouble reaching the
      AI service" string. GC AI now answers through six layers and learns from
      every answer. Backend: run `python -m pytest tests/test_gc_ai.py -q` (29
      pass), then `python tests/gc_ai_server_smoke.py` and
      `python tests/check_gc_ai_web_learning.py`. To test the streaming UI, open
      /ai, ask something that is not in the knowledge base (for example "what is
      the role of the GCE board in Cameroon"), confirm the badge says it read
      from the web with source chips, then ask the same question again and
      confirm the badge switches to "GC AI knowledge base". Also check the
      GC AI Brain button for stats/search/teach. Notes: real Google results need
      GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID (keyless DuckDuckGo +
      Wikipedia are used otherwise), and the existing OpenRouter key should be
      regenerated in the Render dashboard.
