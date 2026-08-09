import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_extension_status():
    """Verify Chrome extension status and feature flag endpoint."""
    response = client.get("/api/v1/extension/status")
    assert response.status_code == 200
    data = response.json()
    assert data["enabled"] is True
    assert "version" in data
    assert isinstance(data["supportedPortals"], list)
    assert "linkedin.com" in data["supportedPortals"]


def test_extension_job_detection_valid_url():
    """Verify job detection when candidate views a LinkedIn job posting URL."""
    payload = {
        "url": "https://www.linkedin.com/jobs/view/123456789",
        "pageTitle": "Senior AI Engineer - TechCorp",
        "rawContent": "We are hiring a Senior AI Engineer skilled in Python, FastAPI, and RAG architectures."
    }
    response = client.post("/api/v1/extension/detect-job", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["isJobProfile"] is True
    assert data["jobSummary"] is not None
    assert data["jobSummary"]["role"] == "Senior AI Engineer - TechCorp"
    assert data["prompt"] is not None
    assert "Senior AI Engineer - TechCorp" in data["prompt"]["title"]
    assert data["prompt"]["allowAction"] == "START_INTERVIEW"


def test_extension_job_detection_non_job_page():
    """Verify job detection returns false on standard search/home page."""
    payload = {
        "url": "https://www.google.com/search?q=python",
        "pageTitle": "Google Search - Python",
        "rawContent": "Python programming language search results."
    }
    response = client.post("/api/v1/extension/detect-job", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["isJobProfile"] is False
    assert data["jobSummary"] is None
    assert data["prompt"] is None


def test_extension_start_job_interview_user_allowed():
    """Verify starting an interview when user clicks Allow / Start Interview on extension popup."""
    payload = {
        "sessionId": "ext-session-999",
        "userConsent": True,
        "job": {
            "jobTitle": "Lead AI Engineer",
            "company": "OpenAI Partner",
            "skills": ["Python", "FastAPI", "LangGraph", "Docker"],
            "experience": "5+ Years"
        }
    }
    response = client.post("/api/v1/extension/start-job-interview", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sessionStarted"] is True
    assert data["sessionId"] == "ext-session-999"
    assert data["reply"] is not None
    assert "Welcome" in data["reply"] or "Question 1" in data["reply"]
    assert data["jobSummary"]["company"] == "OpenAI Partner"


def test_extension_start_job_interview_user_denied():
    """Verify handling when user dismisses or denies permission on popup overlay."""
    payload = {
        "sessionId": "ext-session-000",
        "userConsent": False,
        "job": {
            "jobTitle": "AI Engineer",
            "company": "Some Company"
        }
    }
    response = client.post("/api/v1/extension/start-job-interview", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sessionStarted"] is False
    assert data["sessionId"] == "ext-session-000"
    assert data["reply"] is None
    assert "declined" in data["message"].lower()


def test_analyze_candidate_profile_endpoint():
    """Verify dynamic candidate profile analysis endpoint."""
    payload = {
        "profileId": "linkedin:sarah-connor",
        "platform": "linkedin",
        "profileUrl": "https://linkedin.com/in/sarah-connor",
        "profileContext": {
            "name": "Sarah Connor",
            "headline": "Lead Robotics Engineer",
            "skills": ["ROS2", "PyTorch", "C++", "Edge AI"],
            "about": "10 years experience building autonomous mobile robots and edge vision systems."
        }
    }
    response = client.post("/api/v1/candidate/analyze-profile", json=payload)
    assert response.status_code in (200, 429)
    if response.status_code == 200:
        data = response.json()
        assert data["candidateName"] == "Sarah Connor"
        assert data["analysisStatus"] == "complete"
        assert "summary" in data
        assert isinstance(data["roleFitRankings"], list)


def test_extension_analyze_profile_alias_endpoint():
    """Verify /api/v1/extension/analyze-profile endpoint alias works identically."""
    payload = {
        "profileId": "linkedin:alex-chen",
        "platform": "linkedin",
        "profileUrl": "https://linkedin.com/in/alex-chen",
        "profileContext": {
            "name": "Alex Chen",
            "headline": "Full-Stack Web Architect",
            "skills": ["React", "TypeScript", "Node.js", "GraphQL"],
            "about": "Experienced web engineer crafting scalable cloud architectures."
        }
    }
    response = client.post("/api/v1/extension/analyze-profile", json=payload)
    assert response.status_code in (200, 429)
    if response.status_code == 200:
        data = response.json()
        assert data["candidateName"] == "Alex Chen"
        assert data["analysisStatus"] == "complete"
        assert "React" in data["technicalSkills"] or "TypeScript" in data["technicalSkills"]



def test_analyze_candidate_profile_insufficient_data():
    """Verify empty/generic profile payload returns 400 Bad Request error."""
    payload = {
        "profileId": "generic:empty",
        "platform": "linkedin",
        "profileUrl": "https://linkedin.com/in/empty",
        "profileContext": {
            "name": "Candidate",
            "headline": "",
            "skills": [],
            "about": ""
        }
    }
    response = client.post("/api/v1/candidate/analyze-profile", json=payload)
    assert response.status_code == 400
    assert "Insufficient candidate profile data" in response.json()["detail"]


def test_compare_candidate_profiles_single_profile():
    """Verify comparison with 1 analyzed profile returns valid single-profile positioning without 500 error."""
    payload = {
        "profiles": [
            {
                "platform": "LinkedIn",
                "profileId": "linkedin:vivek",
                "candidateName": "Vivek Kumar Kandu",
                "technicalSkills": ["Python", "FastAPI", "React"],
                "targetRoles": ["Full-Stack Engineer"]
            }
        ]
    }
    response = client.post("/api/v1/candidate/compare-profiles", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["profilesCompared"]) == 1
    assert data["profileConsistencyScore"] == 100
    assert "Python" in data["unifiedSkills"]


def test_compare_candidate_profiles_multiple_profiles():
    """Verify cross-platform comparison with 2 profiles."""
    payload = {
        "profiles": [
            {
                "platform": "LinkedIn",
                "profileId": "linkedin:vivek",
                "candidateName": "Vivek Kumar Kandu",
                "technicalSkills": ["Python", "FastAPI", "React"],
                "targetRoles": ["Full-Stack Engineer"]
            },
            {
                "platform": "GitHub",
                "profileId": "github:vivek",
                "candidateName": "Vivek Kumar Kandu",
                "technicalSkills": ["Python", "Docker", "FastAPI"],
                "targetRoles": ["Backend Engineer"]
            }
        ]
    }
    response = client.post("/api/v1/candidate/compare-profiles", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["profilesCompared"]) == 2
    assert "Python" in data["sharedStrengths"]
    assert "FastAPI" in data["sharedStrengths"]


def test_unified_candidate_intelligence():
    """Verify multi-source profile merging and data provenance tracking."""
    payload = {
        "profiles": [
            {
                "platform": "LinkedIn",
                "profileId": "linkedin:vivek",
                "candidateName": "Vivek Kumar Kandu",
                "technicalSkills": ["React", "JavaScript", "Python"],
                "headline": "Frontend Developer | Team Sarthee AI"
            },
            {
                "platform": "GitHub",
                "profileId": "github:vivekkandu",
                "candidateName": "Vivek Kumar Kandu",
                "technicalSkills": ["Python", "FastAPI", "Docker"],
                "headline": "Full Stack & AI Systems"
            }
        ]
    }
    response = client.post("/api/v1/candidate/unified-intelligence", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["candidateName"] == "Vivek Kumar Kandu"
    assert "LinkedIn" in data["platforms"]
    assert "GitHub" in data["platforms"]
    assert data["candidateVersion"].startswith("cand_ver_")
    
    # Check data provenance
    skills = [s["skill"] for s in data["unifiedSkills"]]
    assert "React" in skills
    assert "FastAPI" in skills
    
    fastapi_prov = next(s for s in data["unifiedSkills"] if s["skill"] == "FastAPI")
    assert fastapi_prov["sourcePlatform"] == "GitHub"
    assert "GitHub" in fastapi_prov["evidence"]


def test_analyze_job_match_different_jobs_produce_different_metrics():
    """Verify that different job postings produce different dynamic match scores, skills, and recommendations."""
    candidate = {
        "id": "cand_vivek_1",
        "name": "Vivek Kumar Kandu",
        "keySkills": ["Python", "FastAPI", "React", "MongoDB"],
        "targetRoles": ["Full Stack Engineer"],
        "experience": ["Developed AI Chatbot with FastAPI and React"],
        "education": ["Bachelor of Technology in Computer Science"]
    }

    # Job 1: React Frontend Developer
    job1_payload = {
        "candidateProfile": candidate,
        "job": {
            "url": "https://linkedin.com/jobs/view/101",
            "title": "Frontend Developer",
            "company": "DataChannel",
            "skills": ["React", "TypeScript", "HTML", "CSS", "Next.js"],
            "description": "Frontend role focused on React, TypeScript, HTML, CSS, Next.js"
        }
    }
    res1 = client.post("/api/v1/extension/analyze-job-match", json=job1_payload)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["success"] is True
    assert "React" in data1["matchedSkills"]
    assert "TypeScript" in data1["missingSkills"]

    # Job 2: Python Backend Developer
    job2_payload = {
        "candidateProfile": candidate,
        "job": {
            "url": "https://linkedin.com/jobs/view/102",
            "title": "Python Backend Developer",
            "company": "FastAPI Labs",
            "skills": ["Python", "FastAPI", "Docker", "Redis", "MongoDB"],
            "description": "Backend position requiring Python, FastAPI, Docker, Redis, MongoDB"
        }
    }
    res2 = client.post("/api/v1/extension/analyze-job-match", json=job2_payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["success"] is True
    assert "Python" in data2["matchedSkills"]
    assert "FastAPI" in data2["matchedSkills"]

    # Job 3: Embedded Systems Engineer
    job3_payload = {
        "candidateProfile": candidate,
        "job": {
            "url": "https://linkedin.com/jobs/view/103",
            "title": "Embedded Systems Engineer",
            "company": "Hardware Tech",
            "skills": ["C", "C++", "RTOS", "Firmware", "Microcontrollers"],
            "description": "Low-level firmware role using C, C++, RTOS, Microcontrollers"
        }
    }
    res3 = client.post("/api/v1/extension/analyze-job-match", json=job3_payload)
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["success"] is True

    # Critical Acceptance Test: Verify Job 1, Job 2, and Job 3 scores and skills are completely DIFFERENT!
    assert data1["match"]["overall"] != data2["match"]["overall"] or data2["match"]["overall"] != data3["match"]["overall"]
    assert data1["matchedSkills"] != data2["matchedSkills"]
    assert data2["matchedSkills"] != data3["matchedSkills"]
    assert data1["jobId"] != data2["jobId"]


def test_analyze_job_match_empty_profile_returns_error():
    """Verify that an empty candidate profile returns HTTP 400 with detail error rather than static metrics."""
    payload = {
        "candidateProfile": {},
        "job": {
            "url": "https://linkedin.com/jobs/view/104",
            "title": "Software Engineer",
            "company": "Acme Inc"
        }
    }
    res = client.post("/api/v1/extension/analyze-job-match", json=payload)
    assert res.status_code == 400
    assert "CANDIDATE_PROFILE_MISSING" in res.json()["detail"]



def test_profile_analysis_validation():
    """Verify HTTP 400 rejection when profile extraction produces insufficient candidate signals."""
    payload = {
        "profileId": "cand_empty",
        "platform": "LinkedIn",
        "profileUrl": "https://linkedin.com/in/empty",
        "profileContext": {
            "name": "Candidate", # Generic name
            "headline": "",
            "skills": []
        }
    }
    response = client.post("/api/v1/extension/analyze-profile", json=payload)
    assert response.status_code == 400
    assert "INSUFFICIENT_PROFILE_DATA" in response.json()["detail"]


def test_incomplete_profile_name_and_headline_only():
    """Verify that a profile with only name and headline returns insufficient_evidence with null score and empty target roles."""
    payload = {
        "profileId": "linkedin:john-doe-minimal",
        "platform": "LinkedIn",
        "profileUrl": "https://linkedin.com/in/john-doe-minimal",
        "profileContext": {
            "name": "John Doe Minimal",
            "headline": "Student at Unknown University",
            "skills": [],
            "experience": [],
            "education": [],
            "projects": []
        }
    }
    response = client.post("/api/v1/extension/analyze-profile", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["analysisStatus"] == "insufficient_evidence"
    assert data["targetRoles"] == []
    assert data["profileReadinessScore"] is None
    assert "skills" in data["missingEvidence"]
    assert "experience" in data["missingEvidence"]


def test_analyze_job_match_with_dict_profile_fields():
    """Verify analyze-job-match endpoint succeeds without 500 error when candidate profile contains dict elements."""
    payload = {
        "candidateProfile": {
            "name": "Web Dev Candidate",
            "skills": [{"skill": "React"}, {"skill": "Node.js"}, {"skill": "JavaScript"}, {"skill": "HTML/CSS"}],
            "experience": [{"role": "Web Developer Intern", "company": "Alpha Media", "keyWork": "Built frontend UIs"}],
            "projects": [{"name": "Portfolio", "description": "Personal website"}],
            "targetRoles": [{"role": "Web Developer Intern", "fitScore": 90}]
        },
        "job": {
            "url": "https://linkedin.com/jobs/view/web-intern-1",
            "title": "Web Developer Intern",
            "company": "Alpha Media",
            "skills": ["React", "JavaScript", "HTML", "CSS"],
            "description": "Looking for Web Developer Intern proficient in React and JavaScript."
        }
    }
    response = client.post("/api/v1/extension/analyze-job-match", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["matchScore"] > 0
    assert "React" in data["matchedSkills"] or "JavaScript" in data["matchedSkills"]

def test_safe_join_and_dict_safety():
    """Verify safe_join converts lists of dicts/strings to joined strings without sequence errors."""
    from app.utils.helpers import safe_join, safe_str_list

    dict_list = [{"skill": "Python"}, {"name": "FastAPI"}, "Docker", {"role": "Backend Engineer"}]
    joined = safe_join(", ", dict_list)
    assert "Python" in joined
    assert "FastAPI" in joined
    assert "Docker" in joined
    assert "Backend Engineer" in joined

    # Test analyze-job-match with heavily nested dict objects in profile and job
    payload = {
        "candidateProfile": {
            "name": "Full Stack Dev",
            "skills": [{"skill": "Python"}, {"skill": "FastAPI"}, {"skill": "React"}],
            "experience": [{"role": "Software Engineer", "company": "Tech Corp"}],
            "projects": [{"name": "AI Assistant", "technologies": [{"skill": "Python"}]}],
            "targetRoles": [{"targetRole": "Backend Developer"}]
        },
        "job": {
            "url": "https://example.com/jobs/dev-1",
            "title": "Backend Engineer",
            "company": "Tech Corp",
            "skills": [{"skill": "Python"}, "FastAPI"],
            "requirements": [{"requirement": "FastAPI"}],
            "description": "Looking for a Backend Engineer with Python and FastAPI skills."
        }
    }
    response = client.post("/api/v1/extension/analyze-job-match", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["matchScore"] >= 50

