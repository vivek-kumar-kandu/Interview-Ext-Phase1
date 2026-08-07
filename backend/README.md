# InterviewOS Backend

"The AI Interview Layer for Every Hiring Platform"

## Requirements
- Python 3.11+

## Quick Start (Local Setup)

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create and activate virtual environment
python -m venv .venv

# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1

# On Mac/Linux:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start backend server
uvicorn app.main:app --reload --port 8000
```

## API Usage

Single Endpoint: `POST http://localhost:8000/api/interview`

### Interactive API Docs (Swagger UI)
Visit: `http://localhost:8000/docs`

### Health Check
Visit: `http://localhost:8000/health`

## Docker Setup
```bash
docker-compose up --build
```
