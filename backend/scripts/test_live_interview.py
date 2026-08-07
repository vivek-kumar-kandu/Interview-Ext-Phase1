import sys
import json
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
SESSION_ID = f"job-interview-session-{int(time.time())}"

start_payload = {
    "sessionId": SESSION_ID,
    "job": {
        "jobTitle": "AI Engineer",
        "company": "OpenAI",
        "skills": ["Python", "FastAPI", "LangGraph", "RAG", "Vector Databases", "Docker", "Redis"],
        "experience": "2+ Years",
        "description": "Building high-throughput scalable AI systems and autonomous agentic workflows."
    },
    "candidate": {
        "member": {
            "id": "CAND-003",
            "name": "Emily Chen",
            "jobRole": "AI Engineer",
            "yearsExperience": 6,
            "education": "MS Artificial Intelligence",
            "status": "COMPLETED"
        },
        "missions": [
            {"day": 7, "title": "Embeddings Explained", "passed": True, "attempts": 1},
            {"day": 8, "title": "Vector Databases Overview", "passed": True, "attempts": 1},
            {"day": 10, "title": "Retrieval Engine", "passed": True, "attempts": 1},
            {"day": 12, "title": "Prompt Engineering Fundamentals", "passed": True, "attempts": 1},
            {"day": 13, "title": "Function Calling", "passed": True, "attempts": 1},
            {"day": 21, "title": "LangChain Agents", "passed": True, "attempts": 1},
            {"day": 22, "title": "Multi-Agent Orchestration", "passed": True, "attempts": 1},
            {"day": 28, "title": "Docker & Kubernetes Deployment", "passed": True, "attempts": 1}
        ],
        "signals": {"commitDays": 31, "missionsCompleted": 31, "missionsFirstTry": 30}
    }
}


def run_job_simulation():
    print("=" * 75)
    print(f"[STARTING LINKEDIN JOB AI INTERVIEW SIMULATION] Session: {SESSION_ID}")
    print("=" * 75)

    # 1. Start Turn
    res = client.post("/api/interview", json=start_payload).json()
    
    print("\n[CHROME EXTENSION JOB SUMMARY]:")
    job_sum = res.get("jobSummary", {})
    print(f"• Company:          {job_sum.get('company')}")
    print(f"• Role:             {job_sum.get('role')}")
    print(f"• Detected Skills:  {job_sum.get('detectedSkills')}")
    print(f"• Est. Duration:    {job_sum.get('estimatedDuration')}")
    print(f"• Difficulty:       {job_sum.get('difficulty')}")

    print(f"\n[AI INTERVIEWER (Turn 1)]:\n{res['reply']}\n")

    answers = [
        "I would structure the FastAPI backend with stateless router endpoints and connect it to Redis for distributed session storage and LangGraph for agent workflow states.",
        "To handle 10,000 concurrent candidate interviews, I would use asynchronous I/O with FastAPI, Redis state persistence, and vector store retrieval caching.",
        "RAG retrieves relevant domain document chunks from a vector store and injects them into the LLM system prompt context to reduce hallucinations.",
        "Function calling parses predefined JSON schema parameters from the model output, enabling reliable integration with external backend tools and database APIs.",
        "LangChain agents use dynamic reasoning loops (like ReAct) to evaluate user input, choose tools from a registry, and iterate until solving the task.",
        "Multi-agent orchestration relies on state graph workflows (like LangGraph) or hierarchical supervisor patterns to divide complex goals among specialized sub-agents.",
        "Model Context Protocol (MCP) establishes standardized client-server interfaces for exposing local file systems and service context securely to LLM applications.",
        "Production deployment requires containerizing microservices with Docker, setting up horizontal pod autoscaling, monitoring latency, and tracking token costs."
    ]

    for turn_idx, answer in enumerate(answers, start=2):
        if res.get("done"):
            break

        prog = res.get("progress", {})
        print("-" * 75)
        print(f"[PROGRESS METRICS]: {prog.get('questionsCount')}/8 Questions | Topics Covered: {prog.get('topicsCovered')}")
        print(f"[CANDIDATE RESPONSE (Turn {turn_idx - 1})]:\n{answer}\n")

        turn_payload = {
            "sessionId": SESSION_ID,
            "message": answer
        }

        res = client.post("/api/interview", json=turn_payload).json()

        if res.get("done"):
            print("=" * 75)
            print("[INTERVIEW COMPLETE - ENTERPRISE EVALUATION REPORT GENERATED]")
            print("=" * 75)
            print(f"\n[AI INTERVIEWER FINAL MSG]:\n{res['reply']}\n")

            feedback = res.get("feedback", {})
            print("ENTERPRISE CANDIDATE EVALUATION REPORT:")
            print(f"• Overall Score:           {feedback.get('overallScore')} / 100")
            print(f"• Technical Knowledge:     {feedback.get('technicalKnowledge')} / 100")
            print(f"• Communication Score:     {feedback.get('communication')} / 100")
            print(f"• Reasoning Score:         {feedback.get('reasoning')} / 100")
            print(f"• Hiring Recommendation:   {feedback.get('hiringRecommendation')}")
            print(f"• Summary:                 {feedback.get('summary')}")
            print(f"• Strengths:               {json.dumps(feedback.get('strengths'), indent=2)}")
            print(f"• Weak Areas:              {json.dumps(feedback.get('weakAreas'), indent=2)}")
            print(f"• Learning Roadmap:        {json.dumps(feedback.get('learningRoadmap'), indent=2)}")
            print("=" * 75)
            break
        else:
            print(f"[AI INTERVIEWER (Turn {turn_idx})]:\n{res['reply']}\n")


if __name__ == "__main__":
    run_job_simulation()
