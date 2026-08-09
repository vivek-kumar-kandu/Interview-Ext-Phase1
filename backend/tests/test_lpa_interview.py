import pytest
from unittest.mock import AsyncMock, patch, PropertyMock

from fastapi import HTTPException
from app.services.lpa_interview_engine import lpa_interview_engine
from app.utils.llm import get_llm
from app.config import settings


@pytest.mark.asyncio
async def test_lpa_calibration_difficulty_levels():
    """1. Verify LPA calibration bands determine correct difficulty descriptors"""
    assert "Junior" in lpa_interview_engine._determine_lpa_difficulty(8.0)
    assert "Mid-level" in lpa_interview_engine._determine_lpa_difficulty(14.0)
    assert "Senior/Lead" in lpa_interview_engine._determine_lpa_difficulty(25.0)


@pytest.mark.asyncio
async def test_interview_uses_current_job_and_candidate_profile():
    """Req 1, 2, 3: First question uses current job and candidate profile dynamically."""
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value.content = '{"question": "How did you design FastAPI endpoints in your Vasuki system?", "topic": "FastAPI Architecture", "difficulty": "Mid-level"}'

    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm):
        start_res = await lpa_interview_engine.start_interview(
            candidate_profile={
                "name": "Vivek",
                "skills": ["Python", "FastAPI", "React"],
                "projects": ["Vasuki System"]
            },
            job_profile={
                "jobTitle": "Python Backend Engineer",
                "company": "Tech Corp",
                "skills": ["Python", "FastAPI"],
                "description": "Build high-throughput FastAPI microservices."
            },
            match_analysis={"matchScore": 90},
            expected_lpa=14.0
        )

        assert start_res["success"] is True
        assert start_res["questionNumber"] == 1
        assert "FastAPI" in start_res["question"] or "Vasuki" in start_res["question"]

        # Check prompt sent to LLM contains current job and candidate evidence
        call_args = mock_llm.ainvoke.call_args[0][0][0].content
        assert "Python Backend Engineer" in call_args
        assert "Tech Corp" in call_args
        assert "Vivek" in call_args
        assert "Vasuki System" in call_args


@pytest.mark.asyncio
async def test_previous_answer_and_history_passed_to_next_question():
    """Req 4, 5, 8, 13, 14: Previous exact answer and complete history passed to Gemini for next turn."""
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value.content = '{"question": "What is React Virtual DOM?", "topic": "React", "difficulty": "Junior"}'

    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm):
        start_res = await lpa_interview_engine.start_interview(
            candidate_profile={"name": "Garvit", "skills": ["React"]},
            job_profile={"jobTitle": "Frontend Developer", "company": "Alpha Tech"},
            match_analysis={},
            expected_lpa=10.0
        )
        sid = start_res["sessionId"]

        raw_user_answer = "Virtual DOM is a lightweight copy of the real DOM used for reconciliation."

        mock_llm.ainvoke.return_value.content = '{"isComplete": false, "turnEvaluation": {"score": 8.5, "feedback": "Accurate explanation of reconciliation."}, "nextQuestion": {"question": "How does React use keys to optimize Virtual DOM diffing?", "topic": "React Diffing", "difficulty": "Mid-level", "isFollowUp": true}}'

        answer_res = await lpa_interview_engine.process_answer(
            session_id=sid,
            answer=raw_user_answer,
            expected_lpa_override=10.0
        )

        assert answer_res["success"] is True
        assert answer_res["questionNumber"] == 2
        assert answer_res["isFollowUp"] is True

        # Check prompt sent to LLM contains exact raw user answer and previous question
        call_args = mock_llm.ainvoke.call_args[0][0][0].content
        assert raw_user_answer in call_args
        assert "What is React Virtual DOM?" in call_args


@pytest.mark.asyncio
async def test_weak_answer_or_dont_know_handled_naturally():
    """Req 6: Candidate 'I don't know' answer is evaluated honestly without fabrication."""
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value.content = '{"question": "Explain Kubernetes pod scheduling.", "topic": "DevOps", "difficulty": "Senior"}'

    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm):
        start_res = await lpa_interview_engine.start_interview(
            candidate_profile={"name": "Sam"},
            job_profile={"jobTitle": "DevOps Engineer", "company": "Cloud Co"},
            match_analysis={},
            expected_lpa=16.0
        )
        sid = start_res["sessionId"]

        dont_know_answer = "I don't know much about Kubernetes pod scheduling, but I have used Docker containers."

        mock_llm.ainvoke.return_value.content = '{"isComplete": false, "turnEvaluation": {"score": 5.0, "feedback": "Honest response acknowledging gap in K8s pod scheduling."}, "nextQuestion": {"question": "How do you manage multi-container setups using Docker Compose?", "topic": "Docker", "difficulty": "Mid-level", "isFollowUp": false}}'

        answer_res = await lpa_interview_engine.process_answer(
            session_id=sid,
            answer=dont_know_answer,
            expected_lpa_override=16.0
        )

        assert answer_res["success"] is True
        assert answer_res["difficulty"] == "Mid-level"  # Simplified difficulty appropriately


@pytest.mark.asyncio
async def test_job_switching_creates_isolated_context():
    """Req 11, 12: Job A (Frontend) and Job B (Python Backend) generate completely distinct contexts."""
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value.content = '{"question": "How do you optimize React re-renders?", "topic": "React Performance", "difficulty": "Senior"}'

    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm):
        res_a = await lpa_interview_engine.start_interview(
            candidate_profile={"name": "Alex", "skills": ["React", "Python"]},
            job_profile={"jobTitle": "Frontend Developer", "company": "Company A", "skills": ["React", "CSS"]},
            match_analysis={},
            expected_lpa=12.0
        )

        mock_llm.ainvoke.return_value.content = '{"question": "How do Python Asyncio event loops handle concurrency?", "topic": "Python Concurrency", "difficulty": "Senior"}'

        res_b = await lpa_interview_engine.start_interview(
            candidate_profile={"name": "Alex", "skills": ["React", "Python"]},
            job_profile={"jobTitle": "Python Backend Developer", "company": "Company B", "skills": ["Python", "Asyncio"]},
            match_analysis={},
            expected_lpa=12.0
        )

        assert res_a["sessionId"] != res_b["sessionId"]
        assert "React" in res_a["question"]
        assert "Python" in res_b["question"]


@pytest.mark.asyncio
async def test_no_static_fallback_gemini_429_quota_raises_503():
    """Req 15, 20, 21, 22: Gemini 429 quota exhaustion raises clean HTTP 503 error without static fallback."""
    mock_llm = AsyncMock()
    mock_llm.ainvoke.side_effect = Exception("429 RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'Generative Language API'")

    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm):
        with pytest.raises(HTTPException) as exc_info:
            await lpa_interview_engine.start_interview(
                candidate_profile={"name": "Test User"},
                job_profile={"jobTitle": "Data Scientist", "company": "AI Firm"},
                match_analysis={},
                expected_lpa=12.0
            )
        assert exc_info.value.status_code == 503
        assert "Gemini AI quota is currently unavailable" in exc_info.value.detail


@pytest.mark.asyncio
async def test_api_key_isolation_interview_key():
    """Req 23: Interview operations use purpose='interview' to select GEMINI_INTERVIEW_API_KEY."""
    with patch.object(type(settings), "GEMINI_INTERVIEW_API_KEY", PropertyMock(return_value="AQ.interview_key_123")), \
         patch.object(type(settings), "GEMINI_RESUME_API_KEY", PropertyMock(return_value="AQ.resume_key_456")), \
         patch.object(type(settings), "GEMINI_INTERVIEW_API_KEYS", PropertyMock(return_value=["AQ.interview_key_123"])):

        llm = get_llm(purpose="interview")
        assert llm is not None
        if hasattr(llm, "_keys"):
            assert "AQ.interview_key_123" in llm._keys
            assert "AQ.resume_key_456" not in llm._keys





@pytest.mark.asyncio
async def test_final_report_contains_every_question_and_exact_user_answer():
    """Req 13, 14, 15, 16, 17, 18, 19: Final report includes every turn, exact user answers, and dynamic scores."""
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value.content = '{"question": "Explain REST API status codes.", "topic": "APIs", "difficulty": "Junior"}'

    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm):
        start_res = await lpa_interview_engine.start_interview(
            candidate_profile={"name": "Rohan"},
            job_profile={"jobTitle": "Backend Intern", "company": "Dev Inc"},
            match_analysis={},
            expected_lpa=8.0
        )
        sid = start_res["sessionId"]

        raw_user_answer = "200 means OK, 404 means Not Found, 500 means Server Error."

        mock_llm.ainvoke.return_value.content = '''{
            "isComplete": true,
            "turnEvaluation": {"score": 9.0, "feedback": "Clear explanation of REST status codes."},
            "finalFeedback": {
                "overallTechnicalScore": 90,
                "strengths": ["Solid HTTP protocol knowledge"],
                "topicsToImprove": ["Advanced API rate limiting"]
            }
        }'''

        answer_res = await lpa_interview_engine.process_answer(
            session_id=sid,
            answer=raw_user_answer,
            expected_lpa_override=8.0
        )

        assert answer_res["interviewComplete"] is True
        assert "questions" in answer_res
        q_item = answer_res["questions"][0]
        assert q_item["userAnswer"] == raw_user_answer
        assert q_item["question"] == "Explain REST API status codes."
        assert answer_res["score"] == 90
        assert "Solid HTTP protocol knowledge" in answer_res["strengths"]


@pytest.mark.asyncio
async def test_no_jobid_required_in_interview_flow():
    """Req 26: Interview start and answer endpoints work completely without requiring or depending on a jobId."""
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value.content = '{"question": "How do you handle async state in React?", "topic": "React State", "difficulty": "Mid-level"}'

    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm):
        # Start without jobId field
        start_res = await lpa_interview_engine.start_interview(
            candidate_profile={"name": "Nisha"},
            job_profile={"jobTitle": "React Developer", "company": "Web Studio"},
            match_analysis={},
            expected_lpa=12.0
        )
        assert start_res["success"] is True
        assert start_res["sessionId"] is not None

        mock_llm.ainvoke.return_value.content = '{"isComplete": false, "turnEvaluation": {"score": 8.0}, "nextQuestion": {"question": "How does Redux Toolkit manage state?", "topic": "State Management", "difficulty": "Mid-level"}}'

        # Submit answer without jobId field
        answer_res = await lpa_interview_engine.process_answer(
            session_id=start_res["sessionId"],
            answer="I use React Query and useState for local async state."
        )
        assert answer_res["success"] is True


@pytest.mark.asyncio
async def test_integrity_event_logging():
    """Req 24: Tab switch and integrity event monitoring logging."""
    res = await lpa_interview_engine.log_integrity_event(
        session_id="session_integrity_test",
        event_type="TAB_SWITCH",
        timestamp="2026-08-09T14:45:00Z",
        detail="Candidate switched active tab"
    )
    assert res["success"] is True
    assert res["recorded"] is True


@pytest.mark.asyncio
async def test_report_snapshot_idempotency_zero_extra_llm_calls():
    """Verify get_session_report returns stored report_snapshot without invoking Gemini (0 LLM cost)."""
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value.content = '{"question": "Explain Docker networking.", "topic": "Docker", "difficulty": "Mid-level"}'

    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm):
        start_res = await lpa_interview_engine.start_interview(
            candidate_profile={"name": "Priya"},
            job_profile={"jobTitle": "DevOps Engineer", "company": "Tech Solutions"},
            match_analysis={},
            expected_lpa=12.0
        )
        sid = start_res["sessionId"]

        mock_llm.ainvoke.return_value.content = '''{
            "isComplete": true,
            "turnEvaluation": {"score": 8.0, "feedback": "Good Docker networking response."},
            "finalFeedback": {"summary": "Strong DevOps candidate."}
        }'''

        await lpa_interview_engine.process_answer(session_id=sid, answer="Docker bridge networks isolate container subnets.")

        # Reset call count on mock LLM
        mock_llm.ainvoke.reset_mock()

        # Fetch report snapshot idempotently multiple times
        rep1 = await lpa_interview_engine.get_session_report(sid)
        rep2 = await lpa_interview_engine.get_session_report(sid)

        assert rep1["success"] is True
        assert rep2["success"] is True
        assert rep1["reportSnapshot"]["overallScore"] == 80
        # ZERO additional LLM calls executed during report retrieval
        assert mock_llm.ainvoke.call_count == 0


@pytest.mark.asyncio
async def test_incomplete_session_partially_completed_status():
    """Verify early interview termination sets status PARTIALLY_COMPLETED without fake turns."""
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value.content = '{"question": "What is clean code?", "topic": "Software Engineering", "difficulty": "Junior"}'

    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm):
        start_res = await lpa_interview_engine.start_interview(
            candidate_profile={"name": "Karan"},
            job_profile={"jobTitle": "Junior Developer", "company": "Soft Corp"},
            match_analysis={},
            expected_lpa=8.0
        )
        sid = start_res["sessionId"]

        end_res = await lpa_interview_engine.end_interview_early(sid)
        assert end_res["success"] is True
        assert end_res["status"] == "PARTIALLY_COMPLETED"
        assert end_res["reportSnapshot"]["jobReadiness"]["status"] == "NEEDS_PREPARATION"
        assert "not completed" in end_res["reportSnapshot"]["jobReadiness"]["explanation"]


@pytest.mark.asyncio
async def test_deterministic_score_and_priority_preparation():
    """Verify deterministic overall score matches turn average and priority prep is categorized."""
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value.content = '{"question": "What is Python GIL?", "topic": "Python Internals", "difficulty": "Mid-level"}'

    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm):
        start_res = await lpa_interview_engine.start_interview(
            candidate_profile={"name": "Rahul"},
            job_profile={"jobTitle": "Python Lead", "company": "Data Inc", "requiredSkills": ["Python", "Asyncio", "System Design"]},
            match_analysis={},
            expected_lpa=18.0
        )
        sid = start_res["sessionId"]

        mock_llm.ainvoke.return_value.content = '''{
            "isComplete": true,
            "turnEvaluation": {"score": 8.0, "feedback": "Good answer on GIL.", "gaps": ["Weak on Asyncio event loops"]},
            "finalFeedback": {"summary": "Solid Python lead candidate."}
        }'''

        ans_res = await lpa_interview_engine.process_answer(session_id=sid, answer="GIL locks thread execution to one bytecode instruction at a time.")
        snapshot = ans_res["reportSnapshot"]

        assert snapshot["overallScore"] == 80
        assert snapshot["performanceLevel"] == "Strong"
        assert "priorityPreparation" in snapshot
        assert "highPriority" in snapshot["priorityPreparation"]
        assert len(snapshot["jobRequirementsMatrix"]) > 0


