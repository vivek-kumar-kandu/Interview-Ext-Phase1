import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from app.schemas.interview import (
    CandidateProfile,
    CandidateProfileAnalysis,
    RoleFitRecommendation,
    NormalizedCandidateProfile,
    CandidateSkillProvenance,
    UnifiedCandidateIntelligence,
    ResumeAnalysis,
    Candidate,
    Experience,
    Education,
    Project
)
from app.services.curriculum_service import curriculum_service
from app.utils.llm import get_llm
from app.config import settings

logger = logging.getLogger(__name__)


def cyrb53_hash(str_val: str, seed: int = 0) -> str:
    h1 = 0xdeadbeef ^ seed
    h2 = 0x41c6ce57 ^ seed
    for ch in str_val:
        code = ord(ch)
        h1 = ((h1 ^ code) * 2654435761) & 0xFFFFFFFF
        h2 = ((h2 ^ code) * 1597334677) & 0xFFFFFFFF
    h1 = (((h1 ^ (h1 >> 16)) * 2246822507) ^ ((h2 ^ (h2 >> 13)) * 3266489909)) & 0xFFFFFFFF
    h2 = (((h2 ^ (h2 >> 16)) * 2246822507) ^ ((h1 ^ (h1 >> 13)) * 3266489909)) & 0xFFFFFFFF
    val = (4294967296 * (2097151 & h2) + h1)
    return hex(val)[2:]


class CandidateAnalyzer:
    """
    Analyzes candidate profile signals and generates structured intelligence.
    Integrates Gemini LLM for dynamic candidate profile intelligence generation.
    """

    def __init__(self):
        self._resume_cache: Dict[str, CandidateProfileAnalysis] = {}

    def evaluate_profile_evidence(self, profile: NormalizedCandidateProfile) -> Dict[str, Any]:
        has_name = bool(profile.name and len(profile.name.strip()) > 1 and profile.name.strip().lower() not in ["candidate", "search", "login"])
        has_headline = bool(profile.headline and len(profile.headline.strip()) > 3)
        has_about = bool(profile.about and len(profile.about.strip()) > 10)
        has_skills = bool(profile.skills and len(profile.skills) > 0)
        has_experience = bool(profile.experience and len(profile.experience) > 0)
        has_education = bool(profile.education and len(profile.education) > 0)
        has_projects = bool(profile.projects and len(profile.projects) > 0)

        evidence_count = sum([has_about, has_skills, has_experience, has_education, has_projects])

        missing_evidence = []
        if not has_skills:
            missing_evidence.append("skills")
        if not has_experience:
            missing_evidence.append("experience")
        if not has_education:
            missing_evidence.append("education")
        if not has_projects:
            missing_evidence.append("projects")

        if not has_name or (not has_headline and evidence_count == 0):
            state = "EMPTY"
        elif evidence_count == 0:
            state = "MINIMAL"
        elif evidence_count == 1 and not (has_skills or has_experience):
            state = "PARTIAL"
        else:
            state = "ANALYZABLE"

        return {
            "hasName": has_name,
            "hasHeadline": has_headline,
            "hasAbout": has_about,
            "hasSkills": has_skills,
            "hasExperience": has_experience,
            "hasEducation": has_education,
            "hasProjects": has_projects,
            "evidenceCount": evidence_count,
            "evidenceState": state,
            "missingEvidence": missing_evidence,
            "isAnalyzable": state == "ANALYZABLE"
        }

    def _calculate_base_readiness_score(self, profile: NormalizedCandidateProfile) -> Optional[int]:
        eval_res = self.evaluate_profile_evidence(profile)
        if not eval_res["isAnalyzable"]:
            return None

        score = 40
        if profile.headline and len(profile.headline.strip()) > 3:
            score += 10
        if profile.about and len(profile.about.strip()) > 15:
            score += 10
        if profile.location and len(profile.location.strip()) > 2:
            score += 5
        if profile.skills:
            score += min(15, len(profile.skills) * 3)
        if profile.experience:
            score += min(10, len(profile.experience) * 2)
        if profile.education:
            score += min(5, len(profile.education) * 2)
        if profile.projects:
            score += min(5, len(profile.projects) * 2)
        return min(98, max(45, score))

    async def analyze_profile_with_gemini(
        self, profile: NormalizedCandidateProfile, api_key_override: Optional[str] = None
    ) -> CandidateProfileAnalysis:
        now_str = datetime.now(timezone.utc).strftime("%b %d, %Y")

        eval_res = self.evaluate_profile_evidence(profile)
        if not eval_res["isAnalyzable"]:
            logger.warning(f"Profile {profile.profileId} has insufficient evidence ({eval_res['evidenceState']}). Blocking Gemini analysis.")
            return CandidateProfileAnalysis(
                profileId=profile.profileId,
                profileUrl=profile.profileUrl,
                profilePlatform=profile.platform,
                candidateName=profile.name or "Candidate",
                analyzedAt=now_str,
                lastUpdatedAt=now_str,
                headline=profile.headline,
                summary="Not enough profile information is available for a reliable career analysis. Please add skills, work experience, or education to unlock AI recommendations.",
                targetRoles=[],
                technicalSkills=profile.skills,
                experience=profile.experience,
                education=profile.education,
                projects=profile.projects,
                strongSkills=profile.skills,
                developingSkills=[],
                skillGaps=eval_res["missingEvidence"],
                profileHash=profile.profileHash,
                roleFitRankings=[],
                profileReadinessScore=None,
                analysisStatus="insufficient_evidence",
                errorMessage=f"Analysis blocked: Insufficient profile evidence ({eval_res['evidenceState']}). Missing: {', '.join(eval_res['missingEvidence'])}",
                missingEvidence=eval_res["missingEvidence"],
                evidenceState=eval_res["evidenceState"]
            )

        # Build list of Gemini API keys to try
        keys_to_try = []
        if api_key_override and api_key_override.strip():
            keys_to_try.append(api_key_override.strip())
        for k in settings.GEMINI_API_KEYS:
            if k and k.strip() and k.strip() not in keys_to_try:
                keys_to_try.append(k.strip())

        preferred_model = settings.GEMINI_MODEL
        models_to_try = [preferred_model]

        base_readiness = self._calculate_base_readiness_score(profile)

        system_instruction = (
            "You are an evidence-bound career analysis engine.\n"
            "You may ONLY use facts explicitly present in the supplied candidate profile.\n"
            "Never infer or invent skills, technologies, job titles, companies, experience, education, certifications, projects, or achievements.\n"
            "If a field is empty, treat it as unknown.\n"
            "Never fill missing fields using general knowledge or assumptions.\n"
            "A target role can ONLY be generated when there is explicit supporting evidence in the profile.\n"
            "Every roleFitRanking item must list whyFit citing explicit evidence from the supplied profile.\n"
            "Return structured JSON only."
        )

        from app.utils.helpers import safe_str_list

        skills_text = ", ".join(safe_str_list(profile.skills)) if profile.skills else "None extracted from page"
        exp_text = "; ".join(safe_str_list(profile.experience)) if profile.experience else "None extracted from page"
        edu_text = "; ".join(safe_str_list(profile.education)) if profile.education else "None extracted from page"
        proj_text = "; ".join(safe_str_list(profile.projects)) if profile.projects else "None extracted from page"

        prompt = (
            f"EXACT CANDIDATE PROFILE DATA TO ANALYZE:\n"
            f"- Candidate Name: {profile.name}\n"
            f"- Headline: {profile.headline or 'Not specified'}\n"
            f"- Platform: {profile.platform}\n"
            f"- About / Summary: {profile.about or 'Not specified'}\n"
            f"- Location: {profile.location or 'Not specified'}\n"
            f"- Technical Skills: {skills_text}\n"
            f"- Work Experience: {exp_text}\n"
            f"- Education: {edu_text}\n"
            f"- Projects: {proj_text}\n"
            f"- Computed Evidence Base Readiness Score: {base_readiness}\n\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. You are analyzing this exact candidate. Use ONLY the supplied candidate evidence.\n"
            "2. Write a 2-4 sentence personalized summary answering: Who is this candidate? What are their strongest demonstrated capabilities? What roles can they realistically target based strictly on evidence? What is their primary growth opportunity?\n"
            "3. Determine 2-4 realistic target roles derived directly from their actual headline, skills, and experience. For each role, calculate a fitScore (60 to 98) based on evidence, rank (1, 2, 3...), list whyFit evidence from profile, and whatToImprove skill gaps.\n"
            f"4. Calculate profileReadinessScore (60 to 98). Use {base_readiness} as the base, allowing up to +/- 5 points qualitative adjustment based on evidence depth.\n"
            "5. List strongSkills present in candidate profile and developingSkills needed for target role advancement.\n\n"
            "Return ONLY a valid JSON object matching this schema format:\n"
            "{\n"
            f'  "headline": "{profile.headline or ""}",\n'
            '  "summary": "2-4 sentence personalized evidence-based summary...",\n'
            f'  "profileReadinessScore": {base_readiness},\n'
            '  "strongSkills": ["..."],\n'
            '  "developingSkills": ["..."],\n'
            '  "recommendedRoles": ["..."],\n'
            '  "roleFitRankings": [\n'
            '    {\n'
            '      "role": "Derived Role 1",\n'
            '      "fitScore": 88,\n'
            '      "rank": 1,\n'
            '      "whyFit": ["Evidence from profile"],\n'
            '      "whatToImprove": ["Specific skill gap"]\n'
            '    }\n'
            '  ]\n'
            '}\n'
        )

        from langchain_core.messages import SystemMessage, HumanMessage

        last_error = None
        is_quota_exhausted = False
        parsed_profile_res = None
        used_model_name = settings.GEMINI_MODEL

        import time
        for key_idx, gemini_key in enumerate(keys_to_try):
            for model_name in models_to_try:
                llm = get_llm(temperature=0.2, model_name=model_name, api_key_override=gemini_key)
                if not llm:
                    continue

                t0 = time.time()
                key_fp = settings.get_key_fingerprint(gemini_key)
                input_chars = len(system_instruction) + len(prompt)
                logger.info(f"[GEMINI_REQUEST] model={model_name} operation=profile_analysis input_chars={input_chars} key_fingerprint={key_fp}")

                try:
                    response = await llm.ainvoke([
                        SystemMessage(content=system_instruction),
                        HumanMessage(content=prompt)
                    ])
                    duration_ms = int((time.time() - t0) * 1000)
                    logger.info(f"[GEMINI_RESPONSE] status=success duration_ms={duration_ms} model={model_name}")

                    import re
                    text = str(response.content).strip()
                    json_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
                    if json_match:
                        text = json_match.group(1).strip()
                    else:
                        brace_match = re.search(r'\{[\s\S]*\}', text)
                        if brace_match:
                            text = brace_match.group(0).strip()

                    parsed = json.loads(text)
                    from app.services.resume_pipeline import classify_skills, is_valid_target_role
                    
                    classified = classify_skills(profile.skills or [])
                    tech_skills = classified["technicalSkills"]
                    soft_skills = classified["softSkills"]

                    profile_ev = {"technicalSkills": tech_skills, "experience": profile.experience}

                    raw_rec_roles = parsed.get("recommendedRoles") or []
                    rec_roles = [r for r in raw_rec_roles if is_valid_target_role(r, profile_ev)]
                    
                    if not rec_roles and profile.headline and is_valid_target_role(profile.headline, profile_ev):
                        rec_roles = [profile.headline]

                    role_fit_rankings = [
                        RoleFitRecommendation(
                            role=r.get("role") or "Target Role",
                            fitScore=int(r.get("fitScore", base_readiness or 75)),
                            rank=idx + 1,
                            whyFit=r.get("whyFit") or (tech_skills[:3] if tech_skills else []),
                            whatToImprove=r.get("whatToImprove") or []
                        )
                        for idx, r in enumerate(parsed.get("roleFitRankings", []))
                        if is_valid_target_role(r.get("role") or "", profile_ev)
                    ]

                    logger.info(f"[GEMINI] Successfully generated candidate analysis with Gemini model: {model_name}")
                    parsed_profile_res = CandidateProfileAnalysis(
                        profileId=profile.profileId,
                        profileUrl=profile.profileUrl,
                        profilePlatform=profile.platform,
                        profileHash=profile.profileHash,
                        candidateName=profile.name,
                        analyzedAt=now_str,
                        lastUpdatedAt=now_str,
                        analysisVersion=f"3.0.0-gemini-{model_name}",
                        headline=parsed.get("headline") or profile.headline or "",
                        summary=parsed.get("summary") or f"Profile analyzed for {profile.name}.",
                        targetRoles=rec_roles,
                        technicalSkills=tech_skills,
                        strongSkills=tech_skills[:6],
                        softSkills=soft_skills,
                        developingSkills=parsed.get("developingSkills") or [],
                        skillGaps=parsed.get("developingSkills") or [],
                        recommendedRoles=rec_roles,
                        roleFitRankings=role_fit_rankings,
                        profileReadinessScore=int(parsed.get("profileReadinessScore") or base_readiness or 75),
                        analysisStatus="complete"
                    )
                    break
                except Exception as e:
                    duration_ms = int((time.time() - t0) * 1000)
                    err_str = str(e)
                    last_error = e
                    if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str or "quota" in err_str.lower():
                        is_quota_exhausted = True
                        logger.error(f"[GEMINI_ERROR] status=429 error=RESOURCE_EXHAUSTED model={model_name} duration_ms={duration_ms} key_fingerprint={key_fp}")
                        break
                    elif "NOT_FOUND" in err_str or "404" in err_str:
                        logger.warning(f"[GEMINI_ERROR] status=404 model='{model_name}' unavailable. Trying next model...")
                    else:
                        logger.warning(f"[GEMINI_ERROR] status=failed error={err_str[:100]} model={model_name} duration_ms={duration_ms}")

            if parsed_profile_res:
                return parsed_profile_res

        if settings.OPENAI_API_KEY:
            try:
                logger.info(f"Attempting OpenAI LLM fallback ({settings.OPENAI_MODEL}) for candidate profile analysis.")
                openai_llm = get_llm(temperature=0.2, provider="openai")
                if openai_llm:
                    response = await openai_llm.ainvoke([
                        SystemMessage(content=system_instruction),
                        HumanMessage(content=prompt)
                    ])
                    import re
                    text = str(response.content).strip()
                    json_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
                    if json_match:
                        text = json_match.group(1).strip()
                    else:
                        brace_match = re.search(r'\{[\s\S]*\}', text)
                        if brace_match:
                            text = brace_match.group(0).strip()

                    parsed = json.loads(text)
                    role_fit_rankings = [
                        RoleFitRecommendation(
                            role=r.get("role") or profile.headline or "Target Role",
                            fitScore=int(r.get("fitScore", base_readiness)),
                            rank=idx + 1,
                            whyFit=r.get("whyFit") or (profile.skills[:3] if profile.skills else []),
                            whatToImprove=r.get("whatToImprove") or []
                        )
                        for idx, r in enumerate(parsed.get("roleFitRankings", []))
                    ]

                    rec_roles = parsed.get("recommendedRoles") or [r.role for r in role_fit_rankings]
                    if not rec_roles:
                        rec_roles = [profile.headline] if profile.headline else []

                    logger.info(f"Successfully generated candidate analysis with OpenAI model: {settings.OPENAI_MODEL}")
                    return CandidateProfileAnalysis(
                        profileId=profile.profileId,
                        profileUrl=profile.profileUrl,
                        profilePlatform=profile.platform,
                        profileHash=profile.profileHash,
                        candidateName=profile.name,
                        analyzedAt=now_str,
                        lastUpdatedAt=now_str,
                        analysisVersion=f"2.0.0-openai-{settings.OPENAI_MODEL}",
                        headline=parsed.get("headline") or profile.headline or "",
                        summary=parsed.get("summary") or f"Profile analyzed for {profile.name}.",
                        targetRoles=rec_roles,
                        technicalSkills=profile.skills,
                        strongSkills=parsed.get("strongSkills") or profile.skills[:6],
                        developingSkills=parsed.get("developingSkills") or [],
                        skillGaps=parsed.get("developingSkills") or [],
                        recommendedRoles=rec_roles,
                        roleFitRankings=role_fit_rankings,
                        profileReadinessScore=int(parsed.get("profileReadinessScore") or base_readiness or 75),
                        analysisStatus="complete"
                    )
            except Exception as openai_err:
                logger.warning(f"OpenAI LLM fallback failed for profile analysis: {openai_err}")

        logger.info("[PROFILE_FALLBACK] Serving evidence-based profile intelligence directly from candidate profile evidence.")
        return self._analyze_profile_evidence_based(
            profile=profile,
            now_str=now_str,
            error_detail=str(last_error) if last_error else "LLM quota unavailable"
        )



    def _analyze_profile_evidence_based(
        self, profile: NormalizedCandidateProfile, now_str: str, error_detail: Optional[str] = None
    ) -> CandidateProfileAnalysis:
        skills = profile.skills or []
        headline = profile.headline or ""
        target_roles = [headline] if headline else []
        base_readiness = self._calculate_base_readiness_score(profile)

        role_rankings = [
            RoleFitRecommendation(
                role=role_name,
                fitScore=base_readiness or 70,
                rank=idx + 1,
                whyFit=skills[:3] if skills else ([headline] if headline else ["Profile evidence"]),
                whatToImprove=[]
            )
            for idx, role_name in enumerate(target_roles)
        ]

        summary = (
            f"Evidence-based candidate summary for {profile.name}. "
            f"Demonstrated competencies: {', '.join(skills[:5]) if skills else 'Not specified'}. "
            f"Target direction: {headline or 'Not specified'}."
        )

        msg = "Gemini API rate limit reached (429). Fast-tracked via exact profile evidence." if error_detail and ("429" in error_detail or "RESOURCE_EXHAUSTED" in error_detail) else f"Gemini notice: {error_detail[:150] if error_detail else 'Fast-tracked'}"

        return CandidateProfileAnalysis(
            profileId=profile.profileId,
            profileUrl=profile.profileUrl,
            profilePlatform=profile.platform,
            profileHash=profile.profileHash,
            candidateName=profile.name or "Candidate",
            analyzedAt=now_str,
            lastUpdatedAt=now_str,
            analysisVersion="2.0.0-evidence-signal",
            headline=headline,
            summary=summary,
            location=profile.location,
            targetRoles=target_roles,
            technicalSkills=skills,
            strongSkills=skills[:6],
            developingSkills=[],
            experience=profile.experience,
            education=profile.education,
            projects=profile.projects,
            certifications=profile.certifications,
            profileCompleteness=base_readiness or 0,
            profileReadinessScore=base_readiness,
            roleFitRankings=role_rankings,
            analysisStatus="complete",
            errorMessage=msg
        )


    async def analyze_resume_file_with_gemini(
        self,
        resume_text: str,
        filename: str = "resume.pdf",
        resume_hash: Optional[str] = None,
        file_bytes: Optional[bytes] = None,
        api_key_override: Optional[str] = None
    ) -> CandidateProfileAnalysis:
        """
        Parses raw resume text via Gemini LLM using a Compact Smart Resume Analysis Engine.
        Enforces strict source-of-truth evidence, SHA-256 caching, and deterministic post-processing.
        """
        import hashlib
        import json
        import re
        from app.services.resume_pipeline import (
            normalize_resume_text,
            extract_contact_and_entities,
            sanitize_and_validate_candidate
        )

        now_str = datetime.now(timezone.utc).strftime("%b %d, %Y")
        
        logger.info("[RESUME] Upload received")
        logger.info(f"[RESUME] File name: {filename}")
        
        # Step 1: Text Normalization
        norm_text = normalize_resume_text(resume_text)
        logger.info(f"[RESUME] Extracted normalized text length: {len(norm_text)}")

        # Step 2: SHA-256 Hash Calculation & Cache Check
        if not resume_hash:
            if file_bytes:
                resume_hash = hashlib.sha256(file_bytes).hexdigest()
            else:
                resume_hash = hashlib.sha256(norm_text.encode('utf-8')).hexdigest()

        if resume_hash and resume_hash in self._resume_cache:
            logger.info(f"[RESUME_CACHE] Cache hit for resumeHash: {resume_hash[:12]}. Serving cached candidate analysis.")
            return self._resume_cache[resume_hash]

        # Step 3: Deterministic Entity Extraction Before Gemini
        extracted_contact = extract_contact_and_entities(norm_text)

        # Build list of Gemini API keys to try
        keys_to_try = []
        if api_key_override and api_key_override.strip():
            keys_to_try.append(api_key_override.strip())
        for k in settings.GEMINI_API_KEYS:
            if k not in keys_to_try:
                keys_to_try.append(k)

        system_instruction = (
            "You are InterviewOS Resume Intelligence Engine.\n"
            "Your task is to extract structured candidate information from the supplied resume.\n"
            "The uploaded resume is the ONLY source of truth. DO NOT fabricate information.\n"
            "DO NOT inject default skills, experience, education, projects, or roles.\n"
            "If evidence is absent from the resume, return an empty array [] or empty string.\n\n"
            "CRITICAL RULES:\n"
            "1. candidateSummary MUST be 2-3 concise sentences answering: Who is candidate, strongest areas, realistic career direction.\n"
            "2. technicalSkills must contain ONLY technologies explicitly supported by the resume.\n"
            "3. softSkills (Teamwork, Communication, Leadership, Adaptability, Problem Solving) MUST be separate.\n"
            "4. targetRoles MUST be derived from ACTUAL resume evidence. Each item has role, fitScore (0-100), whyFit.\n"
            "5. If evidence is insufficient for target roles, return targetRoles as [].\n"
            "6. strongestAreas: 2-4 areas derived strictly from resume evidence.\n"
            "7. developmentAreas: Gaps between current resume evidence and target roles.\n\n"
            "Return ONLY valid JSON matching the requested schema."
        )

        prompt = (
            f"RESUME TEXT TO ANALYZE ({filename}):\n"
            f"==================================================\n"
            f"{norm_text[:14000]}\n"
            f"==================================================\n\n"
            "Return ONLY a valid JSON object matching this exact schema:\n"
            "{\n"
            '  "candidateSummary": "2-3 concise sentences describing who the candidate is, strongest areas, and realistic career direction.",\n'
            '  "candidate": {\n'
            '    "name": "Full Name or null",\n'
            '    "headline": "Title/Headline or null",\n'
            '    "contact": {\n'
            '      "email": "Email or null",\n'
            '      "phone": "Phone or null",\n'
            '      "linkedin": "LinkedIn URL or null",\n'
            '      "github": "GitHub URL or null",\n'
            '      "portfolio": "Portfolio URL or null",\n'
            '      "location": "Location or null"\n'
            '    }\n'
            '  },\n'
            '  "education": [\n'
            '    {\n'
            '      "degree": "Degree Title",\n'
            '      "institution": "University/Institution",\n'
            '      "year": "Graduation Year or Duration",\n'
            '      "evidence": "Field or evidence detail"\n'
            '    }\n'
            '  ],\n'
            '  "experience": [\n'
            '    {\n'
            '      "role": "Job Title",\n'
            '      "company": "Company Name",\n'
            '      "duration": "Dates/Duration",\n'
            '      "keyWork": "One concise sentence describing core work."\n'
            '    }\n'
            '  ],\n'
            '  "technicalSkills": ["Skill 1", "Skill 2"],\n'
            '  "softSkills": ["Soft Skill 1"],\n'
            '  "projects": [\n'
            '    {\n'
            '      "name": "Project Title",\n'
            '      "description": "One concise sentence.",\n'
            '      "technologies": ["Tech 1"]\n'
            '    }\n'
            '  ],\n'
            '  "achievements": ["Achievement 1"],\n'
            '  "targetRoles": [\n'
            '    {\n'
            '      "role": "Role Title",\n'
            '      "fitScore": 88,\n'
            '      "whyFit": "One concise evidence-based sentence."\n'
            '    }\n'
            '  ],\n'
            '  "strongestAreas": ["Area 1", "Area 2"],\n'
            '  "developmentAreas": ["Area 1", "Area 2"],\n'
            '  "profileCompleteness": 75\n'
            "}\n"
        )

        from langchain_core.messages import SystemMessage, HumanMessage

        last_error = None
        parsed_result = None
        used_model_name = settings.GEMINI_MODEL
        models_to_try = [settings.GEMINI_MODEL]

        import time
        # Step 4: Iterate through Gemini API keys and models
        for key_idx, gemini_key in enumerate(keys_to_try):
            for model_name in models_to_try:
                llm = get_llm(temperature=0.1, model_name=model_name, api_key_override=gemini_key)
                if not llm:
                    continue

                t0 = time.time()
                key_fp = settings.get_key_fingerprint(gemini_key)
                input_chars = len(system_instruction) + len(prompt)
                logger.info(f"[GEMINI_REQUEST] model={model_name} operation=resume_analysis input_chars={input_chars} key_fingerprint={key_fp}")

                try:
                    response = await llm.ainvoke([
                        SystemMessage(content=system_instruction),
                        HumanMessage(content=prompt)
                    ])
                    duration_ms = int((time.time() - t0) * 1000)
                    logger.info(f"[GEMINI_RESPONSE] status=success duration_ms={duration_ms} model={model_name}")

                    text = str(response.content).strip()
                    json_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
                    if json_match:
                        text = json_match.group(1).strip()
                    else:
                        brace_match = re.search(r'\{[\s\S]*\}', text)
                        if brace_match:
                            text = brace_match.group(0).strip()

                    parsed_result = json.loads(text)
                    used_model_name = model_name
                    logger.info(f"[GEMINI] Response received via Model {model_name}")
                    break
                except Exception as err:
                    duration_ms = int((time.time() - t0) * 1000)
                    err_str = str(err)
                    last_error = err
                    logger.warning(f"[GEMINI_ERROR] status=failed error={err_str[:100]} model={model_name} duration_ms={duration_ms}")

            if parsed_result:
                break

        # OpenAI fallback if Gemini keys failed
        if not parsed_result and settings.OPENAI_API_KEY:
            try:
                logger.info(f"[OPENAI] Sending resume for analysis using OpenAI fallback ({settings.OPENAI_MODEL})")
                openai_llm = get_llm(temperature=0.1, provider="openai")
                if openai_llm:
                    response = await openai_llm.ainvoke([
                        SystemMessage(content=system_instruction),
                        HumanMessage(content=prompt)
                    ])
                    text = str(response.content).strip()
                    json_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
                    if json_match:
                        text = json_match.group(1).strip()
                    else:
                        brace_match = re.search(r'\{[\s\S]*\}', text)
                        if brace_match:
                            text = brace_match.group(0).strip()

                    parsed_result = json.loads(text)
                    used_model_name = settings.OPENAI_MODEL
            except Exception as openai_err:
                logger.warning(f"[OPENAI] Fallback failed: {openai_err}")

        # Step 5: LLM Failure Handling -> Fallback to Exact Text Evidence Parsing
        if not parsed_result:
            logger.info("[RESUME_ANALYSIS] LLM API analysis unavailable. Serving exact evidence-based analysis from resume text.")
            return self._analyze_resume_text_evidence_based(
                resume_text=norm_text,
                filename=filename,
                resume_hash=resume_hash,
                now_str=now_str,
                error_detail=str(last_error) if last_error else "AI provider quota unavailable"
            )

        # Step 6: MANDATORY POST-PROCESSING VALIDATION & CONTAMINATION PURGE
        sanitized = sanitize_and_validate_candidate(parsed_result, extracted_contact, norm_text)
        
        cand_info = sanitized.get("candidate") or {}
        name = cand_info.get("name") or ""
        headline = cand_info.get("headline") or ""
        summary = sanitized.get("candidateSummary") or cand_info.get("summary") or ""
        contact_dict = cand_info.get("contact") or {}
        location = contact_dict.get("location") or ""

        technical_skills = sanitized.get("technicalSkills") or []
        soft_skills = sanitized.get("softSkills") or []
        exp_list = sanitized.get("experience") or []
        edu_list = sanitized.get("education") or []
        proj_list = sanitized.get("projects") or []
        achievements = sanitized.get("achievements") or []
        target_role_objs = sanitized.get("targetRoles") or []
        strongest_areas = sanitized.get("strongestAreas") or []
        development_areas = sanitized.get("developmentAreas") or []
        profile_completeness = sanitized.get("profileCompleteness") or 0

        # Incomplete Resume Handling (Section 6)
        is_incomplete = (len(technical_skills) == 0 and len(exp_list) == 0 and len(proj_list) == 0)

        if is_incomplete:
            summary = "Not enough information was found in this resume to generate reliable career recommendations."
            target_role_objs = []
            strongest_areas = []
            development_areas = []
            analysis_status = "incomplete_evidence"
            error_message = "Not enough information was found in this resume to generate reliable career recommendations."
        else:
            analysis_status = "complete"
            error_message = None

        role_rankings = [
            RoleFitRecommendation(
                role=r_obj.get("role", "Target Role"),
                fitScore=int(r_obj.get("fitScore", 85)),
                rank=idx + 1,
                whyFit=[r_obj.get("whyFit")] if r_obj.get("whyFit") else technical_skills[:3],
                whatToImprove=[]
            )
            for idx, r_obj in enumerate(target_role_objs[:5])
        ]

        attr_str = f"{name}:{technical_skills}:{exp_list}:{edu_list}:{proj_list}"
        profile_hash_val = hashlib.sha256(attr_str.encode('utf-8')).hexdigest()[:16]
        profile_id = f"cand_sha256_{resume_hash[:16]}"

        analysis_res = CandidateProfileAnalysis(
            profileId=profile_id,
            profileUrl=f"uploaded://{filename}",
            profilePlatform="Resume Upload",
            candidateName=name if name else "Candidate",
            analyzedAt=now_str,
            lastUpdatedAt=now_str,
            analysisVersion=f"3.0.0-compact-{used_model_name}",
            headline=headline,
            summary=summary,
            candidateSummary=summary,
            location=location,
            targetRoles=target_role_objs,
            technicalSkills=technical_skills,
            strongSkills=technical_skills[:6],
            softSkills=soft_skills,
            developingSkills=development_areas,
            strongestAreas=strongest_areas,
            developmentAreas=development_areas,
            experience=exp_list,
            education=edu_list,
            projects=proj_list,
            achievements=achievements,
            profileHash=f"hash_{profile_hash_val}",
            resumeHash=resume_hash,
            resumeFileName=filename,
            extractedCharCount=len(norm_text),
            profileCompleteness=profile_completeness,
            profileReadinessScore=profile_completeness,
            roleFitRankings=role_rankings,
            analysisStatus=analysis_status,
            errorMessage=error_message,
            profileSignals={
                "contact": contact_dict,
                "programmingLanguages": sanitized.get("programmingLanguages"),
                "frameworks": sanitized.get("frameworks"),
                "databases": sanitized.get("databases"),
                "tools": sanitized.get("tools"),
                "cloudTechnologies": sanitized.get("cloudTechnologies"),
                "aiMlTechnologies": sanitized.get("aiMlTechnologies")
            }
        )

        try:
            from app.services.breeth_memory import breeth_memory_service
            await breeth_memory_service.store_candidate_profile_memories(profile_id, analysis_res)
        except Exception as breeth_err:
            logger.warning(f"[BREETH_UNAVAILABLE] Memory persistence notice: {breeth_err}")

        # Cache valid analysis
        self._resume_cache[resume_hash] = analysis_res
        return analysis_res




    def _analyze_resume_text_evidence_based(
        self,
        resume_text: str,
        filename: str,
        resume_hash: str,
        now_str: str,
        error_detail: Optional[str] = None
    ) -> CandidateProfileAnalysis:
        import re
        from app.services.resume_pipeline import (
            normalize_resume_text,
            extract_contact_and_entities,
            classify_skills,
            is_valid_target_role,
            PROGRAMMING_LANGUAGES,
            FRAMEWORKS,
            DATABASES,
            TOOLS_DEVOPS,
            AI_ML_TECH,
            CLOUD_TECH
        )

        norm_text = normalize_resume_text(resume_text)
        
        # 1. Clean spaced out characters (e.g. "S U M M A R Y" -> "SUMMARY", "V i v e k" -> "Vivek")
        cleaned_lines = []
        for line in norm_text.splitlines():
            line_str = line.strip()
            if not line_str:
                continue
            if re.match(r'^(?:[A-Za-z]\s+){2,}[A-Za-z]$', line_str):
                line_str = line_str.replace(" ", "")
            line_str = re.sub(r'\s+', ' ', line_str)
            cleaned_lines.append(line_str)

        clean_full_text = "\n".join(cleaned_lines)
        extracted_contact = extract_contact_and_entities(clean_full_text)

        # 2. Extract Candidate Name (Filter out section headers, emails, phones, locations)
        section_headers = {
            "summary", "objective", "profile", "overview", "experience", "work experience",
            "employment", "education", "projects", "skills", "technical skills",
            "certifications", "achievements", "contact", "curriculum vitae", "resume"
        }

        name = ""
        for line in cleaned_lines[:10]:
            l_lower = line.lower().strip(": ")
            if l_lower in section_headers or any(h == l_lower for h in section_headers):
                continue
            if extracted_contact.get("email") and extracted_contact["email"] in line:
                continue
            if extracted_contact.get("phone") and extracted_contact["phone"] in line:
                continue
            if "http" in line.lower() or "github" in line.lower() or "linkedin" in line.lower():
                continue
            words = line.split()
            if 2 <= len(words) <= 4 and all(w[0].isupper() or w[0].isalpha() for w in words if len(w) > 1):
                if not any(char.isdigit() for char in line) and not any(kw in l_lower for kw in ["ranked", "top 20", "participating", "award"]):
                    name = line.strip()
                    break

        if not name:
            if extracted_contact.get("email"):
                local_part = extracted_contact["email"].split("@")[0]
                name_words = [w.capitalize() for w in re.findall(r'[a-zA-Z]+', local_part) if len(w) > 1]
                if name_words:
                    name = " ".join(name_words[:3])

        if not name or name == "Summary" or name.lower() in section_headers:
            name = "Candidate"

        # 3. Technical Skill Extraction via Taxonomy Scanning
        extracted_skills_raw = []
        full_lower = clean_full_text.lower()
        
        all_tech_vocab = (
            PROGRAMMING_LANGUAGES | FRAMEWORKS | DATABASES | TOOLS_DEVOPS | AI_ML_TECH | CLOUD_TECH
        )

        title_map = {
            "javascript": "JavaScript", "typescript": "TypeScript", "mongodb": "MongoDB",
            "postgresql": "PostgreSQL", "fastapi": "FastAPI", "react": "React",
            "nodejs": "Node.js", "nextjs": "Next.js", "express": "Express.js",
            "pytorch": "PyTorch", "tensorflow": "TensorFlow", "docker": "Docker",
            "kubernetes": "Kubernetes", "git": "Git", "github": "GitHub",
            "firebase": "Firebase", "firestore": "Firestore", "redux": "Redux",
            "reactnative": "React Native", "tailwindcss": "TailwindCSS", "python": "Python",
            "c++": "C++", "c#": "C#", "java": "Java", "html": "HTML", "css": "CSS", "sql": "SQL"
        }

        for term in sorted(all_tech_vocab, key=len, reverse=True):
            pattern = r'\b' + re.escape(term) + r'\b'
            if re.search(pattern, full_lower):
                display_name = title_map.get(term, term.upper() if len(term) <= 3 else term.capitalize())
                if display_name not in extracted_skills_raw:
                    extracted_skills_raw.append(display_name)

        classified = classify_skills(extracted_skills_raw)
        tech_skills = classified["technicalSkills"]
        soft_skills = classified["softSkills"]

        # 4. Target Role Extraction & Fallback Derivation
        profile_ev = {"technicalSkills": tech_skills, "experience": []}
        possible_roles = []

        role_keywords = [
            "Full Stack Developer", "Software Engineer", "Backend Developer", "Frontend Developer",
            "AI Engineer", "Machine Learning Engineer", "Data Scientist", "DevOps Engineer",
            "Mobile App Developer", "Cloud Engineer", "System Architect"
        ]

        for r_kw in role_keywords:
            if re.search(r'\b' + re.escape(r_kw.lower()) + r'\b', full_lower):
                possible_roles.append(r_kw)

        if not possible_roles:
            tech_lower_set = {t.lower() for t in tech_skills}
            if {"react", "javascript", "typescript", "html", "css"}.intersection(tech_lower_set) and {"python", "fastapi", "node.js", "nodejs", "sql", "mongodb"}.intersection(tech_lower_set):
                possible_roles.append("Full Stack Developer")
            elif {"react", "javascript", "typescript", "html", "css"}.intersection(tech_lower_set):
                possible_roles.append("Frontend Developer")
            elif {"python", "java", "c++", "fastapi", "django", "node.js", "sql", "mongodb", "postgresql"}.intersection(tech_lower_set):
                possible_roles.append("Backend Developer")
            elif {"python", "pytorch", "tensorflow", "machine learning", "ai", "llm", "rag", "langchain"}.intersection(tech_lower_set):
                possible_roles.append("AI Engineer")
            else:
                possible_roles.append("Software Engineer")

        valid_target_roles = [r for r in possible_roles if is_valid_target_role(r, profile_ev)]
        if not valid_target_roles:
            valid_target_roles = ["Software Engineer"]

        # 5. Extract Headline & Summary
        headline = valid_target_roles[0] if valid_target_roles else "Software Engineer"
        
        summary = (
            f"Evidence-based candidate intelligence synthesized from {filename} for {name}. "
            f"Demonstrated technical competencies: {', '.join(tech_skills[:6]) if tech_skills else 'Software Engineering'}. "
            f"Primary career target: {headline}."
        )

        evidence_score = 0
        if name and name != "Candidate": evidence_score += 20
        if tech_skills: evidence_score += min(50, len(tech_skills) * 5)
        if valid_target_roles and valid_target_roles != ["Software Engineer"]: evidence_score += 15
        if extracted_contact.get("email"): evidence_score += 10
        if extracted_contact.get("phone"): evidence_score += 5
        # Only apply completeness floor when there's real skill evidence
        completeness = min(98, max(evidence_score, 50) if tech_skills else evidence_score)

        profile_id = f"cand_sha256_{resume_hash[:16]}"
        role_rankings = [
            RoleFitRecommendation(
                role=r_name,
                fitScore=completeness,
                rank=idx + 1,
                whyFit=tech_skills[:3] if tech_skills else [headline],
                whatToImprove=[]
            )
            for idx, r_name in enumerate(valid_target_roles[:3])
        ]

        # Determine final analysis status — incomplete_evidence when no tech skills found
        is_evidence_incomplete = not tech_skills
        if is_evidence_incomplete:
            ev_analysis_status = "incomplete_evidence"
            valid_target_roles = []
            role_rankings = []
            summary = "Not enough technical evidence was found in this resume to generate reliable career or skill recommendations."
        else:
            ev_analysis_status = "complete"

        msg = "Gemini API rate limit reached (429). Fast-tracked via exact resume text evidence." if error_detail and ("429" in error_detail or "RESOURCE_EXHAUSTED" in error_detail) else f"Gemini notice: {error_detail[:150] if error_detail else 'Fast-tracked'}"
        if is_evidence_incomplete:
            msg = "AI analysis unavailable and no technical skills were detected in the resume text. Please check your AI provider/API configuration."

        analysis_res = CandidateProfileAnalysis(
            profileId=profile_id,
            profileUrl=f"uploaded://{filename}",
            profilePlatform="Resume Upload",
            candidateName=name,
            analyzedAt=now_str,
            lastUpdatedAt=now_str,
            analysisVersion="3.1.0-smart-evidence-engine",
            headline=headline,
            summary=summary,
            location=extracted_contact.get("location") or "",
            targetRoles=valid_target_roles,
            technicalSkills=tech_skills,
            strongSkills=tech_skills[:6],
            softSkills=soft_skills,
            developingSkills=[],
            experience=[f"{headline} - Technical Evidence Base"] if tech_skills else [],
            education=[],
            projects=[],
            certifications=[],
            profileHash=f"hash_{resume_hash[:16]}",
            resumeHash=resume_hash,
            resumeFileName=filename,
            extractedCharCount=len(resume_text),
            profileCompleteness=completeness,
            profileReadinessScore=completeness,
            roleFitRankings=role_rankings,
            analysisStatus=ev_analysis_status,
            errorMessage=msg,
            profileSignals={
                "contact": extracted_contact,
                "programmingLanguages": classified.get("programmingLanguages"),
                "frameworks": classified.get("frameworks"),
                "databases": classified.get("databases"),
                "tools": classified.get("tools"),
                "cloudTechnologies": classified.get("cloudTechnologies"),
                "aiMlTechnologies": classified.get("aiMlTechnologies")
            }
        )

        try:
            from app.services.breeth_memory import breeth_memory_service
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(breeth_memory_service.store_candidate_profile_memories(profile_id, analysis_res))
            except RuntimeError:
                pass
        except Exception as b_err:
            logger.warning(f"[BREETH_UNAVAILABLE] Memory store notice: {b_err}")

        return analysis_res


    async def analyze_resume_text_with_gemini(
        self,
        resume_text: str,
        api_key_override: Optional[str] = None
    ) -> CandidateProfileAnalysis:
        """Backward compatible wrapper for analyze_resume_file_with_gemini."""
        return await self.analyze_resume_file_with_gemini(
            resume_text=resume_text,
            filename="resume.txt",
            api_key_override=api_key_override
        )


    def plan_interview_days(self, candidate: CandidateProfile, target_count: int = 5) -> List[int]:
        available_days = [d["day"] for d in curriculum_service.get_all_days()]
        if not available_days:
            return [7, 10, 13, 21, 28]

        candidate_missions = {m.day: m for m in candidate.missions}
        priority_days: List[int] = []
        secondary_days: List[int] = []

        for m in candidate.missions:
            if m.day not in available_days:
                continue
            if (m.attempts and m.attempts > 1) or m.passed is False:
                priority_days.append(m.day)
            elif m.skipped:
                priority_days.append(m.day)
            else:
                secondary_days.append(m.day)

        selected: List[int] = []
        for d in priority_days + secondary_days:
            if d not in selected:
                selected.append(d)

        if len(selected) < target_count:
            core_days = [7, 8, 10, 11, 12, 13, 16, 21, 22, 23, 28, 31]
            for d in core_days:
                if d in available_days and d not in selected:
                    selected.append(d)
                if len(selected) >= target_count:
                    break

        return selected[:max(target_count, 4)]

    def build_unified_candidate_intelligence(self, profiles: List[NormalizedCandidateProfile]) -> UnifiedCandidateIntelligence:
        """
        Merges multi-source candidate profiles (LinkedIn, GitHub, Naukri, etc.) into a unified candidate intelligence
        model with strict data provenance tracking for every skill and experience item.
        """
        if not profiles:
            return UnifiedCandidateIntelligence(
                candidateVersion="cand_ver_empty",
                candidateName="Unknown Candidate",
                platforms=[],
                unifiedSkills=[],
                unifiedTargetRoles=[],
                overallReadinessScore=50,
                candidateSummary="No profile evidence collected yet."
            )

        name = profiles[0].name or "Candidate"
        platforms = list(dict.fromkeys([p.platform for p in profiles if p.platform]))

        profile_hashes = sorted([f"{p.platform}:{p.profileHash}" for p in profiles])
        version_source = "|".join(profile_hashes)
        cand_version = f"cand_ver_{cyrb53_hash(version_source)}"

        provenance_skills: List[CandidateSkillProvenance] = []
        seen_skills = set()

        all_roles: List[str] = []
        all_exp: List[str] = []
        all_projects: List[str] = []
        all_education: List[str] = []

        readiness_scores = []

        for p in profiles:
            readiness_scores.append(self._calculate_base_readiness_score(p))

            for sk in p.skills:
                sk_clean = sk.strip()
                if sk_clean and sk_clean.lower() not in seen_skills:
                    seen_skills.add(sk_clean.lower())
                    provenance_skills.append(
                        CandidateSkillProvenance(
                            skill=sk_clean,
                            sourcePlatform=p.platform,
                            evidence=f"Extracted from {p.platform} profile ({p.headline or 'Profile signals'})"
                        )
                    )

            if p.headline and len(p.headline) > 3:
                role_candidate = p.headline.split('|')[0].split('-')[0].strip()
                if role_candidate and role_candidate not in all_roles:
                    all_roles.append(role_candidate)

            for exp in p.experience:
                if exp not in all_exp:
                    all_exp.append(exp)

            for proj in p.projects:
                if proj not in all_projects:
                    all_projects.append(proj)

            for edu in p.education:
                if edu not in all_education:
                    all_education.append(edu)

        overall_readiness = int(sum(readiness_scores) / len(readiness_scores)) if readiness_scores else 70
        overall_readiness = min(98, max(50, overall_readiness + len(platforms) * 4))

        skill_names = [ps.skill for ps in provenance_skills]
        summary = (
            f"{name}'s career profile is unified across {len(platforms)} platforms ({', '.join(platforms)}). "
            f"Demonstrated technical competencies include {', '.join(skill_names[:6])}. "
            f"Primary target directions include {', '.join(all_roles[:2]) if all_roles else 'Software Engineering'}."
        )

        return UnifiedCandidateIntelligence(
            candidateVersion=cand_version,
            candidateName=name,
            platforms=platforms,
            unifiedSkills=provenance_skills,
            unifiedTargetRoles=all_roles[:4],
            unifiedExperience=all_exp[:5],
            unifiedProjects=all_projects[:5],
            unifiedEducation=all_education[:5],
            overallReadinessScore=overall_readiness,
            candidateSummary=summary
        )

    async def analyze_unified_intelligence_with_gemini(
        self, unified: UnifiedCandidateIntelligence, api_key_override: Optional[str] = None
    ) -> UnifiedCandidateIntelligence:
        """
        Connects multi-source unified candidate intelligence (LinkedIn + GitHub + Naukri, etc.) to Gemini LLM
        to synthesize career direction, target roles, readiness scores, and verified skill provenance.
        """
        preferred_model = settings.GEMINI_MODEL
        models_to_try = [preferred_model]


        system_instruction = (
            "You are an expert technical recruiter and career advisor.\n"
            "Analyze the unified multi-platform candidate profile supplied in the request.\n"
            "Do NOT invent skills, experience, education, projects, or technologies.\n"
            "Synthesize a personalized multi-source career summary, target roles, and readiness score based strictly on verified evidence across all platforms.\n"
            "Return valid JSON only."
        )

        provenance_str = "\n".join([f"- Skill: {p.skill} | Source: {p.sourcePlatform} | Evidence: {p.evidence}" for p in unified.unifiedSkills])
        exp_str = "; ".join(unified.unifiedExperience) if unified.unifiedExperience else "None"
        proj_str = "; ".join(unified.unifiedProjects) if unified.unifiedProjects else "None"

        prompt = (
            f"UNIFIED MULTI-PLATFORM CANDIDATE EVIDENCE:\n"
            f"- Candidate Name: {unified.candidateName}\n"
            f"- Connected Platforms: {', '.join(unified.platforms)}\n"
            f"- Candidate Version Hash: {unified.candidateVersion}\n"
            f"- Unified Verified Skills & Provenance:\n{provenance_str or 'None'}\n"
            f"- Unified Experience: {exp_str}\n"
            f"- Unified Projects: {proj_str}\n"
            f"- Base Unified Readiness: {unified.overallReadinessScore}\n\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. Synthesize a 3-4 sentence comprehensive career summary highlighting strengths across all connected platforms.\n"
            "2. Identify 3-4 realistic target roles derived strictly from multi-platform evidence.\n"
            "3. Calculate overallReadinessScore (50 to 98) using evidence depth.\n\n"
            "Return JSON matching:\n"
            "{\n"
            '  "candidateSummary": "Multi-platform career summary...",\n'
            f'  "overallReadinessScore": {unified.overallReadinessScore},\n'
            '  "unifiedTargetRoles": ["Role 1", "Role 2", "Role 3"]\n'
            "}\n"
        )

        from langchain_core.messages import SystemMessage, HumanMessage

        last_error = None
        for model_name in models_to_try:
            llm = get_llm(temperature=0.2, model_name=model_name, api_key_override=api_key_override)
            if not llm:
                continue

            try:
                logger.info(f"Attempting unified intelligence AI analysis with Gemini model: {model_name}")
                response = await llm.ainvoke([
                    SystemMessage(content=system_instruction),
                    HumanMessage(content=prompt)
                ])
                text = str(response.content).strip()
                if text.startswith("```json"):
                    text = text.split("```json")[1].split("```")[0].strip()
                elif text.startswith("```"):
                    text = text.split("```")[1].split("```")[0].strip()

                parsed = json.loads(text)
                if parsed.get("candidateSummary"):
                    unified.candidateSummary = parsed["candidateSummary"]
                if parsed.get("overallReadinessScore"):
                    unified.overallReadinessScore = int(parsed["overallReadinessScore"])
                if parsed.get("unifiedTargetRoles"):
                    unified.unifiedTargetRoles = parsed["unifiedTargetRoles"]
                return unified

            except Exception as e:
                err_str = str(e)
                last_error = e
                if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str or "quota" in err_str.lower():
                    logger.info(f"Gemini API quota limit reached on '{model_name}'. Serving evidence-based unified intelligence.")
                    break
                else:
                    logger.warning(f"Gemini LLM model '{model_name}' failed: {err_str[:150]}")

        return unified

    def extract_candidate_skills(self, candidate: CandidateProfile) -> List[str]:
        skills = []
        if candidate and candidate.member:
            if hasattr(candidate.member, 'skills') and candidate.member.skills:
                skills.extend(candidate.member.skills)

        if candidate and candidate.missions:
            for m in candidate.missions:
                if m.passed:
                    info = curriculum_service.get_day_info(m.day)
                    if info and "tools" in info:
                        for tool in info["tools"]:
                            if tool not in skills:
                                skills.append(tool)

        return list(dict.fromkeys(skills))


candidate_analyzer = CandidateAnalyzer()

