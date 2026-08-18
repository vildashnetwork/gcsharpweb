# server_working.py - GCSMART Backend API (Production Ready)
import os
import io
import re
import json
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import httpx
from pypdf import PdfReader
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from fastapi.responses import StreamingResponse, Response as FastResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

from twilio.rest import Client as TwilioClient
from twilio.base.exceptions import TwilioRestException

# ============================================================
# Setup logging FIRST - before using logger anywhere
# ============================================================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gcsmart")

# ============================================================
# Configuration & Environment
# ============================================================

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB Connection
MONGO_URL = os.environ.get('MONGO_URL')
if not MONGO_URL:
    raise RuntimeError("MONGO_URL environment variable is not set")
DB_NAME = os.environ.get('DB_NAME', 'gcsmart')
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')
APP_URL = os.environ.get('APP_URL', 'https://gcsharpweb.onrender.com')
APP_NAME = os.environ.get('APP_NAME', 'GCSMART AI')

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
TWILIO_MESSAGING_SERVICE_SID = os.environ.get('TWILIO_MESSAGING_SERVICE_SID')

# Initialize Twilio client
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        logger.info("Twilio client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Twilio client: {e}")
else:
    logger.warning("Twilio credentials not configured - SMS sending will be disabled")

# Initialize MongoDB
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ============================================================
# FastAPI App
# ============================================================

app = FastAPI(
    title="GCSHARP API",
    version="2.1.0",
    description="AI-Powered Educational Platform for Cameroon Students",
    docs_url="/docs",
    redoc_url="/redoc"
)

api_router = APIRouter(prefix="/api")

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
# LLM Client (OpenRouter, with a resilient model fallback chain)
# ============================================================

DEFAULT_MODEL_CHAIN = [
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "openai/gpt-oss-20b:free",
    "openrouter/free",
]

# ============================================================
# Twilio SMS Helper Function
# ============================================================

def send_sms_via_twilio(to_number: str, message: str) -> dict:
    """
    Send SMS using Twilio
    Returns: {'success': bool, 'sid': str, 'error': str}
    """
    if not twilio_client:
        return {
            'success': False,
            'error': 'Twilio client not initialized. Check your credentials.'
        }
    
    if not TWILIO_PHONE_NUMBER and not TWILIO_MESSAGING_SERVICE_SID:
        return {
            'success': False,
            'error': 'No sending phone number or messaging service configured.'
        }
    
    try:
        # Format the phone number with country code
        if not to_number.startswith('+'):
            to_number = '+' + to_number
        
        logger.info(f"Sending SMS to: {to_number}")
        
        # Send SMS using messaging service or direct phone number
        if TWILIO_MESSAGING_SERVICE_SID:
            message = twilio_client.messages.create(
                body=message,
                messaging_service_sid=TWILIO_MESSAGING_SERVICE_SID,
                to=to_number
            )
        else:
            message = twilio_client.messages.create(
                body=message,
                from_=TWILIO_PHONE_NUMBER,
                to=to_number
            )
        
        logger.info(f"SMS sent successfully. SID: {message.sid}")
        return {
            'success': True,
            'sid': message.sid,
            'status': message.status
        }
    except TwilioRestException as e:
        logger.error(f"Twilio error: {e}")
        return {
            'success': False,
            'error': f"Twilio error: {e.msg}",
            'code': e.code
        }
    except Exception as e:
        logger.error(f"Failed to send SMS: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def _sanitize_model_id(raw: str) -> str:
    s = raw.strip()
    m = re.match(r'^[A-Z][A-Z0-9_]*=(.+)$', s)
    if m:
        logger.warning(
            f"OPENROUTER_MODEL env var looks like it contains a 'KEY=' prefix "
            f"({s!r}) — stripping it. Fix the Render env var to contain only "
            f"the model ID, not the full 'KEY=VALUE' line."
        )
        s = m.group(1).strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ('"', "'"):
        s = s[1:-1].strip()
    return s

def _get_model_chain() -> List[str]:
    primary = _sanitize_model_id(os.environ.get("OPENROUTER_MODEL", DEFAULT_MODEL_CHAIN[0]))
    extra_raw = os.environ.get("OPENROUTER_MODEL_FALLBACKS", "")
    extra = [_sanitize_model_id(m) for m in extra_raw.split(",") if m.strip()]
    chain = [primary] + extra + DEFAULT_MODEL_CHAIN
    seen = set()
    ordered = []
    for m in chain:
        if m not in seen:
            seen.add(m)
            ordered.append(m)
    return ordered

class SimpleLLM:
    def __init__(self, api_key: str = "", models: Optional[List[str]] = None):
        self.api_key = api_key or os.environ.get("OPENROUTER_API_KEY", "")
        self.models = models or _get_model_chain()
        self.base_url = "https://openrouter.ai/api/v1"
        self.system_message = ""
        self.session_id = None
        self.referer = os.environ.get("APP_URL", "https://gcsharpweb.onrender.com")
        self.title = os.environ.get("APP_NAME", "GCSMART AI")

    async def _call_model(self, hc: httpx.AsyncClient, model: str, message: str) -> Optional[str]:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": self.system_message},
                {"role": "user", "content": message},
            ],
            "temperature": 0.3,
            "max_tokens": 1000,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": self.referer,
            "X-Title": self.title,
        }
        try:
            response = await hc.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
        except httpx.RequestError as e:
            logger.warning(f"OpenRouter request error for model {model}: {e}")
            return None

        if response.status_code == 200:
            try:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                if content and content.strip():
                    return content
                logger.warning(f"OpenRouter model {model} returned empty content")
                return None
            except (KeyError, IndexError, ValueError) as e:
                logger.warning(
                    f"OpenRouter model {model} returned unparseable response: {e}. "
                    f"Raw body (truncated): {response.text[:300]!r}"
                )
                return None

        detail = ""
        try:
            error_data = response.json()
            detail = error_data.get("error", {}).get("message", "")
        except Exception:
            pass
        logger.warning(f"OpenRouter model {model} failed: {response.status_code} {detail}")
        return None

    async def send_message(self, message: str) -> str:
        if not self.api_key:
            logger.error("OPENROUTER_API_KEY is not configured")
            return self._friendly_failure_message()

        async with httpx.AsyncClient(timeout=30.0) as hc:
            for model in self.models:
                result = await self._call_model(hc, model, message)
                if result is not None:
                    return result

        logger.error(f"All models in fallback chain failed: {self.models}")
        return self._friendly_failure_message()

    @staticmethod
    def _friendly_failure_message() -> str:
        return (
            "I'm having trouble reaching the AI service right now. "
            "This is usually temporary — please try again in a moment. "
            "In the meantime, you can browse past papers or check your dashboard."
        )

# ============================================================
# Local Math Solver
# ============================================================

def solve_math_local(question: str) -> Optional[str]:
    try:
        import sympy as sp
        from sympy.parsing.sympy_parser import (
            parse_expr, standard_transformations, implicit_multiplication_application,
        )

        q = question.lower().strip()
        math_signal = re.search(r'[0-9]', q) and re.search(r'[+\-*/=^]|sqrt|solve|simplify|factor|derivative|integrate', q)
        if not math_signal:
            return None

        transformations = standard_transformations + (implicit_multiplication_application,)
        wants_factor = bool(re.search(r'\bfactor(ise)?\b', q))

        cleaned = re.sub(r'\b(solve|find|simplify|integrate|differentiate|factor(ise)?|for|the|of|value|calculate|what\s+is)\b', ' ', q)
        allowed = re.findall(r'[0-9a-z+\-*/^=().,\s]', cleaned)
        expr_str = ''.join(allowed).strip()
        expr_str = re.sub(r'\s+', ' ', expr_str).strip()
        expr_str = expr_str.replace('^', '**')

        if not expr_str or not re.search(r'[0-9]', expr_str):
            return None

        if '=' in expr_str:
            parts = expr_str.split('=')
            if len(parts) != 2:
                return None
            left, right = parts
            expr = parse_expr(f"({left}) - ({right})", transformations=transformations)
            free_syms = list(expr.free_symbols)
            if not free_syms:
                return None
            solutions = sp.solve(expr, free_syms[0] if len(free_syms) == 1 else free_syms)
            if solutions:
                return f"Solutions: {', '.join(str(s) for s in solutions)}"
            return None
        elif wants_factor:
            expr = parse_expr(expr_str, transformations=transformations)
            factored = sp.factor(expr)
            if str(factored) == str(expr):
                return None
            return str(factored)
        else:
            expr = parse_expr(expr_str, transformations=transformations)
            simplified = sp.simplify(expr)
            return str(simplified)
    except Exception as e:
        logger.debug(f"Local math solver could not handle question: {e}")
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
# Phone & Email Login Models
# ============================================================

class PhoneLoginRequest(BaseModel):
    phone: str
    country_code: str = "+237"

class PhoneVerifyRequest(BaseModel):
    phone: str
    country_code: str = "+237"
    otp: str

class EmailLoginRequest(BaseModel):
    email: str
    password: str

class EmailSignupRequest(BaseModel):
    name: str
    email: str
    password: str

# ============================================================
# Auth Helpers
# ============================================================

def _new_chat(session_id: str, system: str) -> SimpleLLM:
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    chat = SimpleLLM(api_key=api_key)
    chat.system_message = system
    chat.session_id = session_id
    return chat

async def get_current_user(request: Request):
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
# Phone & Email Authentication Routes
# ============================================================

# ---------- PHONE AUTH ----------

@api_router.post("/auth/phone/send-otp")
async def send_phone_otp(req: PhoneLoginRequest):
    """Send OTP to phone number via Twilio"""
    try:
        # Generate 6-digit OTP
        otp_code = ''.join([str(uuid.uuid4().int % 10) for _ in range(6)])
        
        # Store OTP in database with expiration (5 minutes)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
        await db.phone_otps.insert_one({
            "phone": req.phone,
            "country_code": req.country_code,
            "otp": otp_code,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "verified": False
        })
        
        # Format the full phone number
        full_number = f"{req.country_code}{req.phone}"
        
        # Create SMS message
        sms_message = f"Your GCSHARP verification code is: {otp_code}. Valid for 5 minutes."
        
        # Send SMS via Twilio
        result = send_sms_via_twilio(full_number, sms_message)
        
        if result['success']:
            logger.info(f"OTP sent to {full_number} via SMS. SID: {result.get('sid')}")
            return {
                "success": True,
                "message": "Verification code sent via SMS",
                "expires_in": 300
            }
        else:
            # Log the error
            logger.error(f"SMS failed for {full_number}: {result.get('error')}")
            
            # Check if we're in development mode
            env = os.environ.get("ENVIRONMENT", "development")
            
            if env == "development":
                # In development, return OTP for testing
                logger.info(f"Development mode: OTP for {full_number} is {otp_code}")
                return {
                    "success": True,
                    "message": "OTP generated (development mode - SMS not sent)",
                    "otp": otp_code,
                    "expires_in": 300,
                    "warning": "SMS not sent - Twilio error: " + result.get('error', 'Unknown error')
                }
            else:
                # In production, don't return OTP
                return {
                    "success": False,
                    "message": "Failed to send verification code. Please try again.",
                    "error": "SMS delivery failed"
                }
    except Exception as e:
        logger.error(f"Send OTP error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification code")

@api_router.post("/auth/phone/verify")
async def verify_phone_otp(req: PhoneVerifyRequest, response: Response):
    """Verify OTP and login/register user"""
    try:
        # Find valid OTP
        otp_record = await db.phone_otps.find_one({
            "phone": req.phone,
            "country_code": req.country_code,
            "otp": req.otp,
            "verified": False
        })
        
        if not otp_record:
            raise HTTPException(status_code=401, detail="Invalid verification code")
        
        # Check expiration
        expires_at = otp_record["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Verification code expired")
        
        # Mark OTP as verified
        await db.phone_otps.update_one(
            {"_id": otp_record["_id"]},
            {"$set": {"verified": True}}
        )
        
        # Find or create user
        phone_full = f"{req.country_code}{req.phone}"
        user = await db.users.find_one({"phone": phone_full}, {"_id": 0})
        
        if not user:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user = {
                "user_id": user_id,
                "phone": phone_full,
                "email": f"user_{uuid.uuid4().hex[:8]}@gcsmart.temp",
                "name": f"User {phone_full[-4:]}",
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
        
        # Create session
        session_token = f"tok_{uuid.uuid4().hex}"
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.user_sessions.insert_one({
            "user_id": user["user_id"],
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        # Set cookie
        response.set_cookie(
            key="session_token", value=session_token,
            httponly=True, secure=True, samesite="none", path="/",
            max_age=7 * 24 * 60 * 60,
        )
        
        user.pop("_id", None)
        user.pop("password", None)
        return {
            "success": True, 
            "user": user,
            "session_token": session_token
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verify OTP error: {e}")
        raise HTTPException(status_code=500, detail="Verification failed")

# ---------- EMAIL AUTH ----------

@api_router.post("/auth/email/register")
async def email_register(req: EmailSignupRequest):
    """Register with email and password"""
    try:
        # Check if email exists
        existing = await db.users.find_one({"email": req.email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": req.email,
            "name": req.name,
            "password": req.password,
            "phone": None,
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
        
        user.pop("_id", None)
        user.pop("password", None)
        
        return {"success": True, "user": user}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email register error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")

@api_router.post("/auth/email/login")
async def email_login(req: EmailLoginRequest, response: Response):
    """Login with email and password"""
    try:
        user = await db.users.find_one({"email": req.email}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # In production, use proper password hashing!
        if user.get("password") != req.password:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Create session
        session_token = f"tok_{uuid.uuid4().hex}"
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.user_sessions.insert_one({
            "user_id": user["user_id"],
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        # Set cookie
        response.set_cookie(
            key="session_token", value=session_token,
            httponly=True, secure=True, samesite="none", path="/",
            max_age=7 * 24 * 60 * 60,
        )
        
        user.pop("_id", None)
        user.pop("password", None)
        
        return {
            "success": True, 
            "user": user,
            "session_token": session_token
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

# ---------- EXISTING AUTH ROUTES ----------

@api_router.post("/auth/register")
async def register_user(req: RegisterRequest):
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = {
        "user_id": user_id,
        "email": req.email,
        "name": req.name,
        "password": req.password,
        "phone": None,
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
    user.pop("password", None)
    return {"success": True, "user": user}

@api_router.post("/auth/login")
async def login_user(req: LoginRequest, response: Response):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

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
    user.pop("password", None)
    return {"success": True, "user": user, "session_token": session_token}



@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
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
            "phone": None,
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
    user.pop("password", None)
    
    # ✅ Return session_token in the response body
    return {
        "user": user,
        "session_token": session_token  # Add this!
    }



@api_router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    user.pop("_id", None)
    user.pop("password", None)
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
    fresh.pop("password", None)
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
        logger.error(f"Solve endpoint error: {e}")
        return {
            "success": False,
            "answer": "I couldn't work through that problem right now. Try rephrasing it with clearer math notation, or try again shortly.",
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
        "Always return STRICT valid JSON only, no markdown, no commentary, no reasoning or thinking text before or after the JSON."
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
    try:
        data = _clean_json(resp)
        questions = data.get("questions", data if isinstance(data, list) else [])
        if not questions:
            raise ValueError("empty questions list")
    except Exception:
        logger.error(f"Failed to parse AI questions: {resp[:200]}")
        raise HTTPException(status_code=502, detail="Couldn't generate questions right now. Please try again shortly.")

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
            context_prefix = ""
            if history:
                recent = history[-6:]
                context_prefix = "Conversation so far:\n" + "\n".join(
                    f"{m['role'].upper()}: {m['content']}" for m in recent
                ) + "\n\nNow answer the new question.\n\n"

            response = await chat.send_message(context_prefix + req.message)
            full = response

            for chunk in [response[i:i+50] for i in range(0, len(response), 50)]:
                yield f"data: {json.dumps({'delta': chunk})}\n\n"

        except Exception as e:
            logger.error(f"AI stream error: {e}")
            error_msg = "I'm having trouble connecting to my AI service. Please try again in a moment."
            full = error_msg
            for chunk in [error_msg[i:i+50] for i in range(0, len(error_msg), 50)]:
                yield f"data: {json.dumps({'delta': chunk})}\n\n"

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

@api_router.get("/ai/health")
async def ai_health(user: dict = Depends(get_current_user)):
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    result = {
        "api_key_configured": bool(api_key),
        "api_key_prefix": (api_key[:12] + "...") if api_key else None,
        "models_tested": [],
    }

    if not api_key:
        result["diagnosis"] = "OPENROUTER_API_KEY is not set in this environment. Set it in Render's dashboard under Environment, not just your local .env."
        return result

    models = _get_model_chain()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.environ.get("APP_URL", "https://gcsharpweb.onrender.com"),
        "X-Title": os.environ.get("APP_NAME", "GCSMART AI"),
    }
    any_success = False
    async with httpx.AsyncClient(timeout=15.0) as hc:
        for model in models:
            entry = {"model": model}
            try:
                resp = await hc.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": "Reply with just: OK"}],
                        "max_tokens": 10,
                    },
                )
                entry["status_code"] = resp.status_code
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    entry["ok"] = bool(content and content.strip())
                    entry["sample_response"] = (content or "")[:60]
                    if entry["ok"]:
                        any_success = True
                else:
                    entry["ok"] = False
                    try:
                        err = resp.json()
                        entry["error"] = err.get("error", {}).get("message", resp.text[:200])
                    except Exception:
                        entry["error"] = resp.text[:200]
            except httpx.RequestError as e:
                entry["ok"] = False
                entry["error"] = f"Network error: {e}"
            result["models_tested"].append(entry)

    if any_success:
        result["diagnosis"] = "At least one model works. If users still see failures, it may be intermittent rate limiting."
    elif all(m.get("status_code") == 401 for m in result["models_tested"]):
        result["diagnosis"] = "All models returned 401 Unauthorized. The API key is invalid."
    elif all(m.get("status_code") == 429 for m in result["models_tested"]):
        result["diagnosis"] = "All models returned 429 Rate Limited. Check openrouter.ai/activity for your usage."
    else:
        result["diagnosis"] = "Mixed failures across models — see individual entries above."

    return result

@api_router.post("/ai/explain")
async def ai_explain(req: ChatRequest, user: dict = Depends(get_current_user)):
    local_result = solve_math_local(req.message)
    if local_result:
        return {"answer": local_result, "source": "local_solver"}

    system = "You are GC AI, an expert exam tutor. Give a concise, clear step-by-step explanation."
    chat = _new_chat(f"explain_{uuid.uuid4().hex}", system)
    try:
        resp = await chat.send_message(req.message)
        return {"answer": resp, "source": "ai_solver"}
    except Exception as e:
        logger.error(f"AI explain error: {e}")
        return {
            "answer": "I'm having trouble connecting to my AI service. Please try again in a moment.",
            "source": "error",
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

    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        pass

    fence_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fence_match:
        try:
            return json.loads(fence_match.group(1))
        except (json.JSONDecodeError, ValueError):
            pass

    start = text.find('{')
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            ch = text[i]
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    candidate = text[start:i + 1]
                    try:
                        return json.loads(candidate)
                    except (json.JSONDecodeError, ValueError):
                        break

    raise ValueError("Could not extract valid JSON from AI response")

# ============================================================
# Papers Module
# ============================================================

@api_router.get("/papers/filters")
async def paper_filters(user: dict = Depends(get_current_user)):
    papers = await db.papers.find({}, {"_id": 0}).to_list(1000)
    levels = sorted({p.get("level", "Unknown") for p in papers})
    subjects = sorted({p.get("subject", "Unknown") for p in papers})
    years = sorted({p.get("year", 0) for p in papers}, reverse=True)
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
    if q: query["title"] = {"$regex": re.escape(q), "$options": "i"}
    
    papers = await db.papers.find(query, {"_id": 0}).sort([("year", -1), ("subject", 1)]).to_list(500)
    
    for p in papers:
        p.setdefault("fileSize", 0)
        p.setdefault("originalFileSize", 0)
        p.setdefault("fileType", "application/pdf")
        p.setdefault("uploadedBy", None)
        p.setdefault("uploaderName", "Anonymous")
        p.setdefault("downloads", 0)
        p.setdefault("description", "")
        p.setdefault("saved", False)
    
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
              "step-by-step worked solution section. Return STRICT JSON only, with no reasoning or thinking text before or after it.")
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
        if not items:
            raise ValueError("empty items")
    except Exception:
        logger.error(f"QA parse fail: {resp[:200]}")
        raise HTTPException(status_code=502, detail="Couldn't generate a solution for this paper right now. Please try again shortly.")
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
              "step by step on a virtual whiteboard. Return STRICT JSON only, with no reasoning or thinking text before or after it.")
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
        if not raw_scenes:
            raise ValueError("empty scenes")
    except Exception:
        logger.error(f"Video parse fail: {resp[:200]}")
        raise HTTPException(status_code=502, detail="Couldn't build a video solution right now. Please try again shortly.")

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
    try:
        drafts = await db.drafts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
        
        if not drafts:
            return []
            
        ids = [d["paper_id"] for d in drafts]
        papers = await db.papers.find({"paper_id": {"$in": ids}}, {"_id": 0}).to_list(500)
        pmap = {p["paper_id"]: p for p in papers}
        
        result = []
        for d in drafts:
            pp = pmap.get(d["paper_id"])
            if pp:
                pp = dict(pp)
                pp["saved"] = True
                pp["saved_at"] = d["created_at"]
                result.append(pp)
            else:
                result.append({
                    "paper_id": d["paper_id"],
                    "title": "Paper not found",
                    "subject": "Unknown",
                    "level": "Unknown",
                    "year": 0,
                    "paper_number": 0,
                    "pdf_url": "",
                    "description": "",
                    "saved": True,
                    "saved_at": d["created_at"]
                })
        return result
    except Exception as e:
        logger.error(f"List drafts error: {e}")
        return []

@api_router.post("/drafts")
async def save_draft(req: DraftRequest, user: dict = Depends(get_current_user)):
    try:
        logger.info(f"Drafts - User: {user['user_id']}, Paper: {req.paper_id}")
        
        paper = await db.papers.find_one({"paper_id": req.paper_id})
        if not paper:
            logger.warning(f"Drafts - Paper not found: {req.paper_id}, but allowing draft")
        
        existing = await db.drafts.find_one({
            "user_id": user["user_id"], 
            "paper_id": req.paper_id
        })
        
        if existing:
            await db.drafts.delete_one({"user_id": user["user_id"], "paper_id": req.paper_id})
            logger.info(f"Drafts - Removed draft for {req.paper_id}")
            return {"saved": False}
        
        await db.drafts.insert_one({
            "user_id": user["user_id"],
            "paper_id": req.paper_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Drafts - Saved draft for {req.paper_id}")
        return {"saved": True}
    except Exception as e:
        logger.error(f"Drafts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/drafts/{paper_id}")
async def delete_draft(paper_id: str, user: dict = Depends(get_current_user)):
    try:
        await db.drafts.delete_one({"user_id": user["user_id"], "paper_id": paper_id})
        return {"ok": True}
    except Exception as e:
        logger.error(f"Delete draft error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# Root Endpoints
# ============================================================

@api_router.get("/")
async def root():
    return {
        "message": "GCSMART API",
        "version": "2.1.0",
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

    print("Starting GCSMART API Server...")
    print(f"MongoDB: {MONGO_URL[:30]}...")
    print(f"API: {APP_URL}")
    print(f"Docs: {APP_URL}/docs")
    print(f"CORS Origins: {CORS_ORIGINS}")
    print(f"AI Model chain: {_get_model_chain()}")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT,
        log_level="info"
    )