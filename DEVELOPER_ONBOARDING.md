# InterviewOS — New Developer Onboarding Guide

> **Audience:** New developers joining the InterviewOS project.
> **Purpose:** End-to-end system walkthrough — features, architecture, API flows, data processes, known bugs, and improvement suggestions.

---

## Table of Contents

1. [What is InterviewOS?](#1-what-is-interviewos)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Features Deep Dive](#5-features-deep-dive)
6. [API Flow — Endpoint by Endpoint](#6-api-flow--endpoint-by-endpoint)
7. [Data and Storage Processes](#7-data-and-storage-processes)
8. [Frontend Architecture](#8-frontend-architecture)
9. [AI / LLM Integration Layer](#9-ai--llm-integration-layer)
10. [Known Bugs and Errors](#10-known-bugs-and-errors)
11. [Suggested Improvements](#11-suggested-improvements)
12. [Environment Setup](#12-environment-setup)

---

## 1. What is InterviewOS?

**InterviewOS** is a Chrome Extension + FastAPI backend that acts as an AI-powered career co-pilot. When you browse job portals (LinkedIn, Indeed, Greenhouse, etc.), it:

- Detects the job posting on the current page
- Analyzes your uploaded resume against the job
- Runs a live, multi-turn adaptive AI technical interview calibrated to your expected salary (LPA)
- Generates an audit-grade PDF report after each interview
- Recommends tailored job profiles based on your resume

The backend is Python/FastAPI. The frontend is a Chrome MV3 Extension built with React + TypeScript. The AI brain is Google Gemini 2.0 Flash.

---

## 2. High-Level Architecture

```
CHROME EXTENSION (Frontend)
  Popup (popup.html)
  Side Panel (SidePanelApp.tsx)
  Content Script (content.js) — DOM scraping
  Background Worker (background.js) — message bus

         |  HTTPS REST API  |

FASTAPI BACKEND (Python)
  /api/extension/*  — Extension + candidate endpoints
  /api/interview/*  — LPA Interview engine
  /api/judge/*      — Hackathon judge mode
  /api/candidate/*  — Profile and resume analysis

Services Layer:
  CandidateAnalyzer     — resume/profile Gemini analysis
  LPAInterviewEngine    — core multi-turn interview engine
  DeterministicScoringEngine — job match scoring
  JobAnalyzerService    — job posting parser
  JobRecommendationService  — AI job recommendations
  ResumePipeline        — regex-based text extraction
  SessionService        — Redis + in-memory sessions

AI Layer: Gemini 2.0 Flash via LangChain
Storage : Redis (sessions) + Firestore (profiles)
RAG     : Qdrant (in-memory) + CurriculumRetriever

External:
  Google Gemini API   — Resume/Profile Analysis, Question Generation, Turn Evaluation
  Firebase Firestore  — Candidate profiles, Job recommendations persisted cross-session
```

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Chrome Extension | Manifest V3, Content Script, Background Worker, Side Panel |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| AI / LLM | Google Gemini 2.0 Flash via langchain-google-genai |
| Session Storage | Redis (primary) → In-memory dict (fallback) |
| Profile Persistence | Firebase Firestore (frontend only) |
| Vector / RAG | Qdrant in-memory, CurriculumRetriever keyword-based |
| PDF Parsing | pypdf, python-docx |
| Deployment | Render (backend), Chrome Web Store (extension) |

---

## 4. Repository Structure

```
Ai Interview Ext/
├── backend/
│   ├── app/
│   │   ├── main.py                       Entry point, CORS, router registration
│   │   ├── config/settings.py            All env vars (Gemini keys, Redis, Qdrant)
│   │   ├── api/v1/endpoints/
│   │   │   ├── extension.py              Extension + candidate routes (818 lines)
│   │   │   ├── interview.py              LPA interview routes
│   │   │   └── judge.py                  Hackathon judge mode routes
│   │   ├── services/
│   │   │   ├── lpa_interview_engine.py   Core multi-turn interview engine (954 lines)
│   │   │   ├── candidate_analyzer.py     Resume/profile Gemini analysis (1234 lines)
│   │   │   ├── scoring_engine.py         Deterministic job match scoring (440 lines)
│   │   │   ├── job_analyzer.py           Job posting parser
│   │   │   ├── job_recommendation_service.py  AI job recommendations (445 lines)
│   │   │   ├── resume_pipeline.py        Regex-based resume entity extraction
│   │   │   ├── session_service.py        Redis + in-memory session manager
│   │   │   ├── ai_provider.py            Abstract AI provider interface
│   │   │   └── breeth_memory.py          Optional Breeth AI memory layer
│   │   ├── agents/
│   │   │   ├── orchestrator.py           Legacy interview state machine
│   │   │   ├── question_generator.py     Dynamic question generation agent
│   │   │   ├── evaluator.py              Turn-level answer evaluator
│   │   │   ├── followup_generator.py     Follow-up question logic
│   │   │   └── feedback_generator.py     Final session feedback generator
│   │   ├── models/session.py             SessionState, TurnEvaluation, IntegrityEvent
│   │   ├── schemas/
│   │   │   ├── interview.py              Core Pydantic models (437 lines)
│   │   │   └── extension.py             Extension-specific schemas
│   │   ├── rag/retriever.py              Curriculum RAG retriever
│   │   └── utils/                        LLM helpers, string helpers
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── manifest.json                     Chrome Extension manifest MV3
│   ├── src/
│   │   ├── sidepanel/SidePanelApp.tsx    Main side panel app (2915 lines)
│   │   ├── components/
│   │   │   ├── interview/LPAInterviewView.tsx   Full interview UI (1714 lines)
│   │   │   ├── JudgeDemoView.tsx               Hackathon judge panel
│   │   │   ├── RecommendedJobsView.tsx          Jobs explorer
│   │   │   ├── CandidateCard.tsx               Profile display card
│   │   │   └── ResumeUploadCard.tsx            Resume drag-drop upload
│   │   ├── api/interview.ts              All API calls to backend (699 lines)
│   │   ├── store/interview.store.ts      Client-side state management
│   │   ├── services/firestore.ts         Firebase Firestore persistence
│   │   └── lib/reportExporter.ts         PDF report HTML builder
│   └── package.json
└── PROMPTS.md
```

---

## 5. Features Deep Dive

### 5.1 Resume Upload and Analysis

- Candidate uploads a PDF, DOCX, or TXT resume via drag-drop
- Backend extracts text using pypdf (PDF) or python-docx (DOCX)
- Text is sent to Gemini 2.0 Flash for structured extraction
- Extracted: name, skills, experience, education, projects, targetRoles
- A SHA-256 hash is calculated for deduplication stored as profileHash
- Result is a CandidateProfileAnalysis object, cached in-session and persisted to Firebase Firestore

### 5.2 LinkedIn/Platform Profile Scraping

- The content script (content.js) runs on all pages and scrapes DOM for candidate data (name, headline, about, skills, experience)
- Profile is sent to POST /api/extension/analyze-profile
- Gemini analyzes the extracted context and returns a CandidateProfileAnalysis

### 5.3 Job Detection

- When you open a job posting on LinkedIn/Indeed/Greenhouse, the content script sends page data to POST /api/extension/detect-job
- JobAnalyzerService determines if the page is a job profile and extracts job details
- A popup overlay appears on the page asking: "Start AI Interview?"

### 5.4 Job Match Scoring

POST /api/extension/analyze-job-match computes a real-time match score using DeterministicScoringEngine:

- Skill Match: 50% weight — SYNONYM_MAP normalized skill overlap
- Experience Alignment: 20% — keyword matching in experience text
- Project Relevance: 15% — technology overlap in projects
- Education Match: 5% — degree/field alignment
- Keyword Alignment: 10% — job description keyword overlap

Returns: JobMatchScores, matched/missing skills, natural language explanation

### 5.5 LPA-Calibrated AI Interview

- Candidate sets their expected LPA (salary in Indian Lakhs Per Annum)
- Backend maps LPA to difficulty:
  - Up to 8 LPA: Junior — Fundamentals and Practical Basics
  - Up to 18 LPA: Mid-level — Architecture, Trade-offs and Systems
  - Above 18 LPA: Senior/Lead — Scalability, Distributed Systems, Production Failures
- Multi-turn flow: Start → 8 to 15 adaptive questions → Score each turn → Generate final report
- Anti-cheating: Fullscreen exits, tab switches, visibility changes are logged as IntegrityEvent

### 5.6 Deterministic Report Generation

After interview completion, _compute_deterministic_report() calculates:

- Overall Score (average of turn scores, normalized to 0-100)
- Category scores: Technical, Problem Solving, Role Knowledge, Communication
- Job Requirements Alignment Matrix
- Adaptive Difficulty Progression
- Knowledge Gaps
- Per-question Q&A transcript with exact candidate answers

Report is stored as report_snapshot in SessionState — no second LLM call needed for PDF download (idempotent).

### 5.7 PDF Export

- downloadReportPDF() in reportExporter.ts generates a full HTML page and opens it in print dialog
- LPAInterviewView.tsx also has a jsPDF-based PDF generator with per-question breakdown

### 5.8 Job Recommendations

- POST /api/candidate/recommend-jobs uses Gemini to generate 5-8 tailored job profiles
- Strictly derives from candidate's existing CandidateProfileAnalysis — no re-processing of raw resume
- Results persisted to Firestore via saveJobRecommendations()

### 5.9 Profile Cross-Platform Comparison

- POST /api/candidate/compare-profiles merges profiles from multiple platforms (LinkedIn, Indeed, GitHub)
- Returns a profileConsistencyScore and platform-unique skill sets

### 5.10 Judge / Hackathon Mode

- Separate interview mode for hackathon organizers evaluating pre-loaded candidate datasets (candidates.json)
- Routes: POST /api/judge/interview/start, /api/judge/interview/turn, GET /api/judge/interview/report/{session_id}

---

## 6. API Flow — Endpoint by Endpoint

### 6.1 Extension Status

```
GET /api/extension/status
Returns: { enabled, version, supportedPortals[] }
```

### 6.2 Job Detection Flow

```
Content Script scrapes page DOM
  |
  v
POST /api/extension/detect-job
  Body: { url, domain, jobTitle, company, rawDescription }
  |
  v
JobAnalyzerService.detect_job_profile()
  |
  v
Returns: { isJobProfile, job: ExtractedJobPayload, prompt: ExtensionPopupPrompt }
  |
  v
Extension shows popup overlay: "Start Interview?"
```

### 6.3 Resume Analysis Flow

```
User drags PDF to ResumeUploadCard
  |
  v
POST /api/extension/analyze-resume (multipart/form-data)
  Fields: resume (file), geminiApiKey
  |
  v
Backend:
  1. Read file bytes
  2. Calculate SHA-256 hash
  3. Extract text (pypdf for PDF, python-docx for DOCX)
  4. Send to CandidateAnalyzer.analyze_resume_file_with_gemini()
  |
  v
Gemini LLM:
  Prompt: Extract structured JSON from resume text
  Returns: name, skills[], experience[], education[], projects[], targetRoles[]
  |
  v
Returns: CandidateProfileAnalysis JSON
  |
  v
Frontend stores in Firestore + chrome.storage.local
```

### 6.4 Job Match Analysis Flow

```
User opens job posting
  |
  v
POST /api/extension/analyze-job-match
  Body: { candidateProfile, job: ExtractedJobPayload }
  |
  v
Backend:
  1. Extract candidate skills, experience, projects, roles from payload
  2. If job has no skills, JobAnalyzerService.extract_skills_from_job_title_and_desc()
  3. DeterministicScoringEngine.calculate_job_match()
     Skill overlap with SYNONYM_MAP normalization
     Experience keyword alignment
     Project relevance check
     Education matching
     Keyword/responsibility alignment
  4. calculate_skill_gaps() returns DynamicSkillGap[]
  |
  v
Returns: { matchScore, breakdown, matchedSkills[], missingSkills[], explanation }
```

### 6.5 LPA Interview Flow

```
User clicks "Start Interview"
  |
  v
POST /api/interview/start
  Body: { sessionId, candidateProfile, jobProfile, matchAnalysis, expectedLpa }
  |
  v
LPAInterviewEngine.start_interview():
  1. Create SessionState in Redis/memory
  2. Build interview prompt from candidate + job context
  3. Gemini generates Question 1
  4. Store question in session.previous_questions
  |
  v
Returns: { sessionId, reply (question text), topic, difficulty, progress }

[Candidate types answer]

POST /api/interview/answer
  Body: { sessionId, answer, elapsedSeconds, integrityMetrics }
  |
  v
LPAInterviewEngine.process_answer():
  1. Load SessionState from Redis
  2. Send answer to Gemini for evaluation (score 0-10, feedback, strengths, gaps)
  3. Store TurnEvaluation in session.evaluations[]
  4. If questions_asked < 8 (MIN_QUESTIONS): Generate next question
  5. If done: call _compute_deterministic_report() and store as report_snapshot
  |
  v
Returns: { reply (next question or feedback), done, score, topic, progress }

[Interview complete]

GET /api/interview/report/{session_id}
  |
  v
Returns: Stored report_snapshot (zero additional LLM cost)
```

### 6.6 Integrity Event Logging

```
Frontend detects: fullscreen exit / tab switch / page blur
  |
  v
POST /api/interview/integrity
  Body: { sessionId, eventType, timestamp, detail }
  |
  v
LPAInterviewEngine.log_integrity_event()
  Appends IntegrityEvent to session.integrity_events[]
  |
  v
Returns: { recorded: true }
```

### 6.7 Job Recommendations Flow

```
POST /api/candidate/recommend-jobs
  Body: { profileAnalysis: CandidateProfileAnalysis, geminiApiKey }
  |
  v
JobRecommendationService.generate_recommendations():
  1. Validate profile has skills/experience/projects/education
  2. Build Gemini prompt from candidate intelligence
  3. Gemini returns JSON: 5-8 RecommendedJobProfile objects
  4. Fallback: deterministic rule-based recommendations if Gemini fails
  |
  v
Returns: JobRecommendationResponse { profiles[], generatedAt }
  |
  v
Frontend: saveJobRecommendations() to Firestore
```

---

## 7. Data and Storage Processes

### 7.1 Session Storage (Interview State)

| Store | Used When | TTL |
|---|---|---|
| Redis | Redis is running at REDIS_URL | 24 hours (SETEX 86400) |
| In-Memory Dict | Redis not available (dev mode) | Process lifetime only |

Session key format: `interview_session:{session_id}`

SessionState fields:
- session_id, status (COMPLETED / PARTIALLY_COMPLETED / ABANDONED / FAILED)
- candidate_profile_dict, job_profile_dict, match_analysis
- evaluations: List[TurnEvaluation] — per-turn Q&A + score
- integrity_events: List[IntegrityEvent] — anti-cheat log
- report_snapshot: Dict — frozen report (idempotent, no re-generation)
- start_time, end_time, duration_seconds

**Important:** No persistent database (PostgreSQL/SQLite) is used for sessions. Sessions are lost on server restart if Redis is not configured.

### 7.2 Candidate Profile Persistence (Firestore)

| Operation | Firestore Path | When |
|---|---|---|
| Save profile | interviewos/sessions/{sessionId}/candidateProfile | After resume/profile analysis |
| Get profile | Same path | On extension load to restore context |
| Save job recs | interviewos/sessions/{sessionId}/jobRecommendations | After AI job rec generation |
| Get job recs | Same path | On Explore Jobs tab load |

Firestore is frontend-only — backend does not write to Firestore directly.

### 7.3 Resume Cache (In-Memory)

- CandidateAnalyzer._resume_cache: Dict[str, CandidateProfileAnalysis]
- Key: resume_hash (SHA-256)
- Prevents re-analyzing the same resume twice in a single server session
- Lost on server restart — no Redis persistence for resume cache

### 7.4 RAG / Curriculum Data (Static JSON)

- backend/app/data/curriculum.json — 30-day curriculum of technical topics, tools, and question patterns
- CurriculumRetriever indexes it on startup as in-memory keyword-searchable chunks
- Qdrant client configured as :memory: (embedded) — no Qdrant server needed in dev

### 7.5 Candidate Dataset (Judge Mode)

- backend/candidates.json — static JSON file of hackathon candidate data
- Loaded and parsed by JudgeService.analyze_judge_file() at runtime

---

## 8. Frontend Architecture

### 8.1 Chrome Extension Layers

| Layer | File | Role |
|---|---|---|
| Popup | popup.html / popup React app | Quick status + open side panel |
| Side Panel | sidepanel.html and SidePanelApp.tsx | Main app UI (2915 lines) |
| Content Script | content.js | DOM scraper — runs on all pages |
| Background Worker | background.js | Message bus between layers |

### 8.2 SidePanelApp.tsx — Tab Structure

The side panel has these main views:

1. Dashboard — Profile + Job Match overview
2. Interview — LPAInterviewView.tsx — Full multi-turn interview UI
3. Reports — Past sessions + PDF export
4. Explore Jobs — RecommendedJobsView.tsx — AI-suggested jobs
5. Judge Demo — JudgeDemoView.tsx — Hackathon evaluator mode
6. Settings — API key, backend URL config

### 8.3 State Management

- Custom hook + subscriber pattern in interview.store.ts (not Redux/Zustand)
- Global state object with subscribers[] array for re-renders
- Candidate profile persisted to chrome.storage.local + Firestore

### 8.4 API Client

- frontend/src/api/client.ts — Axios-based client pointing to backend
- frontend/src/api/interview.ts — All API wrapper functions
- Backend URL configured via frontend/.env.local VITE_API_BASE_URL
- Mock mode (VITE_ENABLE_MOCK_API=true) allows running frontend without backend

---

## 9. AI / LLM Integration Layer

### 9.1 Gemini Key Rotation

The backend supports multiple API keys for rate-limit resilience:

```
GEMINI_API_KEY              Default key
GEMINI_RESUME_API_KEY       Dedicated key for resume analysis
GEMINI_INTERVIEW_API_KEY    Dedicated key for interview turns
GEMINI_API_KEY_4, _5        Additional rotation pool keys
```

settings.GEMINI_API_KEYS aggregates all keys. The get_llm() utility cycles through them on 429 errors.

### 9.2 LLM Call Points

| Feature | Function Called | Model |
|---|---|---|
| Resume Analysis | analyze_resume_file_with_gemini() | Gemini 2.0 Flash |
| Profile Analysis | analyze_profile_with_gemini() | Gemini 2.0 Flash |
| Question Generation | Each interview turn start | Gemini 2.0 Flash |
| Turn Evaluation | After each candidate answer | Gemini 2.0 Flash |
| Job Recommendations | generate_recommendations() | Gemini 2.0 Flash |
| Unified Intelligence | analyze_unified_intelligence_with_gemini() | Gemini 2.0 Flash |

### 9.3 Error Handling

All LLM errors are mapped to clean HTTP responses:

- 429 / RESOURCE_EXHAUSTED maps to 503 with user-friendly quota message
- 401 / UNAUTHENTICATED maps to 503 with key validation message
- 403 / PERMISSION_DENIED maps to 503 with GCP console guidance

---

## 10. Known Bugs and Errors

### Bug 1 — CRITICAL: Report Button Static / Not Generating Dynamic Report

**Severity:** High
**Location:** frontend/src/components/interview/LPAInterviewView.tsx

**Problem:** The Download Report / View Report button in some states calls downloadReportPDF() with feedbackData from the local turn history instead of fetching the backend's report_snapshot. If feedbackData is null or partially built, the PDF is empty or shows placeholder text.

**Root Cause:** GET /api/interview/report/{session_id} was not being awaited before rendering the report button; the frontend depended on the local feedbackData state alone.

**Impact:** PDF exports can miss category scores, Q&A transcripts, or the job requirements matrix.

---

### Bug 2 — CRITICAL: Session Lost on Backend Restart (No Redis)

**Severity:** High
**Location:** backend/app/services/session_service.py

**Problem:** If Redis is not running (common in dev), all session data is stored only in self._memory_sessions. A server restart or Uvicorn reload clears all active interview sessions.

**Impact:** Candidates mid-interview lose their session completely. The report cannot be retrieved.

**Fix Needed:** Add filesystem-based fallback using SQLite/aiosqlite or enforce Redis as a required dependency.

---

### Bug 3 — CRITICAL: Resume Cache Not Shared Across Processes

**Severity:** High
**Location:** backend/app/services/candidate_analyzer.py — self._resume_cache

**Problem:** The resume cache is a Python dict on the CandidateAnalyzer singleton. In multi-worker deployments (uvicorn --workers 4), each worker has its own cache. A resume analyzed by Worker 1 will be re-analyzed by Worker 2.

**Impact:** Unnecessary Gemini API calls and extra quota usage.

**Fix:** Move resume cache to Redis with key resume_cache:{sha256}.

---

### Bug 4 — MEDIUM: Router Duplication (Double Route Registration)

**Severity:** Medium
**Location:** backend/app/main.py Lines 39-44

**Problem:** All three routers (interview, extension, judge) are registered twice — once under /api and once under /api/v1. Every endpoint exists at two URLs simultaneously, inflating OpenAPI docs and creating confusion.

**Impact:** No runtime crash, but any future middleware or rate limiting must handle both paths.

---

### Bug 5 — MEDIUM: Score Normalization Ambiguity

**Severity:** Medium
**Location:** backend/app/services/lpa_interview_engine.py Lines 86-89

**Problem:** Turn scores from Gemini are expected on a 0-10 scale. The normalization code multiplies by 10 if the score is 10 or less. But if Gemini returns 85.0 (thinking it is already 0-100 scale), the code uses it as-is. No validation enforces consistent scale from Gemini.

**Impact:** Overall score inflation if Gemini occasionally returns 0-100 scale scores.

---

### Bug 6 — MEDIUM: Job Skills Extraction Uses Hardcoded Tech List

**Severity:** Medium
**Location:** backend/app/services/job_analyzer.py — extract_skills_from_job_title_and_desc()

**Problem:** A hardcoded list of approximately 30 technologies is used to extract job skills when the job posting does not provide them explicitly. Modern technologies like Supabase, Remix, tRPC, Bun, etc. are missing.

**Impact:** Job match scores are inaccurate for modern tech stacks not in the list.

---

### Bug 7 — MEDIUM: Firestore saveCandidateProfile Silently Fails

**Severity:** Medium
**Location:** frontend/src/services/firestore.ts

**Problem:** Firestore save functions catch errors and return false on failure, but the calling code in SidePanelApp.tsx does not always check or surface this failure to the user.

**Impact:** Candidate believes their profile is saved, but it silently fails on expired Firebase token or misconfigured security rules.

---

### Bug 8 — HIGH: python-docx Missing from requirements.txt

**Severity:** High (breaks DOCX uploads on fresh deployments)
**Location:** backend/requirements.txt + backend/app/api/v1/endpoints/extension.py Line 279

**Problem:** The python-docx package is imported as docx but is not listed in requirements.txt. If a DOCX resume is uploaded on a fresh deployment, it throws ModuleNotFoundError.

**Fix:** Add python-docx>=1.1.0 to requirements.txt.

---

### Bug 9 — CRITICAL SECURITY: .env Contains Real API Keys Committed to Repo

**Severity:** Critical (Security)
**Location:** backend/.env

**Problem:** The .env file contains actual Gemini API keys and appears to be tracked in git. Keys can be scraped from Git history.

**Fix:** Rotate all keys immediately. Add backend/.env to .gitignore. Use .env.example only in the repo.

---

### Bug 10 — LOW: Adaptive Difficulty Report Uses Static Current Difficulty

**Severity:** Low
**Location:** backend/app/services/lpa_interview_engine.py Lines 226-239

**Problem:** The adaptive_progression section in the report always shows session.current_difficulty (the final state) for ALL past turns instead of the actual difficulty at the time of each turn.

**Impact:** The Adaptive Difficulty Analysis section inaccurately shows the same difficulty for every question.

---

## 11. Suggested Improvements

### High Priority

1. **Add a persistent database (PostgreSQL or SQLite)**
   Replace the in-memory session store with aiosqlite (already in requirements.txt) or PostgreSQL. This survives server restarts and is critical for production reliability.

2. **Move resume cache to Redis**
   Cache CandidateProfileAnalysis in Redis keyed by resume_hash. Survives process restarts and works across multi-worker deployments.

3. **Fix Report Button to always fetch from backend**
   In LPAInterviewView.tsx, always call GET /api/interview/report/{sessionId} before rendering the PDF. Never rely solely on local feedbackData state.

4. **Add python-docx to requirements.txt**
   Add python-docx>=1.1.0 to backend/requirements.txt. DOCX resume upload is broken on fresh deployments.

5. **Rotate compromised API keys and remove .env from git**
   Add backend/.env to .gitignore. Use GitHub Secrets for CI/CD deployments.

---

### Medium Priority

6. **Fix duplicate router registration**
   Choose one canonical prefix (/api/v1) and register each router only once. Add a redirect or deprecation notice for the old /api prefix.

7. **Dynamic job skill extraction via Gemini**
   Replace the hardcoded known_techs list in job_analyzer.py with a small Gemini call to extract skills from the job description text. Better coverage for modern stacks.

8. **Validate Gemini score scale at the source**
   After each turn evaluation, assert 0.0 <= score <= 10.0. Log a warning and clamp if Gemini returns out-of-range values.

9. **Per-turn difficulty tracking in SessionState**
   Add a difficulty_per_turn: List[str] field to SessionState and record the actual difficulty at the time of each question. Use this in the adaptive progression section of the report.

10. **Firestore error surfacing**
    In SidePanelApp.tsx, check the boolean return from saveCandidateProfile() and show a toast notification if it fails.

---

### Nice-to-Have Additions

11. **WebSocket support for real-time interview turns**
    Switching to WebSockets would reduce latency and enable real-time streaming feedback using Gemini's streaming API.

12. **Candidate dashboard analytics**
    A dedicated dashboard showing: number of interviews taken, average score trend over time, most-improved skills, weakest topics, and job match trends.

13. **User authentication layer**
    Add Google OAuth (via Firebase Auth) for true multi-device sync and persistent history.

14. **Interview replay mode**
    Allow candidates to replay a past interview session: see all questions, their answers, AI evaluations, and suggested model answers side-by-side.

15. **Multi-language support**
    Add a language preference to the interview start payload (Hindi, German, French, etc.) to unlock international markets.

16. **Admin Panel / Organiser Dashboard**
    A web-based UI for hackathon organizers to view all Judge Mode sessions, compare candidate scores, and export batch reports.

17. **Streaming Gemini responses**
    Use llm.astream() instead of llm.ainvoke() to stream question text to the frontend word-by-word for better perceived responsiveness.

18. **Rate limiting on the backend**
    Add slowapi or FastAPI middleware to rate-limit analyze-resume and analyze-profile endpoints to prevent quota exhaustion.

---

## 12. Environment Setup

### Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate         # Windows
pip install -r requirements.txt
pip install python-docx        # Install missing dependency

# Copy .env.example to .env and fill in your keys
# Run dev server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install

# Create .env.local with:
# VITE_API_BASE_URL=http://localhost:8000
# VITE_ENABLE_MOCK_API=false

npm run build
# Load the dist/ folder as unpacked extension in chrome://extensions
```

### Key Environment Variables

| Variable | Description |
|---|---|
| GEMINI_API_KEY | Primary Gemini API key |
| GEMINI_RESUME_API_KEY | Dedicated key for resume analysis |
| GEMINI_INTERVIEW_API_KEY | Dedicated key for interview turns |
| GEMINI_MODEL | Default: gemini-2.0-flash |
| REDIS_URL | Default: redis://localhost:6379/0 (optional) |
| QDRANT_URL | Default: :memory: (embedded, no server needed) |

---

*Document generated: August 2026 — InterviewOS v1.0.0*
