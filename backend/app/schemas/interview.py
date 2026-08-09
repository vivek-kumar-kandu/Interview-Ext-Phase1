from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class Experience(BaseModel):
    company: str = ""
    role: str = ""
    duration: str = ""
    description: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)


class Education(BaseModel):
    institution: str = ""
    degree: str = ""
    field: str = ""
    duration: str = ""


class Project(BaseModel):
    name: str = ""
    description: str = ""
    technologies: List[str] = Field(default_factory=list)
    role: str = ""


class Candidate(BaseModel):
    name: str = ""
    headline: str = ""
    summary: str = ""
    location: str = ""
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    github: str = ""


class ResumeAnalysis(BaseModel):
    candidate: Candidate = Field(default_factory=Candidate)
    skills: List[str] = Field(default_factory=list)
    experience: List[Experience] = Field(default_factory=list)
    education: List[Education] = Field(default_factory=list)
    projects: List[Project] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)
    target_roles: List[str] = Field(default_factory=list)
    total_experience_years: float = 0
    profile_completeness: float = 0
    evidence: Dict[str, Any] = Field(default_factory=dict)



class CandidateMember(BaseModel):
    id: str
    name: str
    jobRole: str
    yearsExperience: int
    education: str
    status: str
    skills: Optional[List[str]] = Field(default_factory=list)


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
    expectedLpa: Optional[float] = Field(None, description="Expected LPA salary target for interview calibration")


class StartInterviewRequest(BaseModel):
    candidateProfile: Dict[str, Any] = Field(default_factory=dict, description="Candidate profile data")
    jobProfile: Dict[str, Any] = Field(default_factory=dict, description="Job details data")
    matchAnalysis: Dict[str, Any] = Field(default_factory=dict, description="Job match breakdown data")
    expectedLpa: float = Field(12.0, description="Target expected LPA (e.g. 8, 12, 18, 25)")
    sessionId: Optional[str] = Field(None, description="Optional existing session ID")
    job: Optional[Dict[str, Any]] = Field(None, description="Structured job payload")
    candidate: Optional[Dict[str, Any]] = Field(None, description="Structured candidate payload")
    interviewPreferences: Optional[Dict[str, Any]] = Field(None, description="Interview focus/preferences")


class QuestionModel(BaseModel):
    id: str = Field(..., description="Unique question identifier")
    text: str = Field(..., description="Interview question text")
    category: str = Field("Core Technical Concepts", description="Topic/category")
    difficulty: str = Field("Mid-level", description="Junior | Mid-level | Senior | Lead")
    expectedSignals: List[str] = Field(default_factory=list, description="Target technical signals")


class SessionSummaryModel(BaseModel):
    title: str = Field("AI Technical Interview", description="Interview title")
    focusAreas: List[str] = Field(default_factory=list, description="Target focus areas")
    difficulty: str = Field("Mid-level", description="Overall difficulty calibration")
    estimatedQuestions: int = Field(8, description="Estimated question count")


class StartInterviewResponse(BaseModel):
    success: bool = True
    sessionId: str
    interviewId: Optional[str] = None
    jobId: Optional[str] = None
    questionNumber: int = 1
    question: str
    topic: str = "Core Concepts"
    difficulty: str = "Mid-level"
    totalQuestionsEstimate: int = 8
    expectedLpa: float = 12.0
    session: Optional[SessionSummaryModel] = None
    firstQuestion: Optional[QuestionModel] = None


class InterviewAnswerRequest(BaseModel):
    sessionId: str
    answer: str
    expectedLpa: Optional[float] = None
    elapsedSeconds: Optional[int] = None
    integrityMetrics: Optional[Dict[str, Any]] = None


class InterviewAnswerResponse(BaseModel):
    success: bool = True
    sessionId: str
    questionNumber: int
    question: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    isFollowUp: bool = False
    interviewComplete: bool = False
    score: Optional[int] = None
    strengths: List[str] = Field(default_factory=list)
    gaps: List[str] = Field(default_factory=list)
    feedback: Optional[Dict[str, Any]] = None
    nextQuestion: Optional[Dict[str, Any]] = None
    errorMessage: Optional[str] = None


class IntegrityEventRequest(BaseModel):
    sessionId: str
    eventType: str = Field(..., description="fullscreen_exit | visibility_hidden | tab_switch | blur | camera_unavailable | microphone_unavailable")
    timestamp: Optional[str] = None
    detail: Optional[str] = None



class UnifiedIntelligenceRequest(BaseModel):
    profiles: List[Dict[str, Any]] = Field(default_factory=list)


class DynamicSkillGap(BaseModel):
    skill: str
    status: str = Field(..., description="matched | partially_matched | missing")
    evidence: str = Field(..., description="Direct evidence description or missing notice")
    sourcePlatform: Optional[str] = Field(None, description="Platform source providing evidence")


class EvidenceItem(BaseModel):
    category: str
    title: str
    detail: str
    sourcePlatform: Optional[str] = Field(None, description="Source platform e.g. LinkedIn, GitHub")


class MetricBreakdownItem(BaseModel):
    metric: str
    score: int
    weight: float
    weightedScore: float
    evidence: str


class MetricScore(BaseModel):
    score: int = Field(..., description="Numerical score percentage (0-100)")
    label: str = Field(..., description="Human readable performance rating label")
    calculation: str = Field(..., description="Deterministic mathematical calculation formula string")
    weights: Dict[str, float] = Field(default_factory=dict, description="Metric component weights map")
    breakdown: List[MetricBreakdownItem] = Field(default_factory=list, description="Sub-metric score breakdown")
    evidence: List[EvidenceItem] = Field(default_factory=list, description="Verifiable evidence list")
    confidence: float = Field(0.92, description="Confidence score out of 1.0")
    matchedSkills: List[str] = Field(default_factory=list, description="Verified matched skills list")
    missingSkills: List[str] = Field(default_factory=list, description="Identified missing skills list")


class RoleFitRecommendation(BaseModel):
    role: str
    fitScore: int
    rank: int
    whyFit: List[str] = Field(default_factory=list)
    whatToImprove: List[str] = Field(default_factory=list)


class CandidateJobComparisonResponse(BaseModel):
    candidateName: str
    jobTitle: str
    company: str
    matchScore: MetricScore
    jobReadiness: MetricScore
    skillGaps: List[DynamicSkillGap] = Field(default_factory=list)
    roleFit: Optional[RoleFitRecommendation] = None
    explanationText: str = ""


class CandidateSkillProvenance(BaseModel):
    skill: str
    sourcePlatform: str
    evidence: str


class UnifiedCandidateIntelligence(BaseModel):
    candidateVersion: str
    candidateName: str
    platforms: List[str] = Field(default_factory=list)
    unifiedSkills: List[CandidateSkillProvenance] = Field(default_factory=list)
    unifiedTargetRoles: List[str] = Field(default_factory=list)
    unifiedExperience: List[str] = Field(default_factory=list)
    unifiedProjects: List[str] = Field(default_factory=list)
    unifiedEducation: List[str] = Field(default_factory=list)
    overallReadinessScore: int = 75
    candidateSummary: str = ""


class JobAnalysisSummary(BaseModel):
    company: str
    role: str
    detectedSkills: List[str]
    estimatedDuration: str = "15 Minutes"
    difficulty: str = "Medium-Hard"
    matchScore: Optional[int] = Field(None, description="Job compatibility score percentage")
    readinessScore: Optional[int] = Field(None, description="Interview readiness metric percentage")
    requiredSkills: List[str] = Field(default_factory=list)
    candidateSkills: List[str] = Field(default_factory=list)
    missingSkills: List[str] = Field(default_factory=list)
    candidateVersion: Optional[str] = Field(None, description="Unified Candidate Intelligence Version Hash")
    matchMetricDetails: Optional[MetricScore] = Field(None, description="Complete explainability breakdown for Job Match")
    jobReadinessMetricDetails: Optional[MetricScore] = Field(None, description="Complete explainability breakdown for Job Readiness")
    skillGapDetails: List[DynamicSkillGap] = Field(default_factory=list, description="Per-skill evidence and match status")


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
    matchMetricDetails: Optional[MetricScore] = None
    jobReadinessMetricDetails: Optional[MetricScore] = None
    skillGapDetails: List[DynamicSkillGap] = Field(default_factory=list)


class CandidateProfileAnalysisRequest(BaseModel):
    profileId: str = Field(..., description="Normalized profile identifier e.g. linkedin:garvit-sharma")
    platform: str = Field("linkedin", description="Hiring platform name")
    profileUrl: str = Field(..., description="Canonical profile URL")
    profileContext: Dict[str, Any] = Field(default_factory=dict, description="Extracted profile context")
    geminiApiKey: Optional[str] = Field(None, description="Optional Gemini API key override")


class CandidateProfileAnalysis(BaseModel):
    profileId: str
    profileUrl: str
    profilePlatform: str = "linkedin"
    candidateName: str
    analyzedAt: str
    lastUpdatedAt: str
    analysisVersion: str = "1.0.0"

    headline: Optional[str] = None
    summary: Optional[str] = None
    candidateSummary: Optional[str] = None
    location: Optional[str] = None

    targetRoles: List[Any] = Field(default_factory=list)
    technicalSkills: List[str] = Field(default_factory=list)
    softSkills: List[str] = Field(default_factory=list)
    experience: List[Any] = Field(default_factory=list)
    projects: List[Any] = Field(default_factory=list)
    education: List[Any] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)

    strongSkills: List[str] = Field(default_factory=list)
    developingSkills: List[str] = Field(default_factory=list)
    strongestAreas: List[str] = Field(default_factory=list)
    developmentAreas: List[str] = Field(default_factory=list)
    skillGaps: List[str] = Field(default_factory=list)

    profileHash: Optional[str] = None
    resumeHash: Optional[str] = None
    resumeFileName: Optional[str] = None
    resumeStoragePath: Optional[str] = None
    extractedCharCount: Optional[int] = None
    profileCompleteness: int = Field(0, description="Dynamic completeness score 0-100 derived strictly from resume evidence")

    roleFitRankings: List[RoleFitRecommendation] = Field(default_factory=list)
    profileReadinessScore: Optional[int] = Field(None, description="Profile readiness score out of 100 or None if insufficient data")
    profileSignals: Dict[str, Any] = Field(default_factory=dict)
    analysisStatus: str = "complete"
    errorMessage: Optional[str] = None
    missingEvidence: List[str] = Field(default_factory=list, description="Missing candidate evidence fields")
    evidenceState: str = Field("ANALYZABLE", description="EMPTY | MINIMAL | PARTIAL | ANALYZABLE")



class NormalizedCandidateProfile(BaseModel):
    platform: str = "linkedin"
    profileUrl: str
    profileId: str
    profileHash: Optional[str] = None
    name: str
    headline: Optional[str] = None
    about: Optional[str] = None
    summary: Optional[str] = None
    location: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    experience: List[str] = Field(default_factory=list)
    education: List[str] = Field(default_factory=list)
    projects: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)


class ProfileComparisonRequest(BaseModel):
    profileIds: List[str] = Field(default_factory=list)
    profiles: List[Dict[str, Any]] = Field(default_factory=list)


class ProfileComparisonResult(BaseModel):
    profilesCompared: List[Dict[str, Any]] = Field(default_factory=list)
    profileConsistencyScore: int = Field(78, description="Cross-platform consistency score out of 100")
    breakdown: Dict[str, Any] = Field(default_factory=dict)
    sharedStrengths: List[str] = Field(default_factory=list)
    platformUniqueStrengths: Dict[str, List[str]] = Field(default_factory=dict)
    profileGapNotice: Optional[str] = None
    unifiedSkills: List[str] = Field(default_factory=list)
    unifiedTargetRoles: List[str] = Field(default_factory=list)


class RecommendedJobProfile(BaseModel):
    id: str = Field(..., description="Unique recommendation ID")
    jobTitle: str = Field(..., description="Recommended job role title")
    matchPercentage: int = Field(..., description="Match percentage score e.g. 92")
    whyMatch: str = Field(..., description="Explainable matching rationale string")
    matchingSkills: List[str] = Field(default_factory=list, description="Verified skills from candidate profile matching this role")
    missingSkills: List[str] = Field(default_factory=list, description="Skills candidate needs or could strengthen for this role")
    experienceAlignment: str = Field(..., description="Summary of how candidate experience aligns with role")
    careerFit: str = Field(..., description="Career fit priority: Excellent Match | Strong Match | Good Match")
    description: str = Field(..., description="Short explanation of typical duties in this role")
    resumeStrengths: List[str] = Field(default_factory=list, description="Resume strengths for this role")
    areasToImprove: List[str] = Field(default_factory=list, description="Areas to improve for this role")
    interviewPrepTopics: List[str] = Field(default_factory=list, description="Targeted interview preparation topics")
    suggestedTech: List[str] = Field(default_factory=list, description="Suggested technologies and concepts to prepare")



class JobRecommendationRequest(BaseModel):
    profileAnalysis: Optional[CandidateProfileAnalysis] = Field(None, description="Existing candidate profile analysis")
    profileContext: Optional[Dict[str, Any]] = Field(None, description="Raw or dictionary candidate profile data")
    geminiApiKey: Optional[str] = Field(None, description="Optional Gemini API key override")


class JobRecommendationResponse(BaseModel):
    candidateName: str
    heading: str = "Jobs Recommended For You"
    subheading: str = "Based on your resume, skills, experience and career profile."
    recommendations: List[RecommendedJobProfile] = Field(default_factory=list)
    generatedAt: str = ""
    evidenceCount: int = 0


