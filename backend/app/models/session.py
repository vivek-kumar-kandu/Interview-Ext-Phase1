from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.schemas.interview import CandidateProfile, JobDetails, JobAnalysisSummary, FeedbackSchema


class TurnEvaluation(BaseModel):
    question: str
    answer: str
    day: int
    topic: str
    score: float = Field(default=0.0, description="Score between 0.0 and 10.0")
    feedback: str = ""
    strengths_identified: List[str] = Field(default_factory=list)
    gaps_identified: List[str] = Field(default_factory=list)


class SessionState(BaseModel):
    session_id: str
    candidate: Optional[CandidateProfile] = None
    job: Optional[JobDetails] = None
    job_summary: Optional[JobAnalysisSummary] = None
    planned_days: List[int] = Field(default_factory=list)
    days_covered: List[int] = Field(default_factory=list)
    questions_asked: int = 0
    current_day: Optional[int] = None
    current_question: Optional[str] = None
    pending_followup: bool = False
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)
    evaluations: List[TurnEvaluation] = Field(default_factory=list)
    done: bool = False
    feedback: Optional[FeedbackSchema] = None
