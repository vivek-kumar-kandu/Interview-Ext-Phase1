from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.schemas.interview import CandidateProfile, JobDetails, JobAnalysisSummary, FeedbackSchema


class TurnEvaluation(BaseModel):
    question: str
    answer: str
    day: int = 1
    topic: str = "Technical Depth"
    score: float = Field(default=0.0, description="Score between 0.0 and 10.0")
    feedback: str = ""
    strengths_identified: List[str] = Field(default_factory=list)
    gaps_identified: List[str] = Field(default_factory=list)


class IntegrityEvent(BaseModel):
    eventType: str = Field(..., description="fullscreen_exit | visibility_hidden | tab_switch | blur")
    timestamp: str = Field(..., description="ISO timestamp")
    detail: Optional[str] = None


class SessionState(BaseModel):
    session_id: str
    candidate: Optional[CandidateProfile] = None
    candidate_profile_dict: Optional[Dict[str, Any]] = None
    job: Optional[JobDetails] = None
    job_summary: Optional[JobAnalysisSummary] = None
    match_analysis: Optional[Dict[str, Any]] = None
    expected_lpa: Optional[float] = None
    planned_days: List[int] = Field(default_factory=list)
    days_covered: List[int] = Field(default_factory=list)
    questions_asked: int = 0
    current_day: Optional[int] = None
    current_question: Optional[str] = None
    current_topic: Optional[str] = None
    current_difficulty: Optional[str] = None
    pending_followup: bool = False
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)
    evaluations: List[TurnEvaluation] = Field(default_factory=list)
    integrity_events: List[IntegrityEvent] = Field(default_factory=list)
    done: bool = False
    feedback: Optional[FeedbackSchema] = None
