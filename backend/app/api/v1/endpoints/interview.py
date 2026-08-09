from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status, Request
from app.schemas.interview import (
    StartInterviewRequest,
    StartInterviewResponse,
    InterviewAnswerRequest,
    InterviewAnswerResponse,
    IntegrityEventRequest,
    InterviewRequest,
    InterviewResponse
)
from app.services.lpa_interview_engine import lpa_interview_engine
from app.agents.orchestrator import interview_orchestrator

router = APIRouter()


@router.post("/interview/start", response_model=StartInterviewResponse, status_code=status.HTTP_200_OK)
@router.post("/extension/interview/start", response_model=StartInterviewResponse, status_code=status.HTTP_200_OK)
@router.post("/extension/start-interview", response_model=StartInterviewResponse, status_code=status.HTTP_200_OK)
async def start_lpa_interview(request: StartInterviewRequest) -> StartInterviewResponse:
    """
    Initializes a new dynamic AI technical interview session calibrated against candidate expected LPA,
    resume evidence, target job details, and match gaps.
    """
    res = await lpa_interview_engine.start_interview(
        candidate_profile=request.candidateProfile or request.candidate or {},
        job_profile=request.jobProfile or request.job or {},
        match_analysis=request.matchAnalysis or {},
        expected_lpa=request.expectedLpa,
        session_id=request.sessionId,
        job=request.job,
        candidate=request.candidate,
        interview_preferences=request.interviewPreferences
    )
    return StartInterviewResponse(**res)


@router.post("/interview/answer", response_model=InterviewAnswerResponse, status_code=status.HTTP_200_OK)
@router.post("/extension/interview/answer", response_model=InterviewAnswerResponse, status_code=status.HTTP_200_OK)
@router.post("/extension/process-interview-answer", response_model=InterviewAnswerResponse, status_code=status.HTTP_200_OK)
async def process_lpa_interview_answer(request: InterviewAnswerRequest) -> InterviewAnswerResponse:
    """
    Processes candidate answer, evaluates technical depth, and generates next adaptive question or final feedback via Gemini.
    """
    res = await lpa_interview_engine.process_answer(
        session_id=request.sessionId,
        answer=request.answer,
        expected_lpa_override=request.expectedLpa,
        elapsed_seconds=request.elapsedSeconds,
        integrity_metrics=request.integrityMetrics
    )
    return InterviewAnswerResponse(**res)


@router.post("/interview/integrity", status_code=status.HTTP_200_OK)
@router.post("/extension/interview/integrity", status_code=status.HTTP_200_OK)
@router.post("/extension/log-interview-integrity", status_code=status.HTTP_200_OK)
async def log_integrity_event(request: IntegrityEventRequest) -> Dict[str, Any]:
    """
    Logs observable interview integrity events (fullscreen exit, tab visibility change, camera/mic unavailability).
    """
    return await lpa_interview_engine.log_integrity_event(
        session_id=request.sessionId,
        event_type=request.eventType,
        timestamp=request.timestamp,
        detail=request.detail
    )


@router.get("/interview/report/{session_id}", status_code=status.HTTP_200_OK)
@router.post("/interview/report/{session_id}", status_code=status.HTTP_200_OK)
@router.post("/extension/interview/report/{session_id}", status_code=status.HTTP_200_OK)
async def get_interview_report(session_id: str) -> Dict[str, Any]:
    """
    Idempotently returns the stored report snapshot for an interview session with zero additional LLM cost.
    """
    return await lpa_interview_engine.get_session_report(session_id)


@router.post("/interview/end/{session_id}", status_code=status.HTTP_200_OK)
@router.post("/extension/interview/end/{session_id}", status_code=status.HTTP_200_OK)
async def end_interview_early(session_id: str) -> Dict[str, Any]:
    """
    Terminates an active interview early (e.g. candidate closes interview) and generates report snapshot.
    """
    return await lpa_interview_engine.end_interview_early(session_id)


@router.post("/interview", response_model=InterviewResponse, status_code=status.HTTP_200_OK)
async def process_legacy_interview_turn(request: InterviewRequest) -> InterviewResponse:
    """
    Stateful endpoint handler conforming to Technical Specification POST /api/interview.
    Supports both normal candidate flow and organiser hackathon evaluation sessions.
    """
    try:
        from app.services.judge_interview_engine import judge_interview_engine, _JUDGE_SESSIONS
        cand_dict = request.candidate.dict() if (request.candidate and hasattr(request.candidate, "dict")) else (request.candidate or {})
        is_organiser_cand = bool(
            cand_dict.get("member") or
            cand_dict.get("missions") or
            (request.sessionId and request.sessionId in _JUDGE_SESSIONS)
        )

        if is_organiser_cand:
            session_id = request.sessionId
            if request.message:
                res = await judge_interview_engine.process_turn(session_id=session_id, candidate_answer=request.message)
            else:
                cand_id = cand_dict.get("member", {}).get("id") or cand_dict.get("id")
                res = await judge_interview_engine.start_session(session_id=session_id, candidate_id=cand_id, candidate_data=cand_dict)
            
            fb = None
            if res.get("done") and res.get("feedback"):
                fb = res["feedback"]
            return InterviewResponse(
                reply=res.get("reply", "Evaluation turn complete."),
                done=res.get("done", False),
                feedback=fb
            )

        return await interview_orchestrator.process_turn(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Interview turn processing failed: {str(e)}"
        )

