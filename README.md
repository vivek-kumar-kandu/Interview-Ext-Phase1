# InterviewOS — Monorepo (AI Interview Layer for Any Hiring Platform)

Integrated codebase combining the **React Manifest V3 Chrome Extension** and the **FastAPI AI Interview Backend**.

---

## 📁 Repository Layout

```text
d:\Ai Interview Ext\
├── frontend/                   # React + TypeScript + Vite + Tailwind Chrome Extension
│   ├── src/                    # Extension views (Popup, Sidepanel, Floating Widget)
│   ├── manifest.json           # Chrome Extension Manifest V3
│   ├── vite.config.ts          # Vite build config
│   └── package.json            # Frontend dependencies
├── backend/                    # FastAPI AI Service + RAG Orchestrator
│   ├── app/                    # FastAPI endpoints, RAG agent, schemas & services
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Production container build
│   └── docker-compose.yml      # Service stack (Backend + Qdrant + Redis)
├── package.json                # Root monorepo orchestrator scripts
├── .env.example                # Combined environment variable reference
└── README.md                   # Master repository guide
```

---

## 🚀 Quick Start

### 1. Backend Setup & Run (FastAPI)

```bash
# Navigate to backend
cd backend

# Create and activate virtual environment (if not already done)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt

# Start live reload server (Port 8000)
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

- **Interactive API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

### 2. Frontend Setup & Chrome Extension Build

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Build Chrome Extension bundle
npm run build
```

This creates the build artifact in `frontend/dist`.

---

### 3. Load Extension in Chrome

1. Open Google Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** (top left).
4. Select `d:\Ai Interview Ext\frontend\dist`.
5. Your **InterviewOS** extension is active!

---

## 🛠️ Root Orchestrator Commands

From the root directory (`d:\Ai Interview Ext`), you can also run:

- **Build Frontend**: `npm run build:frontend`
- **Run Backend**: `npm run dev:backend`
