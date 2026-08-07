from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class CandidateMember(BaseModel):
    id: str
    name: str
    jobRole: str
    yearsExperience: int
    education: str
    status: str


class CandidateMission(BaseModel):
    day: int
    title: str
    passed: Optional[bool] = None
    attempts: Optional[int] = None
    skipped: Optional[bool] = None


class CandidateSignals(BaseModel):
    commitDays: Optional[int] = None
    missionsCompleted: Optional[int] = None
    missionsFirstTry: Optional[int] = None


class CandidateProfile(BaseModel):
    member: CandidateMember
    missions: List[CandidateMission] = Field(default_factory=list)
    signals: Optional[CandidateSignals] = None


class JobDetails(BaseModel):
    jobTitle: Optional[str] = Field("AI Engineer", description="Job title extracted from hiring portal")
    company: Optional[str] = Field("Target Company", description="Company name extracted from job page")
    skills: List[str] = Field(default_factory=list, description="Extracted required skills from job posting")
    experience: Optional[str] = Field(None, description="Experience requirement e.g. 2+ Years")
    description: Optional[str] = Field(None, description="Raw job description text")


class InterviewRequest(BaseModel):
    sessionId: str = Field(..., description="Unique session identifier for the candidate interview")
    candidate: Optional[CandidateProfile] = Field(None, description="Candidate details on interview start")
    job: Optional[JobDetails] = Field(None, description="Extracted job posting details from Chrome extension")
    message: Optional[str] = Field(None, description="Candidate response message on turn execution")


class JobAnalysisSummary(BaseModel):
    company: str
    role: str
    detectedSkills: List[str]
    estimatedDuration: str = "15 Minutes"
    difficulty: str = "Medium-Hard"
    matchScore: int = Field(92, description="Job compatibility score percentage")
    readinessScore: int = Field(88, description="Interview readiness metric percentage")
    requiredSkills: List[str] = Field(default_factory=list)
    candidateSkills: List[str] = Field(default_factory=list)
    missingSkills: List[str] = Field(default_factory=list)


class ProgressMetrics(BaseModel):
    questionsCount: int
    totalQuestions: int = 8
    topicsCovered: List[str] = Field(default_factory=list)
    remainingTopics: List[str] = Field(default_factory=list)
    roadmapProgress: List[Dict[str, Any]] = Field(default_factory=list)


class FeedbackSchema(BaseModel):
    # Numerical Score Breakdown
    overallScore: int = Field(88, description="Overall score out of 100")
    technicalKnowledge: int = Field(90, description="Technical knowledge score out of 100")
    communication: int = Field(86, description="Communication score out of 100")
    reasoning: int = Field(89, description="Reasoning score out of 100")
    matchScore: int = Field(92, description="Job match compatibility percentage")
    readinessScore: int = Field(88, description="Interview readiness score percentage")
    hiringRecommendation: str = Field("Strong Hire", description="Recommendation: Strong Hire / Hire / Consider / Reject")

    # Structured Insights
    summary: str
    strengths: List[str] = Field(default_factory=list)
    weakAreas: List[str] = Field(default_factory=list)
    learningRoadmap: List[str] = Field(default_factory=list)
    recruiterSummary: Optional[str] = Field(None, description="Concise recruiter-friendly summary")
    topStrength: Optional[str] = Field(None, description="Top technical strength identified")
    biggestWeakness: Optional[str] = Field(None, description="Primary technical gap to improve")
    nextRecommendedTopic: Optional[str] = Field(None, description="Next suggested learning focus")

    # Backward compatibility aliases
    gaps: List[str] = Field(default_factory=list)
    next: List[str] = Field(default_factory=list)


class InterviewResponse(BaseModel):
    reply: str
    done: bool = False
    whyAsked: Optional[str] = Field(None, description="AI rationale for generating this question")
    matchScore: int = 92
    readinessScore: int = 88
    requiredSkills: List[str] = Field(default_factory=list)
    candidateSkills: List[str] = Field(default_factory=list)
    missingSkills: List[str] = Field(default_factory=list)
    jobSummary: Optional[JobAnalysisSummary] = None
    progress: Optional[ProgressMetrics] = None
    feedback: Optional[FeedbackSchema] = None
