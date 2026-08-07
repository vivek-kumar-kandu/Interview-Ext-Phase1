from fastapi import APIRouter, HTTPException, status
from app.schemas.interview import InterviewRequest, InterviewResponse
from app.agents.orchestrator import interview_orchestrator

router = APIRouter()


@router.post("/interview", response_model=InterviewResponse, status_code=status.HTTP_200_OK)
async def process_interview_turn(request: InterviewRequest) -> InterviewResponse:
    """
    Single stateful REST endpoint handling interview initialization and conversation turns.
    Conforms strictly to technical-spec.md contract.
    """
    try:
        response = await interview_orchestrator.process_turn(request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Interview turn processing failed: {str(e)}"
        )
