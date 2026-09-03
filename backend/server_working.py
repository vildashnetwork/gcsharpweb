# server_working.py - WEB Backend API (Production Ready)
import os
import io
import re
import unicodedata
import json
import uuid
import hashlib
import logging
import asyncio
import secrets
import requests
from urllib.parse import urlencode, urlparse
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Dict

import httpx
from pypdf import PdfReader
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import RedirectResponse, StreamingResponse, Response as FastResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from bson import ObjectId

from twilio.rest import Client as TwilioClient
from twilio.base.exceptions import TwilioRestException

# APScheduler
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

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
GOOGLE_CALLBACK = os.environ.get('CALLBACK', '')
GOOGLE_CLIENT_ID = os.environ.get('CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('CLIENT_SECRET', '')
FRONTEND_URLS = {
    origin.strip().rstrip('/')
    for origin in os.environ.get(
        'FRONTEND_URLS', 'https://gcsharp.com,http://localhost:3000'
    ).split(',')
    if origin.strip()
}

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
TWILIO_MESSAGING_SERVICE_SID = os.environ.get('TWILIO_MESSAGING_SERVICE_SID')

# Brevo Configuration
BREVO_API_KEY = os.environ.get('BREVO_API_KEY')
BREVO_FROM_EMAIL = os.environ.get('BREVO_FROM_EMAIL', 'no-reply@yourdomain.com')
BREVO_FROM_NAME = os.environ.get('BREVO_FROM_NAME', 'GCSharp')

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
            "max_tokens": 2000,
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
    name: Optional[str] = None
    picture: Optional[str] = None

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
# Settings Models
# ============================================================

DEFAULT_SETTINGS = {
    "autoplay_next": True,
    "default_playback_speed": 1.0,
    "default_video_quality": "auto",
    "captions_enabled": False,
    "notifications_enabled": True,
    "email_notifications": True,
    "theme": "system",
    "language": "en",
}

class SettingsUpdate(BaseModel):
    autoplay_next: Optional[bool] = None
    default_playback_speed: Optional[float] = None
    default_video_quality: Optional[str] = None
    captions_enabled: Optional[bool] = None
    notifications_enabled: Optional[bool] = None
    email_notifications: Optional[bool] = None
    theme: Optional[str] = None
    language: Optional[str] = None

# ============================================================
# WebSocket Connection Manager for real‑time notifications
# ============================================================

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        self.active_connections.pop(user_id, None)

    async def send_personal_message(self, message: dict, user_id: str):
        websocket = self.active_connections.get(user_id)
        if websocket:
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(user_id)

manager = ConnectionManager()

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

def _frontend_redirect(origin: str) -> str:
    parsed = urlparse(origin)
    candidate = f'{parsed.scheme}://{parsed.netloc}'.rstrip('/')
    if candidate in FRONTEND_URLS:
        return candidate
    return next(iter(FRONTEND_URLS))


def _frontend_target(url: str) -> str:
    parsed = urlparse(url)
    origin = _frontend_redirect(url)
    path = parsed.path or '/'
    if not path.startswith('/') or path.startswith('//'):
        path = '/'
    query = f'?{parsed.query}' if parsed.query else ''
    return f'{origin}{path}{query}'


async def _create_google_session(profile: dict, response: Response):
    email = profile.get('email')
    if not email:
        raise HTTPException(status_code=401, detail='Google did not return an email address')

    user = await db.users.find_one({'email': email}, {'_id': 0})
    if not user:
        user = {
            'user_id': f'user_{uuid.uuid4().hex[:12]}',
            'email': email,
            'name': profile.get('name', ''),
            'picture': profile.get('picture', ''),
            'phone': None,
            'role': None,
            'onboarded': False,
            'bio': '',
            'institution': '',
            'exam_level': '',
            'study_year': None,
            'subjects': [],
            'goals': [],
            'daily_commitment': '',
            'proficiency': '',
            'learning_style': '',
            'specialization': '',
            'xp': 0,
            'level': 1,
            'streak': 0,
            'accuracy': 0,
            'created_at': datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(dict(user))

    session_token = f'tok_{uuid.uuid4().hex}'
    await db.user_sessions.insert_one({
        'user_id': user['user_id'],
        'session_token': session_token,
        'expires_at': (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        'created_at': datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie(
        key='session_token', value=session_token, httponly=True,
        secure=GOOGLE_CALLBACK.startswith('https://'), samesite='lax', path='/',
        max_age=7 * 24 * 60 * 60,
    )


@api_router.get('/auth/google/login')
async def google_login(redirect: str = 'https://gcsharp.com'):
    if not GOOGLE_CALLBACK or not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail='Google OAuth is not configured')

    state = secrets.token_urlsafe(32)
    redirect_target = _frontend_target(redirect)
    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': GOOGLE_CALLBACK,
        'response_type': 'code',
        'scope': 'openid email profile',
        'state': state,
        'access_type': 'offline',
        'prompt': 'select_account',
    }
    response = RedirectResponse(
        f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}",
        status_code=302,
    )
    response.set_cookie(
        key='google_oauth_state', value=state, httponly=True,
        secure=GOOGLE_CALLBACK.startswith('https://'), samesite='lax', path='/',
        max_age=600,
    )
    response.set_cookie(
        key='google_oauth_redirect', value=redirect_target, httponly=True,
        secure=GOOGLE_CALLBACK.startswith('https://'), samesite='lax', path='/',
        max_age=600,
    )
    return response


@app.get('/auth/callback')
async def google_callback(request: Request, code: Optional[str] = None,
                          state: Optional[str] = None, error: Optional[str] = None):
    redirect_target = _frontend_target(request.cookies.get('google_oauth_redirect', ''))
    if error or not code or not state or state != request.cookies.get('google_oauth_state'):
        return RedirectResponse(f'{_frontend_redirect(redirect_target)}/?auth_error=google')

    async with httpx.AsyncClient() as hc:
        token_response = await hc.post(
            'https://oauth2.googleapis.com/token',
            data={
                'code': code,
                'client_id': GOOGLE_CLIENT_ID,
                'client_secret': GOOGLE_CLIENT_SECRET,
                'redirect_uri': GOOGLE_CALLBACK,
                'grant_type': 'authorization_code',
            },
        )
        if token_response.status_code != 200:
            return RedirectResponse(f'{_frontend_redirect(redirect_target)}/?auth_error=google')
        access_token = token_response.json().get('access_token')
        profile_response = await hc.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
        )

    if profile_response.status_code != 200:
        return RedirectResponse(f'{_frontend_redirect(redirect_target)}/?auth_error=google')

    response = RedirectResponse(redirect_target, status_code=302)
    await _create_google_session(profile_response.json(), response)
    response.delete_cookie('google_oauth_state', path='/')
    response.delete_cookie('google_oauth_redirect', path='/')
    return response

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
                "accuracy": 0,
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
            "accuracy": 0,
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
        "accuracy": 0,
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
    raise HTTPException(status_code=410, detail="Legacy OAuth sessions are no longer supported")
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session id")

    async with httpx.AsyncClient() as hc:
        r = await hc.get(
            "",
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
            "accuracy": 0,
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

    return {
        "user": user,
        "session_token": session_token
    }


@api_router.post("/auth/exchange-session")
async def exchange_session(request: Request, response: Response):
    """Exchange OAuth session_id for user session with token"""
    try:
        raise HTTPException(status_code=410, detail="Legacy OAuth sessions are no longer supported")
        body = await request.json()
        session_id = body.get("sessionId")

        if not session_id:
            raise HTTPException(status_code=400, detail="Missing session_id")

        logger.info(f"Exchanging session: {session_id}")

        # Fetch session data from auth service
        async with httpx.AsyncClient() as hc:
            r = await hc.get(
                "",
                headers={"X-Session-ID": session_id},
            )

        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Auth failed")

        data = r.json()
        email = data.get("email")

        if not email:
            raise HTTPException(status_code=400, detail="No email in session data")

        # Find or create user
        existing = await db.users.find_one({"email": email})

        if existing:
            user = existing
            # Remove sensitive fields
            user.pop("_id", None)
            user.pop("password", None)
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
                "accuracy": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.users.insert_one(dict(user))
            user.pop("_id", None)
            user.pop("password", None)

        # Create session token
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

        return {
            "user": user,
            "session_token": session_token
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Exchange session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
# User Settings
# ============================================================

@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    stored = user.get("settings") or {}
    return {**DEFAULT_SETTINGS, **stored}

@api_router.put("/settings")
async def update_settings(payload: SettingsUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    current = user.get("settings") or {}
    merged = {**DEFAULT_SETTINGS, **current, **updates}
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"settings": merged}})
    return merged

@api_router.post("/settings/reset")
async def reset_settings(user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"settings": DEFAULT_SETTINGS}})
    return dict(DEFAULT_SETTINGS)

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

    # Keep the profile's overall accuracy in sync with every new attempt,
    # not just once a day, since quiz performance should reflect
    # immediately rather than waiting for the next streak evaluation.
    overall_accuracy = await recompute_user_accuracy(user["user_id"])

    return {
        "attempt": attempt, "xp_gain": xp_gain, "new_xp": new_xp,
        "new_level": new_level, "accuracy": overall_accuracy,
    }

@api_router.get("/attempts")
async def list_attempts(user: dict = Depends(get_current_user)):
    items = await db.attempts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

# ============================================================
# Dashboard Stats
# ============================================================

@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    attempts = await db.attempts.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    questions_attempted = sum(a.get("total", 0) for a in attempts)
    correct = sum(a.get("score", 0) for a in attempts)
    accuracy = round((correct / questions_attempted) * 100) if questions_attempted else 0

    attempt_seconds = sum(a.get("time_spent", 0) for a in attempts)

    reading_docs_full = await db.paper_reading_time.find(
        {"user_id": user["user_id"]},
        {"_id": 0, "total_seconds": 1, "daily_seconds": 1, "last_updated": 1}
    ).to_list(2000)
    reading_seconds = sum(d.get("total_seconds", 0) for d in reading_docs_full)

    study_seconds = attempt_seconds + reading_seconds
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

    for d_doc in reading_docs_full:
        daily = d_doc.get("daily_seconds") or {}
        if daily:
            for i in range(7):
                day_key = (now.date() - timedelta(days=i)).isoformat()
                secs = daily.get(day_key, 0)
                if secs:
                    week[6 - i] += round(secs / 60)
        elif d_doc.get("last_updated"):
            try:
                d = datetime.fromisoformat(d_doc["last_updated"])
                if d.tzinfo is None:
                    d = d.replace(tzinfo=timezone.utc)
                delta = (now.date() - d.date()).days
                if 0 <= delta < 7:
                    week[6 - delta] += round(d_doc.get("total_seconds", 0) / 60)
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
        "study_seconds": study_seconds,
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
        "total_papers_viewed": len(reading_docs_full),
    }

# ============================================================
# AI Tutor - Session Management (title, pin, delete)
# ============================================================

@api_router.put("/ai/sessions/{session_id}/title")
async def update_session_title(session_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Update the title of a chat session"""
    try:
        body = await request.json()
        title = body.get("title", "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="Title cannot be empty")

        result = await db.ai_sessions.update_one(
            {"session_id": session_id, "user_id": user["user_id"]},
            {"$set": {"title": title, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Session not found")

        return {"ok": True, "title": title}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update session title error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/ai/sessions/{session_id}")
async def delete_session(session_id: str, user: dict = Depends(get_current_user)):
    """Delete a chat session"""
    try:
        result = await db.ai_sessions.delete_one(
            {"session_id": session_id, "user_id": user["user_id"]}
        )
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Session not found")
        return {"ok": True}
    except Exception as e:
        logger.error(f"Delete session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/ai/sessions/{session_id}/pin")
async def toggle_pin_session(session_id: str, request: Request, user: dict = Depends(get_current_user)):
    try:
        body = await request.json()
        pinned = body.get("pinned", False)

        result = await db.ai_sessions.update_one(
            {"session_id": session_id, "user_id": user["user_id"]},
            {"$set": {"pinned": pinned, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Session not found")

        return {"ok": True, "pinned": pinned}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Toggle pin error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/upload/pdf")
async def upload_pdf(request: Request, user: dict = Depends(get_current_user)):
    try:
        form = await request.form()
        file = form.get("file")

        if not file:
            raise HTTPException(status_code=400, detail="No file uploaded")

        content = await file.read()
        reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""

        return {"text": text[:5000], "filename": file.filename}
    except Exception as e:
        logger.error(f"PDF upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
        "views": 0, "earnings": 0, "students": 0, "likes": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.courses.insert_one(dict(course))
    course.pop("_id", None)
    return course

@api_router.get("/courses")
async def list_courses(mine: bool = False, user: dict = Depends(get_current_user)):
    q = {"teacher_id": user["user_id"]} if mine else {}
    items = await db.courses.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)

    if items:
        ids = [c["course_id"] for c in items]
        likes = await db.video_likes.find(
            {"user_id": user["user_id"], "course_id": {"$in": ids}}, {"_id": 0, "course_id": 1}
        ).to_list(len(ids))
        saves = await db.video_saves.find(
            {"user_id": user["user_id"], "course_id": {"$in": ids}}, {"_id": 0, "course_id": 1}
        ).to_list(len(ids))
        liked_ids = {l["course_id"] for l in likes}
        saved_ids = {s["course_id"] for s in saves}
        for c in items:
            c.setdefault("likes", 0)
            c["liked"] = c["course_id"] in liked_ids
            c["saved"] = c["course_id"] in saved_ids

    return items

@api_router.get("/courses/{course_id}")
async def get_course(course_id: str, user: dict = Depends(get_current_user)):
    c = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    c.setdefault("likes", 0)
    c["liked"] = bool(await db.video_likes.find_one({"course_id": course_id, "user_id": user["user_id"]}))
    c["saved"] = bool(await db.video_saves.find_one({"course_id": course_id, "user_id": user["user_id"]}))
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

# ============================================================
# Video Interactions: Likes, Saves, Recently Watched
# ============================================================

# ---------- Likes ----------

@api_router.post("/courses/{course_id}/like")
async def toggle_like_video(course_id: str, user: dict = Depends(get_current_user)):
    course = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Video not found")

    existing = await db.video_likes.find_one({"course_id": course_id, "user_id": user["user_id"]})
    if existing:
        await db.video_likes.delete_one({"_id": existing["_id"]})
        await db.courses.update_one({"course_id": course_id}, {"$inc": {"likes": -1}})
        liked = False
    else:
        await db.video_likes.insert_one({
            "like_id": f"lk_{uuid.uuid4().hex[:12]}",
            "course_id": course_id,
            "user_id": user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.courses.update_one({"course_id": course_id}, {"$inc": {"likes": 1}})
        liked = True

    fresh = await db.courses.find_one({"course_id": course_id}, {"_id": 0, "likes": 1})
    return {"liked": liked, "likes": max(0, (fresh or {}).get("likes", 0))}

@api_router.get("/videos/liked")
async def list_liked_videos(user: dict = Depends(get_current_user)):
    likes = await db.video_likes.find(
        {"user_id": user["user_id"]}, {"_id": 0, "course_id": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(500)
    if not likes:
        return []
    ids = [l["course_id"] for l in likes]
    courses = await db.courses.find({"course_id": {"$in": ids}}, {"_id": 0}).to_list(500)
    cmap = {c["course_id"]: c for c in courses}
    result = []
    for l in likes:
        c = cmap.get(l["course_id"])
        if c:
            c = dict(c)
            c["liked"] = True
            c["liked_at"] = l["created_at"]
            result.append(c)
    return result

# ---------- Saved videos ----------

@api_router.post("/courses/{course_id}/save")
async def toggle_save_video(course_id: str, user: dict = Depends(get_current_user)):
    course = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Video not found")

    existing = await db.video_saves.find_one({"course_id": course_id, "user_id": user["user_id"]})
    if existing:
        await db.video_saves.delete_one({"_id": existing["_id"]})
        return {"saved": False}

    await db.video_saves.insert_one({
        "save_id": f"sv_{uuid.uuid4().hex[:12]}",
        "course_id": course_id,
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"saved": True}

@api_router.get("/videos/saved")
async def list_saved_videos(user: dict = Depends(get_current_user)):
    saves = await db.video_saves.find(
        {"user_id": user["user_id"]}, {"_id": 0, "course_id": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(500)
    if not saves:
        return []
    ids = [s["course_id"] for s in saves]
    courses = await db.courses.find({"course_id": {"$in": ids}}, {"_id": 0}).to_list(500)
    cmap = {c["course_id"]: c for c in courses}
    result = []
    for s in saves:
        c = cmap.get(s["course_id"])
        if c:
            c = dict(c)
            c["saved"] = True
            c["saved_at"] = s["created_at"]
            result.append(c)
    return result

# ---------- Recently watched ----------

@api_router.post("/courses/{course_id}/watch")
async def record_watch(course_id: str, user: dict = Depends(get_current_user)):
    course = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Video not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.watch_history.update_one(
        {"course_id": course_id, "user_id": user["user_id"]},
        {
            "$set": {"watched_at": now_iso},
            "$setOnInsert": {
                "history_id": f"wh_{uuid.uuid4().hex[:12]}",
                "course_id": course_id,
                "user_id": user["user_id"],
            },
        },
        upsert=True,
    )
    return {"ok": True}

@api_router.get("/videos/recently-watched")
async def list_recently_watched(limit: int = 20, user: dict = Depends(get_current_user)):
    capped_limit = max(1, min(limit, 100))
    history = await db.watch_history.find(
        {"user_id": user["user_id"]}, {"_id": 0, "course_id": 1, "watched_at": 1}
    ).sort("watched_at", -1).to_list(capped_limit)
    if not history:
        return []
    ids = [h["course_id"] for h in history]
    courses = await db.courses.find({"course_id": {"$in": ids}}, {"_id": 0}).to_list(500)
    cmap = {c["course_id"]: c for c in courses}
    result = []
    for h in history:
        c = cmap.get(h["course_id"])
        if c:
            c = dict(c)
            c["watched_at"] = h["watched_at"]
            result.append(c)
    return result

@api_router.delete("/videos/recently-watched")
async def clear_recently_watched(user: dict = Depends(get_current_user)):
    await db.watch_history.delete_many({"user_id": user["user_id"]})
    return {"ok": True}

@api_router.delete("/videos/recently-watched/{course_id}")
async def remove_recently_watched(course_id: str, user: dict = Depends(get_current_user)):
    await db.watch_history.delete_one({"course_id": course_id, "user_id": user["user_id"]})
    return {"ok": True}

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
                "price": 0, "duration": "45:00", "views": 0, "earnings": 0, "students": 0, "likes": 0,
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

async def _ask_ai_for_json(chat: SimpleLLM, prompt: str, required_key: str, retries: int = 1) -> dict:
    last_resp = ""
    for attempt in range(retries + 1):
        this_prompt = prompt if attempt == 0 else (
            prompt + "\n\nIMPORTANT: Your previous reply could not be parsed as JSON. "
            "Reply again with ONLY the JSON object — no markdown code fences, "
            "no explanation, nothing before or after it."
        )
        resp = await chat.send_message(this_prompt)
        last_resp = resp
        try:
            parsed = _clean_json(resp)
            if parsed.get(required_key):
                return parsed
        except Exception:
            continue
    logger.error(
        f"AI JSON generation failed after {retries + 1} attempt(s) for key '{required_key}'. "
        f"Last raw response (truncated): {last_resp[:500]!r}"
    )
    raise ValueError(f"Could not get valid JSON with key '{required_key}' from AI")

# ============================================================
# Papers Module
# ============================================================

def _public_paper(paper: dict) -> dict:
    return {
        "paper_id": paper.get("paper_id"),
        "title": paper.get("title", "Untitled paper"),
        "subject": paper.get("subject", ""),
        "level": paper.get("level", ""),
        "year": paper.get("year"),
        "paper_number": paper.get("paper_number"),
        "description": paper.get("description", ""),
        "created_at": paper.get("created_at"),
    }

def _paper_slug(title: str) -> str:
    normalized = unicodedata.normalize("NFKD", title or "untitled-paper")
    ascii_title = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_title.lower()).strip("-")

@api_router.get("/public/papers")
async def list_public_papers(q: Optional[str] = None):
    query = {}
    if q:
        query["title"] = {"$regex": re.escape(q), "$options": "i"}
    papers = await db.papers.find(query, {"_id": 0}).sort([("year", -1), ("subject", 1), ("title", 1)]).to_list(1000)
    return [{**_public_paper(paper), "slug": _paper_slug(paper.get("title", ""))} for paper in papers]

@api_router.get("/public/papers/slug/{slug}")
async def get_public_paper_by_slug(slug: str):
    papers = await db.papers.find({}, {"_id": 0}).to_list(1000)
    for paper in papers:
        if _paper_slug(paper.get("title", "")) == slug:
            return {**_public_paper(paper), "slug": slug}
    raise HTTPException(status_code=404, detail="Paper not found")

@api_router.get("/public/papers/{paper_id}")
async def get_public_paper(paper_id: str):
    paper = await db.papers.find_one({"paper_id": paper_id}, {"_id": 0})
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return {**_public_paper(paper), "slug": _paper_slug(paper.get("title", ""))}

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

def _strip_reasoning_preamble(text: str) -> str:
    match = re.search(r'##\s*(Given|Solution)', text)
    if match and match.start() > 0:
        return text[match.start():].strip()
    return text

@api_router.post("/papers/ask")
async def ask_about_paper(req: AskRequest, user: dict = Depends(get_current_user)):
    p = await db.papers.find_one({"paper_id": req.paper_id}, {"_id": 0})
    subject = p["subject"] if p else "General"
    system = (
        f"You are GC AI, an expert {subject} exam tutor writing a final worked solution for a student. "
        "CRITICAL: Do NOT show your internal reasoning process. Never write phrases like "
        "'We are given', 'We need to find', 'Let's define', 'Let's assume', or any narration of "
        "how you are thinking through the problem. Go straight to the structured solution as if "
        "writing model answers for an exam mark scheme.\n\n"
        "Format your answer using these markdown sections:\n"
        "## Given\n"
        "A short bullet list of the known quantities from the question.\n\n"
        "## Solution\n"
        "Clearly numbered steps (1., 2., 3. ...), each showing the working, not the thought process. "
        "Use $ ... $ for inline math and $$ ... $$ for standalone equations.\n\n"
        "## Answer\n"
        "The final numeric or symbolic result, stated in one line.\n\n"
        "Be concise. Do not restate the question. Do not apologize or hedge."
    )
    chat = _new_chat(f"ask_{uuid.uuid4().hex}", system)
    resp = await chat.send_message(f"Question:\n\n{req.question}")
    resp = _strip_reasoning_preamble(resp)
    return {"answer": resp}

# ============================================================
# Reading Time Tracking
# ============================================================

class ReadingTimeRequest(BaseModel):
    seconds: int  # delta seconds since last heartbeat

@api_router.post("/papers/{paper_id}/reading-time")
async def record_reading_time(paper_id: str, req: ReadingTimeRequest, user: dict = Depends(get_current_user)):
    seconds = max(0, min(req.seconds, 120))
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    today_key = now.date().isoformat()

    await db.paper_reading_time.update_one(
        {"paper_id": paper_id, "user_id": user["user_id"]},
        {
            "$inc": {
                "total_seconds": seconds,
                f"daily_seconds.{today_key}": seconds,
            },
            "$set": {"last_updated": now_iso},
            "$setOnInsert": {
                "record_id": f"rt_{uuid.uuid4().hex[:12]}",
                "paper_id": paper_id,
                "user_id": user["user_id"],
                "created_at": now_iso,
            },
        },
        upsert=True,
    )
    doc = await db.paper_reading_time.find_one(
        {"paper_id": paper_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    # Fire-and-forget streak update — recomputes from fresh DB state rather
    # than the possibly-stale `user` dict, so overlapping pings can't race.
    asyncio.create_task(update_user_streak(user))
    return {"ok": True, "total_seconds": doc.get("total_seconds", 0) if doc else seconds}

@api_router.get("/papers/{paper_id}/reading-time")
async def get_reading_time(paper_id: str, user: dict = Depends(get_current_user)):
    doc = await db.paper_reading_time.find_one(
        {"paper_id": paper_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return {"total_seconds": (doc or {}).get("total_seconds", 0)}

# ============================================================
# Streak, XP and Accuracy System
# ============================================================
# Rules implemented here:
#  - A calendar day (UTC) counts as "complete" once the user's total
#    study time that day (reading time + quiz time_spent) reaches their
#    daily_commitment target.
#  - Completing a day earns exactly STREAK_XP_PER_DAY (5) XP — flat,
#    not scaled by streak length ("1 streak = 5 xp").
#  - A day can only ever be credited ONCE. After it's credited,
#    last_goal_met_date is set to that day, so nothing re-credits again
#    until the calendar date actually changes — i.e. finishing today's
#    streak means you wait for tomorrow to earn the next one.
#  - Missing a day (not crediting it by the time the 4pm-WAT-equivalent
#    check runs) resets streak to 0.
#  - Level is the higher of the existing XP-based level (1 + xp // 500)
#    and the streak-based level (1 + streak // 7), so a 7-day streak
#    guarantees level 2 without ever lowering a level earned via XP.
#  - `accuracy` on the user profile is the overall percentage of quiz
#    questions answered correctly across all attempts, recomputed
#    whenever a quiz is submitted and again during daily crediting, so
#    it's always available on the profile without a separate call.

STREAK_XP_PER_DAY = 5  # "1 streak = 5 xp"

def parse_daily_commitment(commitment_str: str) -> int:
    """Return required study seconds, default 3600 if unparsable."""
    if not commitment_str:
        return 3600
    commitment_str = commitment_str.lower().strip()
    # Match: hour, hours, h, minute, minutes, min, mins, m
    match = re.match(r'(\d+)\s*(hour|hours|minute|minutes|min|mins|h|m)', commitment_str)
    if not match:
        return 3600
    value = int(match.group(1))
    unit = match.group(2)
    if unit.startswith('hour') or unit == 'h':
        return value * 3600
    else:          # minute, minutes, min, mins, m
        return value * 60

async def create_notification(user_id: str, message: str, type: str = "info", link: Optional[str] = None) -> dict:
    """
    Creates a notification document in the database and sends it via WebSocket.
    """
    notif = {
        "user_id": user_id,
        "message": message,
        "type": type,               # "streak", "reminder", "xp", "info"
        "link": link,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.notifications.insert_one(notif)
    notif["_id"] = str(result.inserted_id)
    # Send real‑time via WebSocket
    await manager.send_personal_message(notif, user_id)
    return notif

async def get_study_time_for_date(user_id: str, target_date: date) -> int:
    """Returns total seconds studied on that UTC calendar date."""
    start = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
    end = datetime.combine(target_date, datetime.max.time(), tzinfo=timezone.utc)

    # Sum attempts time_spent
    attempts_cursor = db.attempts.find({
        "user_id": user_id,
        "created_at": {"$gte": start.isoformat(), "$lte": end.isoformat()}
    })
    attempt_seconds = 0
    async for att in attempts_cursor:
        attempt_seconds += att.get("time_spent", 0)

    # Sum reading time from each paper's daily_seconds map
    reading_docs = db.paper_reading_time.find({"user_id": user_id})
    reading_seconds = 0
    date_str = target_date.isoformat()
    async for doc in reading_docs:
        daily = doc.get("daily_seconds", {})
        reading_seconds += daily.get(date_str, 0)

    return attempt_seconds + reading_seconds

async def recompute_user_accuracy(user_id: str) -> float:
    """
    Recomputes overall quiz accuracy (0-100) across all of this user's
    attempts and persists it on their profile, so it's available
    instantly via /auth/me or /user/streak without a separate dashboard
    call.
    """
    attempts = await db.attempts.find(
        {"user_id": user_id}, {"_id": 0, "score": 1, "total": 1}
    ).to_list(2000)
    total_q = sum(a.get("total", 0) for a in attempts)
    correct = sum(a.get("score", 0) for a in attempts)
    accuracy = round((correct / total_q) * 100, 1) if total_q else 0.0
    await db.users.update_one({"user_id": user_id}, {"$set": {"accuracy": accuracy}})
    return accuracy

async def _credit_streak_day(user_id: str, new_streak: int, credited_date: date) -> int:
    """
    Persists a newly-credited streak day, exactly once: bumps streak to
    new_streak, records credited_date as last_goal_met_date (so this same
    date can never be credited again — the caller must always check that
    first), awards a flat STREAK_XP_PER_DAY XP, recomputes level as the
    higher of the XP-based and streak-based levels, and refreshes
    accuracy. Both the real-time path (update_user_streak) and the daily
    fallback job (daily_reminder_job) route through this single function
    so a day can never be double-credited or double-paid.
    """
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "xp": 1})
    new_xp = (user_doc.get("xp", 0) if user_doc else 0) + STREAK_XP_PER_DAY
    xp_level = 1 + new_xp // 500
    streak_level = 1 + new_streak // 7
    new_level = max(xp_level, streak_level)

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "streak": new_streak,
            "last_goal_met_date": credited_date.isoformat(),
            "xp": new_xp,
            "level": new_level,
        }},
    )
    await recompute_user_accuracy(user_id)
    logger.info(
        f"Streak credited: user={user_id} date={credited_date.isoformat()} "
        f"streak={new_streak} +{STREAK_XP_PER_DAY}xp level={new_level}"
    )
    # Send notification
    await create_notification(
        user_id,
        f"🔥 You've reached a {new_streak}-day study streak!",
        type="streak",
        link="/dashboard"
    )
    return new_level

async def update_user_streak(user: dict) -> dict:
    """
    Real-time check, called after every reading-time ping. Re-reads
    streak state fresh from the DB (rather than trusting the possibly
    stale `user` snapshot) so overlapping pings can't race each other
    into double-crediting the same day.
    """
    user_id = user["user_id"]
    today = datetime.now(timezone.utc).date()
    today_seconds = await get_study_time_for_date(user_id, today)
    goal_seconds = parse_daily_commitment(user.get("daily_commitment", "1 hour"))
    met_goal = today_seconds >= goal_seconds

    fresh = await db.users.find_one(
        {"user_id": user_id}, {"_id": 0, "streak": 1, "last_goal_met_date": 1, "level": 1}
    ) or {}
    streak = fresh.get("streak", 0)
    last_met = fresh.get("last_goal_met_date")
    last_met_date = date.fromisoformat(last_met) if last_met else None
    level = fresh.get("level", 1)

    if met_goal and last_met_date != today:
        # Consecutive day -> extend the streak; otherwise it had lapsed
        # (or this is the first-ever credited day) -> restart at 1.
        new_streak = streak + 1 if last_met_date == today - timedelta(days=1) else 1
        level = await _credit_streak_day(user_id, new_streak, today)
        streak = new_streak
    # else: goal not yet met today, or today was already credited —
    # nothing to do until the calendar date changes.

    return {
        "streak": streak,
        "level": level,
        "met_goal": met_goal,
        "today_seconds": today_seconds,
        "goal_seconds": goal_seconds,
    }


def send_brevo_email(to_email: str, to_name: str, subject: str, html_content: str):
    if not BREVO_API_KEY:
        logger.error("BREVO_API_KEY not set")
        return
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "sender": {
            "name": BREVO_FROM_NAME,
            "email": BREVO_FROM_EMAIL
        },
        "to": [{"email": to_email, "name": to_name}],
        "subject": subject,
        "htmlContent": html_content
    }
    try:
        response = requests.post(url, json=data, headers=headers)
        if response.status_code not in (200, 201):
            logger.error(f"Brevo error: {response.text}")
    except Exception as e:
        logger.error(f"Brevo send error: {e}")

async def daily_reminder_job():
    """
    Runs hourly, only doing real work at hour==15 UTC (4pm WAT/Cameroon
    time). Acts as the once-daily safety net: for anyone the real-time
    path (update_user_streak) somehow missed crediting for yesterday, it
    credits (or resets) their streak here — through the same
    _credit_streak_day() function, so it can never double-credit a day
    the real-time path already caught. Also sends the "you haven't
    studied" reminder email to anyone who missed yesterday's goal.
    """
    now = datetime.now(timezone.utc)
    if now.hour != 15:
        return

    logger.info("Running daily reminder check")
    yesterday = (now - timedelta(days=1)).date()
    users = await db.users.find({}).to_list(1000)

    for user in users:
        user_id = user["user_id"]
        email = user.get("email")
        if not email:
            continue

        log = await db.reminder_log.find_one({"user_id": user_id, "date": yesterday.isoformat()})
        if log:
            continue

        seconds = await get_study_time_for_date(user_id, yesterday)
        goal = parse_daily_commitment(user.get("daily_commitment", "1 hour"))

        last_met = user.get("last_goal_met_date")
        last_met_date = date.fromisoformat(last_met) if last_met else None

        if seconds >= goal:
            if last_met_date == yesterday:
                # Real-time path already credited this exact day — nothing to do.
                pass
            else:
                streak = user.get("streak", 0)
                new_streak = streak + 1 if last_met_date == yesterday - timedelta(days=1) else 1
                await _credit_streak_day(user_id, new_streak, yesterday)
        else:
            # Missed yesterday – reset streak, refresh accuracy, and remind.
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"streak": 0}}
            )
            await recompute_user_accuracy(user_id)

            name = user.get("name", "Student")
            subject = "Don't break your study streak!"
            html = f"""
            <h2>Hi {name},</h2>
            <p>We noticed you didn't study yesterday. Your current streak is <strong>{user.get('streak', 0)}</strong> days.</p>
            <p>Remember, your daily goal is <strong>{user.get('daily_commitment', '1 hour')}</strong>.</p>
            <p>Keep going and don't break the chain!</p>
            <a href="{APP_URL}/dashboard" style="background:#4F46E5;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Go to Dashboard</a>
            """
            send_brevo_email(email, name, subject, html)
            # Create in-app notification
            await create_notification(
                user_id,
                f"⏰ Don't forget to study today! Your daily goal is {user.get('daily_commitment', '1 hour')}.",
                type="reminder",
                link="/study"
            )

        await db.reminder_log.insert_one({
            "user_id": user_id,
            "date": yesterday.isoformat(),
            "sent_at": now.isoformat()
        })

# ============================================================
# WebSocket Endpoint
# ============================================================
# NOTE: This is a raw Starlette/FastAPI WebSocket route (NOT Socket.IO).
# Because it's registered on `api_router` (prefix="/api"), the actual
# mounted path clients must connect to is:
#     ws(s)://<host>/api/ws/notifications?user_id=<user_id>
# A Socket.IO client will NOT work against this endpoint (different
# handshake protocol/framing) and will typically receive a 403. Connect
# with the native browser WebSocket API instead, e.g.:
#     new WebSocket(`${wsBase}/api/ws/notifications?user_id=${userId}`)

@api_router.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket, user_id: str = None):
    """
    WebSocket endpoint for real-time notifications.
    Connect with ?user_id=<user_id> to receive personal notifications.
    """
    if not user_id:
        await websocket.close(code=1008)
        return
    await manager.connect(user_id, websocket)
    try:
        while True:
            # Keep the connection alive; we don't expect messages from client
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id)

# ============================================================
# Notification REST Endpoints
# ============================================================

@api_router.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    """
    Returns the last 100 notifications for the current user, newest first.
    """
    notifs = await db.notifications.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    # Convert ObjectId to string if present
    for n in notifs:
        if "_id" in n:
            n["_id"] = str(n["_id"])
    return notifs

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    """
    Marks a single notification as read.
    """
    try:
        obj_id = ObjectId(notification_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    result = await db.notifications.update_one(
        {"_id": obj_id, "user_id": user["user_id"]},
        {"$set": {"read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

@api_router.put("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    """
    Marks all notifications as read for the current user.
    """
    await db.notifications.update_many(
        {"user_id": user["user_id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"ok": True}

# ============================================================
# Streak API Endpoint
# ============================================================

@api_router.get("/user/streak")
async def get_user_streak(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date()
    today_seconds = await get_study_time_for_date(user["user_id"], today)
    goal = parse_daily_commitment(user.get("daily_commitment", "1 hour"))
    progress_percent = min(100, int((today_seconds / goal) * 100)) if goal > 0 else 0
    return {
        "streak": user.get("streak", 0),
        "level": user.get("level", 1),
        "xp": user.get("xp", 0),
        "accuracy": user.get("accuracy", 0),
        "today_seconds": today_seconds,
        "goal_seconds": goal,
        "progress_percent": progress_percent,
        "last_goal_met_date": user.get("last_goal_met_date"),
        "daily_commitment": user.get("daily_commitment", "1 hour")
    }

# ============================================================
# Drafts
# ============================================================

@api_router.post("/drafts")
async def save_draft(req: DraftRequest, user: dict = Depends(get_current_user)):
    try:
        logger.info(f"Drafts - User: {user['user_id']}, Paper: {req.paper_id}")

        existing = await db.drafts.find_one({
            "user_id": user["user_id"],
            "paper_id": req.paper_id
        })

        if existing:
            result = await db.drafts.delete_one({
                "user_id": user["user_id"], 
                "paper_id": req.paper_id
            })
            logger.info(f"Drafts - Removed draft for {req.paper_id}")
            return {"saved": False}
        else:
            draft_doc = {
                "draft_id": f"draft_{uuid.uuid4().hex[:12]}",
                "user_id": user["user_id"],
                "paper_id": req.paper_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            result = await db.drafts.insert_one(draft_doc)
            logger.info(f"Drafts - Saved draft for {req.paper_id} with id: {result.inserted_id}")
            return {"saved": True}
            
    except Exception as e:
        logger.error(f"Drafts error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update draft: {str(e)}")

@api_router.delete("/drafts/{paper_id}")
async def delete_draft(paper_id: str, user: dict = Depends(get_current_user)):
    try:
        result = await db.drafts.delete_one({
            "user_id": user["user_id"], 
            "paper_id": paper_id
        })
        if result.deleted_count == 0:
            logger.warning(f"Drafts - No draft found for paper {paper_id}")
        return {"ok": True}
    except Exception as e:
        logger.error(f"Delete draft error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

# ============================================================
# Generate Video from Highlighted Text
# ============================================================

class HighlightVideoRequest(BaseModel):
    text: str  # The highlighted text from the PDF
    context: Optional[str] = None  # Optional surrounding context

@api_router.post("/papers/{paper_id}/video/highlight")
async def generate_video_from_highlight(paper_id: str, req: HighlightVideoRequest, user: dict = Depends(get_current_user)):
    p = await db.papers.find_one({"paper_id": paper_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Paper not found")

    text_hash = hashlib.sha256(req.text.encode("utf-8")).hexdigest()[:16]
    cache_key = f"{paper_id}_{text_hash}"
    cached = await db.highlight_video_cache.find_one({"cache_key": cache_key}, {"_id": 0})
    if cached:
        return {"scenes": cached["scenes"], "title": cached["title"], "question": cached["question"], "cached": True}

    data = await fetch_pdf_bytes(p["pdf_url"])
    full_text = extract_pdf_text(data, max_chars=3000)

    system = (
        "You are a master teacher creating a narrated video lesson that solves a specific "
        "exam question that a student has highlighted. Return STRICT JSON only, "
        "with no reasoning or thinking text before or after it."
    )

    prompt = (
        f"This is {p['level']} {p['subject']} {p['year']} Paper {p['paper_number']}.\n\n"
        f"STUDENT HIGHLIGHTED THIS TEXT:\n{req.text}\n\n"
        f"PAPER CONTEXT (for reference):\n{full_text[:1500]}\n\n"
        "Create a video walkthrough that solves the question or explains the concept "
        "the student highlighted. If it's a question, solve it step by step. "
        "If it's a concept, explain it clearly with examples. "
        "Return JSON: {\"title\":\"...\",\"question\":\"...\","
        "\"scenes\":[{\"heading\":\"Step title\","
        "\"board\":[\"line shown on whiteboard\",\"another line\"],"
        "\"narration\":\"what the teacher says, <= 500 chars\"}]}. "
        "Create 3-6 scenes. Narration must be natural spoken English. Return ONLY JSON."
    )

    chat = _new_chat(f"highlight_vid_{uuid.uuid4().hex}", system)

    try:
        parsed = await _ask_ai_for_json(chat, prompt, "scenes", retries=1)
        raw_scenes = parsed["scenes"]
    except Exception as e:
        logger.error(f"Highlight video generation failed for paper {paper_id}: {e}")
        raise HTTPException(status_code=502, detail="Couldn't build a video solution for your selection. Please try again.")

    scenes = []
    for i, sc in enumerate(raw_scenes[:8]):
        narration = (sc.get("narration") or sc.get("heading") or "")[:900]
        scenes.append({
            "heading": sc.get("heading", f"Step {i+1}"),
            "board": sc.get("board", []),
            "narration": narration,
            "audio": "",
        })

    doc = {
        "cache_key": cache_key,
        "paper_id": paper_id,
        "title": parsed.get("title", f"Solution for highlighted text"),
        "question": parsed.get("question", req.text[:200]),
        "scenes": scenes,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.highlight_video_cache.insert_one(dict(doc))

    return {"scenes": scenes, "title": doc["title"], "question": doc["question"], "cached": False}

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
# Scheduler
# ============================================================

scheduler = AsyncIOScheduler()
scheduler.add_job(daily_reminder_job, IntervalTrigger(hours=1), id="daily_reminder")
scheduler.start()
logger.info("Scheduler started for daily reminders")

# ============================================================
# Shutdown Handler
# ============================================================

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    scheduler.shutdown()

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