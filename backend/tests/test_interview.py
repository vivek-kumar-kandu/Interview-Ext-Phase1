import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_interview_flow_start_and_turns():
    session_id = "test-session-101"
    
    candidate_payload = {
        "member": {
            "id": "CAND-003",
            "name": "Emily Chen",
            "jobRole": "AI Engineer",
            "yearsExperience": 6,
            "education": "MS Artificial Intelligence",
            "status": "COMPLETED"
        },
        "missions": [
            {"day": 7, "title": "Embeddings Explained", "passed": True, "attempts": 1},
            {"day": 8, "title": "Vector Databases Overview", "passed": True, "attempts": 1},
            {"day": 10, "title": "Retrieval & Matching Engine", "passed": True, "attempts": 1},
            {"day": 11, "title": "RAG End-to-End & LLM API Basics", "passed": True, "attempts": 1},
            {"day": 12, "title": "Prompt Engineering Fundamentals", "passed": True, "attempts": 1},
            {"day": 13, "title": "Function Calling & Structured Outputs", "passed": True, "attempts": 1},
            {"day": 21, "title": "LangChain Agents", "passed": True, "attempts": 1},
            {"day": 22, "title": "Multi-Agent Orchestration", "passed": True, "attempts": 1},
            {"day": 23, "title": "Model Context Protocol (MCP)", "passed": True, "attempts": 1},
            {"day": 31, "title": "Capstone Project & Final Demo", "passed": True, "attempts": 1}
        ],
        "signals": {"commitDays": 31, "missionsCompleted": 31, "missionsFirstTry": 30}
    }

    mock_llm = AsyncMock()
    # 1. Initial turn question
    mock_llm.ainvoke.return_value.content = '{"question": "Explain embeddings.", "topic": "Embeddings", "difficulty": "Junior"}'

    with patch("app.utils.llm._AQGeminiWrapper.ainvoke", new=mock_llm.ainvoke), \
         patch("app.utils.llm._LangChainGeminiWithRetry.ainvoke", new=mock_llm.ainvoke):

        # 1. Start Interview
        start_payload = {
            "sessionId": session_id,
            "candidate": candidate_payload
        }

        res = client.post("/api/interview", json=start_payload)
        assert res.status_code == 200
        data = res.json()
        assert "reply" in data
        assert data["done"] is False

        # 2. Perform 8 conversation turns
        turn_answers = [
            "Embeddings convert text into dense vectors representing semantic meaning in vector space.",
            "Vector databases use HNSW or IVF indexes to perform efficient nearest neighbor similarity search.",
            "RAG combines document retrieval from vector stores with LLM prompt context to answer queries accurately.",
            "Function calling allows LLMs to return structured JSON parameters matching a predefined function schema.",
            "LangChain agents use reasoning loops like ReAct to select tools dynamically based on user intent.",
            "Multi-agent orchestration coordinates specialized agents via state graphs or supervisor patterns.",
            "MCP provides standardized protocols for connecting model context with external services.",
            "Production deployment requires monitoring latency, observing token costs, and containerizing with Docker."
        ]

        for turn_idx, answer in enumerate(turn_answers, start=1):
            if turn_idx < len(turn_answers):
                mock_llm.ainvoke.return_value.content = '{"isComplete": false, "turnEvaluation": {"score": 8.0, "feedback": "Good response."}, "nextQuestion": {"question": "Next technical concept?", "topic": "AI", "difficulty": "Mid-level"}}'
            else:
                mock_llm.ainvoke.return_value.content = '''{
                    "isComplete": true,
                    "turnEvaluation": {"score": 9.0, "feedback": "Comprehensive answer."},
                    "finalFeedback": {
                        "summary": "Outstanding technical performance across all topics.",
                        "strengths": ["Vector Search", "RAG Architecture", "LangChain Agents"],
                        "gaps": ["Minor edge cases in MCP"],
                        "next": ["Advanced multi-agent state graphs"]
                    }
                }'''

            turn_payload = {
                "sessionId": session_id,
                "message": answer
            }
            res = client.post("/api/interview", json=turn_payload)
            assert res.status_code == 200
            data = res.json()
            assert "reply" in data

        assert data["done"] is True
        assert "feedback" in data
        feedback = data["feedback"]
        assert "summary" in feedback
        assert isinstance(feedback["strengths"], list)
        assert isinstance(feedback["gaps"], list)
        assert isinstance(feedback["next"], list)

