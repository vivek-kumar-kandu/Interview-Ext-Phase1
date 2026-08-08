import pytest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from app.services.lpa_interview_engine import lpa_interview_engine


@pytest.mark.asyncio
async def test_lpa_calibration_difficulty_levels():
    """Verify LPA calibration bands determine correct difficulty descriptors"""
    assert "Junior" in lpa_interview_engine._determine_lpa_difficulty(8.0)
    assert "Mid-Senior" in lpa_interview_engine._determine_lpa_difficulty(14.0)
    assert "Staff/Lead" in lpa_interview_engine._determine_lpa_difficulty(25.0)


@pytest.mark.asyncio
async def test_lpa_interview_gemini_unavailable_raises_503():
    """Requirement 9: NO static fallback. If Gemini API fails, raise 503 error message."""
    with patch("app.services.lpa_interview_engine.get_llm", return_value=None):
        with pytest.raises(HTTPException) as exc_info:
            await lpa_interview_engine.start_interview(
                candidate_profile={"name": "Test Dev"},
                job_profile={"jobTitle": "React Dev"},
                match_analysis={"matchScore": 85},
                expected_lpa=12.0
            )
        assert exc_info.value.status_code == 503
        assert "AI interviewer is temporarily unavailable" in exc_info.value.detail


@pytest.mark.asyncio
async def test_lpa_interview_start_and_turn_flow():
    """Test start interview and multi-turn answer flow with mocked Gemini LLM"""
    mock_llm = AsyncMock()
    
    # Return valid JSON for first question
    mock_llm.ainvoke.return_value.content = '{"question": "How did you implement WebSockets in your Vasuki telemetry system for real-time streaming?", "topic": "WebSockets & System Architecture", "difficulty": "Senior"}'

    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm):
        start_res = await lpa_interview_engine.start_interview(
            candidate_profile={
                "name": "Vivek",
                "skills": ["React", "WebSockets", "Python"],
                "projects": ["Vasuki Telemetry System"],
                "experience": ["Software Engineer (3 yrs)"]
            },
            job_profile={
                "jobTitle": "Fullstack Engineer",
                "company": "Tech Labs",
                "skills": ["React", "WebSockets", "FastAPI"],
                "description": "Building real-time telemetry systems."
            },
            match_analysis={
                "matchScore": 88,
                "matchedSkills": ["React", "WebSockets"],
                "missingSkills": ["FastAPI"]
            },
            expected_lpa=14.0
        )

        assert start_res["success"] is True
        assert start_res["questionNumber"] == 1
        assert "Vasuki" in start_res["question"] or "WebSockets" in start_res["question"]
        assert start_res["expectedLpa"] == 14.0

        sid = start_res["sessionId"]

        # Mock turn response for answer 1
        mock_llm.ainvoke.return_value.content = '{"isComplete": false, "turnEvaluation": {"score": 8.0, "feedback": "Good understanding of WebSockets"}, "nextQuestion": {"question": "Why did you choose WebSockets over HTTP long polling for that architecture?", "topic": "Protocols", "difficulty": "Senior", "isFollowUp": true}}'

        answer_res = await lpa_interview_engine.process_answer(
            session_id=sid,
            answer="I used WebSockets because they allow bi-directional low-latency communication between the ESP32 and React dashboard.",
            expected_lpa_override=14.0
        )

        assert answer_res["success"] is True
        assert answer_res["questionNumber"] == 2
        assert answer_res["isFollowUp"] is True
        assert "WebSockets" in answer_res["question"] or "polling" in answer_res["question"]


@pytest.mark.asyncio
async def test_integrity_logging():
    """Verify observable integrity events are logged for session"""
    res = await lpa_interview_engine.log_integrity_event(
        session_id="test_session_123",
        event_type="fullscreen_exit",
        timestamp="2026-08-09T00:00:00Z",
        detail="Candidate exited fullscreen"
    )
    assert res["success"] is True
    assert res["recorded"] is True
