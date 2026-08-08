# Auth-Gated App Testing Playbook (GCSMART)

Emergent Google OAuth is used. There are NO passwords. Testing agent must inject a
session directly into MongoDB and set the `session_token` cookie in the browser.

## Step 1 — Create Test User & Session (mongosh)
```
mongosh --quiet --eval "
const db = db.getSiblingDB('test_database');
const uid = 'user_teststudent01';
const tok = 'test_session_student_01';
db.users.deleteMany({user_id: uid});
db.user_sessions.deleteMany({session_token: tok});
db.users.insertOne({user_id: uid, email:'test.student@gcsmart.cm', name:'John Doe', picture:'', role:'student', onboarded:true, exam_level:'GCE A Level', subjects:['Physics','Chemistry'], xp:120, level:1, streak:3, created_at:new Date().toISOString()});
db.user_sessions.insertOne({user_id: uid, session_token: tok, expires_at: new Date(Date.now()+7*24*3600*1000).toISOString(), created_at: new Date().toISOString()});
"
```
Teacher account (for Teacher Portal tests): set role:'teacher', onboarded:true, use token 'test_session_teacher_01'.

## Step 2 — Backend API (Bearer token works too)
```
curl -s http://localhost:8001/api/auth/me -H "Authorization: Bearer test_session_student_01"
```

## Step 3 — Browser (cookie auth)
```
await page.context.add_cookies([{
  "name":"session_token","value":"test_session_student_01",
  "domain":"cameroon-study-hub.preview.emergentagent.com","path":"/",
  "httpOnly":True,"secure":True,"sameSite":"None"
}])
await page.goto("https://cameroon-study-hub.preview.emergentagent.com/dashboard")
```

Notes:
- Callback detection uses `useLocation().hash`.
- All queries use `{"_id":0}` projection.
- Frontend uses REACT_APP_BACKEND_URL for API calls.
