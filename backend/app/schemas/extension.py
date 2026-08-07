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
    pageTitle: Optional[str] = Field(None, description="HTML title of the page")
    rawContent: Optional[str] = Field(None, description="Scraped raw text snippet or job posting HTML body")
    job: Optional[JobDetails] = Field(None, description="Pre-parsed job details if extracted by extension")


class ExtensionPopupPrompt(BaseModel):
    title: str = "Job Profile Detected!"
    message: str = "Would you like to start a practice AI technical interview for this role?"
    allowText: str = "Start Interview"
    denyText: str = "Dismiss"
    allowAction: str = "START_INTERVIEW"
    denyAction: str = "IGNORE"


class JobDetectionResponse(BaseModel):
    isJobProfile: bool = Field(..., description="Whether the analyzed page is recognized as a job posting")
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
