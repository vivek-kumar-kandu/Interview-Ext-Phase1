from fastapi import APIRouter, HTTPException, status
from app.schemas.extension import (
    ExtensionStatusResponse,
    JobDetectionRequest,
    JobDetectionResponse,
    UserConsentRequest,
    UserConsentResponse,
)
from app.schemas.interview import InterviewRequest
from app.services.job_analyzer import job_analyzer_service
from app.agents.orchestrator import interview_orchestrator

router = APIRouter()


@router.get("/extension/status", response_model=ExtensionStatusResponse, status_code=status.HTTP_200_OK)
async def check_extension_status() -> ExtensionStatusResponse:
    """
    Status check endpoint for Chrome Extension health, feature availability, and supported job portal domains.
    """
    return ExtensionStatusResponse()


@router.post("/extension/detect-job", response_model=JobDetectionResponse, status_code=status.HTTP_200_OK)
async def detect_job_profile(request: JobDetectionRequest) -> JobDetectionResponse:
    """
    Analyzes page context, URL, and job posting data sent by Chrome Extension.
    Determines if page is a job profile and builds prompt metadata for extension popup.
    """
    try:
        response = job_analyzer_service.detect_job_profile(request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze job profile detection payload: {str(e)}"
        )


@router.post("/extension/start-job-interview", response_model=UserConsentResponse, status_code=status.HTTP_200_OK)
async def start_job_interview(request: UserConsentRequest) -> UserConsentResponse:
    """
    Triggered when the candidate allows / confirms starting an interview from the Chrome Extension popup overlay.
    Initializes session, generates first technical question, and returns interview startup payload.
    """
    try:
        if not request.userConsent:
            return UserConsentResponse(
                sessionStarted=False,
                sessionId=request.sessionId,
                reply=None,
                jobSummary=None,
                progress=None,
                message="Candidate declined to start interview session."
            )

        interview_req = InterviewRequest(
            sessionId=request.sessionId,
            job=request.job,
            candidate=request.candidate
        )

        interview_res = await interview_orchestrator.process_turn(interview_req)

        return UserConsentResponse(
            sessionStarted=True,
            sessionId=request.sessionId,
            reply=interview_res.reply,
            jobSummary=interview_res.jobSummary,
            progress=interview_res.progress,
            message="Interview successfully initialized after candidate allowance."
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start interview from extension popup consent: {str(e)}"
        )
