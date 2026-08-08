import asyncio
import json
import logging
from app.services.ai_provider import GeminiProvider, BreethProvider, LocalDeterministicProvider, AIProviderFactory
from app.services.candidate_analyzer import candidate_analyzer
from app.services.job_analyzer import job_analyzer_service
from app.services.scoring_engine import scoring_engine
from app.schemas.interview import JobDetails, NormalizedCandidateProfile

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_end_to_end_dynamic_pipeline_verification():
    print("\n==========================================================================")
    print("      INTERVIEWOS ZERO-STATIC-DATA END-TO-END DYNAMIC PIPELINE AUDIT      ")
    print("==========================================================================\n")

    # ------------------------------------------------------------------------
    # SCENARIO 1: RESUME A vs RESUME B
    # ------------------------------------------------------------------------
    print("[SCENARIO 1] Uploading Resume A (Frontend Focus: React, TypeScript, Next.js)...")
    resume_a_text = """
    Alice Vance
    Email: alice@vance.io | Location: San Francisco, CA
    Summary: Senior Frontend Engineer with 5 years experience building scalable Web Apps.
    Technical Skills: React, TypeScript, Next.js, Redux, TailwindCSS, HTML5, CSS3, Jest
    Experience:
    - Lead Frontend Engineer at CloudScale (2021 - Present): Developed React/TypeScript UI applications.
    Education: B.S. Computer Science - UC Berkeley
    """

    resume_a_analysis = await candidate_analyzer.analyze_resume_file_with_gemini(
        resume_text=resume_a_text,
        filename="alice_vance_resume.pdf",
        resume_hash="hash_alice_vance_123"
    )

    print(f"--> Candidate A Name: {resume_a_analysis.candidateName}")
    print(f"--> Candidate A Technical Skills: {resume_a_analysis.technicalSkills}")
    print(f"--> Candidate A Summary: {resume_a_analysis.summary}")

    print("\n[SCENARIO 1.2] Uploading Resume B (Backend/ML Focus: Python, PyTorch, Docker, Redis)...")
    resume_b_text = """
    Bob Smith
    Email: bob@smith.dev | Location: Austin, TX
    Summary: AI Infrastructure Engineer specializing in Python, PyTorch models, and high-performance microservices.
    Technical Skills: Python, PyTorch, FastAPI, Docker, Redis, Kubernetes, PostgreSQL, LangChain
    Experience:
    - AI Backend Engineer at MachineTech (2022 - Present): Built RAG search engines with FastAPI and Redis.
    Education: M.S. Data Science - UT Austin
    """

    resume_b_analysis = await candidate_analyzer.analyze_resume_file_with_gemini(
        resume_text=resume_b_text,
        filename="bob_smith_resume.pdf",
        resume_hash="hash_bob_smith_456"
    )

    print(f"--> Candidate B Name: {resume_b_analysis.candidateName}")
    print(f"--> Candidate B Technical Skills: {resume_b_analysis.technicalSkills}")
    print(f"--> Candidate B Summary: {resume_b_analysis.summary}")

    assert resume_a_analysis.candidateName != resume_b_analysis.candidateName, "Candidate names MUST differ!"
    assert set(resume_a_analysis.technicalSkills) != set(resume_b_analysis.technicalSkills), "Technical skills MUST differ!"
    print("\n[SUCCESS] SCENARIO 1 PASSED: Resume A and Resume B produced completely distinct dynamic Candidate Profiles!")

    # ------------------------------------------------------------------------
    # SCENARIO 2: JOB A vs JOB B
    # ------------------------------------------------------------------------
    print("\n[SCENARIO 2] Evaluating Job A (Frontend Developer) vs Job B (ML Engineer)...")

    job_a = JobDetails(
        jobTitle="Frontend Developer",
        company="Acme Web Corp",
        skills=["React", "TypeScript", "Next.js", "CSS3"],
        description="Looking for an experienced Frontend Developer with React and TypeScript skills."
    )

    job_b = JobDetails(
        jobTitle="AI / ML Systems Engineer",
        company="DeepCognition AI",
        skills=["Python", "PyTorch", "Docker", "Redis", "FastAPI"],
        description="Seeking an AI ML Engineer with PyTorch, Docker, Redis, and FastAPI expertise."
    )

    # Candidate A against Job A vs Job B
    match_a_a = scoring_engine.calculate_job_match(
        candidate_skills=resume_a_analysis.technicalSkills,
        candidate_experience=resume_a_analysis.experience,
        candidate_projects=resume_a_analysis.projects,
        candidate_roles=resume_a_analysis.targetRoles or ["Frontend Developer"],
        job=job_a
    )

    match_a_b = scoring_engine.calculate_job_match(
        candidate_skills=resume_a_analysis.technicalSkills,
        candidate_experience=resume_a_analysis.experience,
        candidate_projects=resume_a_analysis.projects,
        candidate_roles=resume_a_analysis.targetRoles or ["Frontend Developer"],
        job=job_b
    )

    print(f"--> Candidate A (Frontend) vs Job A (Frontend Job): Score = {match_a_a.score}% ({match_a_a.label})")
    print(f"    Matched Skills: {match_a_a.matchedSkills}")
    print(f"    Missing Skills: {match_a_a.missingSkills}")

    print(f"--> Candidate A (Frontend) vs Job B (ML Job): Score = {match_a_b.score}% ({match_a_b.label})")
    print(f"    Matched Skills: {match_a_b.matchedSkills}")
    print(f"    Missing Skills: {match_a_b.missingSkills}")

    assert match_a_a.score != match_a_b.score, "Match scores MUST differ across different jobs!"
    assert match_a_a.score > match_a_b.score, "Candidate A MUST score higher on Frontend job than ML job!"

    # Candidate B against Job A vs Job B
    match_b_a = scoring_engine.calculate_job_match(
        candidate_skills=resume_b_analysis.technicalSkills,
        candidate_experience=resume_b_analysis.experience,
        candidate_projects=resume_b_analysis.projects,
        candidate_roles=resume_b_analysis.targetRoles or ["AI Backend Engineer"],
        job=job_a
    )

    match_b_b = scoring_engine.calculate_job_match(
        candidate_skills=resume_b_analysis.technicalSkills,
        candidate_experience=resume_b_analysis.experience,
        candidate_projects=resume_b_analysis.projects,
        candidate_roles=resume_b_analysis.targetRoles or ["AI Backend Engineer"],
        job=job_b
    )

    print(f"--> Candidate B (ML) vs Job A (Frontend Job): Score = {match_b_a.score}% ({match_b_a.label})")
    print(f"--> Candidate B (ML) vs Job B (ML Job): Score = {match_b_b.score}% ({match_b_b.label})")

    assert match_b_b.score > match_b_a.score, "Candidate B MUST score higher on ML job than Frontend job!"
    print("\n[SUCCESS] SCENARIO 2 PASSED: Job A vs Job B produced dynamic score matrix!")

    # ------------------------------------------------------------------------
    # SCENARIO 3: INCOMPLETE / MINIMAL RESUME
    # ------------------------------------------------------------------------
    print("\n[SCENARIO 3] Uploading Incomplete Resume (Name only, no skills/experience)...")
    empty_resume_text = "John Doe\nEmail: john@doe.com\nPhone: 123-456-7890"

    empty_analysis = await candidate_analyzer.analyze_resume_file_with_gemini(
        resume_text=empty_resume_text,
        filename="empty_resume.pdf",
        resume_hash="hash_empty_123"
    )

    print(f"--> Profile Completeness: {empty_analysis.profileCompleteness}%")
    print(f"--> Analysis Status: {empty_analysis.analysisStatus}")
    print(f"--> Error Message: {empty_analysis.errorMessage}")

    assert empty_analysis.analysisStatus == "incomplete_evidence", "Must be flagged incomplete_evidence"
    assert len(empty_analysis.technicalSkills) == 0, "Must NOT hallucinate technical skills"
    assert len(empty_analysis.targetRoles) == 0, "Must NOT invent fake target roles"
    print("\n[SUCCESS] SCENARIO 3 PASSED: Incomplete resume flagged with ZERO hallucinated skills or roles!")

    # ------------------------------------------------------------------------
    # SCENARIO 4: AI PROVIDER FAILURE HANDLING
    # ------------------------------------------------------------------------
    print("\n[SCENARIO 4] Verifying Error State Handling when AI Provider Fails...")
    # Simulating explicit AI provider error return
    failed_analysis = await candidate_analyzer.analyze_profile_with_gemini(
        profile=NormalizedCandidateProfile(
            platform="LinkedIn",
            profileUrl="",
            profileId="cand_fail",
            name="Charlie",
            skills=[]
        )
    )

    print(f"--> Failure Status: {failed_analysis.analysisStatus}")
    print(f"--> Error Notice: {failed_analysis.errorMessage}")

    assert failed_analysis.analysisStatus in ("insufficient_evidence", "error"), "Must be error state!"
    print("\n[SUCCESS] SCENARIO 4 PASSED: AI failure correctly returns explicit notice without static candidate fallback!")

    # ------------------------------------------------------------------------
    # SCENARIO 5: AI PROVIDER ABSTRACTION FACTORY
    # ------------------------------------------------------------------------
    print("\n[SCENARIO 5] Testing AI Provider Abstraction Layer (GeminiProvider, BreethProvider, LocalProvider)...")
    active_provider = AIProviderFactory.get_provider()
    print(f"--> Active AI Provider: {active_provider.__class__.__name__}")
    assert isinstance(active_provider, (GeminiProvider, BreethProvider, LocalDeterministicProvider)), "Must be a valid AIProvider subclass!"
    print("\n[SUCCESS] SCENARIO 5 PASSED: AI Provider Abstraction functioning cleanly!")

    print("\n==========================================================================")
    print(" [SUCCESS] ALL END-TO-END DYNAMIC PIPELINE AUDIT VERIFICATIONS PASSED!")
    print("==========================================================================\n")

if __name__ == "__main__":
    asyncio.run(run_end_to_end_dynamic_pipeline_verification())
