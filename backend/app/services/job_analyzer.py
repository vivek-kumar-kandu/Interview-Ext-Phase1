import logging
from typing import List, Dict, Any, Optional
from app.schemas.interview import JobDetails, JobAnalysisSummary
from app.schemas.extension import JobDetectionRequest, JobDetectionResponse, ExtensionPopupPrompt
from app.services.curriculum_service import curriculum_service

logger = logging.getLogger(__name__)



class JobAnalyzerService:
    """
    Analyzes job posting details extracted by the Chrome extension from hiring portals (LinkedIn, Greenhouse, Lever, etc.)
    and maps them to curriculum technical concepts.
    """
    def extract_skills_from_job_title_and_desc(self, job_title: str, description: str = "") -> List[str]:
        """
        Dynamically extracts skills from role title and job description text.
        """
        extracted = []
        role = job_title or ""
        desc = description or ""
        text_to_search = f"{role} {desc}".lower()
        known_techs = [
            "FastAPI", "Python", "Docker", "Redis", "LangGraph", "RAG", "React", "TypeScript",
            "Kubernetes", "PostgreSQL", "MongoDB", "PyTorch", "TensorFlow", "AWS", "GCP", "Azure",
            "LangChain", "Vector DB", "Qdrant", "Microservices", "REST API", "GraphQL",
            "HTML", "CSS", "JavaScript", "Website Deployment", "Web Development", "Frontend",
            "Backend", "Full Stack", "Node.js", "Java", "C++", "C#", "SQL", "Git", "Next.js"
        ]
        for tech in known_techs:
            if tech.lower() in text_to_search and tech not in extracted:
                extracted.append(tech)

        # Extract terms inside parentheses in job title e.g. (HTML, CSS, JavaScript)
        if "(" in role and ")" in role:
            import re
            paren_content = re.findall(r'\((.*?)\)', role)
            for block in paren_content:
                parts = [p.strip() for p in block.split(',')]
                for p in parts:
                    if p and len(p) > 1 and p not in extracted:
                        extracted.append(p)

        return extracted if extracted else [s.strip() for s in role.split() if len(s) > 2 and s.lower() not in ["intern", "developer", "engineer", "senior", "junior", "lead", "with"]]

    def analyze_job(
        self,
        job: JobDetails,
        candidate_skills: Optional[List[str]] = None,
        candidate_version: Optional[str] = None
    ) -> JobAnalysisSummary:
        company = job.company or "Target Company"
        role = job.jobTitle or "AI Software Engineer"
        
        if job.skills and len(job.skills) > 0:
            detected_skills = job.skills
        else:
            detected_skills = self.extract_skills_from_job_title_and_desc(role, job.description or "")

        # Calculate Candidate-Job Compatibility Match and Skill Gap Analysis
        cand_skills_list = candidate_skills or []
        cand_skills_lower = set(s.lower() for s in cand_skills_list)

        matched_skills = []
        missing_skills = []

        for req in detected_skills:
            req_low = req.lower()
            if req_low in cand_skills_lower or any(req_low in c or c in req_low for c in cand_skills_lower):
                matched_skills.append(req)
            else:
                missing_skills.append(req)

        if cand_skills_list:
            match_pct = int((len(matched_skills) / max(1, len(detected_skills))) * 100)
            match_score = min(98, max(0, match_pct))
            readiness_score = min(98, max(0, match_score - len(missing_skills) * 3))
        else:
            match_score = None
            readiness_score = None

        # Determine difficulty based on role title or experience
        exp_str = (job.experience or "").lower()
        title_str = role.lower()
        if "senior" in title_str or "lead" in title_str or "5+" in exp_str or "principal" in title_str:
            difficulty = "Hard"
        elif "junior" in title_str or "intern" in title_str:
            difficulty = "Medium"
        else:
            difficulty = "Medium-Hard"

        return JobAnalysisSummary(
            company=company,
            role=role,
            detectedSkills=detected_skills,
            estimatedDuration="15 Minutes",
            difficulty=difficulty,
            matchScore=match_score,
            readinessScore=readiness_score,
            requiredSkills=detected_skills,
            candidateSkills=cand_skills_list,
            missingSkills=missing_skills,
            candidateVersion=candidate_version
        )

    def map_skills_to_curriculum_days(self, skills: List[str]) -> List[int]:
        """
        Maps job requirement skills to curriculum day numbers.
        """
        skill_lower = [s.lower() for s in skills]
        mapped_days = []

        all_days = curriculum_service.get_all_days()
        for day in all_days:
            day_num = day.get("day")
            day_tools = [t.lower() for t in day.get("tools", [])]
            day_title = day.get("title", "").lower()

            for sk in skill_lower:
                if any(sk in tool for tool in day_tools) or sk in day_title:
                    mapped_days.append(day_num)
                    break

        # Fallback to core technical days if no direct skill match
        if not mapped_days:
            mapped_days = [7, 10, 13, 21, 28]

        return list(dict.fromkeys(mapped_days))

    def detect_job_profile(self, request: JobDetectionRequest) -> JobDetectionResponse:
        """
        Determines whether the page or payload represents an active job profile
        and generates the extension popup prompt payload.
        """
        job = request.job
        url = (request.url or "").lower()
        title = (request.pageTitle or "").lower()
        content = (request.rawContent or "").lower()

        # Extract job parameters from structured request fields
        req_title = (request.jobTitle or (request.job.jobTitle if request.job else "") or request.pageTitle or "").strip()
        req_company = (request.company or (request.job.company if request.job else "") or "Target Company").strip()
        req_desc = (request.rawDescription or (request.job.description if request.job else "") or request.rawContent or "").strip()

        # Keywords indicating a job profile page
        job_keywords = ["job", "position", "opening", "role", "hiring", "apply", "requirement", "responsibility", "engineer", "developer", "designer", "manager", "analyst", "architect", "intern", "careers"]
        domain_keywords = ["linkedin.com/jobs", "greenhouse.io", "lever.co", "indeed.com", "glassdoor.com", "workday.com", "naukri.com", "internshala.com", "wellfound.com"]

        is_job_profile = False

        if job and (job.jobTitle or job.description or job.skills):
            is_job_profile = True
        elif any(domain in url for domain in domain_keywords):
            is_job_profile = True
        elif any(kw in title for kw in job_keywords) or any(kw in req_title.lower() for kw in job_keywords):
            is_job_profile = True

        if not is_job_profile:

            logger.info(f"[JOB_DETECT_RESPONSE] success=true job_present=false url={request.url}")
            return JobDetectionResponse(
                success=True,
                isJobProfile=False,
                job=None,
                jobSummary=None,
                prompt=None
            )

        # Build job details if missing
        if not job:
            job = JobDetails(
                jobTitle=req_title or "AI Technical Role",
                company=req_company,
                skills=[],
                description=req_desc
            )
        else:
            if req_title: job.jobTitle = req_title
            if req_company and req_company != "Target Company": job.company = req_company
            if req_desc: job.description = req_desc

        from app.schemas.extension import ExtractedJobPayload
        extracted_payload = ExtractedJobPayload(
            url=request.url,
            title=job.jobTitle,
            company=job.company or "Target Company",
            description=job.description or req_desc,
            skills=job.skills or []
        )

        logger.info(
            f"[JOB_DETECT_RESPONSE] success=true job_present=true title={extracted_payload.title} "
            f"company={extracted_payload.company} description_chars={len(extracted_payload.description or '')} "
            f"url={request.url}"
        )

        summary = self.analyze_job(
            job=job,
            candidate_skills=request.candidateSkills,
            candidate_version=request.candidateVersion
        )
        prompt = self.generate_popup_prompt(summary)

        return JobDetectionResponse(
            success=True,
            isJobProfile=True,
            job=extracted_payload,
            jobSummary=summary,
            prompt=prompt
        )



    def generate_popup_prompt(self, summary: JobAnalysisSummary) -> ExtensionPopupPrompt:
        return ExtensionPopupPrompt(
            title=f"Job Profile Detected: {summary.role}",
            message=f"We detected a job posting for {summary.role} at {summary.company}. Would you like to start your AI Technical Interview assistant for this position?",
            allowText="Start Interview",
            denyText="Dismiss",
            allowAction="START_INTERVIEW",
            denyAction="IGNORE"
        )


job_analyzer_service = JobAnalyzerService()

