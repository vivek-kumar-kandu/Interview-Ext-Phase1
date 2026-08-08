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


@router.post("/interview", response_model=InterviewResponse, status_code=status.HTTP_200_OK)
async def process_legacy_interview_turn(request: InterviewRequest) -> InterviewResponse:
    """
    Legacy stateful endpoint handler for backward compatibility.
    """
    try:
        return await interview_orchestrator.process_turn(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Interview turn processing failed: {str(e)}"
        )
