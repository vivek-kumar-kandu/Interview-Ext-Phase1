import asyncio
import json
import logging
import pytest
from app.services.candidate_analyzer import candidate_analyzer
from app.services.resume_pipeline import (
    normalize_resume_text,
    extract_contact_and_entities,
    classify_skills,
    is_valid_target_role,
    sanitize_and_validate_candidate
)
from app.services.scoring_engine import scoring_engine
from app.agents.orchestrator import interview_orchestrator
from app.schemas.interview import JobDetails, InterviewRequest, CandidateProfileAnalysis
from fastapi import HTTPException

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_resume_intelligence_tests():
    print("\n==================================================")
    print("   GENERAL SMART RESUME INTELLIGENCE PIPELINE TEST ")
    print("==================================================\n")

    # ------------------------------------------------------------------------
    # TEST 1: GARVIT SHARMA RESUME BUG REPRODUCTION & FIX VERIFICATION
    # ------------------------------------------------------------------------
    print("[TEST 1] Testing Garvit Sharma Resume (Contact & Soft Skill Contamination Fix)...")
    garvit_resume_text = """
    Garvit Sharma
    Email: garvit2411001@gmail.com | Phone: +91 96250 64273 | Location: India
    GitHub: https://github.com/garvit24 | LinkedIn: https://linkedin.com/in/garvit-sharma
    
    Professional Summary:
    Full Stack Software Developer experienced in building web applications with React, Python, and FastAPI.
    
    Technical Expertise:
    React, JavaScript, Python, FastAPI, PostgreSQL, HTML, CSS, Git, Docker
    
    Soft Skills:
    Teamwork, Communication, Adaptability, Problem Solving
    
    Work History:
    Acme Software Inc - Software Development Intern (Jan 2024 - Jun 2024)
    - Built responsive web interfaces in React and JavaScript.
    - Implemented REST API endpoints in Python using FastAPI.
    
    Academics:
    AKGEC - Bachelor of Technology in Computer Science (2020 - 2024)
    """

    # 1. Text Normalization
    norm_text = normalize_resume_text(garvit_resume_text)
    assert len(norm_text) > 50, "Normalized text must not be empty"

    # 2. Pre-Gemini Contact Entity Extraction
    extracted_contact = extract_contact_and_entities(norm_text)
    assert extracted_contact["email"] == "garvit2411001@gmail.com", "Email must be extracted correctly"
    assert "+91 96250 64273" in extracted_contact["phone"], "Phone number must be extracted correctly"
    assert "github.com/garvit24" in extracted_contact["github"], "GitHub must be extracted correctly"
    print("--> Contact info pre-extracted:", extracted_contact)

    # 3. Post-processing Contamination Purge Test
    raw_mock_llm_response = {
        "candidate": {
            "name": "Garvit Sharma",
            "headline": "Full Stack Developer",
            "summary": "Full Stack Software Developer experienced in React and Python.",
            "contact": extracted_contact
        },
        "skills": ["React", "JavaScript", "Python", "FastAPI", "Teamwork", "Communication", "Adaptability", "+91 96250 64273"],
        "experience": [
            {
                "company": "Acme Software Inc",
                "jobTitle": "Software Development Intern",
                "duration": "Jan 2024 - Jun 2024",
                "description": ["Built web interfaces"],
                "technologies": ["React", "FastAPI"]
            }
        ],
        "education": [
            {
                "institution": "AKGEC",
                "degree": "Bachelor of Technology",
                "fieldOfStudy": "Computer Science",
                "duration": "2020 - 2024"
            }
        ],
        "target_roles": [
            "+91 96250 64273",
            "garvit2411001@gmail.com",
            "Github",
            "Teamwork",
            "Full Stack Developer",
            "Frontend Developer"
        ]
    }

    sanitized = sanitize_and_validate_candidate(raw_mock_llm_response, extracted_contact, norm_text)

    # ASSERTIONS FOR BUG FIX:
    sanitized_roles = [r["role"] for r in sanitized["targetRoles"]]
    print("--> Sanitized Target Roles:", sanitized_roles)
    print("--> Technical Skills:", sanitized["technicalSkills"])
    print("--> Soft Skills:", sanitized["softSkills"])

    assert "+91 96250 64273" not in sanitized_roles, "Phone number MUST NOT be a target role!"
    assert "garvit2411001@gmail.com" not in sanitized_roles, "Email address MUST NOT be a target role!"
    assert "Github" not in sanitized_roles, "Github platform label MUST NOT be a target role!"
    assert "Teamwork" not in sanitized_roles, "Soft skill MUST NOT be a target role!"

    assert "Teamwork" not in sanitized["technicalSkills"], "Teamwork MUST NOT be in technicalSkills!"
    assert "Communication" not in sanitized["technicalSkills"], "Communication MUST NOT be in technicalSkills!"
    assert "Adaptability" not in sanitized["technicalSkills"], "Adaptability MUST NOT be in technicalSkills!"
    assert "+91 96250 64273" not in sanitized["technicalSkills"], "Phone number MUST NOT be in technicalSkills!"

    assert "Teamwork" in sanitized["softSkills"], "Teamwork MUST be in softSkills!"
    assert "Communication" in sanitized["softSkills"], "Communication MUST be in softSkills!"

    assert "Full Stack Developer" in sanitized_roles or "Frontend Developer" in sanitized_roles, "Valid occupation MUST be preserved!"

    print("[SUCCESS] TEST 1 PASSED: Contact info & soft skill contamination purged cleanly!")

    # ------------------------------------------------------------------------
    # TEST 2: ATS RESUME FORMAT
    # ------------------------------------------------------------------------
    print("\n[TEST 2] Testing ATS Resume Format...")
    ats_resume = """
    JOHN DOE
    john.doe@email.com | 123-456-7890 | Seattle, WA
    https://linkedin.com/in/johndoe | https://github.com/johndoe
    
    EXPERIENCE
    Senior Software Engineer - Tech Giant Corp (2020-Present)
    * Led backend development using Java and Spring Boot.
    * Managed Kubernetes clusters and Docker containers on AWS.
    
    EDUCATION
    Master of Science in Computer Science - University of Washington (2018-2020)
    
    SKILLS
    Java, Spring Boot, Microservices, Kubernetes, Docker, AWS, PostgreSQL
    """
    ats_norm = normalize_resume_text(ats_resume)
    ats_contact = extract_contact_and_entities(ats_norm)
    ats_classified = classify_skills(["Java", "Spring Boot", "Microservices", "Kubernetes", "Docker", "AWS", "PostgreSQL", "Leadership"])
    
    assert "Leadership" in ats_classified["softSkills"], "Leadership must be classified as soft skill"
    assert "Leadership" not in ats_classified["technicalSkills"], "Leadership must not be in technicalSkills"
    assert "java" in [s.lower() for s in ats_classified["programmingLanguages"]], "Java must be classified under programmingLanguages"
    assert "spring boot" in [s.lower() for s in ats_classified["frameworks"]], "Spring Boot must be under frameworks"
    assert "kubernetes" in [s.lower() for s in ats_classified["tools"]], "Kubernetes must be under tools"

    print("[SUCCESS] TEST 2 PASSED: ATS resume layout & skill categories recognized correctly!")

    # ------------------------------------------------------------------------
    # TEST 3: TWO-COLUMN CANVA / MODERN RESUME FORMAT
    # ------------------------------------------------------------------------
    print("\n[TEST 3] Testing Two-Column Canva / Modern Resume Format...")
    canva_resume = """
    Priya Sharma                         CONTACT
    AI & Machine Learning Developer       priya@ai-lab.org
                                         +91 9876543210
    PROFILE                              Bengaluru, India
    Passionate ML developer building
    RAG pipelines with PyTorch & Gemini  SKILLS
                                         Python, PyTorch, RAG, FastAPI,
    WORK HISTORY                         ChromaDB, Docker, Git
    AI Research Intern - MindAI
    - Fine-tuned LLMs using PyTorch     ACADEMICS
    - Built vector search using Chroma   B.Tech Artificial Intelligence - RVCE
    """
    canva_norm = normalize_resume_text(canva_resume)
    canva_contact = extract_contact_and_entities(canva_norm)
    canva_classified = classify_skills(["Python", "PyTorch", "RAG", "FastAPI", "ChromaDB", "Docker", "Git"])

    assert canva_contact["email"] == "priya@ai-lab.org", "Email from two-column layout extracted"
    assert "pytorch" in [s.lower() for s in canva_classified["aiMlTechnologies"]], "PyTorch classified under AI/ML"
    assert "rag" in [s.lower() for s in canva_classified["aiMlTechnologies"]], "RAG classified under AI/ML"

    print("[SUCCESS] TEST 3 PASSED: Two-column Canva layout extracted & categorized successfully!")

    # ------------------------------------------------------------------------
    # TEST 4: INCOMPLETE RESUME (NO SKILLS, NO EXPERIENCE, NO EDUCATION)
    # ------------------------------------------------------------------------
    print("\n[TEST 4] Testing Incomplete Resume Handling (No AI Invention)...")
    empty_raw_llm = {
        "candidate": {"name": "Empty Candidate"},
        "skills": [],
        "experience": [],
        "education": [],
        "target_roles": ["Software Engineer", "Developer"] # Gemini hallucination attempt
    }
    empty_sanitized = sanitize_and_validate_candidate(empty_raw_llm, {}, "Empty Resume Content")
    empty_roles = [r["role"] for r in empty_sanitized["targetRoles"]]

    assert len(empty_roles) == 0, "No target roles should be generated for an empty resume!"
    assert len(empty_sanitized["technicalSkills"]) == 0, "No technical skills for an empty resume!"

    print("[SUCCESS] TEST 4 PASSED: Incomplete resume rejected target roles with zero AI hallucination!")

    # ------------------------------------------------------------------------
    # TEST 5: ROLE VALIDATOR REJECTION SUITE
    # ------------------------------------------------------------------------
    print("\n[TEST 5] Testing Target Role Validator against edge cases...")
    test_evidence = {"technicalSkills": ["Python", "FastAPI"]}

    invalid_candidates = [
        "+91 96250 64273",
        "garvit2411001@gmail.com",
        "https://github.com/user",
        "Github",
        "LinkedIn",
        "India",
        "Delhi",
        "Teamwork",
        "Communication",
        "Adaptability",
        "Resume",
        "Profile",
        "Page 1"
    ]

    for inv in invalid_candidates:
        valid = is_valid_target_role(inv, test_evidence)
        assert not valid, f"Role validator MUST reject '{inv}'!"

    valid_candidates = ["Python Developer", "Backend Engineer", "Software Engineer", "Full Stack Developer"]
    for val in valid_candidates:
        assert is_valid_target_role(val, test_evidence), f"Role validator MUST accept '{val}'!"

    print("[SUCCESS] TEST 5 PASSED: Target Role Validator cleanly rejected all invalid & contaminated inputs!")

    print("\n==================================================")
    print(" [SUCCESS] ALL RESUME INTELLIGENCE PIPELINE TESTS PASSED!")
    print("==================================================\n")

if __name__ == "__main__":
    asyncio.run(run_resume_intelligence_tests())
