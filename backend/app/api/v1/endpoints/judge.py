import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status
from app.services.judge_service import judge_service
from app.services.judge_interview_engine import judge_interview_engine

logger = logging.getLogger(__name__)
router = APIRouter()


class JudgeAnalyzeRequest(BaseModel):
    fileId: Optional[str] = Field(None, description="Filename or ID of the organiser-provided file")
    file_id: Optional[str] = Field(None, description="Alternative field name for file ID")

    def get_file_id(self) -> str:
        fid = self.fileId or self.file_id
        if not fid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Request body must include 'fileId' or 'file_id'."
            )
        return fid


class JudgeStartInterviewRequest(BaseModel):
    sessionId: str = Field(..., description="Unique session ID")
    candidateId: Optional[str] = Field(None, description="Candidate ID from candidates.json")
    candidate: Optional[Dict[str, Any]] = Field(None, description="Candidate object context")


class JudgeInterviewTurnRequest(BaseModel):
    sessionId: str = Field(..., description="Unique session ID")
    message: Optional[str] = Field(None, description="Candidate message / answer")
    answer: Optional[str] = Field(None, description="Alternative field name for candidate answer")
    candidate: Optional[Dict[str, Any]] = Field(None, description="Initial candidate object if starting")


@router.get("/judge/files", status_code=status.HTTP_200_OK)
async def list_judge_files() -> Dict[str, Any]:
    """
    Returns metadata for organiser-provided evaluation files discovered in the project repo.
    """
    try:
        files = judge_service.discover_judge_files()
        return {
            "success": True,
            "count": len(files),
            "files": files
        }
    except Exception as e:
        logger.error(f"[JudgeEndpoint] Error discovering organiser files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to discover organiser-provided files: {str(e)}"
        )


@router.get("/judge/candidates", status_code=status.HTTP_200_OK)
async def list_judge_candidates() -> Dict[str, Any]:
    """
    Returns candidate dataset parsed dynamically from candidates.json.
    """
    try:
        res = await judge_service.analyze_judge_file("candidates.json")
        return res
    except Exception as e:
        logger.error(f"[JudgeEndpoint] Error fetching organiser candidates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load organiser candidates dataset: {str(e)}"
        )


@router.post("/judge/analyze", status_code=status.HTTP_200_OK)
async def analyze_judge_file(request: JudgeAnalyzeRequest) -> Dict[str, Any]:
    """
    Analyzes an organiser-provided file dynamically without hardcoded static data.
    """
    file_id = request.get_file_id()
    try:
        result = await judge_service.analyze_judge_file(file_id)
        if not result.get("success"):
            return {
                "success": False,
                "error": result.get("error", "Unable to analyze this organiser-provided file."),
                "detail": result.get("detail", "File analysis failed.")
            }
        return result
    except Exception as e:
        logger.error(f"[JudgeEndpoint] Error analyzing file '{file_id}': {e}")
        return {
            "success": False,
            "error": "Unable to analyze this organiser-provided file.",
            "detail": str(e)
        }


@router.post("/judge/interview/start", status_code=status.HTTP_200_OK)
async def start_judge_interview(request: JudgeStartInterviewRequest) -> Dict[str, Any]:
    """
    Starts a personalized hackathon interview session for a selected candidate.
    """
    try:
        return await judge_interview_engine.start_session(
            session_id=request.sessionId,
            candidate_id=request.candidateId,
            candidate_data=request.candidate
        )
    except Exception as e:
        logger.error(f"[JudgeEndpoint] Failed to start judge interview: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start personalized hackathon interview: {str(e)}"
        )


@router.post("/judge/interview/turn", status_code=status.HTTP_200_OK)
async def process_judge_interview_turn(request: JudgeInterviewTurnRequest) -> Dict[str, Any]:
    """
    Processes candidate answer turn in Judge Panel mode and returns next adaptive question or final report.
    """
    answer_text = request.answer or request.message or ""
    try:
        return await judge_interview_engine.process_turn(
            session_id=request.sessionId,
            candidate_answer=answer_text
        )
    except Exception as e:
        logger.error(f"[JudgeEndpoint] Failed to process judge interview turn: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process judge interview turn: {str(e)}"
        )


@router.get("/judge/interview/report/{session_id}", status_code=status.HTTP_200_OK)
async def get_judge_interview_report(session_id: str) -> Dict[str, Any]:
    """
    Retrieves stored Judge Evaluation Report for session.
    """
    report = await judge_interview_engine.get_session_report(session_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No Judge Evaluation Report found for session '{session_id}'."
        )
    return report


@router.post("/judge/interview", status_code=status.HTTP_200_OK)
async def judge_interview_spec_adapter(request: JudgeInterviewTurnRequest) -> Dict[str, Any]:
    """
    Organiser Technical Specification API Adapter complying strictly with technical-spec.md contract:
    POST /api/interview
    Body: { "sessionId": "...", "candidate": { ... } } -> Start session
    Body: { "sessionId": "...", "message": "..." } -> Turn
    Returns: { "reply": "...", "done": false } or { "reply": "...", "done": true, "feedback": { ... } }
    """
    try:
        if request.candidate and not request.message:
            # Start turn
            cand_data = request.candidate
            cand_id = cand_data.get("id") or cand_data.get("member", {}).get("id")
            res = await judge_interview_engine.start_session(
                session_id=request.sessionId,
                candidate_id=cand_id,
                candidate_data=cand_data
            )
            return {
                "reply": res.get("reply", "Welcome to your technical evaluation."),
                "done": False
            }
        else:
            # Multi-turn exchange
            msg = request.message or request.answer or ""
            res = await judge_interview_engine.process_turn(
                session_id=request.sessionId,
                candidate_answer=msg
            )
            if res.get("done"):
                return {
                    "reply": res.get("reply", "Interview completed."),
                    "done": True,
                    "feedback": res.get("feedback", {
                        "summary": "Interview completed successfully.",
                        "strengths": ["Demonstrated competency"],
                        "gaps": ["None identified"],
                        "next": ["Proceed to capstone"]
                    })
                }
            else:
                return {
                    "reply": res.get("reply", "Next question"),
                    "done": False
                }
    except Exception as e:
        logger.error(f"[JudgeSpecAdapter] Error in spec adapter: {e}")
        return {
            "reply": "Unable to process interview request at this time.",
            "done": False
        }
