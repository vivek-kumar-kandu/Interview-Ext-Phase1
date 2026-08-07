# 🚀 InterviewOS — Developer Architecture, API Flow & Onboarding Guide

Welcome to **InterviewOS**! This comprehensive handbook is written for new developers joining the team. It details the system architecture, end-to-end API flows, database/session data processes, feature breakdown, known edge cases, and future architectural recommendations.

---

## 📑 Table of Contents
1. [Project Overview & Core Mission](#1-project-overview--core-mission)
2. [Technology Stack](#2-technology-stack)
3. [Repository Directory Structure](#3-repository-directory-structure)
4. [End-to-End API Flow & Data Processes](#4-end-to-end-api-flow--data-processes)
5. [Complete Feature Catalog](#5-complete-feature-catalog)
6. [Session Storage & Database Processes](#6-session-storage--database-processes)
7. [Known Edge Cases, Bugs & Resolved Gotchas](#7-known-edge-cases-bugs--resolved-gotchas)
8. [Architectural Suggestions & Feature Roadmap](#8-architectural-suggestions--feature-roadmap)

---

## 🎯 1. Project Overview & Core Mission

**InterviewOS** is an **Enterprise AI Interview Intelligence Platform** designed as a Manifest V3 Chrome Extension paired with a high-throughput Python FastAPI backend server.

### What it does:
1. **Automatic Job Detection**: Scrapes and parses target job postings from LinkedIn and hiring portals in real-time.
2. **Context-Aware Adaptive Interviewing**: Dynamically plans a technical interview curriculum based on job requirements and candidate skill signals.
3. **Explainable AI (XAI)**: Displays real-time reasoning animations (5-stage timeline) and question rationale ("Why Was This Question Generated?").
4. **"Mic Drop" Executive Outcome Reporting**: Synthesizes performance metrics into an executive report with PDF export and recruiter summary copying.

---

## 🛠️ 2. Technology Stack

### Backend Stack (`/backend`)
- **Framework**: Python 3.13 + FastAPI + Pydantic v2
- **LLM / AI Orchestration**: Google Gemini 1.5 Flash (`langchain-google-genai`) with OpenAI (`gpt-4o-mini`) fallback support.
- **RAG & Vector Search**: Qdrant (`:memory:` / vector collections) + JSON curriculum embeddings.
- **Session Storage**: Hybrid `SessionService` (Async Redis connection with automatic in-memory dict fallback).
- **Environment Management**: `python-dotenv` for auto-loading `.env`.
- **Testing**: Pytest + FastAPI TestClient.

### Frontend Stack (`/frontend`)
- **Platform**: Chrome Extension Manifest V3 (SidePanel API + Content Scripts + Service Worker).
- **UI Framework**: React 18 + TypeScript 5 + Tailwind CSS v3 + Lucide Icons.
- **State Management**: Reactive custom Store (`interview.store.ts` subscriber pattern).
- **Export Utilities**: Custom PDF printer & Clipboard summary generator (`lib/reportExporter.ts`).
- **Build System**: Vite 6 + PostCSS.

---

## 📁 3. Repository Directory Structure

```
d:\Ai Interview Ext\
├── DEVELOPER_GUIDE.md               <-- You are here (Workspace Onboarding Guide)
├── package.json                     <-- Monorepo script launcher
│
├── backend/
│   ├── .env                         <-- Environment variables (GEMINI_API_KEY, REDIS_URL)
│   ├── app/
│   │   ├── main.py                  <-- FastAPI app entry point & router mounting
│   │   ├── api/v1/endpoints/        <-- REST routes (/api/interview, /api/extension)
│   │   ├── agents/                  <-- AI Reasoning Engines
│   │   │   ├── orchestrator.py      <-- Multi-turn state machine & whyAsked rationale
│   │   │   ├── question_generator.py<-- Curriculum RAG question generator
│   │   │   ├── followup_generator.py<-- Follow-up question generator
│   │   │   ├── evaluator.py         <-- Technical depth & gap scoring engine
│   │   │   └── feedback_generator.py<-- Executive report synthesis engine
│   │   ├── utils/
│   │   │   └── llm.py               <-- Unified Gemini / OpenAI LLM factory
│   │   ├── schemas/interview.py     <-- Pydantic request/response data contracts
│   │   ├── models/session.py        <-- SessionState & TurnEvaluation models
│   │   ├── services/
│   │   │   ├── session_service.py   <-- Redis + Memory session store service
│   │   │   ├── job_analyzer.py      <-- Job skill extractor service
│   │   │   ├── candidate_analyzer.py<-- Candidate curriculum planner
│   │   │   └── curriculum_service.py<-- RAG curriculum loader
│   │   └── data/                    <-- JSON datasets (candidates.json, curriculum.json)
│   ├── tests/                       <-- Pytest automated test suite
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── sidepanel/
    │   │   └── SidePanelApp.tsx     <-- Main Copilot Workspace (Dashboard, Stream, Reports)
    │   ├── components/widget/
    │   │   └── FloatingWidget.tsx   <-- Injected floating job notification widget
    │   ├── content/
    │   │   └── index.ts             <-- DOM & JSON-LD JobPosting parser content script
    │   ├── store/
    │   │   └── interview.store.ts   <-- Reactive state store (Match, Readiness, Roadmap, Thinking)
    │   ├── api/
    │   │   └── interview.ts         <-- Axios API client layer with mock fallback
    │   ├── lib/
    │   │   └── reportExporter.ts    <-- PDF Export & Clipboard Copy utilities
    │   └── types/
    │       └── feedback.ts          <-- TypeScript interface contracts
    ├── manifest.json                <-- Chrome Extension Manifest V3 configuration
    └── package.json
```

---

## 🔄 4. End-to-End API Flow & Data Processes

```
[Target Webpage (e.g. LinkedIn)]
        │
        ▼ (JSON-LD & DOM Extraction via Content Script)
[frontend/src/content/index.ts] ──(POST /api/extension/detect-job)──► [backend/app/api/v1/endpoints/extension.py]
                                                                                │
                                                                                ▼
                                                                [job_analyzer_service] (Extracts required skills & match metrics)
                                                                                │
[User Opens SidePanel Workspace] ◄──────────────────────────────────────────────┘
        │
        ▼ (Click "Start Interview")
[frontend/src/store/interview.store.ts] ──(POST /api/interview)──► [backend/app/api/v1/endpoints/interview.py]
                                                                                │
                                                                                ▼
                                                                [interview_orchestrator.process_turn]
                                                                   ├── Check Session in `session_service` (Redis / Memory)
                                                                   ├── Run candidate/job skill gap analysis
                                                                   ├── Query `curriculum_service` RAG module
                                                                   ├── Invoke Gemini 1.5 Flash (`app.utils.llm.get_llm()`)
                                                                   ├── Generate Question & `whyAsked` rationale
                                                                   └── Save `SessionState` to `session_service`
        │                                                                       │
        ▼ (Receives Response & Renders UI) ◄────────────────────────────────────┘
  • Job Match Score Card (92%)
  • Interview Readiness Score (88%)
  • Skill Gap Matrix
  • AI Thinking Timeline (5 stages)
  • Why Asked Accordion
  • Live Topic Roadmap
        │
        ▼ (Candidate submits answer)
[process_turn (Turn 2..N)]
  ├── `evaluator_engine.evaluate_turn` (Scores technical accuracy & identifies gaps)
  ├── Advance curriculum day / trigger follow-up question
  └── If `questions_asked >= 8` and `days >= 4`:
        └── `feedback_generator.generate_feedback`
              └── Generates "Mic Drop" Executive Report Card (Top Strength, Weakness, Recruiter Summary)
```

---

## ⚡ 5. Complete Feature Catalog

1. **Job Match Score Card (92%)**: Renders compatibility score badge across top header, overview workspace, and floating job notification widget.
2. **Skill Gap Analysis**: Matrix breakdown displaying `Required Skills` vs `Your Skills (✔)` vs `Missing Skills (❌)`.
3. **Interview Readiness Score (88%)**: Dynamic readiness metric based on technical competency and curriculum topic coverage.
4. **AI Thinking Timeline Animation**: Stage-by-stage animated progress card during AI turn generation:
   - `Stage 1`: Reading Job Description
   - `Stage 2`: Retrieving Curriculum RAG
   - `Stage 3`: Evaluating Previous Answer
   - `Stage 4`: Planning Next Question
   - `Stage 5`: Generating Interview Question
5. **Explainability Accordion ("Why Was This Question Generated?")**: Displays context rationale bullets under every question turn.
6. **Live Interview Topic Roadmap**: Stepper tracking curriculum coverage (`FastAPI` ➔ `LangGraph` ➔ `RAG` ➔ `Docker` ➔ `Redis`).
7. **"Mic Drop" Executive Report Card**: Post-interview summary displaying rating, hiring recommendation (`Strong Hire`), top strength (`System Architecture`), primary weakness (`Docker Deployment`), and next recommended topic (`Redis`).
8. **Export Utilities**:
   - `Download PDF`: Printable executive report document.
   - `Copy Recruiter Summary`: One-click copy recruiter summary with visual toast confirmation.

---

## 💾 6. Session Storage & Database Processes

- **Primary Session Store (`session_service.py`)**:
  - Tries connecting to Redis using `redis.asyncio` via `REDIS_URL`.
  - Serializes `SessionState` objects to JSON with 24-hour expiration (`setex(..., 86400)`).
  - Automatically falls back to an in-memory dictionary `self._memory_sessions` if Redis is offline.

---

## ⚠️ 7. Known Edge Cases, Bugs & Resolved Gotchas

1. **[RESOLVED] Pyrefly Import Warnings**:
   - Fixed missing import diagnostics in scratch scripts by adding type-ignore annotations.
2. **[RESOLVED] LLM Provider Integration**:
   - Integrated Google Gemini API (`GEMINI_API_KEY` & `GEMINI_MODEL=gemini-1.5-flash` via `langchain-google-genai`) with unified fallback in `app/utils/llm.py`.
3. **[RESOLVED] DOM Parsing Fragility**:
   - Solved fragile LinkedIn class selectors by implementing a **3-tier extraction hierarchy** in `frontend/src/content/index.ts`:
     1. Tier 1: JSON-LD Standard Schema (`<script type="application/ld+json">`) parsing `JobPosting` objects.
     2. Tier 2: Multi-Selector DOM Fallbacks (`.jobs-unified-top-card__job-title`, `h1.app-title`, `h1`).
     3. Tier 3: OpenGraph Meta Tags (`og:site_name`, `document.title`).
4. **[RESOLVED] Session Data Volatility**:
   - Solved in-memory state loss on backend restart by adding hybrid Redis persistence in `session_service.py`.

---

## 🚀 8. Architectural Suggestions & Feature Roadmap

### High Priority
- **PostgreSQL / SQLModel Database Persistence**:
  - Add SQLModel/SQLAlchemy with PostgreSQL to store permanent historical candidate interview reports, aggregate skill gap analytics, and candidate progression over time.

### Medium Priority
- **Real-Time Word-by-Word Question Streaming (SSE / WebSockets)**:
  - Update `POST /api/interview` to support `text/event-stream` (Server-Sent Events) so questions stream word-by-word into the SidePanel as the LLM generates tokens.
- **Persistent Qdrant Vector Cluster**:
  - Transition Qdrant vector store from `:memory:` to a persistent Qdrant cloud/Docker cluster with pre-indexed curriculum embeddings.

### Low Priority
- **Live Voice & Speech Pipeline**:
  - Integrate Web Speech API or OpenAI Realtime Voice WebSockets for live spoken interview turns.
