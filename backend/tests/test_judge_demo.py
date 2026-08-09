import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_list_judge_files():
    response = client.get("/api/v1/judge/files")
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    assert data.get("count") >= 3
    
    file_ids = [f["fileId"] for f in data.get("files", [])]
    assert "curriculum.json" in file_ids
    assert "candidates.json" in file_ids
    assert "technical-spec.md" in file_ids


def test_analyze_curriculum_json_dynamic():
    response = client.post(
        "/api/v1/judge/analyze",
        json={"fileId": "curriculum.json"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    assert data.get("fileType") == "curriculum"
    
    extracted = data.get("extracted", {})
    # Verify exact dynamic figures derived from actual file
    assert extracted.get("duration") == 31
    assert extracted.get("modules") == 8
    assert len(extracted.get("moduleList", [])) == 8
    assert "Embeddings & Vector Search" in extracted.get("learningProgression", [])
    assert "Agentic AI & MCP" in extracted.get("learningProgression", [])
    assert len(extracted.get("tools", [])) > 0


def test_analyze_candidates_json_dynamic():
    response = client.post(
        "/api/v1/judge/analyze",
        json={"fileId": "candidates.json"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    assert data.get("fileType") == "candidates"
    
    extracted = data.get("extracted", {})
    assert extracted.get("totalCandidates") > 0
    assert extracted.get("totalCandidates") == len(extracted.get("candidates", []))


def test_analyze_technical_spec_markdown():
    response = client.post(
        "/api/v1/judge/analyze",
        json={"fileId": "technical-spec.md"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    assert data.get("fileType") == "specification"


def test_analyze_non_existent_file():
    response = client.post(
        "/api/v1/judge/analyze",
        json={"fileId": "non_existent_file.json"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is False
    assert "Unable to analyze" in data.get("error", "")
