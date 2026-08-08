import pytest
from app.services.scoring_engine import scoring_engine
from app.schemas.interview import JobDetails, NormalizedCandidateProfile


def test_realtime_job_switching_flow():
    """
    Simulates real-time browser tab switching from Job A to Job B without restarting extension.
    Verifies that match scores, skill gaps, and readiness metrics update dynamically.
    """
    candidate_profile = NormalizedCandidateProfile(
        platform="LinkedIn",
        profileUrl="https://linkedin.com/in/garvit-sharma",
        profileId="garvit-1",
        name="Garvit Sharma",
        skills=["Python", "FastAPI", "Docker", "PyTorch", "RAG"],
        experience=["AI Engineer at Tech Corp"],
        projects=["LLM Fine-tuning Pipeline"]
    )

    # State 1: Active Tab is Job A (Backend AI Engineer)
    job_a = JobDetails(
        jobTitle="AI Systems Engineer",
        company="OpenAI Partner",
        skills=["Python", "FastAPI", "PyTorch", "RAG"],
        description="Build scalable AI pipelines with Python, FastAPI, and RAG."
    )

    match_a = scoring_engine.calculate_job_match(
        candidate_skills=candidate_profile.skills,
        candidate_experience=candidate_profile.experience,
        candidate_projects=candidate_profile.projects,
        candidate_roles=["AI Systems Engineer"],
        job=job_a
    )

    gaps_a = scoring_engine.calculate_skill_gaps(
        candidate_skills=candidate_profile.skills,
        job_skills=job_a.skills
    )

    # State 2: User navigates to Job B (Frontend React Lead)
    job_b = JobDetails(
        jobTitle="Lead Frontend Engineer",
        company="Design Systems Inc",
        skills=["React", "TypeScript", "TailwindCSS", "Next.js"],
        description="Lead frontend development using React, TypeScript, and Next.js."
    )

    match_b = scoring_engine.calculate_job_match(
        candidate_skills=candidate_profile.skills,
        candidate_experience=candidate_profile.experience,
        candidate_projects=candidate_profile.projects,
        candidate_roles=["AI Systems Engineer"],
        job=job_b
    )

    gaps_b = scoring_engine.calculate_skill_gaps(
        candidate_skills=candidate_profile.skills,
        job_skills=job_b.skills
    )

    # Verification: Job A vs Job B MUST produce distinct match scores and skill gaps
    assert match_a.score > match_b.score
    assert match_a.score >= 85
    assert match_b.score < 60

    # Skill Gap Verification: Job A has 0 missing skills; Job B has missing React, TypeScript, Next.js
    missing_a = [g.skill for g in gaps_a if g.status == "missing"]
    missing_b = [g.skill for g in gaps_b if g.status == "missing"]

    assert len(missing_a) == 0
    assert "React" in missing_b
    assert "TypeScript" in missing_b


def test_realtime_profile_switching_flow():
    """
    Simulates candidate context switching from Profile A (Backend Dev) to Profile B (Frontend Dev)
    on the exact same Job page.
    """
    job = JobDetails(
        jobTitle="Senior React Developer",
        company="Web Scale LLC",
        skills=["React", "TypeScript", "State Management", "CSS"],
        description="Senior React Developer role."
    )

    # Profile A: Backend Python Developer
    profile_a = NormalizedCandidateProfile(
        platform="LinkedIn",
        profileUrl="https://linkedin.com/in/dev-a",
        profileId="dev-a",
        name="Developer A",
        skills=["Python", "Django", "PostgreSQL", "Docker"]
    )

    # Profile B: Frontend Specialist
    profile_b = NormalizedCandidateProfile(
        platform="GitHub",
        profileUrl="https://github.com/dev-b",
        profileId="dev-b",
        name="Developer B",
        skills=["React", "TypeScript", "State Management", "TailwindCSS"]
    )

    match_profile_a = scoring_engine.calculate_job_match(
        candidate_skills=profile_a.skills,
        candidate_experience=[],
        candidate_projects=[],
        candidate_roles=["Backend Engineer"],
        job=job
    )

    match_profile_b = scoring_engine.calculate_job_match(
        candidate_skills=profile_b.skills,
        candidate_experience=[],
        candidate_projects=[],
        candidate_roles=["Frontend Engineer"],
        job=job
    )

    # Verification: Switching from Profile A to Profile B on the same job changes match score dynamically
    assert match_profile_b.score > match_profile_a.score
    assert "React" in match_profile_b.matchedSkills
    assert "React" in match_profile_a.missingSkills
