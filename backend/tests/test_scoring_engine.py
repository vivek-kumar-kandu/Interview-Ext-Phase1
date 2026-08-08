import pytest
from app.services.scoring_engine import scoring_engine
from app.schemas.interview import JobDetails, NormalizedCandidateProfile


def test_strongly_matching_job_high_score():
    """1. Strongly matching job -> high score (>= 80%)"""
    candidate_skills = ["React", "JavaScript", "TypeScript", "REST API", "Git"]
    candidate_exp = ["Senior Frontend Developer at Tech Corp (4 yrs)"]
    candidate_projects = ["React Dashboard App", "TypeScript Web Application"]
    candidate_roles = ["Frontend React Engineer"]
    candidate_edu = ["B.Tech Computer Science"]

    job = JobDetails(
        jobTitle="Frontend React Engineer",
        company="TechCorp",
        skills=["React", "JavaScript", "TypeScript", "REST API"],
        description="Looking for Senior Frontend React Engineer with TypeScript and REST API experience."
    )

    match = scoring_engine.calculate_job_match(
        candidate_skills=candidate_skills,
        candidate_experience=candidate_exp,
        candidate_projects=candidate_projects,
        candidate_roles=candidate_roles,
        candidate_education=candidate_edu,
        job=job
    )

    assert match is not None
    assert match.score >= 80
    assert "React" in match.matchedSkills
    assert len(match.missingSkills) == 0


def test_weakly_matching_job_low_score():
    """2. Weakly matching job -> low score (< 65%)"""
    candidate_skills = ["React", "JavaScript"]
    candidate_exp = ["Junior Developer (1 yr)"]
    candidate_projects = ["Portfolio Site"]
    candidate_roles = ["Junior Developer"]

    job = JobDetails(
        jobTitle="Senior Backend Python Architect",
        company="Data Corp",
        skills=["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS"],
        description="Senior Backend Architect required with 8+ years Python, Docker, Kubernetes, and AWS experience."
    )

    match = scoring_engine.calculate_job_match(
        candidate_skills=candidate_skills,
        candidate_experience=candidate_exp,
        candidate_projects=candidate_projects,
        candidate_roles=candidate_roles,
        job=job
    )

    assert match is not None
    assert match.score < 65
    assert len(match.missingSkills) >= 4


def test_unrelated_job_very_low_score():
    """3. Completely unrelated job -> very low score (<= 40%)"""
    candidate_skills = ["Graphic Design", "Photoshop", "Illustrator"]
    candidate_exp = ["Visual Designer (1 yr)"]
    candidate_projects = ["Logo Design"]
    candidate_roles = ["UI Designer"]

    job = JobDetails(
        jobTitle="Embedded Systems Kernel Engineer",
        company="Hardware Systems",
        skills=["C++", "Assembly", "RTOS", "Linux Kernel", "FPGA"],
        description="Looking for Low Level Embedded Kernel Developer in C++ and Assembly."
    )

    match = scoring_engine.calculate_job_match(
        candidate_skills=candidate_skills,
        candidate_experience=candidate_exp,
        candidate_projects=candidate_projects,
        candidate_roles=candidate_roles,
        job=job
    )

    assert match is not None
    assert match.score <= 40


def test_same_resume_and_job_same_result():
    """4. Same resume + same job -> same exact result (Reproducibility)"""
    job = JobDetails(
        jobTitle="Software Engineer",
        company="Scale Tech",
        skills=["Python", "React", "Docker"],
        description="Software Engineer role."
    )
    cand_skills = ["Python", "React"]

    res1 = scoring_engine.calculate_job_match(
        candidate_skills=cand_skills,
        candidate_experience=["Software Engineer (2 yrs)"],
        candidate_projects=["Project A"],
        candidate_roles=["Software Engineer"],
        job=job
    )

    res2 = scoring_engine.calculate_job_match(
        candidate_skills=cand_skills,
        candidate_experience=["Software Engineer (2 yrs)"],
        candidate_projects=["Project A"],
        candidate_roles=["Software Engineer"],
        job=job
    )

    assert res1 is not None and res2 is not None
    assert res1.score == res2.score
    assert res1.calculation == res2.calculation
    assert res1.matchedSkills == res2.matchedSkills


def test_missing_job_description_no_score():
    """5. Missing job description/details -> no score (None)"""
    job_empty = JobDetails(jobTitle="", company="", skills=[], description="")

    match = scoring_engine.calculate_job_match(
        candidate_skills=["Python", "React"],
        candidate_experience=["Developer"],
        candidate_projects=["App"],
        candidate_roles=["Developer"],
        job=job_empty
    )

    assert match is None


def test_missing_resume_data_no_score():
    """6. Missing resume data -> no fabricated score (None)"""
    job = JobDetails(
        jobTitle="Frontend Engineer",
        company="Acme",
        skills=["React", "TypeScript"],
        description="Frontend Engineer posting."
    )

    match = scoring_engine.calculate_job_match(
        candidate_skills=[],
        candidate_experience=[],
        candidate_projects=[],
        candidate_roles=[],
        job=job
    )

    assert match is None


def test_different_jobs_different_scores():
    """7. Different jobs -> different scores for same candidate profile"""
    candidate_skills = ["Python", "FastAPI", "Docker", "SQL"]
    candidate_exp = ["Backend Developer at Tech Corp (2 yrs)"]
    candidate_projects = ["AI Microservice Engine"]
    candidate_roles = ["Backend Engineer"]

    job_a = JobDetails(
        jobTitle="Senior Backend Python Developer",
        company="Cloud Systems",
        skills=["Python", "FastAPI", "Docker", "SQL"],
        description="Seeking backend engineer with strong Python, FastAPI, and Docker experience."
    )

    job_b = JobDetails(
        jobTitle="Frontend React Developer",
        company="UI Labs",
        skills=["React", "TypeScript", "CSS", "Tailwind"],
        description="Looking for frontend specialist in React and TypeScript."
    )

    job_c = JobDetails(
        jobTitle="Data Analyst",
        company="Analytics Inc",
        skills=["Excel", "Tableau", "PowerBI", "SQL"],
        description="Data analyst position requiring Tableau and Excel."
    )

    match_a = scoring_engine.calculate_job_match(candidate_skills, candidate_exp, candidate_projects, candidate_roles, job=job_a)
    match_b = scoring_engine.calculate_job_match(candidate_skills, candidate_exp, candidate_projects, candidate_roles, job=job_b)
    match_c = scoring_engine.calculate_job_match(candidate_skills, candidate_exp, candidate_projects, candidate_roles, job=job_c)

    assert match_a is not None and match_b is not None and match_c is not None
    assert match_a.score != match_b.score
    assert match_b.score != match_c.score
    assert match_a.score > match_b.score
    assert match_a.score > match_c.score
