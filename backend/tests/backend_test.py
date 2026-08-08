"""GCSMART backend regression tests."""
import os
import json
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

STUDENT_TOKEN = "test_session_student_01"
TEACHER_TOKEN = "test_session_teacher_01"


@pytest.fixture(scope="session")
def student():
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {STUDENT_TOKEN}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def teacher():
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {TEACHER_TOKEN}", "Content-Type": "application/json"})
    return s


# Auth ------------------------------------------------------------------
class TestAuth:
    def test_me_student(self, student):
        r = student.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["user_id"] == "user_teststudent01"
        assert d["role"] == "student"
        assert d["email"] == "test.student@gcsmart.cm"

    def test_me_teacher(self, teacher):
        r = teacher.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "teacher"

    def test_me_unauth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer garbage"})
        assert r.status_code == 401

    def test_profile_update(self, student):
        r = student.put(f"{BASE_URL}/api/auth/profile", json={"bio": "TEST_bio", "institution": "TEST_inst"})
        assert r.status_code == 200
        d = r.json()
        assert d["bio"] == "TEST_bio"
        assert d["institution"] == "TEST_inst"


# Seed / exam structure ---------------------------------------------------
class TestSeedAndStructure:
    def test_seed(self, student):
        r = student.post(f"{BASE_URL}/api/seed")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_exam_structure(self):
        r = requests.get(f"{BASE_URL}/api/exam/structure")
        assert r.status_code == 200
        d = r.json()
        for k in ("GCE O Level", "GCE A Level", "HND", "Concours"):
            assert k in d["levels"]
        assert len(d["years"]) > 5
        assert d["papers"] == [1, 2, 3]


# Dashboard / leaderboard -------------------------------------------------
class TestDashboard:
    def test_dashboard_stats(self, student):
        r = student.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ("study_hours", "questions_attempted", "accuracy", "streak", "xp", "level", "consistency"):
            assert k in d
        assert len(d["consistency"]) == 7

    def test_leaderboard(self, student):
        r = student.get(f"{BASE_URL}/api/leaderboard")
        assert r.status_code == 200
        d = r.json()
        assert "top" in d
        assert isinstance(d["top"], list)


# Courses -----------------------------------------------------------------
class TestCourses:
    def test_list_courses_has_seed(self, student):
        r = student.get(f"{BASE_URL}/api/courses")
        assert r.status_code == 200
        d = r.json()
        assert len(d) >= 3
        assert all("video_url" in c for c in d)

    def test_create_and_view_course(self, teacher, student):
        payload = {
            "title": "TEST_Algebra Basics", "description": "TEST",
            "subject": "Pure Mathematics", "level": "GCE A Level",
            "video_url": "https://www.youtube.com/embed/HfACrKJ_Y2w",
        }
        r = teacher.post(f"{BASE_URL}/api/courses", json=payload)
        assert r.status_code == 200
        course = r.json()
        cid = course["course_id"]
        assert course["title"] == payload["title"]
        assert course["teacher_id"] == "user_testteacher01"

        # GET to verify persistence
        r = student.get(f"{BASE_URL}/api/courses/{cid}")
        assert r.status_code == 200
        assert r.json()["course_id"] == cid

        # Register view (student) -> earnings
        r = student.post(f"{BASE_URL}/api/courses/{cid}/view")
        assert r.status_code == 200
        first = r.json()
        assert first.get("counted") is True
        assert first.get("rate") == 90

        # Second view should not double-count
        r = student.post(f"{BASE_URL}/api/courses/{cid}/view")
        assert r.status_code == 200
        assert r.json().get("counted") is False

        # Teacher earnings reflect view
        r = teacher.get(f"{BASE_URL}/api/teacher/stats")
        assert r.status_code == 200
        stats = r.json()
        assert stats["earnings"] >= 90
        assert stats["views"] >= 1

        # cleanup - delete course & view
        requests.delete  # motor doesn't expose HTTP delete endpoint; skip


# Attempts ---------------------------------------------------------------
class TestAttempts:
    def test_submit_attempt(self, student):
        payload = {
            "level": "GCE A Level", "subject": "Physics", "year": 2024, "paper": 1,
            "answers": [
                {"question_id": "q1", "selected": 0, "correct": 0, "topic": "Kinematics", "time_spent": 30},
                {"question_id": "q2", "selected": 1, "correct": 2, "topic": "Kinematics", "time_spent": 20},
            ],
            "score": 1, "total": 2, "time_spent": 50,
        }
        r = student.post(f"{BASE_URL}/api/attempts", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["attempt"]["accuracy"] == 50
        assert d["xp_gain"] >= 10

        # GET to verify persistence
        r = student.get(f"{BASE_URL}/api/attempts")
        assert r.status_code == 200
        assert any(a["attempt_id"] == d["attempt"]["attempt_id"] for a in r.json())


# AI generate + chat ------------------------------------------------------
class TestAI:
    def test_generate_questions(self, student):
        r = student.post(f"{BASE_URL}/api/questions/generate", json={
            "level": "GCE O Level", "subject": "Mathematics", "year": 2023, "paper": 1, "count": 3
        }, timeout=90)
        assert r.status_code == 200
        d = r.json()
        assert "questions" in d
        qs = d["questions"]
        assert len(qs) >= 1
        q0 = qs[0]
        for k in ("text", "options", "correct_index", "explanation"):
            assert k in q0
        assert len(q0["options"]) == 4
        assert 0 <= q0["correct_index"] <= 3

    def test_ai_chat_stream(self, student):
        # Use raw requests to consume SSE stream
        with requests.post(f"{BASE_URL}/api/ai/chat",
                           headers={"Authorization": f"Bearer {STUDENT_TOKEN}",
                                    "Content-Type": "application/json"},
                           data=json.dumps({"message": "What is Newton's second law? one line",
                                            "subject": "Physics"}),
                           stream=True, timeout=90) as r:
            assert r.status_code == 200
            got_delta = False
            done = False
            for line in r.iter_lines(decode_unicode=True):
                if not line or not line.startswith("data:"):
                    continue
                payload = json.loads(line[5:].strip())
                if "delta" in payload:
                    got_delta = True
                if payload.get("done"):
                    done = True
                    break
            assert got_delta, "No streamed tokens received"
            assert done, "Stream never marked done"


# Teacher -----------------------------------------------------------------
class TestTeacher:
    def test_teacher_stats(self, teacher):
        r = teacher.get(f"{BASE_URL}/api/teacher/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ("courses", "students", "views", "earnings", "rate", "chart"):
            assert k in d
        assert d["rate"] == 90
