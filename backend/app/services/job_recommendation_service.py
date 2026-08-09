import json
import logging
import hashlib
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import HTTPException, status

from app.schemas.interview import (
    CandidateProfileAnalysis,
    RecommendedJobProfile,
    JobRecommendationResponse,
)
from app.config import settings

logger = logging.getLogger(__name__)

class JobRecommendationService:
    """
    Service for generating dynamic, personalized job recommendations derived exclusively
    from candidate resume intelligence and CandidateProfileAnalysis data.
    """

    async def generate_recommendations(
        self,
        profile: CandidateProfileAnalysis,
        api_key_override: Optional[str] = None
    ) -> JobRecommendationResponse:
        """
        Generates 5-8 tailored job profile recommendations based on candidate resume analysis.
        Reuses existing candidate intelligence and does NOT re-process the raw resume PDF.
        """
        # Validate profile completeness
        skills = profile.technicalSkills or profile.strongSkills or []
        experience = profile.experience or []
        projects = profile.projects or []
        education = profile.education or []

        is_incomplete = (
            profile.analysisStatus in ["incomplete_evidence", "insufficient_evidence", "error"] or
            (len(skills) == 0 and len(experience) == 0 and len(projects) == 0 and len(education) == 0)
        )

        if is_incomplete:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="INSUFFICIENT_CANDIDATE_DATA: Insufficient candidate resume data to generate job recommendations. Please analyze a complete resume first."
            )

        candidate_name = profile.candidateName or "Candidate"
        headline = profile.headline or ""
        summary = profile.candidateSummary or profile.summary or ""
        strongest_areas = profile.strongestAreas or []
        development_areas = profile.developmentAreas or profile.developingSkills or []
        target_roles = profile.targetRoles or []

        # Attempt AI generation with configured Gemini provider
        ai_recommendations = await self._generate_with_gemini(
            profile=profile,
            candidate_name=candidate_name,
            headline=headline,
            summary=summary,
            skills=skills,
            experience=experience,
            projects=projects,
            education=education,
            strongest_areas=strongest_areas,
            development_areas=development_areas,
            target_roles=target_roles,
            api_key_override=api_key_override
        )

        if ai_recommendations and len(ai_recommendations) >= 3:
            # Ensure recommendations are sorted by match score descending
            ai_recommendations.sort(key=lambda r: r.matchPercentage, reverse=True)
            return JobRecommendationResponse(
                candidateName=candidate_name,
                heading="Jobs Recommended For You",
                subheading="Based on your resume, skills, experience and career profile.",
                recommendations=ai_recommendations[:8],
                generatedAt=datetime.now(timezone.utc).isoformat(),
                evidenceCount=len(skills) + len(experience) + len(projects)
            )

        # Fallback: Dynamic Evidence-Based Recommendation Generator
        logger.info("[JOB_RECOMMENDATION] LLM unavailable or returned insufficient roles. Running dynamic evidence-based recommender.")
        fallback_recs = self._generate_evidence_based_fallback(
            profile=profile,
            skills=skills,
            experience=experience,
            projects=projects,
            education=education,
            target_roles=target_roles
        )

        fallback_recs.sort(key=lambda r: r.matchPercentage, reverse=True)
        return JobRecommendationResponse(
            candidateName=candidate_name,
            heading="Jobs Recommended For You",
            subheading="Based on your resume, skills, experience and career profile.",
            recommendations=fallback_recs[:8],
            generatedAt=datetime.now(timezone.utc).isoformat(),
            evidenceCount=len(skills) + len(experience) + len(projects)
        )

    async def _generate_with_gemini(
        self,
        profile: CandidateProfileAnalysis,
        candidate_name: str,
        headline: str,
        summary: str,
        skills: List[str],
        experience: List[Any],
        projects: List[Any],
        education: List[Any],
        strongest_areas: List[str],
        development_areas: List[str],
        target_roles: List[Any],
        api_key_override: Optional[str] = None
    ) -> Optional[List[RecommendedJobProfile]]:
        """
        Queries Gemini LLM to generate 5-8 structured Job Recommendations derived strictly
        from the candidate profile intelligence.
        """
        from app.utils.llm import get_llm
        from langchain_core.messages import SystemMessage, HumanMessage

        keys_to_try = [api_key_override] if api_key_override else settings.GEMINI_RESUME_API_KEYS
        keys_to_try = [k for k in keys_to_try if k]
        if not keys_to_try:
            return None

        target_roles_str = ", ".join([
            (r.get("role") if isinstance(r, dict) else str(r))
            for r in target_roles
        ]) if target_roles else "Not specified"

        exp_str = json.dumps(experience[:4]) if experience else "No explicit experience listed"
        projects_str = json.dumps(projects[:4]) if projects else "No explicit projects listed"
        edu_str = json.dumps(education[:3]) if education else "No explicit education listed"

        system_instruction = (
            "You are InterviewOS Career Matching & Job Intelligence Engine.\n"
            "Your task is to generate 5 to 8 highly relevant, personalized job profile recommendations "
            "derived STRICTLY from the provided candidate profile intelligence.\n"
            "DO NOT use generic static mappings or mock job cards. Analyze the candidate's actual skills, "
            "experience, projects, education, strengths, and career targets.\n\n"
            "CRITICAL REQUIREMENTS FOR EACH RECOMMENDED JOB:\n"
            "1. jobTitle: Accurate industry title matching candidate evidence (e.g. React Developer, Python Backend Developer, ML Engineer, Embedded Systems Engineer, Full Stack Engineer, DevOps Engineer).\n"
            "2. matchPercentage: Integer score between 65 and 98 reflecting actual candidate fit.\n"
            "3. whyMatch: Clear explanation starting with 'Why you're a strong match:' explaining how their actual skills and background fit this role.\n"
            "4. matchingSkills: List of specific skills from the candidate's profile that match this role.\n"
            "5. missingSkills: List of 2-4 skills the candidate should strengthen for this role.\n"
            "6. experienceAlignment: Concise 1-2 sentence statement evaluating candidate background vs role expectations.\n"
            "7. careerFit: 'Excellent Match' for match >= 90%, 'Strong Match' for match 80-89%, 'Good Match' for match 65-79%.\n"
            "8. description: Short 1-2 sentence explanation of what candidate would typically do in this role.\n"
            "9. resumeStrengths: 3-4 specific strengths from candidate's resume for this role.\n"
            "10. areasToImprove: 2-3 areas candidate can improve for this role.\n"
            "11. interviewPrepTopics: 3-4 technical interview preparation topics for this role.\n"
            "12. suggestedTech: 3-4 suggested technologies/concepts to prepare for this role.\n\n"
            "Return ONLY a valid JSON array of 5 to 8 job recommendation objects matching the schema."
        )

        prompt = (
            f"CANDIDATE INTELLIGENCE TO MATCH:\n"
            f"- Name: {candidate_name}\n"
            f"- Headline: {headline}\n"
            f"- Summary: {summary}\n"
            f"- Technical Skills: {', '.join(skills)}\n"
            f"- Work Experience: {exp_str}\n"
            f"- Projects: {projects_str}\n"
            f"- Education: {edu_str}\n"
            f"- Demonstrated Strengths: {', '.join(strongest_areas)}\n"
            f"- Growth Areas: {', '.join(development_areas)}\n"
            f"- Target Roles: {target_roles_str}\n\n"
            "Generate 5-8 recommendations ordered by matchPercentage (descending). Return ONLY valid JSON array."
        )

        model_name = settings.GEMINI_MODEL

        for gemini_key in keys_to_try:
            llm = get_llm(temperature=0.2, model_name=model_name, api_key_override=gemini_key)
            if not llm:
                continue
            try:
                response = await llm.ainvoke([
                    SystemMessage(content=system_instruction),
                    HumanMessage(content=prompt)
                ])
                text = str(response.content).strip()
                import re
                json_match = re.search(r'```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```', text)
                if json_match:
                    text = json_match.group(1).strip()
                else:
                    bracket_match = re.search(r'\[\s*\{[\s\S]*\}\s*\]', text)
                    if bracket_match:
                        text = bracket_match.group(0).strip()

                items = json.loads(text)
                if isinstance(items, list) and len(items) > 0:
                    recs = []
                    for idx, item in enumerate(items):
                        rec_id = f"job_rec_{idx+1}_{hashlib.md5(item.get('jobTitle', '').encode()).hexdigest()[:8]}"
                        match_pct = int(item.get("matchPercentage", 80))
                        fit_label = "Excellent Match" if match_pct >= 90 else ("Strong Match" if match_pct >= 80 else "Good Match")
                        recs.append(
                            RecommendedJobProfile(
                                id=rec_id,
                                jobTitle=item.get("jobTitle", "Software Engineer"),
                                matchPercentage=match_pct,
                                whyMatch=item.get("whyMatch", f"Your resume demonstrates strong technical alignment for {item.get('jobTitle')}."),
                                matchingSkills=item.get("matchingSkills") or skills[:4],
                                missingSkills=item.get("missingSkills") or development_areas[:2] or ["System Architecture", "Cloud Optimization"],
                                experienceAlignment=item.get("experienceAlignment", "Strong background alignment based on uploaded candidate profile."),
                                careerFit=item.get("careerFit", fit_label),
                                description=item.get("description", f"Develop, deploy and optimize core features for {item.get('jobTitle')} systems."),
                                resumeStrengths=item.get("resumeStrengths") or skills[:3],
                                areasToImprove=item.get("areasToImprove") or development_areas[:2] or ["Advanced Design Patterns"],
                                interviewPrepTopics=item.get("interviewPrepTopics") or [f"{item.get('jobTitle')} Core Concepts", "Data Structures", "System Design"],
                                suggestedTech=item.get("suggestedTech") or skills[:3] or ["Git", "REST APIs"]
                            )
                        )
                    return recs
            except Exception as err:
                err_str = str(err)
                logger.warning(f"[GEMINI_JOB_REC_ERROR] model={model_name}: {err_str}")
                return self._generate_evidence_based_fallback(profile, skills, experience, projects, education, target_roles)

        return self._generate_evidence_based_fallback(profile, skills, experience, projects, education, target_roles)


    def _generate_evidence_based_fallback(
        self,
        profile: CandidateProfileAnalysis,
        skills: List[str],
        experience: List[Any],
        projects: List[Any],
        education: List[Any],
        target_roles: List[Any]
    ) -> List[RecommendedJobProfile]:
        """
        Computes evidence-aligned dynamic job recommendations directly from candidate attributes
        when LLM services are offline or rate limited.
        Only returns archetypes with actual keyword overlap — irrelevant roles are excluded.
        """
        # Build combined evidence text from all candidate signals for broader matching
        all_skill_text = " ".join(skills).lower()
        proj_text = " ".join([
            (p.get("title", "") if isinstance(p, dict) else str(p))
            for p in projects
        ]).lower()
        exp_text_blob = " ".join([
            ((e.get("title", "") + " " + e.get("company", "")) if isinstance(e, dict) else str(e))
            for e in experience
        ]).lower()
        target_roles_text = " ".join([
            (tr.get("role") if isinstance(tr, dict) else str(tr))
            for tr in target_roles
        ]).lower()

        combined_text = f"{all_skill_text} {proj_text} {exp_text_blob} {target_roles_text}"
        skills_set = set(s.lower() for s in skills)

        # Extended archetype library — ordered by general industry prevalence
        archetypes = [
            {
                "title": "AI / ML Engineer",
                "keywords": ["machine learning", "deep learning", "pytorch", "tensorflow", "genai",
                             "generative ai", "llm", "langchain", "vector", " ai", "rag", "nlp",
                             "scikit", "keras", "huggingface", "embedding", "openai"],
                "req_skills": ["Python", "PyTorch/TensorFlow", "Generative AI", "LangChain", "Vector Databases"],
                "missing_pool": ["Model Fine-Tuning", "MLOps Pipeline", "GPU Acceleration", "Prompt Engineering"],
                "description": "Build, fine-tune, and deploy machine learning models and Retrieval-Augmented Generation (RAG) pipelines.",
                "prep_topics": ["Transformer Architectures", "RAG Pipeline Engineering", "Embedding & Vector Search", "Model Evaluation Metrics"]
            },
            {
                "title": "Full Stack Developer",
                "keywords": ["fullstack", "full stack", "react", "node.js", "nodejs", "express",
                             "javascript", "typescript", "nextjs", "next.js", "vite", "sql",
                             "postgresql", "mysql", "mongodb", "firebase"],
                "req_skills": ["React/Frontend Frameworks", "Node.js/Python Backend", "RESTful APIs", "SQL/NoSQL", "Git"],
                "missing_pool": ["Docker Containerization", "CI/CD Pipelines", "System Design", "AWS Deployment"],
                "description": "Deliver end-to-end software solutions across user-facing client interfaces and backend microservices.",
                "prep_topics": ["Full-Stack Architecture Patterns", "API Integration", "Database Schema Design", "Security & CORS"]
            },
            {
                "title": "Frontend Developer",
                "keywords": ["react", "javascript", "typescript", "html", "css", "vue", "angular",
                             "tailwind", "next.js", "nextjs", "svelte", "frontend", "figma", "vite", "webpack"],
                "req_skills": ["React", "JavaScript", "TypeScript", "HTML5/CSS3", "State Management"],
                "missing_pool": ["Next.js SSR", "GraphQL", "Web Vitals Optimization", "E2E Testing"],
                "description": "Design and build responsive, highly interactive web user interfaces using modern frontend framework architectures.",
                "prep_topics": ["Component Lifecycle & Hooks", "DOM Rendering & State Management", "Performance Optimization", "Async Data Fetching"]
            },
            {
                "title": "Python Backend Developer",
                "keywords": ["python", "fastapi", "django", "flask", "postgresql", "sql",
                             "redis", "celery", "backend", "rest api", "mysql", "sqlalchemy"],
                "req_skills": ["Python", "FastAPI", "REST APIs", "SQL Databases", "Git"],
                "missing_pool": ["Docker/Containerization", "Redis Caching", "Microservices Architecture", "Celery Task Queues"],
                "description": "Architect and implement scalable server-side microservices, REST APIs, and database models.",
                "prep_topics": ["FastAPI Async Endpoints", "SQL Query Optimization", "ORM & Migration Patterns", "Authentication & Security"]
            },
            {
                "title": "Flutter Mobile Developer",
                "keywords": ["flutter", "dart", "mobile", "ios", "android", "bloc", "provider", "riverpod"],
                "req_skills": ["Flutter", "Dart", "Mobile App Architecture", "State Management", "REST APIs"],
                "missing_pool": ["Native Android/iOS Integrations", "App Store Publishing", "Offline Sync", "CI/CD Deployment"],
                "description": "Create high-performance cross-platform mobile applications for iOS and Android.",
                "prep_topics": ["Widget Lifecycle", "BLoC & Riverpod State Management", "Native Method Channels", "App Performance Tuning"]
            },
            {
                "title": "Firebase & Cloud App Developer",
                "keywords": ["firebase", "firestore", "cloud functions", "gcp", "google cloud",
                             "aws", "azure", "serverless", "cloud", "firebase auth"],
                "req_skills": ["Firebase/Firestore", "Cloud Functions", "Authentication", "Real-time Database", "REST APIs"],
                "missing_pool": ["Cloud Architecture Design", "Pub/Sub Messaging", "Cloud Run Deployment", "Security Rules"],
                "description": "Design and implement serverless cloud-native applications with Firebase, GCP, and managed backend services.",
                "prep_topics": ["Firestore Data Modeling", "Cloud Functions & Triggers", "Firebase Auth Flows", "Cost Optimization"]
            },
            {
                "title": "Software Engineer",
                "keywords": ["software engineer", "software developer", "programming", "git",
                             "github", "agile", "scrum", "api", "postman", "rest"],
                "req_skills": ["Programming Languages", "REST APIs", "Git/GitHub", "Agile Methodology", "Problem Solving"],
                "missing_pool": ["System Design", "Distributed Systems", "Performance Optimization", "Cloud Deployment"],
                "description": "Design, develop, and maintain software applications across multiple layers of the product stack.",
                "prep_topics": ["Data Structures & Algorithms", "Object-Oriented Design", "System Design Fundamentals", "Code Review & Clean Code"]
            },
            {
                "title": "Data Engineer",
                "keywords": ["sql", "postgresql", "mysql", "data", "etl", "pipeline",
                             "spark", "kafka", "bigquery", "hadoop", "pandas", "numpy"],
                "req_skills": ["SQL", "ETL Pipelines", "Python/PySpark", "Cloud Data Warehouses", "Data Modeling"],
                "missing_pool": ["Apache Kafka", "dbt Transformations", "Airflow Orchestration", "Real-time Streaming"],
                "description": "Build and maintain robust data pipelines, warehouses, and ETL/ELT flows to support analytics and ML teams.",
                "prep_topics": ["SQL Query Optimization", "Data Warehouse Design", "Batch vs Streaming", "Data Quality & Testing"]
            },
            {
                "title": "Cloud & DevOps Engineer",
                "keywords": ["aws", "docker", "kubernetes", "terraform", "ci/cd", "cloud",
                             "devops", "linux", "bash", "jenkins", "github actions", "helm"],
                "req_skills": ["Docker", "Linux", "AWS/Cloud", "CI/CD Pipelines", "Git"],
                "missing_pool": ["Kubernetes Orchestration", "Terraform IaC", "Monitoring & Observability", "Helm Charts"],
                "description": "Automate deployment infrastructure, manage CI/CD pipelines, and ensure continuous availability of cloud applications.",
                "prep_topics": ["Containerization Best Practices", "Infrastructure as Code", "CI/CD Workflow Design", "Cloud Security"]
            },
            {
                "title": "Embedded Software Engineer",
                "keywords": ["c++", "embedded", "iot", "rtos", "microcontroller",
                             "firmware", "hardware", "stm32", "arduino", "raspberry pi", "arm cortex"],
                "req_skills": ["C++", "C", "Microcontrollers", "RTOS", "Embedded Systems"],
                "missing_pool": ["System Architecture", "ARM Cortex Peripherals", "CAN Bus", "Firmware Debugging"],
                "description": "Develop low-level firmware, driver interfaces, and real-time operating system applications for hardware devices.",
                "prep_topics": ["Memory Management & Pointers", "Interrupt Handlers & Timers", "I2C / SPI Communication", "RTOS Task Scheduling"]
            },
        ]

        target_roles_lower = [
            (tr.get("role") if isinstance(tr, dict) else str(tr)).lower()
            for tr in target_roles
        ]

        matched_scores = []

        for arch in archetypes:
            # Match keywords against individual skills
            matching_sks = []
            for s in skills:
                s_lower = s.lower()
                if any(kw in s_lower for kw in arch["keywords"]):
                    if s not in matching_sks:
                        matching_sks.append(s)

            # Also count keyword hits in the broader combined evidence text blob
            keyword_hits_in_text = sum(1 for kw in arch["keywords"] if kw in combined_text)
            overlap_count = len(matching_sks)

            # Check if this role matches candidate's stated target roles
            tr_match = any(
                arch["title"].lower() in tr_lower or tr_lower in arch["title"].lower()
                for tr_lower in target_roles_lower
            )

            # CRITICAL FIX: Skip archetypes with NO evidence overlap unless explicitly in target roles
            if overlap_count == 0 and keyword_hits_in_text == 0 and not tr_match:
                continue

            # Base match score derived from evidence overlap
            base_score = 65 + min(28, overlap_count * 6 + min(keyword_hits_in_text, 3) * 2)

            # Score boost if role is in candidate's explicitly stated target roles
            if tr_match:
                base_score = min(96, base_score + 12)

            matched_scores.append((arch, base_score, matching_sks))

        # Sort by calculated match score descending, take top 8
        matched_scores.sort(key=lambda x: x[1], reverse=True)
        selected = matched_scores[:8]

        recommendations = []
        for idx, (arch, score, matching_sks) in enumerate(selected):
            verified_matching = matching_sks if matching_sks else [s for s in skills if s in arch["req_skills"]]
            if not verified_matching:
                verified_matching = skills[:3] if skills else arch["req_skills"][:3]

            missing_sks = [m for m in arch["missing_pool"] if m.lower() not in skills_set][:2]
            if not missing_sks:
                missing_sks = ["System Architecture", "Performance Tuning"]

            fit_label = "Excellent Match" if score >= 90 else ("Strong Match" if score >= 80 else "Good Match")

            rec_id = f"fallback_rec_{idx+1}_{hashlib.md5(arch['title'].encode()).hexdigest()[:8]}"
            why_text = f"Your resume demonstrates strong technical alignment in {', '.join(verified_matching[:3])} for {arch['title']} roles."

            exp_count = len(experience)
            exp_alignment = (
                f"Matches your candidate profile with {exp_count} documented position(s) and technical skill set."
                if exp_count > 0
                else "Aligns with candidate's demonstrated technical competencies."
            )

            recommendations.append(
                RecommendedJobProfile(
                    id=rec_id,
                    jobTitle=arch["title"],
                    matchPercentage=score,
                    whyMatch=f"Why you're a strong match: {why_text}",
                    matchingSkills=verified_matching[:5],
                    missingSkills=missing_sks,
                    experienceAlignment=exp_alignment,
                    careerFit=fit_label,
                    description=arch["description"],
                    resumeStrengths=verified_matching[:4],
                    areasToImprove=missing_sks,
                    interviewPrepTopics=arch["prep_topics"],
                    suggestedTech=verified_matching[:3] + missing_sks[:1]
                )
            )

        return recommendations

job_recommendation_service = JobRecommendationService()
