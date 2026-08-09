# InterviewOS — AI Development & System Architecture Prompts

Documenting the core architectural prompts, development instructions, engineering decisions, and AI-assisted workflows used to design, build, and refine **InterviewOS** — an Enterprise AI Technical Interview & Job Intelligence Copilot Chrome Extension powered by FastAPI and Google Gemini.

---

## Table of Contents
1. [Project Concept & Architecture](#1-project-concept--architecture)
2. [Resume Upload & Parsing Subsystem](#2-resume-upload--parsing-subsystem)
3. [Smart Resume Intelligence & Evidence Policy](#3-smart-resume-intelligence--evidence-policy)
4. [Job Profile Detection & Match Engine](#4-job-profile-detection--match-engine)
5. [Recommended Jobs Flow ("Explore Jobs")](#5-recommended-jobs-flow-explore-jobs)
6. [AI Technical Interview Engine (LPA-Calibrated)](#6-ai-technical-interview-engine-lpa-calibrated)
7. [Anti-Cheating & Integrity Monitoring](#7-anti-cheating--integrity-monitoring)
8. [Gemini AI Integration & Rate-Limit Fallback](#8-gemini-ai-integration--rate-limit-fallback)
9. [Firebase / Firestore Data Persistence](#9-firebase--firestore-data-persistence)
10. [Error Handling & Human-Readable Responses](#10-error-handling--human-readable-responses)
11. [Organiser Evaluation Dataset & Judge Demo Flow](#11-organiser-evaluation-dataset--judge-demo-flow)
12. [Dynamic Report Generation & PDF Export](#12-dynamic-report-generation--pdf-export)
13. [Dynamic Metrics & Real-Time Scoring](#13-dynamic-metrics--real-time-scoring)
14. [Previous Reports — Dynamic History Flow](#14-previous-reports--dynamic-history-flow)
15. [Production Deployment (Render & Chrome Web Store)](#15-production-deployment-render--chrome-web-store)
16. [Live Render Backend Integration](#16-live-render-backend-integration)
17. [Development Principles](#development-principles)

---

## 1. Project Concept & Architecture

### Objective
Build an all-in-one AI hiring copilot extension that operates directly on top of job boards (LinkedIn, Indeed, Lever, Greenhouse, Workday) and provides an end-to-end intelligence loop: Resume Parsing → Live Job Extraction → Dynamic Compatibility Scoring → LPA-Calibrated Technical Interviewing → PDF/JSON Evaluation Reporting.

### Prompt / Instruction
> Design a Manifest V3 Chrome Extension paired with a Python FastAPI backend called InterviewOS. The extension must analyze uploaded candidate resumes, extract job specs from active browser tabs, score match compatibility using real skill metrics, and conduct an interactive AI technical interview tailored to candidate target salary (LPA).

### Implementation
- **Frontend Extension**: React 18, TypeScript, Vite, Tailwind CSS, Lucide icons in `frontend/src/` providing SidePanel, Popup, and Content Script.
- **Backend FastAPI**: Located in `backend/app/main.py` exposing REST endpoints for resume parsing, job detection, scoring, interview execution, and judge evaluation.

### Important Decisions
- Separated extension UI from AI business logic. All LLM calls and key storage remain strictly on the FastAPI backend.
- Used Manifest V3 `sidePanel` API to provide an unobtrusive co-pilot experience while candidates browse hiring portals.

### Current Status
**Completed**

---

## 2. Resume Upload & Parsing Subsystem

### Objective
Extract raw text from PDF and DOCX resume uploads and parse technical skills, experience, education, and projects into structured JSON using Gemini LLM.

### Prompt / Instruction
> Build a resume parsing service in Python. Accept binary PDF/DOCX files, extract raw text cleanly, and pass document text to Gemini LLM with schema constraints to produce structured candidate profile models.

### Implementation
- `backend/app/services/resume_pipeline.py`: Handles multi-format text extraction (`pypdf`, `python-docx`).
- `backend/app/services/candidate_analyzer.py`: Invokes Gemini via `get_llm(purpose="resume")` to populate `CandidateProfileAnalysis` Pydantic models.

### Important Decisions
- SHA-256 payload hashing for deduplication and idempotent profile caching.
- Enforced Pydantic schemas to validate LLM output structure.

### Current Status
**Completed**

---

## 3. Smart Resume Intelligence & Evidence Policy

### Objective
Prevent AI hallucinations and classification errors (e.g. classifying contact metadata as skills) and enforce an explicit evidence validation policy.

### Prompt / Instruction
> Enforce strict sanitization on candidate profile parsing:
> 1. Contact info (emails, phone numbers, URLs) must NOT be listed as technical skills.
> 2. Platform names (GitHub, LinkedIn) must NOT be classified as engineering skills.
> 3. Hard technical skills (Python, React, SQL) must be separated from soft skills.
> 4. If candidate evidence is sparse, return an explicit `insufficient_evidence` status instead of fabricating candidate data.

### Implementation
- `backend/app/services/candidate_analyzer.py`: Implements `evaluate_profile_evidence()` to verify skill and experience thresholds.
- `backend/app/utils/helpers.py`: Provides `safe_str_list()` regex filters to strip contact data and URLs from technical skill arrays.

### Important Decisions
- Explicitly rejected generating fake candidate profiles when resume text is insufficient or empty.

### Current Status
**Completed**

---

## 4. Job Profile Detection & Match Engine

### Objective
Extract job details from hiring portals in real-time and calculate compatibility using mathematical skill set intersection rather than random percentages.

### Prompt / Instruction
> Build a 3-tier DOM scraper in the Chrome Extension content script (JSON-LD Schema.org -> Portal CSS selectors -> OpenGraph meta tags). Calculate match scores using explicit set overlap logic:
> `Match Score = Weighted Skill Overlap + Experience Alignment`.

### Implementation
- `frontend/src/content/index.ts`: 3-tier DOM extractor targeting job titles, companies, requirements, and descriptions.
- `backend/app/services/scoring_engine.py`: Computes match percentages, matched skills list, missing skills list, and career readiness tier.

### Important Decisions
- Deterministic calculation guarantees distinct match scores and missing skill breakdowns for different job postings.

### Current Status
**Completed**

---

## 5. Recommended Jobs Flow ("Explore Jobs")

### Objective
Recommend aligned career opportunities based on the uploaded candidate's technical skills and target roles.

### Prompt / Instruction
> Build a job recommendation endpoint (`POST /api/candidate/recommend-jobs`) that evaluates an uploaded candidate profile against role databases, ordering recommendations by match percentage with explainability rationales.

### Implementation
- `backend/app/services/job_recommendation_service.py`: Ranks target job profiles against candidate skills and returns top matching positions with matched/missing skill chips and interview prep topics.

### Important Decisions
- Blocks recommendation generation if no valid candidate resume has been uploaded first.

### Current Status
**Completed**

---

## 6. AI Technical Interview Engine (LPA-Calibrated)

### Objective
Conduct multi-turn, adaptive technical interviews calibrated against candidate Expected LPA (salary target), resume evidence, and job requirements.

### Prompt / Instruction
> Build an adaptive technical interview engine:
> - Difficulty calibration: <=8 LPA (Junior/Basics), 9-18 LPA (Mid-Senior/Architecture & Trade-offs), >=19 LPA (Staff/Lead/Scalability & Failure Recovery).
> - Conduct 8+ sequential turns covering core competency domains.
> - Track exact questions asked, candidate typed responses, and expected technical solutions.
> - Generate dynamic readiness scores based directly on candidate typed answer quality and keyword density.

### Implementation
- `backend/app/services/lpa_interview_engine.py`: Manages session state, difficulty calibration, turn evaluation, and report snapshot generation.
- `frontend/src/api/interview.ts` & `LPAInterviewView.tsx`: Client turn tracker handling turn progression, exact question recording, expected answer rendering, and 100% dynamic metric score calculations.

### Important Decisions
- Implemented a role-calibrated local fallback interviewer in `api/interview.ts` to ensure uninterrupted session progression if Gemini API quotas are exhausted.

### Current Status
**Completed**

---

## 7. Anti-Cheating & Integrity Monitoring

### Objective
Monitor candidate engagement events during active interview sessions without violating browser privacy boundaries.

### Prompt / Instruction
> Track candidate interaction events during interview sessions: fullscreen exits, tab switches, and window focus loss. Log integrity events to session metrics and display an integrity audit summary in the final report.

### Implementation
- `LPAInterviewView.tsx`: Attach DOM listeners for `visibilitychange` and `fullscreenchange`.
- `backend/app/services/lpa_interview_engine.py`: `log_integrity_event()` records timestamped integrity events to session audit metrics.

### Important Decisions
- Transparently scope integrity monitoring to observable DOM/browser events; avoid false claims of OS-level proctoring.

### Current Status
**Completed**

---

## 8. Gemini AI Integration & Rate-Limit Fallback

### Objective
Power resume extraction, job matching, and interview evaluation using Google Gemini LLM while handling API rate limits gracefully.

### Prompt / Instruction
> Integrate Gemini AI via a secure backend architecture using a single primary `GEMINI_API_KEY` (model: `gemini-2.0-flash`). If rate limits (HTTP 429) occur, activate local evaluation fallbacks so candidate interview sessions never crash or get stuck.

### AI Log — Rate Limit Discovery
During development, all Gemini keys hit 429 RESOURCE_EXHAUSTED simultaneously:
```
[GEMINI_RETRY] Key AQ.Ab8...ntCQ (length=53) failed (429 RESOURCE_EXHAUSTED)
[GEMINI_RETRY] Key AQ.Ab8...DwWw (length=53) failed (429 RESOURCE_EXHAUSTED)
[GEMINI_RETRY] Key AQ.Ab8...pI-A (length=53) failed (429 RESOURCE_EXHAUSTED)
```
**Resolution**: Consolidated to a single backend GEMINI_API_KEY and implemented local fallback evaluators in `api/interview.ts` so interview sessions are never blocked.

### Implementation
- `backend/app/utils/llm.py`: Configures `ChatGoogleGenerativeAI` with temperature tuning and fallback handling.
- `frontend/src/api/interview.ts`: Local turn tracker fallback ensuring seamless question progression and report generation during API quota limits.

### Important Decisions
- Consolidated API key architecture to a single, backend-configured `GEMINI_API_KEY` variable.

### Current Status
**Completed**

---

## 9. Firebase / Firestore Data Persistence

### Objective
Persist candidate profiles, match histories, and interview report snapshots on the client side using Firebase Firestore.

### Prompt / Instruction
> Integrate Firebase Cloud Firestore client SDK in the extension to persist candidate data under user document paths without exposing server credentials.

### Firebase Environment Variables
During production audit, the following Firebase configuration variables were verified as required:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

### Implementation
- `frontend/src/services/firestore.ts`: Saves user profiles, match records, and completed interview reports under `users/{userId}/...`.

### Important Decisions
- Client SDK uses web app parameters only; no service account private keys are included in frontend source code.

### Current Status
**Completed**

---

## 10. Error Handling & Human-Readable Responses

### Objective
Catch backend errors (e.g. 429 Quota Exhaustion) cleanly and present clear human-readable error messages in the extension UI.

### Prompt / Instruction
> Handle API exceptions gracefully: return structured JSON errors with error codes, and render user-friendly alert banners in React components without `[object Object]` stringification bugs.

### Implementation
- `backend/app/main.py`: Adds `@app.exception_handler(429)` returning clean JSON payload.
- `frontend/src/sidepanel/SidePanelApp.tsx`: Parses `err.response?.data?.detail` or `message` cleanly.

### Important Decisions
- Completely eliminated silent failures and unhandled promise rejections.

### Current Status
**Completed**

---

## 11. Organiser Evaluation Dataset & Judge Demo Flow

### Objective
Provide a dedicated Judge Panel flow for hackathon evaluations using organizer dataset files (`curriculum.json`, `candidates.json`, `technical-spec.md`).

### Prompt / Instruction
> Create a secondary "Explore Judge Files" entry point in the extension UI. Parse organizer dataset files dynamically, allow selecting candidate profiles (e.g. Emily Chen), run personalized hackathon interviews, and generate Judge Evaluation Reports adhering to `technical-spec.md`.

### AI Development Log — Session Prompts

**Prompt 1** — Report not generating dynamically:
> "check the report button is still static and can't work dynamically, the report is not generating"

**Resolution**: Traced that `JudgeDemoView.tsx` was rendering a hardcoded static report object. Rewired the component to pull interview session state from `liveSession` and compute the report from actual candidate answers.

**Prompt 2** — Include candidate answer in report:
> "with this it also shows user input answer along with the real answer of the question and then it will be updated in the pdf summary downloaded by the user as report"

**Resolution**: Added `candidateAnswer` field to each interview turn object. Updated `pdfGenerator.ts` to include both `Question`, `Your Answer`, and `Expected Answer` sections in the PDF layout.

**Prompt 3** — Real percentage based on actual answers:
> "it will also include the real percentage based on the answer of the candidate as how much the candidate is actual prepared for the interview"

**Resolution**: Built a keyword-density scoring algorithm in the frontend that computes a dynamic `preparednessScore` per turn from answer quality signals.

### Implementation
- `backend/app/services/judge_service.py` & `judge_interview_engine.py`: Handles disk file discovery, curriculum parsing, and hackathon evaluation turn engine.
- `frontend/src/components/JudgeDemoView.tsx`: Multi-tab judge panel component featuring Curriculum Explorer, Candidate Directory, Spec Viewer, and Evaluation Reports.

### Important Decisions
- Isolated Judge Panel mode completely from standard user flow so normal resume upload and job matching remain untouched.

### Current Status
**Completed**

---

## 12. Dynamic Report Generation & PDF Export

### Objective
Generate a fully dynamic interview evaluation report (visible in UI + downloadable as PDF) based on actual candidate typed answers — not static/hardcoded mock data.

### AI Development Log

**Prompt** — Report button visible only after interview complete:
> "i want judge Evaluation Report show after complete interview"

**Resolution**: Added a state flag `interviewCompleted` to `JudgeDemoView.tsx`. Report section and "Generate Report" button only render once the interview session has all 8 turns completed.

**Follow-up Prompt** — Remove generate button from mid-interview:
> "i want remove Generate report this also and i want show only after complete the interview then show generate Report"

**Resolution**: Moved the report generation UI completely below the interview completion gate. Removed all intermediate report CTAs from the active interview flow.

**Prompt** — UI/UX improvement without touching backend:
> "please improve ui and ux and not touch any backend file and folder"

**Resolution**: Refined `JudgeDemoView.tsx` with premium card layouts, animated transitions, gradient status chips, and improved tab navigation. Zero backend files touched.

**Prompt** — Use InterviewOS logo from icons directory:
> "use our logo"
> "please our logo which is inside icons logo.jpg and logo.png"

**Resolution**: Detected logo assets at `frontend/public/icons/logo.png`. Wired the logo into the Judge Panel header and sidebar branding, preserving asset path for both dev and production builds.

### Implementation
- `frontend/src/utils/pdfGenerator.ts`: Generates multi-page PDF reports including candidate answer, expected answer, score per turn, overall metrics, and integrity audit log.
- `frontend/src/components/JudgeDemoView.tsx`: Controls report visibility gate and PDF download trigger.

### Current Status
**Completed**

---

## 13. Dynamic Metrics & Real-Time Scoring

### Objective
Replace all static/hardcoded metric percentages in the interview report with live values computed from candidate's actual typed answers.

### AI Development Log

**Prompt** — Metrics still static:
> "this metrics are still static make them dynamic based on the answer"

**Root Cause**: Evaluation metrics (Technical Depth, Communication, Problem Solving, Confidence, Domain Expertise, Preparedness) were computed from placeholder values unrelated to candidate responses.

**Resolution Approach**:
1. Built a `scoreTurn()` function in `frontend/src/api/interview.ts` that evaluates each candidate answer against the expected answer's keyword set.
2. Computed a `keywordMatchRatio` per turn.
3. Averaged keyword match ratios across all turns for each metric dimension.
4. Displayed live metric badges in the report that update with every submitted answer.

**Prompt** — Include actual candidate answer alongside evaluation:
> "also add with their actual answer"

**Resolution**: Updated report rendering to show a side-by-side comparison panel: candidate's verbatim typed answer on the left, AI-generated expected answer on the right.

### Implementation
- `frontend/src/api/interview.ts`: Implements `computeDynamicMetrics()` and `scoreTurn()` scoring functions.
- `frontend/src/components/JudgeDemoView.tsx`: Consumes live metric scores and renders animated gauge charts per metric category.

### Current Status
**Completed**

---

## 14. Previous Reports — Dynamic History Flow

### Objective
Make the "Previous Reports" button fully dynamic so it loads all past interview reports generated from a candidate's actual typed answers — not static placeholder cards.

### AI Development Log

**Prompt** — Previous report button should work dynamically:
> "i want to make the previous report button work in dynamic way and will work accordingly to the report etc generated by the users's answers"

**Root Cause**: The "Previous Reports" modal was rendering a static mock report object with hardcoded candidate names and scores.

**Resolution**:
1. Implemented a dual-store persistence system saving every completed interview to `localStorage` under both a job-scoped key and a global history key.
2. Built an interactive modal listing all saved reports with Candidate, Score, Date, and a `View` action.
3. Clicking `View` dynamically loads that report's questions, answers, expected answers, metrics, and audit log into the main report panel.
4. Added a `Delete (X)` button per saved report for cleanup.

### Implementation
- `frontend/src/components/interview/LPAInterviewView.tsx`: Implements `saveReportToHistory()`, `loadPreviousReports()`, `renderPastReportsModal()`, and dual localStorage persistence.

### Important Decisions
- Reports are stored under both `interviewOS_reports_{jobId}` (job-scoped) and `interviewOS_global_reports` (cross-session) keys to support both job-specific and global history views.

### Current Status
**Completed**

---

## 15. Production Deployment (Render & Chrome Web Store)

### Objective
Prepare the Python FastAPI backend for hosting on Render and package the Manifest V3 Chrome Extension for public publication on the Chrome Web Store.

### AI Development Log

**Prompt** — Full production launch:
> "I want to prepare the COMPLETE InterviewOS Chrome Extension for PUBLIC PRODUCTION LAUNCH.
> 1. Deploy the backend publicly on Render.
> 2. Remove dependency on localhost:8000 for production.
> 3. Connect the Chrome Extension to the deployed backend.
> 4. Prepare the complete Chrome Extension for public release through the Chrome Web Store.
> 5. Make sure Gemini API, Firebase/Firestore, CORS, environment variables and all backend services continue working."

**Production Audit Findings**:
- All `localhost:8000` hardcodes confirmed removed from production build.
- `frontend/.env.production` configured with `VITE_API_BASE_URL`.
- CORS policy updated: `chrome-extension://.*|http://localhost.*|https://.*`.
- `Dockerfile` confirmed present and correctly configured for Render deployment.
- `requirements.txt` includes all production dependencies.
- Chrome Extension `manifest.json` updated with correct host permissions.

**Environment Variables Required for Backend (Render)**:
```
GEMINI_API_KEY=your_gemini_api_key
PORT=10000
ALLOWED_ORIGINS=*
LOG_LEVEL=info
```

**Environment Variables Required for Frontend**:
```
VITE_API_BASE_URL=https://interview-ext-backend.onrender.com
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_ENABLE_MOCK_API=false
VITE_LOG_LEVEL=info
VITE_APP_VERSION=1.0.0
```

### Implementation
- `backend/app/main.py`: CORS regex updated (`chrome-extension://.*|http://localhost.*|https://.*`).
- `backend/requirements.txt`: Added `langchain-google-genai` and `google-genai`.
- `frontend/.env.production`: Configured production backend URL.
- Packaged extension ZIP: `frontend/interviewos-extension-v1.0.0.zip`.

### Important Decisions
- Automated extension packaging via Vite build script and PowerShell archive compression.
- Distinction between Production-Ready Architecture/Code (fully implemented and packaged) vs Live Public Deployment (Render deployment & Chrome Web Store publishing pending final user launch).

### Current Status
**Production Build Completed / Packaged**

---

## 16. Live Render Backend Integration

### Objective
Connect the Chrome Extension's production build to the live Render backend URL after successful deployment.

### AI Development Log

**Prompt** — Switch from localhost to live Render URL:
> "https://interview-ext-backend.onrender.com
> now our backend is running on that url so according to this change the localhost:8000 port so that we can launch that on chrome extension and then the backend be take from this render link"

**Changes Applied**:
1. `frontend/.env.production` updated: `VITE_API_BASE_URL=https://interview-ext-backend.onrender.com`
2. `frontend/manifest.json` updated: added `https://interview-ext-backend.onrender.com/*` to `host_permissions`
3. `frontend/public/manifest.json` updated: same update applied
4. Ran `npm run build` — **1941 modules transformed, built in 12.73s**
5. Verified production bundle: `content.js` confirmed contains the Render URL — zero localhost references remain
6. Re-packaged ZIP: `interviewos-extension-v1.0.0.zip` (~878 KB)

**Bundle Verification**:
```js
// dist/content.js (confirmed)
const ut = "https://interview-ext-backend.onrender.com"

// dist/assets/constants.js (confirmed)
apiBaseUrl: "https://interview-ext-backend.onrender.com"
```

### Git & GitHub Production Push

**Prompt** — Verify .gitignore before push:
> "now we are now push on github toh .gitignore already updated hai ki karna hai"

**Actions Verified**:
- `.gitignore` excludes: `.env`, `.env.*`, `*.zip`, `node_modules/`, `dist/`, `__pycache__/`, `*.pyc`, Firebase service account JSON.
- No secrets committed to repository.
- Production build and ZIP ready for Chrome Web Store submission.

### Current Status
**Live — Backend deployed at `https://interview-ext-backend.onrender.com`**

---

## Development Principles

InterviewOS was built following 10 core engineering principles:

1. **AI-Generated Analysis**: Profile analysis and match signals are generated from actual candidate resumes and job postings.
2. **Zero Fabrication**: Sparse resume data triggers explicit `insufficient_evidence` states instead of generating fake candidate details.
3. **Deterministic Match Scoring**: Compatibility percentages are derived from mathematical skill set set-intersections and experience weights.
4. **Backend-Only Secrets**: API keys (`GEMINI_API_KEY`) are hosted strictly on the backend and never bundled in extension JavaScript.
5. **Structured Schema Validation**: All LLM outputs are validated against Pydantic models.
6. **Graceful Rate-Limit Fallback**: Quota limits trigger local evaluation fallbacks so active candidate sessions never freeze.
7. **Transparent Anti-Cheating**: Proctoring is strictly scoped to observable browser DOM events (`visibilitychange`, `fullscreenchange`).
8. **Clean Dual-Flow Architecture**: Standard user workflow and Judge Panel demo flow operate independently without cross-contamination.
9. **Environment-Based API Targeting**: Seamless switching between `http://localhost:8000` (dev) and `https://interview-ext-backend.onrender.com` (production).
10. **Human-Readable Error Handling**: All network and AI exceptions surface clear user guidance in UI alert banners.

---

## AI Tools & Models Used

| Purpose | Model / Tool |
|---------|--------------|
| Resume Parsing & Analysis | Google Gemini 2.0 Flash (`gemini-2.0-flash`) |
| Job Match Scoring | Google Gemini 2.0 Flash |
| Interview Question Generation | Google Gemini 2.0 Flash |
| Interview Turn Evaluation | Google Gemini 2.0 Flash + Local Fallback |
| Judge Panel Evaluation | Google Gemini 2.0 Flash |
| PDF Report Generation | `html2canvas` + `jsPDF` |
| Extension Framework | React 18 + TypeScript + Vite |
| Backend Framework | Python FastAPI |
| Data Validation | Pydantic v2 |
| AI Development Assistant | Antigravity (Google DeepMind) |

---

---

# BUILD FROM SCRATCH — Complete Prompt Sequence

This section documents every prompt required to rebuild **InterviewOS** from a blank directory to a fully production-deployed Chrome Extension with an AI-powered backend. Follow these prompts in order.

---

## PHASE 0 — Project Initialization

### Prompt S-01: Workspace & Monorepo Setup
```
Create a monorepo workspace for a Chrome Extension project called "InterviewOS".
Structure:
- /frontend  → Vite + React 18 + TypeScript Chrome Extension
- /backend   → Python FastAPI AI backend
- /package.json at root with workspaces config

Initialize both projects with proper .gitignore files excluding:
  node_modules/, dist/, __pycache__/, *.pyc, .env, .env.*, *.zip,
  venv/, .venv/, *.log, .DS_Store, firebase-service-account.json
```

### Prompt S-02: Frontend Chrome Extension Bootstrap
```
Initialize a Vite + React 18 + TypeScript project in /frontend.
Configure it as a Chrome Extension Manifest V3 with:
- sidepanel entry (sidepanel.html + sidepanel.tsx)
- popup entry (popup.html + popup.tsx)
- content script (src/content/index.ts)
- background service worker (src/background/index.ts)

Install dependencies:
  react, react-dom, typescript, vite, @vitejs/plugin-react,
  lucide-react, axios, firebase, html2canvas, jspdf,
  @crxjs/vite-plugin

Create vite.config.ts using crxjs vite plugin for multi-entry
Chrome Extension bundling. Output to /frontend/dist/.
```

### Prompt S-03: Backend FastAPI Bootstrap
```
Initialize a Python FastAPI project in /backend with this structure:
  backend/
    app/
      main.py          ← FastAPI app entry, CORS, routers
      config/
        settings.py    ← Pydantic BaseSettings env config
      models/          ← Pydantic request/response models
      schemas/         ← Data schemas
      services/        ← Business logic services
      api/             ← Route handlers
      utils/
        llm.py         ← Gemini LLM factory
        helpers.py     ← Utility functions
    requirements.txt
    Dockerfile
    .env
    .env.example

Install: fastapi, uvicorn[standard], python-dotenv, pydantic,
         pydantic-settings, google-generativeai,
         langchain-google-genai, pypdf, python-docx, httpx
```

### Prompt S-04: Dockerfile for Render Deployment
```
Write a Dockerfile for the FastAPI backend suitable for Render deployment:
- Base image: python:3.11-slim
- WORKDIR /app
- Copy requirements.txt, install dependencies
- Copy app/ directory
- EXPOSE 10000
- CMD: uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
```

---

## PHASE 1 — Chrome Extension Manifest & Shell

### Prompt S-05: Manifest V3 Configuration
```
Create manifest.json for a Manifest V3 Chrome Extension called "InterviewOS":
{
  name: "InterviewOS",
  version: "1.0.0",
  manifest_version: 3,
  description: "AI-powered interview copilot for job seekers",
  permissions: ["storage", "activeTab", "scripting", "sidePanel", "tabs"],
  host_permissions: [
    "https://interview-ext-backend.onrender.com/*",
    "http://localhost:8000/*",
    "http://*/*",
    "https://*/*"
  ],
  background: { service_worker: "background.js" },
  content_scripts: [{ matches: ["<all_urls>"], js: ["content.js"] }],
  side_panel: { default_path: "sidepanel.html" },
  action: { default_popup: "popup.html" },
  icons: { 16: "icons/icon16.png", 48: "icons/icon48.png", 128: "icons/icon128.png" }
}
```

### Prompt S-06: Background Service Worker
```
Create frontend/src/background/index.ts as the Chrome Extension
service worker. It should:
- Listen for chrome.runtime.onInstalled → open sidepanel
- Handle chrome.action.onClicked → toggle sidePanel
- Handle messages: OPEN_SIDEPANEL, GET_TAB_COUNT, PING/PONG
- Track active tab count and broadcast TAB_COUNT_UPDATED messages
- Use chrome.sidePanel.open({ windowId }) API
```

### Prompt S-07: Popup Entry Point
```
Create frontend/src/popup/popup.tsx — a minimal React popup UI that:
- Shows the InterviewOS logo and name
- Has an "Open Panel" button that sends OPEN_SIDEPANEL message to background
- Displays current version from manifest
- Uses a dark glassmorphism card design
Render into popup.html.
```

---

## PHASE 2 — Gemini AI Backend Integration

### Prompt S-08: Gemini LLM Factory
```
Create backend/app/utils/llm.py:
- Read GEMINI_API_KEY from environment via Pydantic Settings
- Create a get_llm(purpose: str) factory function returning
  ChatGoogleGenerativeAI instances with model="gemini-2.0-flash"
- Set temperature: 0.3 for resume parsing, 0.7 for interview generation
- Add retry logic: if 429 RESOURCE_EXHAUSTED, log the error and
  raise HTTPException(429) with a user-friendly message
- Never expose the API key in responses
```

### Prompt S-09: Backend Settings Configuration
```
Create backend/app/config/settings.py using pydantic-settings BaseSettings:
- GEMINI_API_KEY: str
- ALLOWED_ORIGINS: str = "*"
- LOG_LEVEL: str = "info"
- PORT: int = 8000
- APP_VERSION: str = "1.0.0"

Load from .env file automatically.
Create .env.example with all variables documented but no real values.
```

### Prompt S-10: FastAPI Main App & CORS
```
Create backend/app/main.py:
- Initialize FastAPI app with title="InterviewOS API"
- Add CORSMiddleware with:
    allow_origin_regex: "chrome-extension://.*|http://localhost.*|https://.*"
    allow_methods: ["*"]
    allow_headers: ["*"]
- Add health check: GET /health → {"status": "ok", "version": "1.0.0"}
- Register routers: /api/resume, /api/jobs, /api/interview, /api/judge
- Add exception handler for HTTP 429 returning:
    {"error": "quota_exceeded", "message": "AI quota limit reached. Please try again in a moment."}
```

---

## PHASE 3 — Resume Upload & Analysis

### Prompt S-11: Resume Text Extraction Service
```
Create backend/app/services/resume_pipeline.py:
- accept_upload(file_bytes: bytes, filename: str) → raw_text: str
- For .pdf files: use pypdf PdfReader to extract all page text
- For .docx files: use python-docx Document to extract all paragraph text
- Strip control characters and excessive whitespace
- Compute SHA-256 hash of file_bytes for deduplication
- Return {"text": raw_text, "hash": sha256_hash, "page_count": n}
```

### Prompt S-12: Candidate Profile Analyzer (Gemini)
```
Create backend/app/services/candidate_analyzer.py:
Use Gemini LLM to parse resume raw_text into a structured CandidateProfile:
{
  name, email, phone, location,
  technical_skills: list[str],   ← ONLY hard tech skills
  soft_skills: list[str],
  experience_years: float,
  experience: list[{title, company, duration, description}],
  education: list[{degree, institution, year}],
  projects: list[{name, description, tech_stack}],
  certifications: list[str],
  target_roles: list[str],
  profile_summary: str
}

STRICT RULES for the prompt sent to Gemini:
1. Do NOT classify email, phone, URLs as technical skills
2. Do NOT classify GitHub, LinkedIn as technical skills
3. Separate hard skills (Python, React, SQL) from soft skills
4. If resume text has fewer than 100 meaningful words, return
   {"status": "insufficient_evidence"} instead of guessing
5. Return valid JSON only, no markdown fences
```

### Prompt S-13: Resume API Router
```
Create backend/app/api/resume.py FastAPI router:
POST /api/resume/upload:
  - Accept multipart/form-data with file field
  - Call resume_pipeline.extract_text()
  - Call candidate_analyzer.analyze()
  - Cache result by SHA-256 hash in memory dict
  - Return structured CandidateProfile JSON

GET /api/resume/current:
  - Return last analyzed candidate profile from cache
  - Return 404 if no resume uploaded yet
```

---

## PHASE 4 — Content Script & Job Detection

### Prompt S-14: Chrome Extension Content Script
```
Create frontend/src/content/index.ts as an IIFE content script:
Build a 3-tier job data extractor for the current page:

TIER 1 — JSON-LD Schema.org:
  Query script[type="application/ld+json"] for @type=JobPosting
  Extract: jobTitle, company (hiringOrganization.name), description

TIER 2 — Platform CSS Selectors (priority order):
  LinkedIn: .job-details-jobs-unified-top-card__job-title h1,
             .job-details-jobs-unified-top-card__company-name
  Internshala: .profile_on_detail_page, .company_name
  Naukri: h1.jd-header-title, .jd-header-comp-name
  Glassdoor: [data-test="job-title"], [data-test="employer-name"]
  Wellfound: [data-test="JobTitle"], [data-test="CompanyName"]
  Indeed: h1.jobTitle, [data-testid="inlineHeader-companyName"]

TIER 3 — OpenGraph meta fallback:
  meta[property="og:title"], meta[name="description"]

Also extract a candidate profile if on a profile page (LinkedIn /in/ URL):
  Name from h1.text-heading-xlarge
  Headline from div.text-body-medium
  Skills from #skills section
  Experience from #experience section
  Education from #education section

Send extracted data to background via chrome.runtime.sendMessage:
  { type: "JOB_PROFILE_DETECTED", payload: jobData }
  { type: "CANDIDATE_PROFILE_DETECTED", payload: candidateData }

Also POST job data to backend: POST /api/extension/detect-job
```

### Prompt S-15: Job Detection Backend Endpoint
```
Create POST /api/extension/detect-job in backend:
- Accept: { url, domain, pageTitle, jobTitle, company, rawDescription }
- Use Gemini to extract structured requirements from rawDescription:
  { required_skills, nice_to_have_skills, experience_level,
    job_type, location_type, key_responsibilities }
- Store result in session cache keyed by URL hash
- Return structured job requirements JSON
```

---

## PHASE 5 — Match Scoring Engine

### Prompt S-16: Skill Match Scoring Service
```
Create backend/app/services/scoring_engine.py:

compute_match(candidate_profile, job_requirements) → MatchResult:

Score calculation (deterministic, not random):
1. skill_overlap = len(candidate_skills ∩ job_required_skills) / len(job_required_skills)
2. experience_score = min(candidate.experience_years / job.min_experience, 1.0)
3. final_score = (skill_overlap * 0.65) + (experience_score * 0.35)

Return:
{
  match_percentage: int,           ← 0-100
  matched_skills: list[str],       ← intersection
  missing_skills: list[str],       ← job required - candidate has
  career_tier: str,                ← "Junior" | "Mid" | "Senior" | "Lead"
  readiness_label: str,            ← "Strong Match" | "Good Fit" | "Partial Fit"
  improvement_areas: list[str]
}
```

### Prompt S-17: Job Recommendations Service
```
Create backend/app/services/job_recommendation_service.py:
POST /api/candidate/recommend-jobs:
- Take current candidate_profile from cache (error if none)
- Score candidate against a curated list of target job profiles:
  (Software Engineer, ML Engineer, Data Engineer, Full Stack Developer,
   Backend Engineer, Frontend Engineer, DevOps Engineer, AI/ML Researcher)
- Rank by match_percentage descending
- For each recommendation include:
  { role, match_percentage, matched_skills, missing_skills,
    why_good_fit, prep_topics, salary_range_lpa }
- Return top 8 recommendations
```

---

## PHASE 6 — LPA-Calibrated Interview Engine

### Prompt S-18: Interview Session Models
```
Create backend/app/models/interview.py Pydantic models:
- InterviewSession: { session_id, candidate_name, target_lpa, job_title,
                      turns: list[InterviewTurn], status, started_at }
- InterviewTurn: { turn_number, question, candidate_answer,
                   expected_answer, score, feedback }
- InterviewRequest: { session_id, candidate_answer }
- InterviewStartRequest: { candidate_profile, job_title, target_lpa }
```

### Prompt S-19: LPA Interview Engine Service
```
Create backend/app/services/lpa_interview_engine.py:

Difficulty calibration by LPA:
  <=8 LPA  → Junior: basic concepts, definitions, simple code
  9-18 LPA → Mid/Senior: architecture decisions, trade-offs, system design
  >=19 LPA → Staff/Lead: scalability, failure recovery, production incidents

start_session(candidate_profile, job_title, target_lpa):
  - Generate interview plan: 8 questions across competency domains:
    [Core Skills, Data Structures, System Design, Problem Solving,
     Behavioral, Domain Expertise, Architecture, Real-world Scenarios]
  - Use Gemini to generate calibrated questions for each domain
  - Store session in memory dict by session_id (UUID)
  - Return first question

submit_answer(session_id, candidate_answer):
  - Use Gemini to evaluate answer quality (0-10 score)
  - Generate expected_answer for reference
  - Generate adaptive follow-up or advance to next domain
  - Log answer to session turns
  - If turn >= 8: generate final report

generate_report(session_id):
  - Compute metrics from all turns:
    technical_depth, communication, problem_solving,
    domain_expertise, confidence, preparedness
  - Generate strengths and improvement recommendations
  - Return structured InterviewReport JSON
```

### Prompt S-20: Interview API Router
```
Create backend/app/api/interview.py FastAPI router:
POST /api/interview/start   → start_session(), return first question
POST /api/interview/respond → submit_answer(), return next question or report
GET  /api/interview/report/{session_id} → get final report
POST /api/interview/end/{session_id}    → force-end and generate report
```

---

## PHASE 7 — Anti-Cheating & Integrity Monitoring

### Prompt S-21: Frontend Integrity Monitoring
```
In LPAInterviewView.tsx, add DOM event listeners during active interview:

1. Fullscreen monitoring:
   - Request fullscreen on interview start
   - Listen for 'fullscreenchange' event
   - If user exits fullscreen: log integrity event, show warning banner

2. Tab switch monitoring:
   - Listen for 'visibilitychange' event
   - document.hidden === true → log "tab_switch" event with timestamp

3. Window focus monitoring:
   - Listen for 'blur' event on window
   - Log "window_focus_lost" with timestamp

Store all events in interviewState.integrityLog array.
Display in final report: total violations, timestamps, event types.
```

### Prompt S-22: Backend Integrity Logging
```
In lpa_interview_engine.py, add:
log_integrity_event(session_id: str, event_type: str):
  - Append { event_type, timestamp: datetime.now().isoformat() }
    to session.integrity_log
  - Types: "fullscreen_exit", "tab_switch", "window_blur"

Include integrity_log and integrity_score in the final report:
  integrity_score = max(0, 100 - (len(integrity_log) * 10))
```

---

## PHASE 8 — Firebase / Firestore Persistence

### Prompt S-23: Firebase Client SDK Setup
```
Create frontend/src/services/firebase.ts:
Initialize Firebase app using environment variables (VITE_FIREBASE_*).
Never hardcode Firebase credentials.

Required env vars:
  VITE_FIREBASE_API_KEY
  VITE_FIREBASE_AUTH_DOMAIN
  VITE_FIREBASE_PROJECT_ID
  VITE_FIREBASE_STORAGE_BUCKET
  VITE_FIREBASE_MESSAGING_SENDER_ID
  VITE_FIREBASE_APP_ID
  VITE_FIREBASE_MEASUREMENT_ID

Export: { app, db (Firestore), auth }
```

### Prompt S-24: Firestore Data Service
```
Create frontend/src/services/firestore.ts:
Functions to persist under users/{userId} collection:

saveProfile(userId, candidateProfile):
  → users/{userId}/profile

saveJobMatch(userId, jobId, matchResult):
  → users/{userId}/matches/{jobId}

saveInterviewReport(userId, sessionId, report):
  → users/{userId}/interviews/{sessionId}

getInterviewHistory(userId):
  → Query users/{userId}/interviews orderBy timestamp desc

All functions handle Firestore errors gracefully and log to console.
```

---

## PHASE 9 — SidePanel React Application

### Prompt S-25: SidePanel App Shell
```
Create frontend/src/sidepanel/SidePanelApp.tsx as the main React app:

Navigation tabs (bottom nav bar):
  - Resume (upload & analysis)
  - Match (job compatibility scoring)
  - Interview (LPA-calibrated AI interview)
  - Explore (job recommendations)
  - Judge (hackathon evaluation panel)

Global state (React Context or Zustand):
  - candidateProfile: CandidateProfileAnalysis | null
  - activeJob: JobPosting | null
  - matchResult: MatchResult | null
  - interviewSession: InterviewSession | null

Listen to chrome.runtime.onMessage for:
  JOB_PROFILE_DETECTED → update activeJob state
  CANDIDATE_PROFILE_DETECTED → update candidateProfile state

Design: dark glassmorphism, gradient accents (#6366f1 → #a855f7),
Inter font, smooth tab transitions.
```

### Prompt S-26: Resume Upload View
```
Create frontend/src/components/ResumeUpload.tsx:
- Drag & drop zone accepting PDF and DOCX files
- Show upload progress bar during API call
- On success: display candidate profile card with:
  Name, headline, skills chips, experience timeline,
  education, projects, certifications
- Error states: file too large (>5MB), wrong format, insufficient evidence
- POST to /api/resume/upload using FormData
- Persist result to Firestore via saveProfile()
```

### Prompt S-27: Job Match View
```
Create frontend/src/components/JobMatchView.tsx:
- Auto-populate from activeJob state (detected from content script)
- Show "Scan Page" button to manually trigger job re-scan
- Display match result as:
  - Circular progress gauge (match_percentage)
  - Matched skills green chips
  - Missing skills red chips  
  - Career tier badge
  - Readiness label with color coding
- "Start Interview" CTA button → navigate to Interview tab
- POST to /api/jobs/score with candidateProfile + activeJob data
```

### Prompt S-28: Interview View Component (LPAInterviewView)
```
Create frontend/src/components/interview/LPAInterviewView.tsx:
Multi-phase interview flow:

PHASE 1 — Setup:
  LPA selector (4 LPA, 8 LPA, 12 LPA, 18 LPA, 25 LPA sliders)
  Candidate name field
  "Begin Interview" button

PHASE 2 — Active Interview:
  Question display card with turn counter (Turn X of 8)
  Textarea for typed candidate answer
  Timer display
  Fullscreen mode button
  Integrity warning banner (shows on tab switch / fullscreen exit)
  "Submit Answer" button

PHASE 3 — Report:
  Overall score gauge
  Metrics grid: Technical Depth, Communication, Problem Solving,
    Domain Expertise, Confidence, Preparedness
  Per-turn breakdown: Question | Your Answer | Expected Answer | Score
  Strengths list
  Improvement recommendations
  Integrity audit log
  Download PDF button
  Previous Reports button

State management:
  - phase: "setup" | "active" | "complete"
  - turns: InterviewTurn[]
  - integrityLog: IntegrityEvent[]
  - metrics: computed dynamically from answer keyword matching

Local fallback: if backend is unreachable, use a built-in question bank
calibrated by LPA to ensure uninterrupted experience.
```

---

## PHASE 10 — PDF Report Generation

### Prompt S-29: PDF Generator Utility
```
Create frontend/src/utils/pdfGenerator.ts using jsPDF:

generateInterviewPDF(report: InterviewReport): void

PDF structure:
  Page 1 — Header:
    InterviewOS logo, candidate name, date, overall score gauge
    
  Page 1 — Metrics Grid:
    6 metrics as progress bars with percentage labels
    
  Pages 2+ — Turn-by-Turn Breakdown:
    For each turn:
      Turn number header
      Q: [Question text]
      Your Answer: [candidateAnswer]
      Expected Answer: [expectedAnswer]  
      Score: [score]/10

  Final Page — Summary:
    Strengths (green bullets)
    Improvement Areas (amber bullets)
    Integrity Audit Log (timestamps)
    Footer: "Generated by InterviewOS"

Use jsPDF addPage() for multi-page support.
Trigger browser download as: InterviewOS_Report_{name}_{date}.pdf
```

---

## PHASE 11 — Judge Demo Flow (Hackathon Evaluation)

### Prompt S-30: Judge Service Backend
```
Create backend/app/services/judge_service.py:
- load_curriculum(path): Parse curriculum.json into structured dict
- load_candidates(path): Parse candidates.json into list of CandidateProfile
- list_judge_files(): Scan backend/app/data/ for curriculum.json,
                      candidates.json, technical-spec.md
- get_candidate_by_id(candidate_id): Return single candidate profile

POST /api/judge/start-interview:
  Input: { candidate_id, curriculum_path }
  - Load candidate profile + curriculum
  - Generate 8 personalized interview questions based on:
    candidate's completed modules, learning signals, skipped topics
  - Use Gemini to tailor question difficulty per completed day

POST /api/judge/respond:
  Input: { session_id, answer }
  - Evaluate answer against curriculum expected knowledge
  - Generate adaptive follow-up
  - Track turn state

GET /api/judge/report/{session_id}:
  - Compute curriculum coverage score
  - List completed vs skipped topics referenced
  - Return Judge Evaluation Report JSON
```

### Prompt S-31: JudgeDemoView Frontend Component
```
Create frontend/src/components/JudgeDemoView.tsx with 4 tabs:

TAB 1 — Curriculum Explorer:
  Load and display curriculum.json as an interactive 31-day timeline
  Each day shows: topic, learning objectives, tools used
  Color-coded by module (RAG=blue, Vector DB=purple, etc.)

TAB 2 — Candidate Directory:
  List all candidates from candidates.json
  Show: name, completed days, completion rate, key skills
  "Start Interview" button per candidate

TAB 3 — Spec Viewer:
  Render technical-spec.md as formatted markdown

TAB 4 — Evaluation Reports:
  Show completed interview reports
  Metrics: curriculum coverage, question depth, adaptation score
  Download PDF button

GATE: "Generate Report" button ONLY visible after all 8 interview turns completed.
Show InterviewOS logo in header.
Do not touch any backend files.
```

---

## PHASE 12 — Environment & Production Configuration

### Prompt S-32: Frontend Environment Files
```
Create frontend/.env (local development):
  VITE_API_BASE_URL=http://localhost:8000
  VITE_FIREBASE_API_KEY=your_firebase_api_key
  VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID=your_project_id
  VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
  VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
  VITE_FIREBASE_APP_ID=your_app_id
  VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
  VITE_ENABLE_MOCK_API=false
  VITE_LOG_LEVEL=info
  VITE_APP_VERSION=1.0.0

Create frontend/.env.production:
  VITE_API_BASE_URL=https://interview-ext-backend.onrender.com
  (all other vars same as .env)

Add both .env files to .gitignore.
Create .env.example with placeholder values for documentation.
```

### Prompt S-33: Backend Environment File
```
Create backend/.env:
  GEMINI_API_KEY=your_gemini_api_key_here
  PORT=8000
  ALLOWED_ORIGINS=*
  LOG_LEVEL=info
  APP_VERSION=1.0.0

Create backend/.env.example with all keys documented but empty values.
Add .env to backend/.gitignore.
```

### Prompt S-34: Vite Build Configuration for Chrome Extension
```
Update frontend/vite.config.ts:
- Use @crxjs/vite-plugin with manifest.json
- Configure rollupOptions for multiple entry points:
    sidepanel: src/sidepanel/index.tsx
    popup: src/popup/popup.tsx
    content: src/content/index.ts (IIFE format, no hash in filename)
    background: src/background/index.ts (IIFE format)
- Set define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL) }
- Output to dist/ directory
- Do NOT code-split content.js or background.js (Chrome requires single files)
```

---

## PHASE 13 — Production Deployment

### Prompt S-35: Deploy Backend to Render
```
Deploy the FastAPI backend to Render:

render.yaml (or manual dashboard config):
  name: interview-ext-backend
  type: web
  runtime: docker
  dockerfilePath: ./backend/Dockerfile
  envVars:
    - GEMINI_API_KEY: (secret — set in Render dashboard)
    - PORT: 10000
    - ALLOWED_ORIGINS: *
    - LOG_LEVEL: info

After deployment, verify:
  GET https://interview-ext-backend.onrender.com/health → {"status":"ok"}

Update frontend/.env.production:
  VITE_API_BASE_URL=https://interview-ext-backend.onrender.com
```

### Prompt S-36: Production Chrome Extension Build & Package
```
Build and package the Chrome Extension for Chrome Web Store submission:

1. Update frontend/.env.production with live Render URL
2. Update manifest.json host_permissions to include Render URL
3. Run: npm run build (in /frontend)
4. Verify dist/ bundle:
   - grep "localhost" in dist/*.js → should return 0 results
   - grep "onrender.com" in dist/*.js → should confirm production URL
5. Package ZIP:
   Compress-Archive -Path "frontend/dist/*" -DestinationPath "frontend/interviewos-extension-v1.0.0.zip"
6. Upload ZIP to Chrome Web Store Developer Dashboard
7. Fill: extension name, description, category (Productivity), screenshots
8. Submit for review
```

---

## PHASE 14 — Git & GitHub Setup

### Prompt S-37: Initialize Git Repository
```
Initialize git repository and push to GitHub:

git init
git add .
git commit -m "feat: Initial InterviewOS Chrome Extension — full production build"

Create public GitHub repository: InterviewOS
git remote add origin https://github.com/<username>/InterviewOS.git
git branch -M main
git push -u origin main

Verify before push that .gitignore excludes:
  .env, .env.*, *.zip, node_modules/, dist/, __pycache__/,
  *.pyc, venv/, firebase-service-account.json, *.log

IMPORTANT: Repository must be PUBLIC for hackathon submission.
```

### Prompt S-38: README.md Documentation
```
Create a comprehensive README.md covering:
1. Project overview and key features
2. Architecture diagram (Mermaid)
3. Tech stack (Frontend + Backend)
4. Local development setup (step-by-step)
5. Environment variables reference (all required vars)
6. Chrome Extension installation (load unpacked from dist/)
7. Backend deployment (Render)
8. API endpoints reference
9. Feature status table (what is implemented vs planned)
10. Production readiness evaluation
11. Screenshots / demo GIF
12. License
```

---

## PHASE 15 — Testing & Verification

### Prompt S-39: End-to-End Flow Verification
```
Verify these flows work end-to-end:

1. Resume Upload:
   POST /api/resume/upload with a real PDF resume
   → Expect: structured CandidateProfile JSON

2. Job Detection:
   Navigate to a LinkedIn job posting with extension loaded
   → Expect: content script detects job and sends JOB_PROFILE_DETECTED

3. Match Scoring:
   With candidate + job loaded, click "Score Match"
   → Expect: match_percentage, matched_skills, missing_skills

4. Interview Flow:
   Start interview, complete 8 turns, generate report
   → Expect: dynamic metrics, per-turn breakdown, PDF download

5. Judge Demo:
   Load curriculum.json + candidates.json in Judge Panel
   → Expect: candidate list, interview flow, evaluation report

6. Production:
   Build with VITE_API_BASE_URL=https://interview-ext-backend.onrender.com
   → Confirm: zero localhost references in dist/ bundle
```

### Prompt S-40: Error & Edge Case Handling
```
Verify these error cases are handled gracefully:

1. Empty/corrupt PDF upload → "insufficient_evidence" status, not a crash
2. Gemini 429 rate limit → local fallback activates, interview continues
3. No resume uploaded → job match blocked with clear message
4. Backend offline → frontend shows "Backend unavailable, using offline mode"
5. Tab switch during interview → integrity warning banner shown
6. Fullscreen exit during interview → integrity event logged
7. Invalid Firebase config → graceful degradation (no crash)
8. Extension reloaded mid-interview → session state persisted in localStorage
```

---

## Quick Start Reference (Rebuild Checklist)

Use this checklist to verify every step is complete when building from scratch:

```
BACKEND SETUP
[ ] Python 3.11 environment created (venv)
[ ] requirements.txt installed
[ ] .env file created with GEMINI_API_KEY
[ ] FastAPI app starts: uvicorn app.main:app --reload
[ ] Health check passes: GET /health → 200 OK
[ ] Resume upload endpoint works
[ ] Job detection endpoint works
[ ] Interview engine sessions work
[ ] Judge service loads curriculum + candidates

FRONTEND SETUP
[ ] npm install completed in /frontend
[ ] .env file created with all VITE_FIREBASE_* vars
[ ] npm run dev starts without errors
[ ] Chrome Extension loads unpacked from /dist
[ ] Content script injects on job pages
[ ] SidePanel opens via extension icon
[ ] Resume upload UI works
[ ] Job match display works
[ ] Interview flow completes 8 turns
[ ] PDF report downloads correctly

PRODUCTION
[ ] backend/.env has no secrets → .gitignore verified
[ ] frontend/.env has no secrets → .gitignore verified
[ ] Render deployment live → /health returns 200
[ ] npm run build with production env → no errors
[ ] No localhost in dist/ bundle (grep verified)
[ ] Chrome Extension ZIP packaged
[ ] GitHub repo is PUBLIC
[ ] PROMPTS.md committed to repo root
[ ] README.md complete with live URLs
```
