import requests
import json
import os

BASE_URL = "http://127.0.0.1:8000/api/extension/analyze-resume"
SCRATCH_DIR = r"C:\Users\vivek\.gemini\antigravity-ide\brain\d3278dd2-9dc4-4487-8c56-137dfbe5f345\scratch"

def test_live_pipeline():
    print("=== LIVE RESUME ANALYSIS PIPELINE VERIFICATION ===")

    # 1. Upload Resume A
    path_a = os.path.join(SCRATCH_DIR, "resume_a_rahul.txt")
    with open(path_a, "rb") as f:
        res_a = requests.post(BASE_URL, files={"file": ("resume_a_rahul.txt", f, "text/plain")})
    assert res_a.status_code == 200, f"Resume A failed: {res_a.text}"
    data_a = res_a.json()
    print(f"\n[RESUME A SUCCESS]")
    print(f"Name: {data_a.get('candidateName')}")
    print(f"Summary: {data_a.get('candidateSummary')}")
    print(f"Completeness: {data_a.get('profileCompleteness')}%")
    print(f"Skills: {data_a.get('technicalSkills')}")
    print(f"Target Roles: {data_a.get('targetRoles')}")
    print(f"Exp count: {len(data_a.get('experience', []))}")
    print(f"Edu count: {len(data_a.get('education', []))}")

    # Assertions for Resume A
    assert data_a.get("candidateName") == "Rahul Sharma"
    assert "Python" in data_a.get("technicalSkills", [])
    assert len(data_a.get("targetRoles", [])) > 0
    assert data_a.get("profileCompleteness") > 50

    # 2. Upload Resume B
    path_b = os.path.join(SCRATCH_DIR, "resume_b_priya.txt")
    with open(path_b, "rb") as f:
        res_b = requests.post(BASE_URL, files={"file": ("resume_b_priya.txt", f, "text/plain")})
    assert res_b.status_code == 200, f"Resume B failed: {res_b.text}"
    data_b = res_b.json()
    print(f"\n[RESUME B SUCCESS]")
    print(f"Name: {data_b.get('candidateName')}")
    print(f"Skills: {data_b.get('technicalSkills')}")
    print(f"Target Roles: {data_b.get('targetRoles')}")

    # Assertions for Resume B
    assert data_b.get("candidateName") == "Priya Nair"
    assert data_b.get("candidateName") != data_a.get("candidateName")
    assert data_b.get("technicalSkills") != data_a.get("technicalSkills")
    assert data_b.get("resumeHash") != data_a.get("resumeHash")

    # 3. Upload Incomplete Resume C
    path_c = os.path.join(SCRATCH_DIR, "resume_c_incomplete.txt")
    with open(path_c, "rb") as f:
        res_c = requests.post(BASE_URL, files={"file": ("resume_c_incomplete.txt", f, "text/plain")})
    assert res_c.status_code == 200, f"Resume C failed: {res_c.text}"
    data_c = res_c.json()
    print(f"\n[RESUME C (INCOMPLETE) SUCCESS]")
    print(f"Summary: {data_c.get('candidateSummary')}")
    print(f"Completeness: {data_c.get('profileCompleteness')}%")
    print(f"Skills: {data_c.get('technicalSkills')}")
    print(f"Target Roles: {data_c.get('targetRoles')}")

    # Assertions for Incomplete Resume C
    assert "Not enough information" in data_c.get("candidateSummary", "")
    assert len(data_c.get("targetRoles", [])) == 0
    assert len(data_c.get("technicalSkills", [])) == 0
    assert data_c.get("profileCompleteness") < 35

    # 4. Upload Resume A again (Cache check)
    with open(path_a, "rb") as f:
        res_a_again = requests.post(BASE_URL, files={"file": ("resume_a_rahul.txt", f, "text/plain")})
    assert res_a_again.status_code == 200
    data_a_again = res_a_again.json()
    print(f"\n[RESUME A AGAIN (CACHED) SUCCESS]")
    assert data_a_again.get("resumeHash") == data_a.get("resumeHash")
    assert data_a_again.get("candidateName") == "Rahul Sharma"

    print("\n[ALL LIVE VERIFICATION TESTS PASSED SUCCESSFULLY!]")

if __name__ == "__main__":
    test_live_pipeline()
