# InterviewOS — AI Technical Interview & Job Intelligence Copilot

**InterviewOS** is an Enterprise AI hiring copilot built as a Manifest V3 Chrome Extension paired with a Python FastAPI backend. Operating seamlessly on top of any hiring board (LinkedIn, Indeed, Lever, Greenhouse, Workday), InterviewOS parses candidate resumes, extracts live job specs, calculates evidence-based match metrics, recommends aligned career opportunities, and conducts LPA-calibrated multi-turn AI technical interviews.

---

## What is InterviewOS?

InterviewOS eliminates candidate preparation friction by bringing intelligent role analysis and adaptive interview practice directly into the browser workspace.

### Core Candidate Workflow

```text
Upload Resume
      ↓
AI Profile Intelligence (Skills, Experience, Projects)
      ↓
Browse Any Web Job Posting (LinkedIn, Indeed, Lever)
      ↓
Content Script Extracts Job Specs in Real-Time
      ↓
Mathematical Compatibility Matching & Missing Skill Gaps
      ↓
Explore Recommended Career Opportunities
      ↓
Launch LPA-Calibrated Adaptive AI Technical Interview
      ↓
Dynamic Turn Progression & Evaluation Report (PDF / JSON)
```

---

## Key Features

### Completed Features (Implemented in Repository)
- **AI Resume Intelligence**: Parses PDF/DOCX resumes via `pypdf` and Gemini LLM into structured technical skills, soft skills, experience, education, and target roles (`candidate_analyzer.py`).
- **Real-Time Job Detection**: 3-tier DOM scraper (`content/index.ts`) extracting job specs from JSON-LD Schema.org, CSS selectors, and OpenGraph tags across hiring boards.
- **Dynamic Compatibility Matching**: Derives match percentages, matched skills, missing skill gaps, and readiness tiers using set-intersection math (`scoring_engine.py`).
- **Recommended Jobs Engine**: Ranks target job opportunities by candidate skill overlap and experience alignment (`job_recommendation_service.py`).
- **LPA-Calibrated AI Technical Interview**: Multi-turn adaptive technical interviewer adjusting question complexity based on candidate target LPA (Junior <=8 LPA, Mid-Senior 9-18 LPA, Staff/Lead >=19 LPA).
- **Turn-by-Turn Q&A & Ideal Answer Tracking**: Records full turn questions, candidate typed responses, ideal technical answers, and turn scores (`LPAInterviewView.tsx`).
- **Dynamic Candidate Readiness Metrics**: 100% dynamic calculation of Overall Readiness, Technical Depth, Problem Solving, and Curriculum Fit scores based on actual typed answers (`JudgeDemoView.tsx`).
- **Proctoring & Integrity Monitoring**: Observes browser DOM events (`visibilitychange`, `fullscreenchange`) to log tab switches and fullscreen exits in interview audit metrics.
- **Judge Panel Demo Hub**: Organizer evaluation dashboard allowing hackathon judges to inspect curriculum dataset files (`curriculum.json`, `candidates.json`, `technical-spec.md`) and run pre-seeded candidate mission interviews (`JudgeDemoView.tsx`).
- **PDF & JSON Evaluation Reports**: Downloads comprehensive evaluation report snapshots with strengths matrix, preparation priorities, question breakdowns, and integrity audit summary.

### Planned Features
- Real-time voice response evaluation via Web Audio API.
- Integrated IDE code playground for live coding challenges inside the extension sidepanel.

---

## Architecture & How It Works

```text
┌────────────────────────────────────────────────────────┐
│             Chrome Browser Extension                   │
│  (Popup App | SidePanel Workspace | Content Script)    │
└──────────────────────────┬─────────────────────────────┘
                           │  HTTP / REST
                           ▼
┌────────────────────────────────────────────────────────┐
│                 Python FastAPI Backend                 │
│  (app/main.py | endpoints: /interview, /extension)     │
└──────────────┬───────────────────────────┬─────────────┘
               │                           │
               ▼                           ▼
┌──────────────────────────┐    ┌────────────────────────┐
│     Google Gemini AI     │    │  Firebase / Firestore  │
│  (gemini-2.0-flash LLM)  │    │  (Client Profile Store)│
└──────────────────────────┘    └────────────────────────┘
```

---

## Important Architectural Distinction

To maintain complete accuracy, InterviewOS evaluates deployment across three distinct states:

- **Production-Ready Architecture**: The application is architected for public deployment with server-side API key isolation, environment-driven base URLs, and CORS security regex.
- **Production-Ready Code**: Code checks, build pipelines, error handlers, and client-side failovers are fully implemented without critical blockers.
- **Production Deployed**: *InterviewOS is currently prepared for production deployment. The core application is implemented and packaged in `frontend/interviewos-extension-v1.0.0.zip`, while live cloud deployment on Render and publication on the Chrome Web Store remain final deployment steps.*

---

## Resume Intelligence & Evidence Policy

InterviewOS enforces a strict **Zero-Fabrication Policy** during resume extraction:

1. **Extracted Signals**: Technical skills, soft skills, employment history, degree achievements, project tech stacks, target job titles, and profile completeness score.
2. **Sanitization Filters**: Contact details (emails, phone numbers, URLs) and platform names (GitHub, LinkedIn) are stripped from technical skill arrays (`helpers.py`).
3. **Evidence Validation**: If resume evidence is sparse or invalid, the backend returns an explicit `insufficient_evidence` status rather than generating fake candidate profiles.

---

## Job Matching Engine

Compatibility scores in InterviewOS are calculated deterministically using mathematical skill overlap and experience alignment:

$$\text{Match Score} = \text{Weighted Skill Set Overlap}(\text{Candidate Skills}, \text{Job Required Skills}) + \text{Experience Tier Alignment}$$

- **Matched Skills**: Exact intersection of candidate skills with job requirement tags.
- **Missing Skills**: Critical job requirements absent from the candidate profile.
- **Role Readiness**: Categorized into `High Match` (>=75%), `Moderate Match` (50-74%), or `Needs Skill Bridge` (<50%).

---

## Recommended Jobs ("Explore Jobs")

Candidates can open the **Explore Jobs** view in the extension to view role recommendations. The engine ranks available positions using candidate technical skills and past experience, providing:
- Match Score (%) & Alignment Tier
- Matched Technical Skill Chips
- Missing Skill Gaps to Address
- Recommended Preparation Topics

---

## AI Technical Interview Engine

Candidates can launch an AI-powered technical interview calibrated to their target **LPA (Lakhs Per Annum)**:

### Difficulty Calibration Tiers
- **<= 8 LPA (Junior)**: Syntax fundamentals, programming basics, and core data structures.
- **9 - 18 LPA (Mid-Senior)**: System architecture, async concurrency, DB indexing, state management, and trade-offs.
- **>= 19 LPA (Staff/Lead)**: Distributed systems, high-concurrency scaling, microservice failure modes, and leadership decisions.

### Turn Progression & Evaluation
- Conducts 8+ sequential turns covering core competency domains (*System Architecture*, *State Management*, *API Integration*, *Performance*, *Database Schema*, *Security*, *Testing/CI-CD*, *Scalability*).
- Displays exact questions asked, candidate typed responses, and the **Expected / Real Technical Solution**.
- Generates 100% dynamic metric scores based on candidate response depth and technical keyword density.

---

## Anti-Cheating & Integrity Monitoring

During active interview sessions, InterviewOS monitors observable browser DOM events:
- **Tab Switch Detection**: Logged when `document.visibilityState` changes.
- **Fullscreen Exit Logging**: Tracked via `fullscreenchange` event listeners.
- **Integrity Audit Summary**: Summarized in the post-interview evaluation report snapshot.

*Note: Monitoring is strictly scoped to standard Web Browser DOM APIs.*

---

## Backend API Structure

Built with Python FastAPI (`backend/app/main.py`), exposing the following endpoints:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/health` | `GET` | Health check status verification |
| `/api/candidate/analyze-resume` | `POST` | PDF/DOCX resume text extraction and candidate profile analysis |
| `/api/extension/detect-job` | `POST` | Scrapes job posting details from page DOM |
| `/api/v1/extension/analyze-job-match` | `POST` | Calculates dynamic compatibility score and skill gaps |
| `/api/candidate/recommend-jobs` | `POST` | Ranks target positions against candidate profile |
| `/api/extension/interview/start` | `POST` | Initializes LPA-calibrated AI interview session |
| `/api/extension/interview/answer` | `POST` | Processes candidate turn answer and returns next adaptive question |
| `/api/extension/interview/integrity` | `POST` | Logs candidate integrity events (tab switches, fullscreen exits) |
| `/api/interview/report/{session_id}` | `GET/POST` | Idempotently returns pre-computed interview report snapshot |
| `/api/v1/judge/files` | `GET` | Lists organizer evaluation dataset files |
| `/api/v1/judge/analyze` | `POST` | Dynamically analyzes curriculum and candidate dataset files |

---

## Production Readiness Audit

### Backend Readiness
- **Server Binding**: Configured to bind to `0.0.0.0:$PORT` for cloud platform compatibility (Render / AWS App Runner / Railway).
- **Environment Isolation**: All LLM keys (`GEMINI_API_KEY`) and infrastructure paths are hosted exclusively on the server.
- **CORS Configuration**: Regex-based origin validator (`chrome-extension://.*|http://localhost.*|https://.*`) allowing Chrome Extension requests with credentials support.
- **Error Exception Handling**: Exception handler `@app.exception_handler(429)` returns structured error payloads (`GEMINI_QUOTA_EXHAUSTED`).
- **Input Validation**: Pydantic v2 schemas enforce validation on candidate profiles, job matches, and turn payloads.

### Frontend / Chrome Extension Readiness
- **Production Build Pipeline**: Vite build script outputs clean Manifest V3 assets to `frontend/dist`.
- **Zero Hardcoded Localhost in JS Build**: Production API URLs are injected dynamically via `VITE_API_BASE_URL`.
- **Permissions Audit**: Scoped strictly to necessary extension permissions (`storage`, `activeTab`, `scripting`, `sidePanel`).
- **Client Fallback Resilience**: Local sequential turn tracker in `api/interview.ts` prevents candidate sessions from crashing during API rate limits.

---

## Production Readiness Checklist

| Area | Status | Notes |
| :--- | :--- | :--- |
| **Resume Analysis** | ✅ Ready | PDF/DOCX parsing with evidence validation in `candidate_analyzer.py` |
| **AI Integration** | ✅ Ready | Gemini 2.0 Flash via server-side `GEMINI_API_KEY` |
| **Job Matching** | ✅ Ready | Mathematical skill set set-intersection scoring engine |
| **Dynamic Metrics** | ✅ Ready | Real-time score calculations from candidate typed answers |
| **AI Interview** | ✅ Ready | LPA-calibrated 8+ turn progression with ideal technical answers |
| **Interview Monitoring** | ✅ Ready | DOM-based tab switch and fullscreen exit event auditing |
| **Backend API** | ✅ Ready | FastAPI router endpoints with `/health` diagnostic probe |
| **Database / Storage** | ✅ Ready | In-memory Qdrant + client-side Firestore profile persistence |
| **Authentication** | 🟡 Needs Verification | Client profile IDs stored via Firebase client SDK |
| **API Security** | ✅ Ready | Server-side key isolation; zero API keys in client JS |
| **Secret Management** | ✅ Ready | `.env.example` templates created; no secrets in Git |
| **Error Handling** | ✅ Ready | FastAPI HTTP 429 handlers & clean React error alert banners |
| **Logging** | ✅ Ready | Structured backend logger and typed frontend logger |
| **CORS Configuration** | ✅ Ready | Regex origin matching for `chrome-extension://` & HTTPS |
| **Production Backend Host** | 🟡 Needs Deployment | Render setup configured; waiting for web service launch |
| **HTTPS Endpoint** | 🟡 Needs Deployment | HTTPS provided automatically upon Render deployment |
| **Chrome Extension Build** | ✅ Ready | Production build generated in `frontend/dist` |
| **Chrome Web Store Package**| ✅ Ready | Zip package generated at `interviewos-extension-v1.0.0.zip` |
| **Scalability** | ✅ Ready | Stateless REST backend with async task handling |
| **Privacy Policy & Audit** | ✅ Ready | Data flow documented; zero third-party data tracking |

---

## Production Configuration Matrix

| Setting / Variable | Development Environment | Production Target Environment |
| :--- | :--- | :--- |
| **`VITE_API_BASE_URL`** | `http://localhost:8000` | `https://interviewos-backend.onrender.com` |
| **`GEMINI_API_KEY`** | Local `.env` file | Render Web Service Environment Variables |
| **`GEMINI_MODEL`** | `gemini-2.0-flash` | `gemini-2.0-flash` |
| **Backend Server Command** | `uvicorn app.main:app --reload --port 8000` | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **FastAPI `DEBUG` Mode** | `True` | `False` |
| **Chrome Extension Target** | Unpacked `frontend/dist` | Published Chrome Web Store Package |

---

## Production Deployment Steps

Follow this workflow to deploy the backend and publish the Chrome Extension:

```text
Step 1: Push codebase to GitHub repository (Interview-Ext-Phase1)
  ↓
Step 2: Create Render Web Service (Root: backend, Start: uvicorn app.main:app --host 0.0.0.0 --port $PORT)
  ↓
Step 3: Set GEMINI_API_KEY environment variable on Render dashboard
  ↓
Step 4: Verify live HTTPS backend health check: GET https://<render-domain>/health
  ↓
Step 5: Set VITE_API_BASE_URL in frontend/.env.production to live Render URL
  ↓
Step 6: Execute npm run build in frontend directory
  ↓
Step 7: Upload frontend/interviewos-extension-v1.0.0.zip to Chrome Web Store Developer Dashboard
```

---

## Local Development & Environment Setup

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- Google Chrome Browser

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate Python virtual environment
python -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On macOS/Linux:
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY

# Start local FastAPI server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
FastAPI Swagger Documentation is available at: `http://localhost:8000/docs`.

### 3. Frontend & Extension Build

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Build Chrome Extension bundle
npm run build
```

The compiled Manifest V3 extension will be generated in `frontend/dist`.

### 4. Load Extension in Chrome

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in top-right corner).
3. Click **Load unpacked** (top-left button).
4. Select the `frontend/dist` directory.
5. InterviewOS is now active in your browser!

---

## Production Readiness Summary

- **✅ Production-Ready Architecture & Code**: Built with server-side key isolation, environment-driven API URLs, CORS regex support, and complete error handling.
- **🟡 Production Deployment Status**:
  - **Backend**: Ready to launch on Render (`0.0.0.0:$PORT`).
  - **Frontend Build**: Compiled & verified in `frontend/dist`.
  - **Chrome Extension Package**: Created at `frontend/interviewos-extension-v1.0.0.zip` ready for Web Store upload.
  - **HTTPS & Public API**: Provided automatically upon launching on Render.

# ai-interview-extension-final
