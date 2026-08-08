import pytest
import importlib
from fastapi.testclient import TestClient
from app.main import app

candidate_analyzer_module = importlib.import_module("app.services.candidate_analyzer")
client = TestClient(app)

class FakeGeminiResponseWith:
    def __init__(self, content):
        self.content = content

class DynamicGeminiMock:
    async def ainvoke(self, messages):
        human_msg = messages[-1].content
        if "Incomplete" in human_msg or "OnlyEducation" in human_msg or "NoSkills" in human_msg:
            return FakeGeminiResponseWith('''{
                "candidateSummary": "Not enough information was found in this resume to generate reliable career recommendations.",
                "candidate": {"name": "Test User", "headline": null},
                "education": [{"degree": "B.Tech Computer Science", "institution": "Tech University", "year": "2024", "evidence": "CS"}],
                "experience": [],
                "technicalSkills": [],
                "softSkills": [],
                "projects": [],
                "achievements": [],
                "targetRoles": [],
                "strongestAreas": [],
                "developmentAreas": [],
                "profileCompleteness": 15
            }''')
        elif "Priya" in human_msg or "AI & Data" in human_msg:
            return FakeGeminiResponseWith('''{
                "candidateSummary": "AI Engineer with hands-on experience in LangChain, FastAPI and Vector Databases.",
                "candidate": {"name": "Priya Nair", "headline": "AI Engineer"},
                "education": [{"degree": "M.Tech AI", "institution": "IISc Bangalore", "year": "2024", "evidence": "AI"}],
                "experience": [{"role": "AI Engineer", "company": "AI Labs", "duration": "2023-2026", "keyWork": "Built RAG search"}],
                "technicalSkills": ["Python", "FastAPI", "LangChain", "PyTorch"],
                "softSkills": ["Problem Solving"],
                "projects": [{"name": "Agentic Search", "description": "AI search engine", "technologies": ["LangChain"]}],
                "achievements": ["Hackathon Winner"],
                "targetRoles": [{"role": "AI Engineer", "fitScore": 92, "whyFit": "Extensive LangChain and PyTorch evidence."}],
                "strongestAreas": ["AI/ML", "LangChain", "FastAPI"],
                "developmentAreas": ["Cloud Deployment"],
                "profileCompleteness": 85
            }''')
        elif "SoftSkillCandidate" in human_msg:
            return FakeGeminiResponseWith('''{
                "candidateSummary": "Software Developer with strong teamwork and problem solving skills.",
                "candidate": {"name": "SoftSkillCandidate", "headline": "Software Engineer"},
                "education": [{"degree": "B.Tech", "institution": "State University", "year": "2023", "evidence": "CS"}],
                "experience": [{"role": "Software Intern", "company": "DevWorks", "duration": "2023", "keyWork": "App development"}],
                "technicalSkills": ["JavaScript", "React"],
                "softSkills": ["Teamwork", "Communication", "Leadership", "Adaptability", "Problem Solving"],
                "projects": [],
                "achievements": [],
                "targetRoles": [{"role": "Frontend Developer", "fitScore": 85, "whyFit": "React experience."}],
                "strongestAreas": ["React", "JavaScript"],
                "developmentAreas": ["Backend Databases"],
                "profileCompleteness": 65
            }''')
        else:
            return FakeGeminiResponseWith('''{
                "candidateSummary": "Computer Science graduate with IoT and Python experience.",
                "candidate": {"name": "Rahul Sharma", "headline": "Embedded/IoT Developer"},
                "education": [{"degree": "B.Tech CS", "institution": "IIT Madras", "year": "2024", "evidence": "Computer Science"}],
                "experience": [{"role": "IoT Developer Intern", "company": "SensorsInc", "duration": "2024", "keyWork": "ESP32 firmware."}],
                "technicalSkills": ["Python", "C++", "Flutter", "Firebase", "ESP32"],
                "softSkills": ["Collaboration"],
                "projects": [{"name": "Telemetry Dashboard", "description": "Real-time telemetry", "technologies": ["Flutter", "Firebase"]}],
                "achievements": ["Best Project Award"],
                "targetRoles": [{"role": "Embedded / IoT Developer", "fitScore": 88, "whyFit": "ESP32 and sensor integration."}],
                "strongestAreas": ["IoT & Embedded Systems", "Python/C++", "Flutter Development"],
                "developmentAreas": ["Backend framework depth"],
                "profileCompleteness": 80
            }''')

def setup_mock_gemini(monkeypatch):
    monkeypatch.setattr(candidate_analyzer_module, "get_llm", lambda **kwargs: DynamicGeminiMock())

# TEST 1: Complete technical resume -> correct skills, experience, education and roles
def test_1_complete_technical_resume(monkeypatch):
    setup_mock_gemini(monkeypatch)
    res = client.post("/api/extension/analyze-resume", data={"resumeText": "Rahul Sharma\nEmbedded Developer\nSkills: Python, C++, ESP32, Flutter"})
    assert res.status_code == 200
    data = res.json()
    assert data["candidateName"] == "Rahul Sharma"
    assert "Python" in data["technicalSkills"]
    assert len(data["experience"]) > 0
    assert len(data["education"]) > 0
    assert len(data["targetRoles"]) > 0

# TEST 2: Resume with only education -> no fake roles/skills
def test_2_resume_with_only_education(monkeypatch):
    setup_mock_gemini(monkeypatch)
    res = client.post("/api/extension/analyze-resume", data={"resumeText": "OnlyEducation Resume\nEducation: B.Tech Computer Science"})
    assert res.status_code == 200
    data = res.json()
    assert data["technicalSkills"] == []
    assert data["experience"] == []
    assert data["targetRoles"] == []
    assert "Not enough information" in data["candidateSummary"]

# TEST 3: Resume with no skills -> technicalSkills = []
def test_3_resume_with_no_skills(monkeypatch):
    setup_mock_gemini(monkeypatch)
    res = client.post("/api/extension/analyze-resume", data={"resumeText": "NoSkills Candidate\nEducation: High School Diploma"})
    assert res.status_code == 200
    data = res.json()
    assert data["technicalSkills"] == []

# TEST 4: Resume with no experience -> experience = []
def test_4_resume_with_no_experience(monkeypatch):
    setup_mock_gemini(monkeypatch)
    res = client.post("/api/extension/analyze-resume", data={"resumeText": "Incomplete Resume\nEducation: B.Tech"})
    assert res.status_code == 200
    data = res.json()
    assert data["experience"] == []

# TEST 5: Resume containing phone/email/LinkedIn/GitHub -> contact data NEVER appears as roles or technical skills
def test_5_resume_contact_purged_from_skills_and_roles(monkeypatch):
    setup_mock_gemini(monkeypatch)
    raw_resume = (
        "Rahul Sharma\n"
        "Email: rahul.sharma@example.com\n"
        "Phone: +91 9876543210\n"
        "LinkedIn: https://linkedin.com/in/rahul-sharma\n"
        "GitHub: https://github.com/rahul-sharma\n"
        "Skills: Python, C++, rahul.sharma@example.com, +91 9876543210, https://github.com/rahul-sharma\n"
    )
    res = client.post("/api/extension/analyze-resume", data={"resumeText": raw_resume})
    assert res.status_code == 200
    data = res.json()
    for s in data["technicalSkills"]:
        assert "rahul.sharma@example.com" not in s
        assert "+91" not in s
        assert "github.com" not in s
    for r in data["targetRoles"]:
        role_title = r["role"] if isinstance(r, dict) else r
        assert "rahul.sharma@example.com" not in role_title
        assert "+91" not in role_title

# TEST 6: Resume with soft skills -> softSkills separated from technicalSkills
def test_6_soft_skills_separated_from_technical_skills(monkeypatch):
    setup_mock_gemini(monkeypatch)
    raw = "SoftSkillCandidate\nSkills: React, JavaScript, Teamwork, Communication, Leadership, Adaptability, Problem Solving"
    res = client.post("/api/extension/analyze-resume", data={"resumeText": raw})
    assert res.status_code == 200
    data = res.json()
    assert "Teamwork" not in data["technicalSkills"]
    assert "Communication" not in data["technicalSkills"]
    assert "Teamwork" in data["softSkills"] or "Communication" in data["softSkills"]

# TEST 7: Two completely different resumes -> completely different analysis
def test_7_two_different_resumes_produce_different_analysis(monkeypatch):
    setup_mock_gemini(monkeypatch)
    res_a = client.post("/api/extension/analyze-resume", data={"resumeText": "Rahul Sharma\nEmbedded Developer\nSkills: ESP32, C++"})
    res_b = client.post("/api/extension/analyze-resume", data={"resumeText": "Priya Nair\nAI & Data Engineer\nSkills: LangChain, PyTorch"})
    assert res_a.status_code == 200 and res_b.status_code == 200
    data_a, data_b = res_a.json(), res_b.json()
    assert data_a["candidateName"] != data_b["candidateName"]
    assert data_a["technicalSkills"] != data_b["technicalSkills"]

# TEST 8: Same resume uploaded twice -> cached result reused
def test_8_same_resume_uploaded_twice_uses_cache(monkeypatch):
    setup_mock_gemini(monkeypatch)
    raw = "Rahul Sharma\nUnique Resume Upload Test\nSkills: Python, C++, ESP32"
    res1 = client.post("/api/extension/analyze-resume", data={"resumeText": raw})
    res2 = client.post("/api/extension/analyze-resume", data={"resumeText": raw})
    assert res1.status_code == 200 and res2.status_code == 200
    assert res1.json()["resumeHash"] == res2.json()["resumeHash"]

# TEST 9: Different resume uploaded -> new Gemini analysis
def test_9_different_resume_uploaded_triggers_new_analysis(monkeypatch):
    setup_mock_gemini(monkeypatch)
    res1 = client.post("/api/extension/analyze-resume", data={"resumeText": "Rahul Sharma\nResume One"})
    res2 = client.post("/api/extension/analyze-resume", data={"resumeText": "Priya Nair\nResume Two AI & Data"})
    assert res1.json()["resumeHash"] != res2.json()["resumeHash"]

# TEST 10: Gemini API failure -> real error state, NEVER static fallback
def test_10_gemini_failure_returns_error_state(monkeypatch):
    class FailingLLM:
        async def ainvoke(self, messages):
            raise Exception("Gemini API Rate Limit Exceeded / Key Invalid")

    monkeypatch.setattr(candidate_analyzer_module, "get_llm", lambda **kwargs: FailingLLM())
    res = client.post("/api/extension/analyze-resume", data={"resumeText": "Some Real Resume Text Content For Test 10"})
    assert res.status_code in (200, 500)
    data = res.json()
    assert data["analysisStatus"] in ("error", "incomplete_evidence") or "AI_ANALYSIS_FAILED" in str(data.get("errorMessage")) or "AI analysis unavailable" in str(data.get("errorMessage"))

