import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_extension_status():
    """Verify Chrome extension status and feature flag endpoint."""
    response = client.get("/api/v1/extension/status")
    assert response.status_code == 200
    data = response.json()
    assert data["enabled"] is True
    assert "version" in data
    assert isinstance(data["supportedPortals"], list)
    assert "linkedin.com" in data["supportedPortals"]


def test_extension_job_detection_valid_url():
    """Verify job detection when candidate views a LinkedIn job posting URL."""
    payload = {
        "url": "https://www.linkedin.com/jobs/view/123456789",
        "pageTitle": "Senior AI Engineer - TechCorp",
        "rawContent": "We are hiring a Senior AI Engineer skilled in Python, FastAPI, and RAG architectures."
    }
    response = client.post("/api/v1/extension/detect-job", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["isJobProfile"] is True
    assert data["jobSummary"] is not None
    assert data["jobSummary"]["role"] == "Senior AI Engineer - TechCorp"
    assert data["prompt"] is not None
    assert "Senior AI Engineer - TechCorp" in data["prompt"]["title"]
    assert data["prompt"]["allowAction"] == "START_INTERVIEW"


def test_extension_job_detection_non_job_page():
    """Verify job detection returns false on standard search/home page."""
    payload = {
        "url": "https://www.google.com/search?q=python",
        "pageTitle": "Google Search - Python",
        "rawContent": "Python programming language search results."
    }
    response = client.post("/api/v1/extension/detect-job", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["isJobProfile"] is False
    assert data["jobSummary"] is None
    assert data["prompt"] is None


def test_extension_start_job_interview_user_allowed():
    """Verify starting an interview when user clicks Allow / Start Interview on extension popup."""
    payload = {
        "sessionId": "ext-session-999",
        "userConsent": True,
        "job": {
            "jobTitle": "Lead AI Engineer",
            "company": "OpenAI Partner",
            "skills": ["Python", "FastAPI", "LangGraph", "Docker"],
            "experience": "5+ Years"
        }
    }
    response = client.post("/api/v1/extension/start-job-interview", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sessionStarted"] is True
    assert data["sessionId"] == "ext-session-999"
    assert data["reply"] is not None
    assert "Welcome" in data["reply"] or "Question 1" in data["reply"]
    assert data["jobSummary"]["company"] == "OpenAI Partner"


def test_extension_start_job_interview_user_denied():
    """Verify handling when user dismisses or denies permission on popup overlay."""
    payload = {
        "sessionId": "ext-session-000",
        "userConsent": False,
        "job": {
            "jobTitle": "AI Engineer",
            "company": "Some Company"
        }
    }
    response = client.post("/api/v1/extension/start-job-interview", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sessionStarted"] is False
    assert data["sessionId"] == "ext-session-000"
    assert data["reply"] is None
    assert "declined" in data["message"].lower()
