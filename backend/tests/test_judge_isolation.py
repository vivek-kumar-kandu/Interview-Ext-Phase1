import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


from unittest.mock import patch, AsyncMock

def test_normal_interview_mode_isolation():
    """Verify normal interview mode does NOT touch or require organiser files."""
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value.content = '{"question": "How do you build FastAPI backends?", "topic": "FastAPI"}'
    
    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm):
        response = client.post(
            "/api/interview/start",
            json={
                "sessionId": "test-normal-1",
                "candidateProfile": {
                    "id": "cand_normal_1",
                    "name": "Jane Doe",
                    "targetRole": "Backend Engineer",
                    "keySkills": ["Python", "FastAPI"]
                },
                "jobProfile": {
                    "jobTitle": "Backend Engineer",
                    "company": "TechCorp",
                    "skills": ["Python", "FastAPI"]
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "curriculum" not in str(data).lower()
        assert "organiser" not in str(data).lower()


def test_judge_panel_mode_lazy_loading_files():
    """Verify organiser files are loaded when requested in JUDGE_PANEL_MODE."""
    response = client.get("/api/v1/judge/files")
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    assert data.get("count") >= 3
    file_ids = [f["fileId"] for f in data.get("files", [])]
    assert "curriculum.json" in file_ids
    assert "candidates.json" in file_ids
    assert "technical-spec.md" in file_ids


def test_judge_panel_candidates_dataset_dynamic():
    """Verify organiser candidates dataset is parsed dynamically from candidates.json."""
    response = client.get("/api/v1/judge/candidates")
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    extracted = data.get("extracted", {})
    assert extracted.get("totalCandidates") > 0
    assert len(extracted.get("candidates", [])) == extracted.get("totalCandidates")


def test_judge_panel_personalized_interview_session():
    """Verify personalized hackathon interview initiation for selected candidate."""
    session_id = "test-judge-session-1"
    start_resp = client.post(
        "/api/v1/judge/interview/start",
        json={
            "sessionId": session_id,
            "candidateId": "CAND-001"
        }
    )
    assert start_resp.status_code == 200
    start_data = start_resp.json()
    assert start_data.get("success") is True
    assert start_data.get("done") is False
    assert len(start_data.get("reply", "")) > 0

    # Multi-turn turns
    turn1 = client.post(
        "/api/v1/judge/interview/turn",
        json={
            "sessionId": session_id,
            "message": "I configure virtual environments using venv and handle dependency management with requirements.txt."
        }
    )
    assert turn1.status_code == 200
    t1_data = turn1.json()
    assert t1_data.get("success") is True


def test_organiser_spec_adapter_contract():
    """Verify organiser technical-spec.md API adapter POST /api/judge/interview."""
    session_id = "test-spec-adapter-1"
    
    # Turn 1: Start session
    start_resp = client.post(
        "/api/judge/interview",
        json={
            "sessionId": session_id,
            "candidate": {
                "id": "CAND-001",
                "name": "Sarah Johnson",
                "jobRole": "Senior Data Engineer"
            }
        }
    )
    assert start_resp.status_code == 200
    s_data = start_resp.json()
    assert "reply" in s_data
    assert s_data.get("done") is False

    # Turn 2: Conversation turn
    turn_resp = client.post(
        "/api/judge/interview",
        json={
            "sessionId": session_id,
            "message": "We use vector embeddings and cosine similarity search for retrieval."
        }
    )
    assert turn_resp.status_code == 200
    t_data = turn_resp.json()
    assert "reply" in t_data
    assert "done" in t_data


def test_security_no_api_keys_exposed():
    """Verify security constraint: no Gemini API keys appear in Judge Panel API responses."""
    resp = client.post(
        "/api/v1/judge/analyze",
        json={"fileId": "curriculum.json"}
    )
    assert resp.status_code == 200
    text_content = resp.text
    assert "AIzaSy" not in text_content
    assert "GEMINI_API_KEY" not in text_content
