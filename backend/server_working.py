# server_working.py - GCSMART Backend API (Production Ready)
import os
import io
import json
import uuid
import base64
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import asyncio

import httpx
from pypdf import PdfReader
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from fastapi.responses import StreamingResponse, Response as FastResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

# ============================================================
# Configuration & Environment
# ============================================================

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB Connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb+srv://gcsharp-user:HMLfa8jjFgvhmOut@gcsharp.nh4zzwi.mongodb.net/?retryWrites=true&w=majority')
DB_NAME = os.environ.get('DB_NAME', 'gcsmart')
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')
APP_URL = os.environ.get('APP_URL', 'https://gcsharpweb.onrender.com')
APP_NAME = os.environ.get('APP_NAME', 'GCSMART AI')

# Initialize MongoDB
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ============================================================
# FastAPI App
# ============================================================

app = FastAPI(
    title="GCSMART API",
    version="2.0.0",
    description="AI-Powered Educational Platform for Cameroon Students",
    docs_url="/docs",
    redoc_url="/redoc"
)

api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gcsmart")

# ============================================================
# CORS Configuration
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Simple LLM Client (OpenRouter SDK Compatible)
# ============================================================

class SimpleLLM:
    """Simple LLM client using OpenRouter API with Hugging Face fallback"""
    
    def __init__(self, api_key: str = "", model: str = "google/gemini-2.5-flash:free"):
        self.api_key = api_key or os.environ.get("OPENROUTER_API_KEY", "")
        self.model = model
        self.base_url = "https://openrouter.ai/api/v1"
        self.system_message = ""
        self.session_id = None
        self.referer = os.environ.get("APP_URL", "https://gcsharpweb.onrender.com")
        self.title = os.environ.get("APP_NAME", "GCSMART AI")
    
    def with_model(self, provider: str, model: str):
        self.model = f"{provider}/{model}" if provider else model
        return self
    
    async def send_message(self, message: str) -> str:
        """Send message to OpenRouter API"""
        try:
            if not self.api_key:
                return "Error: OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env"
            
            # Build request payload as per OpenRouter docs
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": self.system_message},
                    {"role": "user", "content": message}
                ],
                "temperature": 0.3,
                "max_tokens": 1000,
            }
            
            # Headers as per OpenRouter documentation
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": self.referer,  # Required for rankings
                "X-OpenRouter-Title": self.title,  # Required for rankings
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    error_msg = f"OpenRouter API error: {response.status_code}"
                    try:
                        error_data = response.json()
                        if "error" in error_data:
                            error_msg += f" - {error_data['error'].get('message', '')}"
                    except:
                        pass
                    logger.error(error_msg)
                    return await self._call_huggingface(message)
                    
        except Exception as e:
            logger.error(f"LLM error: {e}")
            return await self._call_huggingface(message)
    
    async def _call_huggingface(self, message: str) -> str:
        """Fallback to Hugging Face Inference API (free)"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api-inference.huggingface.co/models/microsoft/phi-2",
                    json={
                        "inputs": message,
                        "parameters": {"max_new_tokens": 500}
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list) and len(data) > 0:
                        return data[0].get("generated_text", str(data))
                return "AI service temporarily unavailable. Please try again."
        except Exception as e:
            logger.error(f"Hugging Face error: {e}")
            return f"I apologize, but I'm currently unable to generate a response. Error: {str(e)}"

# ============================================================
# Local Math Solver (Fallback)
# ============================================================

def solve_math_local(question: str) -> Optional[str]:
    """Solve math problems locally using SymPy"""
    try:
        import sympy as sp
        import re
        
        # Extract expression
        expr_str = re.sub(r'(solve|find|simplify|integrate|differentiate|for|the|of)', '', question.lower())
        math_expr = re.findall(r'[0-9xya-z+\-*/^=().]', expr_str)
        expr_str = ''.join(math_expr).strip()
        
        if not expr_str:
            return None
            
        if '=' in expr_str:
            left, right = expr_str.split('=')
            expr = sp.parse_expr(f"{left} - ({right})")
            solutions = sp.solve(expr)
            if solutions:
                return f"Solutions: {', '.join(str(s) for s in solutions)}"
        else:
            expr = sp.parse_expr(expr_str)
            return str(sp.simplify(expr))
    except Exception as e:
        logger.error(f"Local math solver error: {e}")
        return None

# ============================================================
# Pydantic Models
# ============================================================

class ProfileUpdate(BaseModel):
    role: Optional[str] = None
    bio: Optional[str] = None
    institution: Optional[str] = None
    exam_level: Optional[str] = None
    study_year: Optional[int] = None
    subjects: Optional[List[str]] = None
    goals: Optional[List[str]] = None
    daily_commitment: Optional[str] = None
    proficiency: Optional[str] = None
    learning_style: Optional[str] = None
    specialization: Optional[str] = None
    onboarded: Optional[bool] = None

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    subject: Optional[str] = "General"

class GenerateQuestionsRequest(BaseModel):
    level: str
    subject: str
    year: int
    paper: int = 1
    count: int = 10

class SubmitAttemptRequest(BaseModel):
    level: str
    subject: str
    year: int
    paper: int
    answers: List[dict]
    score: int
    total: int
    time_spent: int
    questions_snapshot: Optional[list] = None

class CourseCreate(BaseModel):
    title: str
    description: str
    subject: str
    level: str
    video_url: str
    thumbnail: Optional[str] = None
    price: float = 0
    duration: Optional[str] = "45:00"

class AskRequest(BaseModel):
    paper_id: str
    question: str

class DraftRequest(BaseModel):
    paper_id: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class SolveRequest(BaseModel):
    question: str
    subject: Optional[str] = None

# ============================================================
# Auth Helpers
# ============================================================

def _new_chat(session_id: str, system: str):
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    model = os.environ.get("OPENROUTER_MODEL", "google/gemini-2.5-flash:free")
    chat = SimpleLLM(api_key=api_key, model=model)
    chat.system_message = system
    chat.session_id = session_id
    return chat

async def get_current_user(request: Request):
    """Get current user from session token"""
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ============================================================
# Authentication Routes
# ============================================================

@api_router.post("/auth/register")
async def register_user(req: RegisterRequest):
    """Register a new user"""
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = {
        "user_id": user_id,
        "email": req.email,
        "name": req.name,
        "password": req.password,  # In production, hash this!
        "role": "student",
        "onboarded": False,
        "bio": "",
        "institution": "",
        "exam_level": "",
        "study_year": None,
        "subjects": [],
        "goals": [],
        "daily_commitment": "",
        "proficiency": "",
        "learning_style": "",
        "specialization": "",
        "xp": 0,
        "level": 1,
        "streak": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    user.pop("_id", None)
    return {"success": True, "user": user}

@api_router.post("/auth/login")
async def login_user(req: LoginRequest, response: Response):
    """Login user and create session"""
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # In production, use proper password hashing!
    if user.get("password") != req.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    session_token = f"tok_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none", path="/",
        max_age=7 * 24 * 60 * 60,
    )
    user.pop("_id", None)
    return {"success": True, "user": user, "session_token": session_token}

@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    """Process OAuth session from EmergentAgent"""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session id")

    async with httpx.AsyncClient() as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Auth failed")
    data = r.json()

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user = existing
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture", ""),
            "role": None,
            "onboarded": False,
            "bio": "",
            "institution": "",
            "exam_level": "",
            "study_year": None,
            "subjects": [],
            "goals": [],
            "daily_commitment": "",
            "proficiency": "",
            "learning_style": "",
            "specialization": "",
            "xp": 0,
            "level": 1,
            "streak": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(dict(user))

    session_token = data.get("session_token") or f"tok_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none", path="/",
        max_age=7 * 24 * 60 * 60,
    )
    user.pop("_id", None)
    return user

@api_router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    user.pop("_id", None)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

@api_router.put("/auth/profile")
async def update_profile(payload: ProfileUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return fresh

# ============================================================
# Exam Structure
# ============================================================

EXAM_STRUCTURE = {
    "GCE O Level": ["Mathematics", "English Language", "French", "Physics", "Chemistry",
                    "Biology", "History", "Geography", "Economics", "Literature", "Additional Mathematics"],
    "GCE A Level": ["Pure Mathematics", "Further Mathematics", "Physics", "Chemistry", "Biology",
                    "Economics", "Accounting", "Business Studies", "French", "English Literature"],
    "HND": ["Computer Science", "Business Management", "Accounting", "Marketing", "Law", "Engineering"],
    "Concours": ["General Knowledge", "Mathematics", "French", "English", "Sciences"],
}

@api_router.get("/exam/structure")
async def exam_structure():
    years = list(range(2026, 2009, -1))
    return {"levels": EXAM_STRUCTURE, "years": years, "papers": [1, 2, 3]}

# ============================================================
# Math Solver Endpoint
# ============================================================

@api_router.post("/solve")
async def solve_math_problem(req: SolveRequest, user: dict = Depends(get_current_user)):
    """Solve math problems using local SymPy or AI"""
    # Try local solver first
    local_result = solve_math_local(req.question)
    if local_result:
        return {
            "success": True,
            "answer": local_result,
            "source": "local_solver",
            "confidence": 0.95,
            "question": req.question,
            "subject": req.subject or "Mathematics"
        }
    
    # Fall back to AI
    try:
        system = "You are a math expert. Solve the problem step by step. Return the final answer clearly."
        chat = _new_chat(f"solve_{uuid.uuid4().hex[:12]}", system)
        response = await chat.send_message(req.question)
        return {
            "success": True,
            "answer": response,
            "source": "ai_solver",
            "confidence": 0.85,
            "question": req.question,
            "subject": req.subject or "General"
        }
    except Exception as e:
        logger.error(f"AI solve error: {e}")
        return {
            "success": False,
            "error": str(e),
            "suggestion": "Try rephrasing your question or use specific math notation"
        }

# ============================================================
# AI Question Generation
# ============================================================

@api_router.post("/questions/generate")
async def generate_questions(req: GenerateQuestionsRequest, user: dict = Depends(get_current_user)):
    cache_key = f"{req.level}|{req.subject}|{req.year}|{req.paper}|{req.count}"
    cached = await db.questions_cache.find_one({"cache_key": cache_key}, {"_id": 0})
    if cached:
        return {"questions": cached["questions"], "cached": True}

    system = (
        "You are an expert Cameroon GCE/HND examiner creating authentic multiple-choice exam questions. "
        "Always return STRICT valid JSON only, no markdown, no commentary."
    )
    prompt = (
        f"Create {req.count} exam-standard multiple-choice questions for {req.level} "
        f"{req.subject}, year {req.year}, Paper {req.paper}. "
        "Return a JSON object with key 'questions' as an array. Each item must have: "
        "id (string), text (the question), options (array of exactly 4 strings), "
        "correct_index (0-3 integer), explanation (clear step-by-step solution, 2-4 sentences), "
        "topic (short topic name), difficulty (one of easy/medium/hard), marks (integer 1-4). "
        "Make questions realistic and curriculum-appropriate. Return ONLY the JSON object."
    )
    chat = _new_chat(f"gen_{uuid.uuid4().hex}", system)
    resp = await chat.send_message(prompt)
    text = resp.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        data = json.loads(text)
        questions = data.get("questions", data if isinstance(data, list) else [])
    except Exception:
        logger.error(f"Failed to parse AI questions: {text[:200]}")
        raise HTTPException(status_code=502, detail="AI failed to generate questions")

    for i, q in enumerate(questions):
        q["id"] = q.get("id") or f"q{i+1}"

    await db.questions_cache.insert_one({
        "cache_key": cache_key,
        "questions": questions,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"questions": questions, "cached": False}

# ============================================================
# Attempts & Progress
# ============================================================

@api_router.post("/attempts")
async def submit_attempt(req: SubmitAttemptRequest, user: dict = Depends(get_current_user)):
    accuracy = round((req.score / req.total) * 100) if req.total else 0
    topic_stats = {}
    for a in req.answers:
        t = a.get("topic", "General")
        topic_stats.setdefault(t, {"correct": 0, "total": 0})
        topic_stats[t]["total"] += 1
        if a.get("selected") == a.get("correct"):
            topic_stats[t]["correct"] += 1
    weak = [t for t, s in topic_stats.items() if s["total"] and s["correct"] / s["total"] < 0.5]
    strong = [t for t, s in topic_stats.items() if s["total"] and s["correct"] / s["total"] >= 0.8]

    attempt = {
        "attempt_id": f"att_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "level": req.level, "subject": req.subject, "year": req.year, "paper": req.paper,
        "score": req.score, "total": req.total, "accuracy": accuracy,
        "time_spent": req.time_spent,
        "weak_topics": weak, "strong_topics": strong,
        "answers": req.answers,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.attempts.insert_one(dict(attempt))

    xp_gain = req.score * 10 + (25 if accuracy == 100 else 0)
    new_xp = user.get("xp", 0) + xp_gain
    new_level = 1 + new_xp // 500
    await db.users.update_one({"user_id": user["user_id"]},
                              {"$set": {"xp": new_xp, "level": new_level}})
    attempt.pop("_id", None)
    return {"attempt": attempt, "xp_gain": xp_gain, "new_xp": new_xp, "new_level": new_level}

@api_router.get("/attempts")
async def list_attempts(user: dict = Depends(get_current_user)):
    items = await db.attempts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    attempts = await db.attempts.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    questions_attempted = sum(a["total"] for a in attempts)
    correct = sum(a["score"] for a in attempts)
    accuracy = round((correct / questions_attempted) * 100) if questions_attempted else 0
    study_seconds = sum(a.get("time_spent", 0) for a in attempts)
    study_hours = round(study_seconds / 3600, 1)

    weak_counter, strong_counter = {}, {}
    for a in attempts:
        for t in a.get("weak_topics", []):
            weak_counter[t] = weak_counter.get(t, 0) + 1
        for t in a.get("strong_topics", []):
            strong_counter[t] = strong_counter.get(t, 0) + 1
    weak = sorted(weak_counter, key=weak_counter.get, reverse=True)[:4]
    strong = sorted(strong_counter, key=strong_counter.get, reverse=True)[:4]

    now = datetime.now(timezone.utc)
    week = [0] * 7
    for a in attempts:
        try:
            d = datetime.fromisoformat(a["created_at"])
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            delta = (now.date() - d.date()).days
            if 0 <= delta < 7:
                week[6 - delta] += round(a.get("time_spent", 0) / 60)
        except Exception:
            pass
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    weekday_today = now.weekday()
    consistency = []
    for i in range(7):
        idx = (weekday_today - 6 + i) % 7
        consistency.append({"day": days[idx], "minutes": week[i]})

    return {
        "study_hours": study_hours,
        "questions_attempted": questions_attempted,
        "accuracy": accuracy,
        "streak": user.get("streak", 0),
        "xp": user.get("xp", 0),
        "level": user.get("level", 1),
        "xp_to_next": 500 - (user.get("xp", 0) % 500),
        "weak_topics": weak,
        "strong_topics": strong,
        "recent_attempts": sorted(attempts, key=lambda a: a["created_at"], reverse=True)[:5],
        "consistency": consistency,
        "total_attempts": len(attempts),
    }

# ============================================================
# Leaderboard
# ============================================================

@api_router.get("/leaderboard")
async def leaderboard(user: dict = Depends(get_current_user)):
    users = await db.users.find({"role": "student"}, {"_id": 0, "name": 1, "picture": 1, "xp": 1, "level": 1, "user_id": 1}).to_list(500)
    users.sort(key=lambda u: u.get("xp", 0), reverse=True)
    board = []
    my_rank = None
    for i, u in enumerate(users):
        entry = {"rank": i + 1, "name": u.get("name", "Student"), "picture": u.get("picture", ""),
                 "xp": u.get("xp", 0), "level": u.get("level", 1), "is_me": u["user_id"] == user["user_id"]}
        if entry["is_me"]:
            my_rank = entry
        board.append(entry)
    return {"top": board[:10], "my_rank": my_rank}

# ============================================================
# AI Tutor (Streaming)
# ============================================================

@api_router.get("/ai/sessions")
async def ai_sessions(user: dict = Depends(get_current_user)):
    items = await db.ai_sessions.find({"user_id": user["user_id"]}, {"_id": 0, "messages": 0}).sort("updated_at", -1).to_list(100)
    return items

@api_router.get("/ai/sessions/{session_id}")
async def ai_session_detail(session_id: str, user: dict = Depends(get_current_user)):
    s = await db.ai_sessions.find_one({"session_id": session_id, "user_id": user["user_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    return s

@api_router.post("/ai/chat")
async def ai_chat(req: ChatRequest, user: dict = Depends(get_current_user)):
    """Streaming AI chat endpoint for the AI Tutor"""
    session_id = req.session_id or f"chat_{uuid.uuid4().hex[:12]}"
    session = await db.ai_sessions.find_one({"session_id": session_id, "user_id": user["user_id"]}, {"_id": 0})
    if not session:
        session = {
            "session_id": session_id,
            "user_id": user["user_id"],
            "title": req.message[:50],
            "subject": req.subject,
            "messages": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.ai_sessions.insert_one(dict(session))

    history = session.get("messages", [])
    system = (
        f"You are GC AI, an expert, patient tutor for Cameroon students preparing for "
        f"GCE O/A Level, HND and Concours exams. Subject focus: {req.subject}. "
        "Explain step by step, use clear structure, give worked examples, and end with a short "
        "'Related topics' list when helpful. Be encouraging and exam-focused."
    )
    chat = _new_chat(session_id, system)

    async def event_gen():
        full = ""
        try:
            # Build context from conversation history
            context_prefix = ""
            if history:
                recent = history[-6:]
                context_prefix = "Conversation so far:\n" + "\n".join(
                    f"{m['role'].upper()}: {m['content']}" for m in recent
                ) + "\n\nNow answer the new question.\n\n"
            
            # Get AI response
            response = await chat.send_message(context_prefix + req.message)
            full = response
            
            # Stream response in chunks
            for chunk in [response[i:i+50] for i in range(0, len(response), 50)]:
                yield f"data: {json.dumps({'delta': chunk})}\n\n"
                
        except Exception as e:
            logger.error(f"AI stream error: {e}")
            # Send error message to frontend
            error_msg = "I'm having trouble connecting to my AI service. Please try again in a moment."
            for chunk in [error_msg[i:i+50] for i in range(0, len(error_msg), 50)]:
                yield f"data: {json.dumps({'delta': chunk})}\n\n"
        
        # Persist conversation
        new_messages = history + [
            {"role": "user", "content": req.message, "ts": datetime.now(timezone.utc).isoformat()},
            {"role": "assistant", "content": full, "ts": datetime.now(timezone.utc).isoformat()},
        ]
        await db.ai_sessions.update_one(
            {"session_id": session_id, "user_id": user["user_id"]},
            {"$set": {"messages": new_messages, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        yield f"data: {json.dumps({'done': True, 'session_id': session_id})}\n\n"

    return StreamingResponse(
        event_gen(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream",
        }
    )

@api_router.post("/ai/explain")
async def ai_explain(req: ChatRequest, user: dict = Depends(get_current_user)):
    """Explain a concept using AI"""
    # Try local math solver first
    local_result = solve_math_local(req.message)
    if local_result:
        return {"answer": local_result, "source": "local_solver"}
    
    # Fall back to AI
    system = "You are GC AI, an expert exam tutor. Give a concise, clear step-by-step explanation."
    chat = _new_chat(f"explain_{uuid.uuid4().hex}", system)
    try:
        resp = await chat.send_message(req.message)
        return {"answer": resp, "source": "ai_solver"}
    except Exception as e:
        logger.error(f"AI explain error: {e}")
        return {
            "answer": "I'm having trouble connecting to my AI service. Please try again later.",
            "source": "error",
            "error": str(e)
        }

# ============================================================
# Teacher: Courses & Earnings
# ============================================================

VIEW_RATE_FCFA = 90

@api_router.post("/courses")
async def create_course(req: CourseCreate, user: dict = Depends(get_current_user)):
    course = {
        "course_id": f"crs_{uuid.uuid4().hex[:12]}",
        "teacher_id": user["user_id"],
        "teacher_name": user.get("name", ""),
        "teacher_picture": user.get("picture", ""),
        "title": req.title, "description": req.description,
        "subject": req.subject, "level": req.level,
        "video_url": req.video_url,
        "thumbnail": req.thumbnail or "",
        "price": req.price, "duration": req.duration,
        "views": 0, "earnings": 0, "students": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.courses.insert_one(dict(course))
    course.pop("_id", None)
    return course

@api_router.get("/courses")
async def list_courses(mine: bool = False, user: dict = Depends(get_current_user)):
    q = {"teacher_id": user["user_id"]} if mine else {}
    items = await db.courses.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

@api_router.get("/courses/{course_id}")
async def get_course(course_id: str, user: dict = Depends(get_current_user)):
    c = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    return c

@api_router.post("/courses/{course_id}/view")
async def register_view(course_id: str, user: dict = Depends(get_current_user)):
    course = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Not found")
    existing = await db.course_views.find_one(
        {"course_id": course_id, "student_id": user["user_id"]}, {"_id": 0})
    if existing:
        return {"counted": False, "earnings": course["earnings"]}
    await db.course_views.insert_one({
        "view_id": f"vw_{uuid.uuid4().hex[:10]}",
        "course_id": course_id,
        "student_id": user["user_id"],
        "teacher_id": course["teacher_id"],
        "earning": VIEW_RATE_FCFA,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.courses.update_one({"course_id": course_id},
                                {"$inc": {"views": 1, "students": 1, "earnings": VIEW_RATE_FCFA}})
    return {"counted": True, "rate": VIEW_RATE_FCFA}

@api_router.get("/teacher/stats")
async def teacher_stats(user: dict = Depends(get_current_user)):
    courses = await db.courses.find({"teacher_id": user["user_id"]}, {"_id": 0}).to_list(200)
    total_earnings = sum(c.get("earnings", 0) for c in courses)
    total_views = sum(c.get("views", 0) for c in courses)
    total_students = sum(c.get("students", 0) for c in courses)
    views = await db.course_views.find({"teacher_id": user["user_id"]}, {"_id": 0}).to_list(2000)
    now = datetime.now(timezone.utc)
    monthly = {}
    for v in views:
        try:
            d = datetime.fromisoformat(v["created_at"])
            key = d.strftime("%b")
            monthly[key] = monthly.get(key, 0) + v.get("earning", 0)
        except Exception:
            pass
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    chart = [{"month": m, "earnings": monthly.get(m, 0)} for m in months[max(0, now.month - 6):now.month]]
    return {
        "courses": len(courses),
        "students": total_students,
        "views": total_views,
        "earnings": total_earnings,
        "rate": VIEW_RATE_FCFA,
        "chart": chart,
        "course_table": [{"title": c["title"], "students": c.get("students", 0),
                          "views": c.get("views", 0), "earnings": c.get("earnings", 0)} for c in courses],
    }

# ============================================================
# Seed Demo Data
# ============================================================

@api_router.post("/seed")
async def seed_demo():
    """Seed demo data for testing"""
    teacher = await db.users.find_one({"email": "demo.teacher@gcsmart.cm"}, {"_id": 0})
    if not teacher:
        tid = f"user_{uuid.uuid4().hex[:12]}"
        teacher = {
            "user_id": tid, "email": "demo.teacher@gcsmart.cm",
            "name": "Dr. Amadou Bello", "picture": "",
            "role": "teacher", "onboarded": True, "specialization": "Mathematics",
            "bio": "Head of STEM Research, GCSHARP Academy", "institution": "GCSHARP Academy",
            "xp": 0, "level": 1, "streak": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(dict(teacher))
    tid = teacher["user_id"]
    if await db.courses.count_documents({"teacher_id": tid}) == 0:
        demo_courses = [
            {"title": "Calculus - Chain Rule Masterclass", "subject": "Pure Mathematics", "level": "GCE A Level",
             "video_url": "https://www.youtube.com/embed/HfACrKJ_Y2w", "description": "Differentiation rules for Paper 2, worked step by step.",
             "thumbnail": "https://images.unsplash.com/photo-1655704705321-3ac52dc67f70?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"},
            {"title": "Organic Chemistry: Reaction Mechanisms", "subject": "Chemistry", "level": "GCE A Level",
             "video_url": "https://www.youtube.com/embed/bka20Q9TN6M", "description": "Electrophilic addition and substitution explained clearly.",
             "thumbnail": "https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"},
            {"title": "Physics: Kinematics & Motion", "subject": "Physics", "level": "GCE O Level",
             "video_url": "https://www.youtube.com/embed/ZM8ECpBuQYE", "description": "Equations of motion with real exam examples.",
             "thumbnail": "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"},
        ]
        for c in demo_courses:
            await db.courses.insert_one({
                "course_id": f"crs_{uuid.uuid4().hex[:12]}",
                "teacher_id": tid, "teacher_name": teacher["name"], "teacher_picture": "",
                "price": 0, "duration": "45:00", "views": 0, "earnings": 0, "students": 0,
                "created_at": datetime.now(timezone.utc).isoformat(), **c,
            })

    if await db.papers.count_documents({}) == 0:
        A = "https://customer-assets-0z36b82j.emergentagent.net/job_cameroon-study-hub/artifacts"
        STAT1 = f"{A}/bpetqdqc_PURE%20MATHEMATICS%20with%20statistics%20paper%201.pdf"
        MECH2 = f"{A}/zo09xaaa_A-LEVEL-2025-Pure-mathematics-with-mechanics-2.pdf"
        STAT2 = f"{A}/uar8038x_A-LEVEL-2025-Pure-mathematics-with-statistics-2.pdf"
        seed_papers = [
            {"title": "Pure Mathematics with Statistics — Paper 1 (MCQ)", "subject": "Pure Mathematics", "level": "GCE A Level", "year": 2025, "paper_number": 1, "pdf_url": STAT1, "description": "Official 2025 A-Level multiple choice paper."},
            {"title": "Pure Mathematics with Statistics — Paper 2", "subject": "Pure Mathematics", "level": "GCE A Level", "year": 2025, "paper_number": 2, "pdf_url": STAT2, "description": "Official 2025 A-Level structured/theory paper."},
            {"title": "Pure Mathematics with Mechanics — Paper 2", "subject": "Pure Mathematics", "level": "GCE A Level", "year": 2025, "paper_number": 2, "pdf_url": MECH2, "description": "Official 2025 A-Level mechanics paper."},
        ]
        for sp in seed_papers:
            await db.papers.insert_one({
                "paper_id": f"pap_{uuid.uuid4().hex[:12]}",
                "created_at": datetime.now(timezone.utc).isoformat(), **sp,
            })

    return {"ok": True}

# ============================================================
# PDF Helpers
# ============================================================

_pdf_cache = {}

async def fetch_pdf_bytes(url: str) -> bytes:
    if url in _pdf_cache:
        return _pdf_cache[url]
    async with httpx.AsyncClient(timeout=45, follow_redirects=True) as hc:
        r = await hc.get(url)
    r.raise_for_status()
    _pdf_cache[url] = r.content
    return r.content

def extract_pdf_text(data: bytes, max_chars: int = 9000) -> str:
    reader = PdfReader(io.BytesIO(data))
    parts = []
    for p in reader.pages:
        parts.append(p.extract_text() or "")
    return "\n".join(parts)[:max_chars]

def _clean_json(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)

# ============================================================
# Papers Module
# ============================================================

@api_router.get("/papers/filters")
async def paper_filters(user: dict = Depends(get_current_user)):
    papers = await db.papers.find({}, {"_id": 0}).to_list(1000)
    levels = sorted({p["level"] for p in papers})
    subjects = sorted({p["subject"] for p in papers})
    years = sorted({p["year"] for p in papers}, reverse=True)
    return {"levels": levels, "subjects": subjects, "years": years, "papers": [1, 2, 3]}

@api_router.get("/papers")
async def list_papers(level: Optional[str] = None, subject: Optional[str] = None,
                      year: Optional[int] = None, paper: Optional[int] = None,
                      q: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if level: query["level"] = level
    if subject: query["subject"] = subject
    if year: query["year"] = year
    if paper: query["paper_number"] = paper
    if q: query["title"] = {"$regex": q, "$options": "i"}
    papers = await db.papers.find(query, {"_id": 0}).sort([("year", -1), ("subject", 1)]).to_list(500)
    drafts = await db.drafts.find({"user_id": user["user_id"]}, {"_id": 0, "paper_id": 1}).to_list(500)
    saved = {d["paper_id"] for d in drafts}
    for p in papers:
        p["saved"] = p["paper_id"] in saved
    return papers

@api_router.get("/papers/{paper_id}")
async def get_paper(paper_id: str, user: dict = Depends(get_current_user)):
    p = await db.papers.find_one({"paper_id": paper_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    d = await db.drafts.find_one({"user_id": user["user_id"], "paper_id": paper_id}, {"_id": 0})
    p["saved"] = bool(d)
    return p

@api_router.get("/papers/{paper_id}/pdf")
async def proxy_pdf(paper_id: str, user: dict = Depends(get_current_user)):
    p = await db.papers.find_one({"paper_id": paper_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    try:
        data = await fetch_pdf_bytes(p["pdf_url"])
    except Exception:
        raise HTTPException(status_code=502, detail="Could not load PDF")
    return FastResponse(content=data, media_type="application/pdf",
                        headers={"Cache-Control": "public, max-age=86400"})

@api_router.post("/papers/{paper_id}/qa")
async def generate_paper_qa(paper_id: str, user: dict = Depends(get_current_user)):
    p = await db.papers.find_one({"paper_id": paper_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    cached = await db.paper_qa_cache.find_one({"paper_id": paper_id}, {"_id": 0})
    if cached:
        return {"items": cached["items"], "cached": True}

    data = await fetch_pdf_bytes(p["pdf_url"])
    text = extract_pdf_text(data)
    system = ("You are a senior Cameroon GCE examiner. Read the exam paper text and produce a clear, "
              "step-by-step worked solution section. Return STRICT JSON only.")
    prompt = (
        f"This is {p['level']} {p['subject']} {p['year']} Paper {p['paper_number']}.\n\n"
        f"PAPER TEXT:\n{text}\n\n"
        "Extract the individual questions and for each return a JSON object. "
        "Return JSON: {\"items\":[{\"number\":\"1\",\"question\":\"...\",\"steps\":[\"step 1\",\"step 2\"],\"answer\":\"final answer\"}]}. "
        "Solve at least the first 8 questions you can identify. Keep steps concise and mathematically correct. Return ONLY JSON."
    )
    chat = _new_chat(f"qa_{uuid.uuid4().hex}", system)
    resp = await chat.send_message(prompt)
    try:
        parsed = _clean_json(resp)
        items = parsed.get("items", [])
    except Exception:
        logger.error(f"QA parse fail: {resp[:200]}")
        raise HTTPException(status_code=502, detail="AI could not solve this paper")
    await db.paper_qa_cache.insert_one({"paper_id": paper_id, "items": items,
                                        "created_at": datetime.now(timezone.utc).isoformat()})
    return {"items": items, "cached": False}

@api_router.post("/papers/{paper_id}/video")
async def generate_video_solution(paper_id: str, user: dict = Depends(get_current_user)):
    p = await db.papers.find_one({"paper_id": paper_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")
    cached = await db.paper_video_cache.find_one({"paper_id": paper_id}, {"_id": 0})
    if cached:
        return {"scenes": cached["scenes"], "cached": True}

    data = await fetch_pdf_bytes(p["pdf_url"])
    text = extract_pdf_text(data, max_chars=7000)
    system = ("You are a master teacher creating a narrated video lesson that solves an exam question "
              "step by step on a virtual whiteboard. Return STRICT JSON only.")
    prompt = (
        f"This is {p['level']} {p['subject']} {p['year']} Paper {p['paper_number']}.\n\n"
        f"PAPER TEXT:\n{text}\n\n"
        "Pick the FIRST substantial question and create a video walkthrough that solves it. "
        "Return JSON: {\"title\":\"...\",\"question\":\"...\",\"scenes\":[{\"heading\":\"Step title\","
        "\"board\":[\"line shown on whiteboard\",\"another line\"],\"narration\":\"what the teacher says, <= 500 chars\"}]}. "
        "Create 4 to 6 scenes ending with the final answer. Narration must be natural spoken English. Return ONLY JSON."
    )
    chat = _new_chat(f"vid_{uuid.uuid4().hex}", system)
    resp = await chat.send_message(prompt)
    try:
        parsed = _clean_json(resp)
        raw_scenes = parsed.get("scenes", [])
    except Exception:
        logger.error(f"Video parse fail: {resp[:200]}")
        raise HTTPException(status_code=502, detail="AI could not build a video solution")

    scenes = []
    for i, sc in enumerate(raw_scenes[:6]):
        narration = (sc.get("narration") or sc.get("heading") or "")[:900]
        scenes.append({
            "heading": sc.get("heading", f"Step {i+1}"),
            "board": sc.get("board", []),
            "narration": narration,
            "audio": "",
        })
    doc = {"paper_id": paper_id, "title": parsed.get("title", p["title"]),
           "question": parsed.get("question", ""), "scenes": scenes,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.paper_video_cache.insert_one(dict(doc))
    return {"scenes": scenes, "title": doc["title"], "question": doc["question"], "cached": False}

@api_router.post("/papers/ask")
async def ask_about_paper(req: AskRequest, user: dict = Depends(get_current_user)):
    p = await db.papers.find_one({"paper_id": req.paper_id}, {"_id": 0})
    subject = p["subject"] if p else "General"
    system = (f"You are GC AI, an expert {subject} tutor. A student highlighted a question from an exam paper. "
              "Solve it clearly with concise numbered steps and a final answer.")
    chat = _new_chat(f"ask_{uuid.uuid4().hex}", system)
    resp = await chat.send_message(f"Solve this exam question step by step:\n\n{req.question}")
    return {"answer": resp}

# ============================================================
# Drafts
# ============================================================

@api_router.get("/drafts")
async def list_drafts(user: dict = Depends(get_current_user)):
    drafts = await db.drafts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    ids = [d["paper_id"] for d in drafts]
    papers = await db.papers.find({"paper_id": {"$in": ids}}, {"_id": 0}).to_list(500)
    pmap = {p["paper_id"]: p for p in papers}
    result = []
    for d in drafts:
        pp = pmap.get(d["paper_id"])
        if pp:
            pp = dict(pp); pp["saved"] = True; pp["saved_at"] = d["created_at"]
            result.append(pp)
    return result

@api_router.post("/drafts")
async def save_draft(req: DraftRequest, user: dict = Depends(get_current_user)):
    existing = await db.drafts.find_one({"user_id": user["user_id"], "paper_id": req.paper_id})
    if existing:
        await db.drafts.delete_one({"user_id": user["user_id"], "paper_id": req.paper_id})
        return {"saved": False}
    await db.drafts.insert_one({"user_id": user["user_id"], "paper_id": req.paper_id,
                                "created_at": datetime.now(timezone.utc).isoformat()})
    return {"saved": True}

@api_router.delete("/drafts/{paper_id}")
async def delete_draft(paper_id: str, user: dict = Depends(get_current_user)):
    await db.drafts.delete_one({"user_id": user["user_id"], "paper_id": paper_id})
    return {"ok": True}

# ============================================================
# Root Endpoints
# ============================================================

@api_router.get("/")
async def root():
    return {
        "message": "GCSMART API",
        "version": "2.0.0",
        "status": "running",
        "endpoints": {
            "auth": "/api/auth",
            "exam": "/api/exam/structure",
            "solve": "/api/solve",
            "papers": "/api/papers",
            "ai": "/api/ai/chat",
            "docs": "/docs"
        }
    }

app.include_router(api_router)

# ============================================================
# Shutdown Handler
# ============================================================

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ============================================================
# Main Entry Point
# ============================================================

if __name__ == "__main__":
    import uvicorn
    
    PORT = int(os.environ.get("PORT", 8000))
    
    print("🚀 Starting GCSMART API Server...")
    print(f"📚 MongoDB: {MONGO_URL[:50]}...")
    print(f"🌐 API: {APP_URL}")
    print(f"📖 Docs: {APP_URL}/docs")
    print(f"🔗 CORS Origins: {CORS_ORIGINS}")
    print(f"🤖 AI Model: {os.environ.get('OPENROUTER_MODEL', 'google/gemini-2.5-flash:free')}")
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=PORT,
        log_level="info"
    )