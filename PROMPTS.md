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
12. [Production Deployment (Render & Chrome Web Store)](#12-production-deployment-render--chrome-web-store)
13. [Development Principles](#development-principles)

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

### Implementation
- `backend/app/services/judge_service.py` & `judge_interview_engine.py`: Handles disk file discovery, curriculum parsing, and hackathon evaluation turn engine.
- `frontend/src/components/JudgeDemoView.tsx`: Multi-tab judge panel component featuring Curriculum Explorer, Candidate Directory, Spec Viewer, and Evaluation Reports.

### Important Decisions
- Isolated Judge Panel mode completely from standard user flow so normal resume upload and job matching remain untouched.

### Current Status
**Completed**

---

## 12. Production Deployment (Render & Chrome Web Store)

### Objective
Prepare the Python FastAPI backend for hosting on Render and package the Manifest V3 Chrome Extension for public publication on the Chrome Web Store.

### Prompt / Instruction
> Configure backend deployment for Render (binding to `0.0.0.0:$PORT`, updating CORS for `chrome-extension://*` origins, and adding dependencies to `requirements.txt`). Reconfigure frontend Vite build with `VITE_API_BASE_URL` and package `dist/` into a Chrome Web Store upload-ready ZIP file.

### Implementation
- `backend/app/main.py`: CORS regex updated (`chrome-extension://.*|http://localhost.*|https://.*`).
- `backend/requirements.txt`: Added `langchain-google-genai` and `google-genai`.
- `frontend/.env.production`: Configured production backend URL.
- Packaged extension ZIP: `frontend/interviewos-extension-v1.0.0.zip`.

### Important Decisions
- Automated extension packaging via Vite build script and PowerShell archive compression.
- Distinction between Production-Ready Architecture/Code (fully implemented and packaged) vs Live Public Deployment (Render deployment & Chrome Web Store publishing pending final user launch).

### Current Status
**Production Build Completed / Packaged (Cloud Deployment Pending)**

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
9. **Environment-Based API Targeting**: Seamless switching between `http://localhost:8000` (dev) and Render URL (production).
10. **Human-Readable Error Handling**: All network and AI exceptions surface clear user guidance in UI alert banners.
