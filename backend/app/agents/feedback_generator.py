import json
from typing import List
from app.config import settings
from app.models.session import SessionState
from app.schemas.interview import FeedbackSchema


from app.utils.llm import get_llm


class FeedbackGenerator:
    """
    Synthesizes overall interview performance into an executive feedback report containing:
    - Numerical breakdown (overallScore, technicalKnowledge, communication, reasoning, matchScore, readinessScore)
    - Hiring recommendation (Strong Hire / Hire / Consider / Reject)
    - Executive summary and recruiter-friendly summary
    """
    async def generate_feedback(self, session: SessionState) -> FeedbackSchema:
        candidate_name = session.candidate.member.name if session.candidate else "Candidate"
        job_role = session.job.jobTitle if session.job and session.job.jobTitle else (session.candidate.member.jobRole if session.candidate else "AI Software Engineer")
        company = session.job.company if session.job and session.job.company else "Target Company"

        scores = [ev.score for ev in session.evaluations] if session.evaluations else [8.5]
        avg_score_10 = sum(scores) / len(scores) if scores else 8.5

        # Scale 0-10 to 0-100 metrics
        overall_score = min(98, max(50, int(avg_score_10 * 10)))
        tech_score = min(99, max(50, int(overall_score + 2)))
        comm_score = min(95, max(50, int(overall_score - 2)))
        reasoning_score = min(96, max(50, int(overall_score + 1)))
        # Calculate dynamic match score from job/candidate skill alignment
        req_skills = session.job.skills if session.job and session.job.skills else ["FastAPI", "Docker", "LangGraph", "Redis"]
        from app.services.candidate_analyzer import candidate_analyzer
        cand_skills = candidate_analyzer.extract_candidate_skills(session.candidate) if session.candidate else ["FastAPI", "LangGraph", "Python", "React", "TypeScript"]
        matched_count = len([s for s in req_skills if s in cand_skills])
        match_score = min(98, max(65, int((matched_count / max(len(req_skills), 1)) * 100)))
        readiness_score = min(96, max(60, int(overall_score * 0.95 + 5)))

        if overall_score >= 85:
            recommendation = "Strong Hire"
        elif overall_score >= 75:
            recommendation = "Hire"
        elif overall_score >= 65:
            recommendation = "Consider"
        else:
            recommendation = "Needs Development"

        all_strengths: List[str] = []
        all_gaps: List[str] = []

        for ev in session.evaluations:
            all_strengths.extend(ev.strengths_identified)
            all_gaps.extend(ev.gaps_identified)

        unique_strengths = list(dict.fromkeys(all_strengths))
        unique_gaps = list(dict.fromkeys(all_gaps))

        recruiter_summary = (
            f"Candidate {candidate_name} evaluated for {job_role} at {company}. "
            f"Overall Score: {overall_score}/100, Job Match: {match_score}%, Interview Readiness: {readiness_score}%. "
            f"Recommendation: {recommendation}. Top Strength: {unique_strengths[0] if unique_strengths else 'System Architecture'}."
        )

        llm = get_llm(temperature=0.3, purpose="interview")
        if llm:
            try:
                from langchain_core.messages import HumanMessage


                eval_summary_lines = [
                    f"- Topic: {ev.topic} (Day {ev.day}), Score: {ev.score}/10, Feedback: {ev.feedback}"
                    for ev in session.evaluations
                ]

                sys_prompt = (
                    f"You are a Hiring Manager evaluating {candidate_name} for the {job_role} position at {company}.\n"
                    f"Evaluations Log:\n" + "\n".join(eval_summary_lines) + "\n\n"
                    f"Generate JSON matching keys: summary, strengths (list), weakAreas (list), learningRoadmap (list)."
                )

                response = await llm.ainvoke([HumanMessage(content=sys_prompt)])
                content = response.content.strip()
                if content.startswith("```json"):
                    content = content.replace("```json", "").replace("```", "").strip()
                data = json.loads(content)

                strengths_res = data.get("strengths", unique_strengths or ["Strong domain proficiency"])
                weak_res = data.get("weakAreas", unique_gaps or ["Can deepen practical trade-off analysis"])
                next_res = data.get("learningRoadmap", ["Practice high-throughput system design under load"])

                return FeedbackSchema(
                    overallScore=overall_score,
                    technicalKnowledge=tech_score,
                    communication=comm_score,
                    reasoning=reasoning_score,
                    matchScore=match_score,
                    readinessScore=readiness_score,
                    hiringRecommendation=recommendation,
                    summary=data.get("summary", f"{candidate_name} demonstrated strong competency for the {job_role} position at {company}."),
                    strengths=strengths_res,
                    weakAreas=weak_res,
                    learningRoadmap=next_res,
                    recruiterSummary=recruiter_summary,
                    topStrength=strengths_res[0] if strengths_res else "System Architecture",
                    biggestWeakness=weak_res[0] if weak_res else "Docker Deployment",
                    nextRecommendedTopic=next_res[0] if next_res else "Redis",
                    gaps=weak_res,
                    next=next_res
                )
            except Exception:
                pass

        # Deterministic fallback feedback report
        weak_areas = unique_gaps[:3] if unique_gaps else ["Docker networking & container orchestration optimization", "Redis cluster scaling under high concurrency"]
        roadmap = [
            "Review Redis cluster partitioning strategies for session state",
            "Practice container network optimization & Kubernetes deployment specs"
        ]

        strengths_fallback = unique_strengths[:4] if unique_strengths else [
            f"Solid grasp of core engineering topics for {job_role}",
            "Structured communication and architectural reasoning"
        ]

        return FeedbackSchema(
            overallScore=overall_score,
            technicalKnowledge=tech_score,
            communication=comm_score,
            reasoning=reasoning_score,
            matchScore=match_score,
            readinessScore=readiness_score,
            hiringRecommendation=recommendation,
            summary=f"{candidate_name} demonstrated strong technical domain competency for the {job_role} role at {company}.",
            strengths=strengths_fallback,
            weakAreas=weak_areas,
            learningRoadmap=roadmap,
            recruiterSummary=recruiter_summary,
            topStrength="System Architecture" if not strengths_fallback else strengths_fallback[0],
            biggestWeakness="Docker Deployment" if not weak_areas else weak_areas[0],
            nextRecommendedTopic="Redis" if not roadmap else roadmap[0],
            gaps=weak_areas,
            next=roadmap
        )



feedback_generator = FeedbackGenerator()
