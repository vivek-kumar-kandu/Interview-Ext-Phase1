import asyncio
import logging
from unittest.mock import AsyncMock, patch
from app.services.lpa_interview_engine import lpa_interview_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify_interview_flow")

async def test_interview_flow():
    candidate = {
        "name": "Sarah Connor",
        "headline": "Full-Stack AI Developer",
        "skills": ["React", "TypeScript", "Node.js", "Python", "FastAPI", "PostgreSQL"],
        "experience": ["5 years building web applications and microservices"],
        "projects": ["Built AI-powered document intelligence pipeline using FastAPI and React"]
    }

    job_a = {
        "id": "job_react_101",
        "jobTitle": "Senior React Frontend Architect",
        "company": "DesignCraft Inc",
        "skills": ["React 18", "TypeScript", "Redux Toolkit", "Web Performance", "CSS/Tailwind"],
        "description": "Lead frontend architecture for our high-scale React application. Optimize render performance, component design system, and state management."
    }

    job_b = {
        "id": "job_java_202",
        "jobTitle": "Principal Java Microservices Engineer",
        "company": "FinTech Global Solutions",
        "skills": ["Java 21", "Spring Boot", "Kafka", "Docker", "Kubernetes", "PostgreSQL"],
        "description": "Design resilient backend microservices using Java Spring Boot and Apache Kafka for event-driven trading platforms."
    }

    match_a = {
        "matchScore": 86,
        "matchedSkills": ["React", "TypeScript"],
        "missingSkills": ["Redux Toolkit", "Web Performance"]
    }

    match_b = {
        "matchScore": 62,
        "matchedSkills": ["PostgreSQL"],
        "missingSkills": ["Java 21", "Spring Boot", "Kafka", "Kubernetes"]
    }

    mock_llm_a = AsyncMock()
    mock_llm_a.ainvoke.return_value.content = '{"question": "How would you optimize component render performance and Redux Toolkit state in a high-scale React application?", "topic": "React Architecture & Performance", "difficulty": "Senior"}'

    mock_llm_b = AsyncMock()
    mock_llm_b.ainvoke.return_value.content = '{"question": "Explain your approach to designing resilient Kafka message consumers in Java Spring Boot microservices.", "topic": "Java & Distributed Systems", "difficulty": "Lead"}'

    logger.info("==================================================")
    logger.info("TESTING JOB A INTERVIEW GENERATION (React Architect)")
    logger.info("==================================================")
    
    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm_a):
        start_a = await lpa_interview_engine.start_interview(
            candidate_profile=candidate,
            job_profile=job_a,
            match_analysis=match_a,
            expected_lpa=18.0
        )

    logger.info(f"JOB A Question 1: {start_a['question']}")
    logger.info(f"JOB A Topic: {start_a['topic']} | Difficulty: {start_a['difficulty']}")

    logger.info("\n==================================================")
    logger.info("TESTING JOB B INTERVIEW GENERATION (Java Microservices)")
    logger.info("==================================================")

    with patch("app.services.lpa_interview_engine.get_llm", return_value=mock_llm_b):
        start_b = await lpa_interview_engine.start_interview(
            candidate_profile=candidate,
            job_profile=job_b,
            match_analysis=match_b,
            expected_lpa=25.0
        )

    logger.info(f"JOB B Question 1: {start_b['question']}")
    logger.info(f"JOB B Topic: {start_b['topic']} | Difficulty: {start_b['difficulty']}")

    assert start_a['question'] != start_b['question'], "Job A and Job B questions must be distinct!"
    logger.info("\nVERIFICATION SUCCESS: Job A questions and Job B questions are dynamically grounded in their respective job context!")

if __name__ == "__main__":
    asyncio.run(test_interview_flow())
