# GCSMART — Product Requirements & Progress

## Original Problem Statement
Premium AI-powered e-learning platform for Cameroon students (GCE O Level, GCE A Level, HND, Concours). Dark-blue/glassmorphism premium UI comparable to Coursera/Khan Academy. Features: auth, student dashboard, past questions (Paper 1 AI mode), AI tutor, PDF reader, teacher portal (earn per view), gamification, analytics.

## User Choices (locked)
- Full-stack: React + FastAPI + **MongoDB** (production-ready, NOT localStorage).
- Auth: **Emergent-managed Google OAuth** for students & teachers.
- AI: **Emergent Universal LLM key**, model **openai gpt-5.4**.
- Theme: **Light + Dark toggle**.
- Priority scope: Student core (Auth, Dashboard, Past Questions Paper 1 AI, AI Tutor) + Teacher dashboard (post lesson videos, earn 90 FCFA per qualified student view).

## Architecture
- Backend `/app/backend/server.py` — all routes prefixed `/api`. Collections: users, user_sessions, questions_cache, attempts, ai_sessions, courses, course_views.
- Frontend `/app/frontend/src` — App.js (router + Auth/Theme providers), context/{AuthContext,ThemeContext}, components/layout/AppLayout, pages/{Login,AuthCallback,Onboarding,Dashboard,StudyCenter,ExamMode,AITutor,Analytics,TeacherPortal,Settings}.
- Design tokens in index.css (light/dark CSS vars), Outfit (display) + Inter (body).

## User Personas
- Student: practices AI past questions, learns via AI tutor, watches lessons, tracks XP/streak.
- Teacher: publishes lesson videos, earns 90 FCFA per unique student view.
- Admin: (backlog).

## Implemented (2026-06-08)
- Google OAuth login + session cookie + `/auth/me` + logout + profile update.
- Multi-step onboarding (role → profile → goals/expertise).
- Student Dashboard: stat cards, study consistency bar chart, exam roadmap, AI recommendations (weak topics), XP level ring, lesson videos, leaderboard.
- Study Center: Past Questions (level/subject/year/paper/count) → **real-AI** MCQ Exam Mode with timer, instant feedback, explanations, results (score/accuracy/XP), attempt persistence. Video Lessons tab with view-counting (teacher earnings).
- AI Tutor: streaming (SSE) multi-turn chat with subject selector + quick actions, persisted sessions.
- Analytics: accuracy trend line chart, focus areas, milestones, summary cards.
- Teacher Portal: earnings/courses/students/views stats, earnings chart, create-lesson dialog, my lessons.
- Settings: profile edit, theme toggle, logout.
- Light/Dark theme toggle everywhere.
- Verified: 15/15 backend tests + all frontend e2e flows pass (testing agent iteration_1).

## Backlog (prioritized)
- P1: Paper 2 AI mode (PDF viewer + AI worked solutions), PDF Reader with highlight→Ask AI side panel.
- P1: Admin dashboard (user/content moderation, reports).
- P2: Bookmarks, Downloads/offline, Certificates, badges gallery, notifications center.
- P2: Full leaderboard page, streak calendar, daily goals.
- P2: questions_cache TTL/refresh; split server.py into routers.

## Next Tasks
- Build Paper 2 AI mode + PDF Reader with AI assistant split-pane.
- Add Admin role dashboard.
