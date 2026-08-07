from typing import List, Dict, Any, Optional
from app.schemas.interview import JobDetails, JobAnalysisSummary
from app.schemas.extension import JobDetectionRequest, JobDetectionResponse, ExtensionPopupPrompt
from app.services.curriculum_service import curriculum_service


class JobAnalyzerService:
    """
    Analyzes job posting details extracted by the Chrome extension from hiring portals (LinkedIn, Greenhouse, Lever, etc.)
    and maps them to curriculum technical concepts.
    """
    def analyze_job(self, job: JobDetails) -> JobAnalysisSummary:
        company = job.company or "Target Company"
        role = job.jobTitle or "AI Software Engineer"
        
        if job.skills and len(job.skills) > 0:
            detected_skills = job.skills
        else:
            # Extract skills dynamically from description text or role title
            extracted = []
            text_to_search = f"{role} {job.description or ''}".lower()
            known_techs = [
                "FastAPI", "Python", "Docker", "Redis", "LangGraph", "RAG", "React", "TypeScript",
                "Kubernetes", "PostgreSQL", "MongoDB", "PyTorch", "TensorFlow", "AWS", "GCP", "Azure",
                "LangChain", "Vector DB", "Qdrant", "Microservices", "REST API", "GraphQL"
            ]
            for tech in known_techs:
                if tech.lower() in text_to_search and tech not in extracted:
                    extracted.append(tech)
            detected_skills = extracted if extracted else ["Python", "FastAPI", "LangGraph", "RAG", "Docker", "Redis"]

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
            requiredSkills=detected_skills
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

        # Keywords indicating a job profile page
        job_keywords = ["job", "jobs", "career", "careers", "position", "opening", "role", "hiring", "apply", "requirement", "responsibility"]
        domain_keywords = ["linkedin.com/jobs", "greenhouse.io", "lever.co", "indeed.com", "glassdoor.com", "workday.com"]

        is_job_profile = False

        # If structured job details are already extracted
        if job and (job.jobTitle or job.company or job.description or job.skills):
            is_job_profile = True
        # Check domain/URL patterns
        elif any(domain in url for domain in domain_keywords):
            is_job_profile = True
        # Check title and content keywords
        elif any(kw in title for kw in job_keywords) or any(kw in content[:500] for kw in job_keywords):
            is_job_profile = True

        if not is_job_profile:
            return JobDetectionResponse(
                isJobProfile=False,
                jobSummary=None,
                prompt=None
            )

        # Build job details if missing
        if not job:
            extracted_title = request.pageTitle or "AI Technical Role"
            job = JobDetails(
                jobTitle=extracted_title,
                company="Hiring Organization",
                skills=["Python", "FastAPI", "AI Integration", "RAG", "LLM APIs"],
                description=request.rawContent
            )

        summary = self.analyze_job(job)
        prompt = self.generate_popup_prompt(summary)

        return JobDetectionResponse(
            isJobProfile=True,
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

