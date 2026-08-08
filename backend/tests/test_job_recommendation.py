import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_job_recommendation_python_backend_profile():
    python_profile = {
        "profileAnalysis": {
            "profileId": "cand_py_101",
            "candidateName": "Garvit Sharma",
            "headline": "Python Backend Engineer",
            "candidateSummary": "Experienced Python backend developer with FastAPI, PostgreSQL and Redis.",
            "technicalSkills": ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker", "REST APIs", "Git"],
            "experience": [
                {
                    "company": "TechCorp",
                    "role": "Backend Engineer",
                    "duration": "2.5 Years",
                    "description": ["Built REST microservices with FastAPI and PostgreSQL."],
                    "technologies": ["Python", "FastAPI", "PostgreSQL"]
                }
            ],
            "projects": [
                {
                    "name": "High Throughput API",
                    "description": "Async API pipeline using Redis and FastAPI",
                    "technologies": ["FastAPI", "Redis", "Python"]
                }
            ],
            "education": [{"degree": "B.Tech Computer Science", "institution": "IIT Delhi"}],
            "strongestAreas": ["Backend Architecture", "API Development"],
            "developmentAreas": ["System Design", "Kubernetes"],
            "targetRoles": [{"role": "Python Backend Developer", "fitScore": 94}],
            "analysisStatus": "complete"
        }
    }

    res = client.post("/api/candidate/recommend-jobs", json=python_profile)
    assert res.status_code == 200
    data = res.json()

    assert data["candidateName"] == "Garvit Sharma"
    assert data["heading"] == "Jobs Recommended For You"
    assert data["subheading"] == "Based on your resume, skills, experience and career profile."

    recs = data["recommendations"]
    assert 5 <= len(recs) <= 8

    # Verify descending matchPercentage ordering
    scores = [r["matchPercentage"] for r in recs]
    assert scores == sorted(scores, reverse=True)

    # Verify Python/Backend role is among top recommendations
    top_titles = [r["jobTitle"].lower() for r in recs[:3]]
    assert any("python" in t or "backend" in t or "full stack" in t for t in top_titles)

    # Check structure of top recommendation
    top_rec = recs[0]
    assert "jobTitle" in top_rec
    assert "matchPercentage" in top_rec
    assert "whyMatch" in top_rec
    assert len(top_rec["matchingSkills"]) > 0
    assert len(top_rec["missingSkills"]) > 0
    assert "experienceAlignment" in top_rec
    assert top_rec["careerFit"] in ["Excellent Match", "Strong Match", "Good Match"]
    assert "description" in top_rec
    assert len(top_rec["resumeStrengths"]) > 0
    assert len(top_rec["areasToImprove"]) > 0
    assert len(top_rec["interviewPrepTopics"]) > 0
    assert len(top_rec["suggestedTech"]) > 0


def test_job_recommendation_react_frontend_profile():
    frontend_profile = {
        "profileAnalysis": {
            "profileId": "cand_fe_202",
            "candidateName": "Priya Nair",
            "headline": "Frontend React Developer",
            "candidateSummary": "Frontend engineer specializing in React, TypeScript, Next.js and Tailwind CSS.",
            "technicalSkills": ["React", "TypeScript", "JavaScript", "HTML5", "CSS3", "Tailwind CSS", "Next.js", "Redux"],
            "experience": [
                {
                    "company": "UI Labs",
                    "role": "Frontend Developer",
                    "duration": "3 Years",
                    "description": ["Developed responsive single-page web applications in React & TypeScript."],
                    "technologies": ["React", "TypeScript", "Tailwind"]
                }
            ],
            "projects": [
                {
                    "name": "Design System",
                    "description": "Custom UI component library",
                    "technologies": ["React", "TypeScript", "Tailwind"]
                }
            ],
            "education": [{"degree": "B.S. Software Engineering", "institution": "BITS Pilani"}],
            "strongestAreas": ["Frontend Web Development", "UI Engineering"],
            "developmentAreas": ["GraphQL", "Web Vitals"],
            "targetRoles": [{"role": "Frontend Developer", "fitScore": 95}],
            "analysisStatus": "complete"
        }
    }

    res = client.post("/api/candidate/recommend-jobs", json=frontend_profile)
    assert res.status_code == 200
    data = res.json()

    recs = data["recommendations"]
    # Strict evidence-based fallback may return fewer but more relevant recommendations
    assert 2 <= len(recs) <= 8

    top_titles = [r["jobTitle"].lower() for r in recs[:3]]
    assert any("frontend" in t or "react" in t or "full stack" in t for t in top_titles)



def test_job_recommendation_embedded_iot_profile():
    embedded_profile = {
        "profileAnalysis": {
            "profileId": "cand_emb_303",
            "candidateName": "Rahul Sharma",
            "headline": "Embedded Systems Engineer",
            "candidateSummary": "Embedded software developer with C++, C, RTOS, STM32 and IoT experience.",
            "technicalSkills": ["C++", "C", "RTOS", "Embedded Systems", "STM32", "Microcontrollers", "IoT", "Git"],
            "experience": [
                {
                    "company": "IoT Solutions",
                    "role": "Embedded Firmware Engineer",
                    "duration": "2 Years",
                    "description": ["Built C++ firmware for STM32 microcontrollers with FreeRTOS."],
                    "technologies": ["C++", "C", "FreeRTOS"]
                }
            ],
            "projects": [
                {
                    "name": "Smart Sensor Hub",
                    "description": "IoT data acquisition node",
                    "technologies": ["C++", "RTOS"]
                }
            ],
            "education": [{"degree": "B.Tech Electrical & Electronics", "institution": "NIT Trichy"}],
            "strongestAreas": ["Firmware Development", "RTOS Programming"],
            "developmentAreas": ["System Architecture", "ARM Assembly"],
            "targetRoles": [{"role": "Embedded Software Engineer", "fitScore": 92}],
            "analysisStatus": "complete"
        }
    }

    res = client.post("/api/candidate/recommend-jobs", json=embedded_profile)
    assert res.status_code == 200
    data = res.json()

    recs = data["recommendations"]
    # Strict evidence-based fallback may return fewer but more relevant recommendations
    assert 2 <= len(recs) <= 8

    top_titles = [r["jobTitle"].lower() for r in recs[:3]]
    assert any("embedded" in t or "systems" in t or "software" in t for t in top_titles)



def test_job_recommendation_incomplete_profile_raises_400():
    incomplete_payload = {
        "profileAnalysis": {
            "profileId": "empty_cand",
            "candidateName": "Empty Candidate",
            "technicalSkills": [],
            "experience": [],
            "projects": [],
            "education": [],
            "analysisStatus": "incomplete_evidence"
        }
    }

    res = client.post("/api/candidate/recommend-jobs", json=incomplete_payload)
    assert res.status_code == 400
    assert "Analyze your resume first" in res.json()["detail"] or "INSUFFICIENT_CANDIDATE_DATA" in res.json()["detail"]
