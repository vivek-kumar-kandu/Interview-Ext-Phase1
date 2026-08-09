from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.interview import JobDetails, JobAnalysisSummary, CandidateProfile, ProgressMetrics


class ExtensionStatusResponse(BaseModel):
    enabled: bool = True
    version: str = "1.0.0"
    supportedPortals: List[str] = Field(
        default=["linkedin.com", "greenhouse.io", "lever.co", "indeed.com", "glassdoor.com", "workday.com"],
        description="List of supported hiring portal domains"
    )
    message: str = "AI Interview Extension Service is active"


class JobDetectionRequest(BaseModel):
    url: Optional[str] = Field(None, description="URL of the current page viewed by candidate")
    domain: Optional[str] = Field(None, description="Domain name e.g. linkedin.com")
    pageTitle: Optional[str] = Field(None, description="HTML title of the page")
    jobTitle: Optional[str] = Field(None, description="Job title extracted from DOM")
    company: Optional[str] = Field(None, description="Company name extracted from DOM")
    rawDescription: Optional[str] = Field(None, description="Raw job description text extracted from DOM")
    rawContent: Optional[str] = Field(None, description="Scraped raw text snippet or job posting HTML body")
    job: Optional[JobDetails] = Field(None, description="Pre-parsed job details if extracted by extension")
    candidateSkills: Optional[List[str]] = Field(default_factory=list, description="Candidate skills across unified multi-profile intelligence")
    candidateVersion: Optional[str] = Field(None, description="Unified Candidate Intelligence Version Hash")



class ExtensionPopupPrompt(BaseModel):
    title: str = "Job Profile Detected!"
    message: str = "Would you like to start a practice AI technical interview for this role?"
    allowText: str = "Start Interview"
    denyText: str = "Dismiss"
    allowAction: str = "START_INTERVIEW"
    denyAction: str = "IGNORE"


class ExtractedJobPayload(BaseModel):
    url: Optional[str] = Field(None, description="URL of current job posting page")
    title: Optional[str] = Field(None, description="Job Title")
    company: Optional[str] = Field(None, description="Company Name")
    location: Optional[str] = Field(None, description="Job Location")
    description: Optional[str] = Field(None, description="Full or partial raw job description")
    requirements: List[Any] = Field(default_factory=list, description="Explicit job requirements list")
    skills: List[Any] = Field(default_factory=list, description="Extracted required technical/soft skills")
    employmentType: Optional[str] = Field(None, description="Employment type e.g. Full-time, Internship, Remote")
    experienceRequirement: Optional[str] = Field(None, description="Experience requirement e.g. 2+ years")
    educationRequirements: List[Any] = Field(default_factory=list, description="Education requirements e.g. Bachelor's in CS")


class JobDetectionResponse(BaseModel):
    success: bool = Field(True, description="Indicates if detection API call succeeded")
    isJobProfile: bool = Field(..., description="Whether the analyzed page is recognized as a job posting")
    job: Optional[ExtractedJobPayload] = Field(None, description="Actual extracted job payload")
    jobSummary: Optional[JobAnalysisSummary] = None
    prompt: Optional[ExtensionPopupPrompt] = None


class UserConsentRequest(BaseModel):
    sessionId: str = Field(..., description="Unique session ID for the candidate interview")
    userConsent: bool = Field(..., description="True if user clicked Allow / Start Interview on popup")
    job: Optional[JobDetails] = Field(None, description="Job details extracted from page")
    candidate: Optional[CandidateProfile] = Field(None, description="Candidate details if logged in")


class UserConsentResponse(BaseModel):
    sessionStarted: bool = Field(..., description="Indicates if interview session was successfully started")
    sessionId: str
    reply: Optional[str] = None
    jobSummary: Optional[JobAnalysisSummary] = None
    progress: Optional[ProgressMetrics] = None
    message: str



class JobMatchScores(BaseModel):
    overall: int = Field(..., description="Overall job match percentage (0-100)")
    technical: int = Field(..., description="Technical skills alignment percentage (0-100)")
    experience: int = Field(..., description="Experience depth alignment percentage (0-100)")
    education: int = Field(..., description="Education & background alignment percentage (0-100)")
    role: int = Field(..., description="Role title & positioning alignment percentage (0-100)")


class MatchBreakdown(BaseModel):
    skillMatch: int = Field(..., description="Technical skill match percentage (0-100)")
    experienceMatch: int = Field(..., description="Experience alignment percentage (0-100)")
    projectRelevance: int = Field(..., description="Project relevance percentage (0-100)")
    educationMatch: int = Field(..., description="Education match percentage (0-100)")
    keywordAlignment: int = Field(..., description="Keyword alignment percentage (0-100)")



class JobMatchAnalysisRequest(BaseModel):
    candidateProfile: Dict[str, Any] = Field(default_factory=dict, description="Candidate resume profile dictionary")
    job: ExtractedJobPayload = Field(default_factory=ExtractedJobPayload, description="Extracted job payload from current page")
    geminiApiKey: Optional[str] = Field(None, description="Optional Gemini API Key override")


class JobMatchAnalysisResponse(BaseModel):
    success: bool = Field(True, description="Indicates whether matching succeeded")
    jobId: str = Field("", description="Unique MD5/hash identifier for this job posting")
    matchScore: Optional[int] = Field(None, description="Overall match percentage (0-100) or null if insufficient data")
    breakdown: Optional[MatchBreakdown] = Field(None, description="Detailed sub-scores breakdown")
    match: Optional[JobMatchScores] = Field(None, description="Structured match sub-scores breakdown")
    matchedSkills: List[str] = Field(default_factory=list, description="List of skills candidate possesses matching job requirements")
    missingSkills: List[str] = Field(default_factory=list, description="List of skills candidate lacks for job requirements")
    strongMatches: List[str] = Field(default_factory=list, description="Key candidate strengths aligning with role")
    skillGaps: List[Dict[str, Any]] = Field(default_factory=list, description="Dynamic skill gap status breakdown")
    evidence: List[str] = Field(default_factory=list, description="Evidence bullet points supported by candidate profile")
    explanation: str = Field("", description="Human-readable explanation of match score")
    reasoning: str = Field("", description="Detailed explanation text for matching score")
    recommendation: str = Field("", description="Overall fit recommendation e.g. Exceptional Match | Strong Match | Good Match | Potential Fit")
    errorMessage: Optional[str] = Field(None, description="Error message if analysis failed")


