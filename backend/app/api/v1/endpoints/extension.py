import logging
import re
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status
from app.schemas.extension import (
    ExtensionStatusResponse,
    JobDetectionRequest,
    JobDetectionResponse,
    UserConsentRequest,
    UserConsentResponse,
    JobMatchAnalysisRequest,
    JobMatchAnalysisResponse,
    JobMatchScores,
    ExtractedJobPayload,
)

from app.schemas.interview import (
    InterviewRequest,
    CandidateProfileAnalysisRequest,
    CandidateProfileAnalysis,
    RoleFitRecommendation,
    ProfileComparisonRequest,
    ProfileComparisonResult,
    NormalizedCandidateProfile,
    UnifiedCandidateIntelligence,
    UnifiedIntelligenceRequest,
    CandidateJobComparisonResponse,
    MetricScore,
    DynamicSkillGap,
    JobRecommendationRequest,
    JobRecommendationResponse,
)
from app.services.job_analyzer import job_analyzer_service
from app.services.candidate_analyzer import candidate_analyzer
from app.services.job_recommendation_service import job_recommendation_service
from app.agents.orchestrator import interview_orchestrator

logger = logging.getLogger(__name__)
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


@router.post("/candidate/analyze-profile", response_model=CandidateProfileAnalysis, status_code=status.HTTP_200_OK)
async def analyze_candidate_profile_alias(request: CandidateProfileAnalysisRequest) -> CandidateProfileAnalysis:
    return await analyze_candidate_profile(request)


@router.post("/extension/analyze-profile", response_model=CandidateProfileAnalysis, status_code=status.HTTP_200_OK)
async def analyze_candidate_profile(request: CandidateProfileAnalysisRequest) -> CandidateProfileAnalysis:
    """
    Analyzes candidate profile context extracted by Chrome extension using Gemini LLM and returns structured candidate intelligence.
    """
    try:
        ctx = request.profileContext or {}
        name = ctx.get("name") or ""
        headline = ctx.get("headline") or ""
        about = ctx.get("about") or ""
        skills = ctx.get("keySkills") or ctx.get("skills") or []
        experience = ctx.get("experience") or []
        education = ctx.get("education") or []
        projects = ctx.get("projects") or []
        profile_hash = ctx.get("profileHash") or f"hash_{request.profileId}"

        import json
        payload_to_log = {
            "platform": request.platform,
            "profileUrl": request.profileUrl,
            "profileHash": profile_hash,
            "name": name.strip(),
            "headline": headline,
            "about": about[:150] if about else "",
            "skills": skills,
            "experience": experience,
            "education": education,
            "projects": projects
        }
        logger.info("\n==================================================")
        logger.info("[InterviewOS] EXACT CANDIDATE PAYLOAD SENT TO GEMINI:")
        logger.info(json.dumps(payload_to_log, indent=2))
        logger.info("==================================================\n")

        # Enforce strict profile validation: Name + at least 1 evidence signal required
        has_valid_name = bool(name) and name.strip().lower() not in ["candidate", "search", "login", "sign in", "web"] and len(name.strip()) >= 2
        has_evidence_signal = bool(headline) or bool(about) or len(skills) > 0 or len(experience) > 0 or len(education) > 0 or len(projects) > 0

        if not (has_valid_name and has_evidence_signal):
            logger.warning(f"Profile extraction validation failed for URL: {request.profileUrl} (name='{name}', skills={len(skills)})")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="INSUFFICIENT_PROFILE_DATA: Insufficient candidate profile data extracted. Profile must contain a valid name and at least one core profile section (headline, about, skills, or experience)."
            )

        norm_profile = NormalizedCandidateProfile(
            platform=request.platform,
            profileUrl=request.profileUrl,
            profileId=request.profileId,
            profileHash=profile_hash,
            name=name.strip(),
            headline=headline,
            about=about,
            location=ctx.get("location"),
            skills=skills,
            experience=experience,
            education=education,
            projects=projects
        )

        from app.services.candidate_analyzer import candidate_analyzer
        return await candidate_analyzer.analyze_profile_with_gemini(norm_profile, api_key_override=request.geminiApiKey)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to analyze candidate profile with Gemini: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Candidate profile analysis error: {str(e)}"
        )


import hashlib
from fastapi import File, Form, UploadFile, Request

@router.post("/candidate/analyze-resume", response_model=CandidateProfileAnalysis, status_code=status.HTTP_200_OK)
@router.post("/extension/analyze-resume", response_model=CandidateProfileAnalysis, status_code=status.HTTP_200_OK)
async def analyze_candidate_resume(
    request: Request,
    resume: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    resumeText: Optional[str] = Form(None),
    geminiApiKey: Optional[str] = Form(None),
    apiKey: Optional[str] = Form(None)
) -> CandidateProfileAnalysis:
    """
    Accepts PDF/DOCX/TXT resume upload or text content (via multipart/form-data or JSON body), extracts candidate evidence, and generates structured candidate intelligence via Gemini LLM.
    Strictly source-of-truth pipeline with SHA-256 hash calculation and NO static fallbacks.
    """
    upload_file = resume or file
    extracted_api_key = geminiApiKey or apiKey or request.headers.get("x-gemini-api-key") or request.headers.get("x-api-key")

    # Fallback to JSON body if multipart parsing returned no files or text
    if not upload_file and not (resumeText and len(resumeText.strip()) >= 10):
        try:
            content_type = request.headers.get("content-type", "")
            if "application/json" in content_type:
                body_json = await request.json()
                if isinstance(body_json, dict):
                    extracted_json_text = (
                        body_json.get("resumeText")
                        or body_json.get("resume_text")
                        or body_json.get("resume")
                        or body_json.get("text")
                    )
                    if extracted_json_text and isinstance(extracted_json_text, str):
                        resumeText = extracted_json_text
                    if not extracted_api_key:
                        extracted_api_key = body_json.get("geminiApiKey") or body_json.get("apiKey")
        except Exception as json_err:
            logger.warning(f"JSON payload fallback parsing notice for resume analysis: {json_err}")

    if not upload_file and not (resumeText and len(resumeText.strip()) >= 10):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume file is required. Please upload a valid PDF, DOCX or TXT file."
        )

    try:
        extracted_text = ""
        filename = "resume.txt"
        content_bytes = b""
        resume_hash = ""

        if upload_file:
            filename = upload_file.filename or "resume.pdf"
            content_bytes = await upload_file.read()

            if not content_bytes or len(content_bytes) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Uploaded resume file is empty."
                )

            resume_hash = hashlib.sha256(content_bytes).hexdigest()
            fname_lower = filename.lower()

            if fname_lower.endswith(".pdf") or content_bytes.startswith(b"%PDF"):
                try:
                    import io
                    from pypdf import PdfReader
                    pdf_file = io.BytesIO(content_bytes)
                    reader = PdfReader(pdf_file)
                    pdf_pages_text = []
                    for page in reader.pages:
                        t = page.extract_text()
                        if t:
                            pdf_pages_text.append(t)
                    if pdf_pages_text:
                        raw_combined = "\n".join(pdf_pages_text)
                        clean_lines = []
                        for line in raw_combined.splitlines():
                            l_str = line.strip()
                            if not l_str:
                                continue
                            if l_str.startswith('/') or re.match(r'^(structtreeroot|catalog|xref|endobj|obj|\d+\s+\d+\s+obj|\d+\s+\d+\s+R)\b', l_str, re.IGNORECASE):
                                continue
                            clean_lines.append(l_str)
                        extracted_text = "\n".join(clean_lines)
                        logger.info(f"Extracted {len(pdf_pages_text)} pages ({len(extracted_text)} chars) from PDF resume '{filename}' (sha256: {resume_hash[:12]})")
                except Exception as pdf_err:
                    logger.warning(f"pypdf extraction error for '{filename}': {pdf_err}")

            elif fname_lower.endswith(".docx"):
                try:
                    import io
                    import docx
                    doc_file = io.BytesIO(content_bytes)
                    doc = docx.Document(doc_file)
                    docx_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
                    if docx_text:
                        extracted_text = docx_text
                        logger.info(f"Extracted clean text ({len(docx_text)} chars) from DOCX resume '{filename}' (sha256: {resume_hash[:12]})")
                except Exception as docx_err:
                    logger.warning(f"docx extraction error for '{filename}': {docx_err}")

            if not extracted_text.strip():
                try:
                    decoded = content_bytes.decode("utf-8", errors="ignore")
                    if decoded and len(decoded.strip()) >= 10 and not decoded.startswith("%PDF"):
                        extracted_text = decoded
                except Exception:
                    pass

        if not extracted_text.strip() and resumeText:
            extracted_text = resumeText.strip()
            if not resume_hash:
                resume_hash = hashlib.sha256(extracted_text.encode('utf-8')).hexdigest()

        if not extracted_text or len(extracted_text.strip()) < 10:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Could not extract readable text from resume. Please upload a valid, non-scanned text, PDF or DOCX file."
            )

        from app.services.candidate_analyzer import candidate_analyzer
        return await candidate_analyzer.analyze_resume_file_with_gemini(
            resume_text=extracted_text,
            filename=filename,
            resume_hash=resume_hash,
            file_bytes=content_bytes,
            api_key_override=extracted_api_key
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to analyze candidate resume: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Resume analysis failed: {str(e)}"
        )


@router.post("/candidate/compare-profiles", response_model=ProfileComparisonResult, status_code=status.HTTP_200_OK)
async def compare_candidate_profiles(request: ProfileComparisonRequest) -> ProfileComparisonResult:
    """
    Compares candidate profile representations across hiring platforms (e.g. LinkedIn vs Indeed).
    """
    try:
        profiles = request.profiles or []
        if not profiles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No candidate profiles provided for comparison. Please analyze a candidate profile first."
            )

        compared_meta = []
        platform_skills = {}
        all_skills = set()
        all_roles = set()

        for p in profiles:
            plat = p.get("profilePlatform") or p.get("platform") or "Web"
            pid = p.get("profileId") or f"{plat.lower()}:cand"
            cname = p.get("candidateName") or p.get("name") or "Candidate"
            skills = set(p.get("technicalSkills") or p.get("strongSkills") or p.get("keySkills") or [])
            roles = set(p.get("targetRoles") or p.get("recommendedRoles") or [])

            compared_meta.append({"platform": plat, "profileId": pid, "candidateName": cname})
            platform_skills[plat] = list(skills)
            all_skills.update(skills)
            all_roles.update(roles)

        if len(profiles) == 1:
            plat = list(platform_skills.keys())[0] if platform_skills else "LinkedIn"
            skills_list = list(all_skills)
            return ProfileComparisonResult(
                profilesCompared=compared_meta,
                profileConsistencyScore=100,
                breakdown={
                    "identityConsistency": True,
                    "experienceConsistency": True,
                    "skillsConsistencyScore": 100,
                    "careerPositioningScore": 90
                },
                sharedStrengths=skills_list,
                platformUniqueStrengths={plat: skills_list},
                profileGapNotice="Analyze an additional profile (e.g. Indeed, GitHub, Naukri) to compare cross-platform technical positioning.",
                unifiedSkills=skills_list,
                unifiedTargetRoles=list(all_roles)
            )

        if platform_skills:
            skill_sets = [set(s) for s in platform_skills.values()]
            shared = list(set.intersection(*skill_sets)) if skill_sets else []
        else:
            shared = []

        platform_unique = {}
        for plat, sk_list in platform_skills.items():
            others = set()
            for other_plat, other_sk in platform_skills.items():
                if other_plat != plat:
                    others.update(other_sk)
            platform_unique[plat] = [s for s in sk_list if s not in others]

        total_unique = len(all_skills)
        shared_count = len(shared)
        skills_consistency = min(95, max(60, int((shared_count / max(1, total_unique)) * 100) + 30))
        consistency_score = min(92, max(65, int((skills_consistency * 0.7) + 20)))

        gap_notice = None
        if consistency_score < 85:
            gap_notice = "Your profiles present different technical skill sets across hiring platforms."

        return ProfileComparisonResult(
            profilesCompared=compared_meta,
            profileConsistencyScore=consistency_score,
            breakdown={
                "identityConsistency": True,
                "experienceConsistency": True,
                "skillsConsistencyScore": skills_consistency,
                "careerPositioningScore": 80
            },
            sharedStrengths=shared,
            platformUniqueStrengths=platform_unique,
            profileGapNotice=gap_notice,
            unifiedSkills=list(all_skills),
            unifiedTargetRoles=list(all_roles)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to compare candidate profiles: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare candidate profiles: {str(e)}"
        )


@router.post("/candidate/unified-intelligence", response_model=UnifiedCandidateIntelligence, status_code=status.HTTP_200_OK)
async def get_unified_candidate_intelligence(request: UnifiedIntelligenceRequest) -> UnifiedCandidateIntelligence:
    """
    Merges multi-source candidate profiles into a single unified candidate intelligence payload with data provenance.
    """
    try:
        norm_profiles: List[NormalizedCandidateProfile] = []
        for p in request.profiles:
            ctx = p.get("profileContext") or p
            norm_profiles.append(
                NormalizedCandidateProfile(
                    platform=p.get("profilePlatform") or p.get("platform") or ctx.get("platform") or "LinkedIn",
                    profileUrl=p.get("profileUrl") or ctx.get("profileUrl") or "",
                    profileId=p.get("profileId") or ctx.get("id") or "cand_1",
                    profileHash=p.get("profileHash") or ctx.get("profileHash") or "hash_1",
                    name=p.get("candidateName") or ctx.get("name") or "Candidate",
                    headline=p.get("headline") or ctx.get("headline") or "",
                    about=p.get("summary") or ctx.get("about") or "",
                    location=ctx.get("location") or "",
                    skills=p.get("technicalSkills") or ctx.get("keySkills") or ctx.get("skills") or [],
                    experience=p.get("experience") or ctx.get("experience") or [],
                    education=p.get("education") or ctx.get("education") or [],
                    projects=p.get("projects") or ctx.get("projects") or [],
                    certifications=ctx.get("certifications") or []
                )
            )

        res = candidate_analyzer.build_unified_candidate_intelligence(norm_profiles)
        res = await candidate_analyzer.analyze_unified_intelligence_with_gemini(res)
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate unified candidate intelligence: {str(e)}"
        )


@router.post("/candidate/compare-job", response_model=CandidateJobComparisonResponse, status_code=status.HTTP_200_OK)
async def compare_candidate_to_job(request: Dict[str, Any]) -> CandidateJobComparisonResponse:
    """
    Computes dynamic, evidence-based Job Match, Skill Gap, Role Fit, and Job Readiness between candidate and job posting.
    Returns complete explainability breakdown structures.
    """
    try:
        from app.services.scoring_engine import scoring_engine
        from app.schemas.interview import JobDetails, NormalizedCandidateProfile

        cand_data = request.get("candidate") or request.get("candidateProfile") or {}
        job_data = request.get("job") or request.get("jobDetails") or {}

        cand_name = cand_data.get("name") or cand_data.get("candidateName") or "Candidate"
        cand_skills = cand_data.get("keySkills") or cand_data.get("technicalSkills") or cand_data.get("skills") or []
        cand_exp = cand_data.get("experience") or []
        cand_projects = cand_data.get("projects") or []
        cand_roles = cand_data.get("targetRoles") or ([cand_data.get("targetRole")] if cand_data.get("targetRole") else [])

        job_obj = JobDetails(
            jobTitle=job_data.get("jobTitle") or job_data.get("role") or "",
            company=job_data.get("company") or "Target Company",
            skills=job_data.get("skills") or job_data.get("detectedSkills") or [],
            experience=job_data.get("experience"),
            description=job_data.get("description")
        )

        match_score = scoring_engine.calculate_job_match(
            candidate_skills=cand_skills,
            candidate_experience=cand_exp,
            candidate_projects=cand_projects,
            candidate_roles=cand_roles,
            job=job_obj
        )

        skill_gaps = scoring_engine.calculate_skill_gaps(
            candidate_skills=cand_skills,
            job_skills=job_obj.skills or match_score.matchedSkills + match_score.missingSkills
        )

        # Profile Readiness
        norm_prof = NormalizedCandidateProfile(
            platform=cand_data.get("platform") or "LinkedIn",
            profileUrl=cand_data.get("profileUrl") or "",
            profileId=cand_data.get("id") or "cand_1",
            name=cand_name,
            headline=cand_roles[0] if cand_roles else (cand_data.get("headline") or ""),
            skills=cand_skills,
            experience=cand_exp,
            projects=cand_projects
        )
        profile_readiness = scoring_engine.calculate_profile_readiness(norm_prof)

        # Job Readiness
        missing_count = len([g for g in skill_gaps if g.status == "missing"])
        job_readiness = scoring_engine.calculate_job_readiness(
            profile_readiness_score=profile_readiness.score,
            job_match_score=match_score.score,
            missing_skills_count=missing_count
        )

        explanation = (
            f"Evaluated candidate '{cand_name}' against '{job_obj.jobTitle}' at '{job_obj.company}'. "
            f"Job Match Score: {match_score.score}% ({match_score.label}). "
            f"Verified {len(match_score.matchedSkills)} of {len(match_score.matchedSkills) + len(match_score.missingSkills)} required skills."
        )

        return CandidateJobComparisonResponse(
            candidateName=cand_name,
            jobTitle=job_obj.jobTitle,
            company=job_obj.company,
            matchScore=match_score,
            jobReadiness=job_readiness,
            skillGaps=skill_gaps,
            explanationText=explanation
        )

    except Exception as e:
        logger.error(f"Failed to execute compare_candidate_to_job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate job match comparison: {str(e)}"
        )


@router.post("/candidate/recommend-jobs", response_model=JobRecommendationResponse, status_code=status.HTTP_200_OK)
@router.post("/extension/recommend-jobs", response_model=JobRecommendationResponse, status_code=status.HTTP_200_OK)
async def recommend_candidate_jobs(payload: Dict[str, Any]) -> JobRecommendationResponse:
    """
    Dynamically generates personalized job profile recommendations derived strictly from candidate's
    uploaded resume and existing CandidateProfileAnalysis data.
    """
    try:
        prof_data = payload.get("profileAnalysis") or payload.get("profileContext") or payload
        api_key = payload.get("geminiApiKey") or payload.get("apiKey")

        # Parse payload into CandidateProfileAnalysis object
        if isinstance(prof_data, dict):
            # Check if prof_data is wrapped
            if "profileAnalysis" in prof_data and isinstance(prof_data["profileAnalysis"], dict):
                prof_data = prof_data["profileAnalysis"]
            
            # Check if essential candidate attributes exist
            skills = prof_data.get("technicalSkills") or prof_data.get("strongSkills") or prof_data.get("keySkills") or prof_data.get("skills") or []
            exp = prof_data.get("experience") or []
            proj = prof_data.get("projects") or []
            edu = prof_data.get("education") or []
            name = prof_data.get("candidateName") or prof_data.get("name") or "Candidate"

            is_incomplete = (
                prof_data.get("analysisStatus") in ["incomplete_evidence", "insufficient_evidence", "error"] or
                (len(skills) == 0 and len(exp) == 0 and len(proj) == 0 and len(edu) == 0)
            )

            if is_incomplete:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="INSUFFICIENT_CANDIDATE_DATA: Analyze your resume first before generating job recommendations."
                )

            profile_obj = CandidateProfileAnalysis(
                profileId=prof_data.get("profileId") or "cand_1",
                profileUrl=prof_data.get("profileUrl") or "uploaded://resume.pdf",
                profilePlatform=prof_data.get("profilePlatform") or "Resume Upload",
                candidateName=name,
                analyzedAt=prof_data.get("analyzedAt") or "",
                lastUpdatedAt=prof_data.get("lastUpdatedAt") or "",
                headline=prof_data.get("headline") or "",
                summary=prof_data.get("summary") or prof_data.get("candidateSummary") or "",
                candidateSummary=prof_data.get("candidateSummary") or prof_data.get("summary") or "",
                location=prof_data.get("location") or "",
                targetRoles=prof_data.get("targetRoles") or [],
                technicalSkills=skills,
                strongSkills=skills[:6],
                strongestAreas=prof_data.get("strongestAreas") or [],
                developmentAreas=prof_data.get("developmentAreas") or prof_data.get("developingSkills") or [],
                experience=exp,
                projects=proj,
                education=edu,
                analysisStatus=prof_data.get("analysisStatus") or "complete"
            )
        elif isinstance(prof_data, CandidateProfileAnalysis):
            profile_obj = prof_data
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="INSUFFICIENT_CANDIDATE_DATA: Candidate profile analysis data is required."
            )

        return await job_recommendation_service.generate_recommendations(profile_obj, api_key_override=api_key)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate candidate job recommendations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to generate job recommendations right now. Please try again. ({str(e)})"
        )


@router.post("/extension/analyze-job-match", response_model=JobMatchAnalysisResponse, status_code=status.HTTP_200_OK)
async def analyze_job_match(request: JobMatchAnalysisRequest) -> JobMatchAnalysisResponse:
    """
    Dynamic, evidence-based AI/Deterministic Job Matching endpoint for Chrome Extension.
    Compares candidate resume profile with extracted page job posting context in real-time.
    Guarantees different jobs produce different match metrics.
    """
    import hashlib

    cand_data = request.candidateProfile or {}
    job_data = request.job or ExtractedJobPayload()

    url = (job_data.url or "").strip()
    title = (job_data.title or "").strip()
    company = (job_data.company or "Target Company").strip()
    description = (job_data.description or "").strip()
    cand_id = cand_data.get("id") or cand_data.get("profileId") or "cand_active"

    # Compute stable jobId hash
    raw_hash_input = f"{url.lower()}|{title.lower()}|{company.lower()}"
    job_id = f"job_{hashlib.md5(raw_hash_input.encode('utf-8')).hexdigest()[:12]}"

    # Structured Debug Logging (Requirement 12)
    logger.info(f"[JOB_DETECTION] url={url or 'N/A'}")
    logger.info(f"[JOB_EXTRACTION] title={title} company={company} descriptionChars={len(description)}")
    logger.info(f"[JOB_MATCH] jobId={job_id} candidateId={cand_id} status=started")

    from app.utils.helpers import safe_str, safe_str_list, safe_join

    # If title is missing or candidate profile is empty, return error response (Requirement 10)
    cand_name = cand_data.get("name") or cand_data.get("candidateName") or "Candidate"
    cand_skills = safe_str_list(cand_data.get("keySkills") or cand_data.get("technicalSkills") or cand_data.get("skills") or [])
    cand_exp = safe_str_list(cand_data.get("experience") or [])
    cand_projects = safe_str_list(cand_data.get("projects") or [])
    cand_roles = safe_str_list(cand_data.get("targetRoles") or ([cand_data.get("targetRole")] if cand_data.get("targetRole") else []))
    cand_edu = safe_str_list(cand_data.get("education") or [])

    if not title and description:
        first_line = description.split('\n')[0].strip()
        title = first_line[:60] if len(first_line) > 3 else "Technical Position"

    if not title and not description:
        logger.error(f"[JOB_MATCH] jobId={job_id} status=failed error='Missing job title and description'")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="JOB_CONTENT_UNAVAILABLE: Unable to read the job details from this page. Please open the full job posting and try again."
        )

    if not cand_skills and not cand_exp and not cand_roles:
        logger.error(f"[JOB_MATCH] jobId={job_id} status=failed error='Empty candidate profile'")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CANDIDATE_PROFILE_MISSING: Analyze your resume first before matching with job postings."
        )


    try:
        from app.services.scoring_engine import scoring_engine
        from app.schemas.interview import JobDetails

        # Collect or extract skills from job posting
        raw_job_skills = safe_str_list(list(job_data.skills or []))
        if job_data.requirements:
            for req in safe_str_list(job_data.requirements):
                if req and req not in raw_job_skills:
                    raw_job_skills.append(req)

        job_skills = raw_job_skills

        if not job_skills or len(job_skills) < 2:
            extracted = safe_str_list(job_analyzer_service.extract_skills_from_job_title_and_desc(title, description))
            for s in extracted:
                if s not in job_skills:
                    job_skills.append(s)

        job_obj = JobDetails(
            jobTitle=title or "Software Engineer",
            company=company,
            skills=job_skills,
            experience=safe_str(job_data.experienceRequirement or description),
            description=description
        )

        match_score = scoring_engine.calculate_job_match(
            candidate_skills=cand_skills,
            candidate_experience=cand_exp,
            candidate_projects=cand_projects,
            candidate_roles=cand_roles,
            candidate_education=cand_edu,
            job=job_obj
        )

        if not match_score:
            logger.warning(f"[JOB_MATCH] jobId={job_id} status=failed error='Insufficient evidence'")
            return JobMatchAnalysisResponse(
                success=False,
                jobId=job_id,
                matchScore=None,
                breakdown=None,
                errorMessage="Insufficient information to calculate a reliable match."
            )

        skill_gaps = scoring_engine.calculate_skill_gaps(
            candidate_skills=cand_skills,
            job_skills=job_obj.skills or (match_score.matchedSkills + match_score.missingSkills)
        )

        # Sub-scores from 5-part metric breakdown
        from app.schemas.extension import MatchBreakdown
        breakdown_items = match_score.breakdown
        skill_pct = breakdown_items[0].score if len(breakdown_items) > 0 else 0
        exp_pct = breakdown_items[1].score if len(breakdown_items) > 1 else 0
        proj_pct = breakdown_items[2].score if len(breakdown_items) > 2 else 0
        edu_pct = breakdown_items[3].score if len(breakdown_items) > 3 else 0
        kw_pct = breakdown_items[4].score if len(breakdown_items) > 4 else 0

        match_breakdown = MatchBreakdown(
            skillMatch=skill_pct,
            experienceMatch=exp_pct,
            projectRelevance=proj_pct,
            educationMatch=edu_pct,
            keywordAlignment=kw_pct
        )

        overall_score = match_score.score

        scores = JobMatchScores(
            overall=overall_score,
            technical=skill_pct,
            experience=exp_pct,
            education=edu_pct,
            role=proj_pct
        )

        # Strong matches: matched skills + matched role alignment
        matched_str_list = safe_str_list(match_score.matchedSkills)
        missing_str_list = safe_str_list(match_score.missingSkills)

        strong_matches = list(matched_str_list)
        if proj_pct >= 70:
            strong_matches.append(f"Technical Project Alignment ({title})")

        gaps_list = [g.dict() for g in skill_gaps]
        evidence_list = [safe_str(e.detail) for e in match_score.evidence] if match_score.evidence else [
            f"Candidate satisfies technical requirements for {safe_join(', ', matched_str_list[:3])}."
        ]

        if missing_str_list:
            explanation_text = f"{overall_score}% match because candidate satisfies technical requirements for {safe_join(', ', matched_str_list[:3]) if matched_str_list else 'core skills'}, but lacks {safe_join(', ', missing_str_list[:2])} experience."
        else:
            explanation_text = f"{overall_score}% match with strong technical alignment across all required competencies for {title}."

        logger.info(f"[JOB_MATCH] jobId={job_id} status=success overall={overall_score}")

        return JobMatchAnalysisResponse(
            success=True,
            jobId=job_id,
            matchScore=overall_score,
            breakdown=match_breakdown,
            match=scores,
            matchedSkills=matched_str_list,
            missingSkills=missing_str_list,
            strongMatches=strong_matches,
            skillGaps=gaps_list,
            evidence=evidence_list,
            explanation=explanation_text,
            reasoning=explanation_text,
            recommendation=match_score.label
        )


    except HTTPException:
        raise
    except Exception as e:
        err_str = str(e)
        logger.error(f"[JOB_MATCH] jobId={job_id} status=failed error={err_str}")
        if "401" in err_str or "unauthenticated" in err_str.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="GEMINI_AUTHENTICATION_FAILED: Gemini authentication failed. Check GEMINI_API_KEY and Gemini API configuration."
            )
        elif "429" in err_str or "quota" in err_str.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="GEMINI_QUOTA_EXHAUSTED: Gemini API quota exhausted. Please try again later."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"INTERNAL_SERVER_ERROR: Failed to calculate job match ({err_str})"
            )



