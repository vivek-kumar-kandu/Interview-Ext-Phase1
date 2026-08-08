from app.services.scoring_engine import scoring_engine
from app.schemas.interview import JobDetails

candidate_skills = ["React", "JavaScript", "TypeScript", "HTML", "CSS", "REST API", "Git"]
candidate_exp = ["Frontend Engineer at Web Studio (3 yrs)"]
candidate_projects = ["E-Commerce Dashboard in React", "Component Library"]
candidate_roles = ["Frontend Developer"]
candidate_edu = ["B.Tech Computer Science"]

job_1 = JobDetails(
    jobTitle="Senior React & TypeScript Developer",
    company="SaaS Corp",
    skills=["React", "TypeScript", "JavaScript", "REST API", "Git"],
    description="Looking for Senior React developer proficient in TypeScript, JavaScript, and REST APIs."
)

job_2 = JobDetails(
    jobTitle="Python Backend Developer",
    company="Data Scale",
    skills=["Python", "FastAPI", "Docker", "PostgreSQL", "AWS"],
    description="Seeking Python backend developer with FastAPI, PostgreSQL, Docker, and AWS experience."
)

job_3 = JobDetails(
    jobTitle="DevOps & Cloud Engineer",
    company="Cloud Ops",
    skills=["Kubernetes", "Terraform", "AWS", "Docker", "CI/CD", "Linux"],
    description="DevOps engineer for cloud infrastructure, Kubernetes, and CI/CD pipelines."
)

res1 = scoring_engine.calculate_job_match(candidate_skills, candidate_exp, candidate_projects, candidate_roles, candidate_edu, job_1)
res2 = scoring_engine.calculate_job_match(candidate_skills, candidate_exp, candidate_projects, candidate_roles, candidate_edu, job_2)
res3 = scoring_engine.calculate_job_match(candidate_skills, candidate_exp, candidate_projects, candidate_roles, candidate_edu, job_3)

print("\n=======================================================")
print(f"Candidate Profile: {candidate_skills}")
print("=======================================================")
print(f"JOB 1 ({job_1.jobTitle}): Score = {res1.score}% | Matched: {res1.matchedSkills} | Missing: {res1.missingSkills}")
print(f"JOB 2 ({job_2.jobTitle}): Score = {res2.score}% | Matched: {res2.matchedSkills} | Missing: {res2.missingSkills}")
print(f"JOB 3 ({job_3.jobTitle}): Score = {res3.score}% | Matched: {res3.matchedSkills} | Missing: {res3.missingSkills}")
print("=======================================================\n")
