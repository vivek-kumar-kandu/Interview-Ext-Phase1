from typing import Optional
from app.config import settings
from app.rag.retriever import curriculum_retriever
from app.services.curriculum_service import curriculum_service
from app.schemas.interview import CandidateProfile, JobDetails


class QuestionGenerator:
    """
    Generates tailored technical questions based on curriculum context, candidate background, and job posting requirements.
    """
    async def generate_question(
        self,
        day: int,
        candidate: Optional[CandidateProfile] = None,
        job: Optional[JobDetails] = None,
        turn_index: int = 1
    ) -> str:
        day_info = curriculum_service.get_day_info(day)
        day_title = day_info.get("title", "Technical Concepts") if day_info else f"Day {day} Concepts"
        context = curriculum_retriever.get_day_context(day)

        company = job.company if job and job.company else "the target company"
        job_title = job.jobTitle if job and job.jobTitle else "AI Engineer"
        required_skills = ", ".join(job.skills) if job and job.skills else "FastAPI, LangGraph, RAG, Docker"

        if settings.OPENAI_API_KEY:
            try:
                from langchain_openai import ChatOpenAI
                from langchain_core.messages import SystemMessage, HumanMessage

                llm = ChatOpenAI(
                    model=settings.OPENAI_MODEL,
                    api_key=settings.OPENAI_API_KEY,
                    temperature=0.7
                )

                job_role = candidate.member.jobRole if candidate else job_title
                years_exp = candidate.member.yearsExperience if candidate else 3

                prompt = (
                    f"You are a Principal AI Technical Interviewer evaluating a candidate for the {job_title} role at {company}.\n"
                    f"Job Skill Requirements: {required_skills}\n"
                    f"Curriculum Topic: Day {day} - {day_title}\n"
                    f"Curriculum Context: {context}\n"
                    f"Candidate Background: {years_exp} yrs exp in {job_role}.\n\n"
                    f"Ask ONE scenario-based technical question (Question #{turn_index}) directly referencing the role at {company} and testing practical knowledge of {day_title}."
                )

                response = await llm.ainvoke([HumanMessage(content=prompt)])
                return response.content.strip()
            except Exception:
                pass

        # Deterministic fallback question incorporating job posting details
        tools = ", ".join(day_info.get("tools", ["core tools"])) if day_info else required_skills
        if turn_index == 1 and job and job.company:
            return (
                f"I noticed this role at {company} for {job_title} requires strong expertise in {required_skills}. "
                f"Suppose you are designing a high-throughput system at {company} using {day_title} ({tools}). "
                f"How would you structure the architecture for maximum performance and reliability?"
            )
        
        return f"Regarding the technical requirements for this {job_title} role, how do you approach design and implementation when working with {day_title} ({tools})?"


question_generator = QuestionGenerator()
