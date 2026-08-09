import logging
from typing import Optional, List, Dict, Any
from app.config import settings
from app.models.session import SessionState
from app.schemas.interview import (
    InterviewRequest,
    InterviewResponse,
    JobAnalysisSummary,
    ProgressMetrics
)
from app.services.session_service import session_service
from app.services.candidate_analyzer import candidate_analyzer
from app.services.job_analyzer import job_analyzer_service
from app.services.curriculum_service import curriculum_service
from app.agents.question_generator import question_generator
from app.agents.followup_generator import followup_generator
from app.agents.evaluator import evaluator_engine
from app.agents.feedback_generator import feedback_generator

logger = logging.getLogger(__name__)


class InterviewOrchestrator:
    """
    Main state machine orchestrator for managing multi-turn AI candidate interviews with job posting context and progress tracking.
    """
    def _compute_progress(self, session: SessionState) -> ProgressMetrics:
        topics_covered = []
        roadmap_items: List[Dict[str, Any]] = []

        for idx, day in enumerate(session.planned_days):
            day_info = curriculum_service.get_day_info(day)
            title = day_info.get("title", f"Day {day}") if day_info else f"Day {day}"

            if day in session.days_covered:
                topics_covered.append(title)
                status = "completed" if day != session.current_day else "active"
            else:
                status = "pending"

            roadmap_items.append({
                "index": idx + 1,
                "topic": title,
                "status": status,
                "day": day
            })

        remaining_topics = [item["topic"] for item in roadmap_items if item["status"] == "pending"]

        return ProgressMetrics(
            questionsCount=session.questions_asked,
            totalQuestions=settings.MIN_QUESTIONS,
            topicsCovered=list(dict.fromkeys(topics_covered)),
            remainingTopics=remaining_topics,
            roadmapProgress=roadmap_items
        )

    def _compute_skill_analysis(self, session: SessionState):
        from app.services.scoring_engine import scoring_engine
        from app.schemas.interview import JobDetails, NormalizedCandidateProfile

        job_obj = session.job or JobDetails(
            jobTitle=session.job_summary.role if session.job_summary else "Software Engineer",
            company=session.job_summary.company if session.job_summary else "Target Company",
            skills=session.job_summary.detectedSkills if session.job_summary else []
        )

        cand_skills = candidate_analyzer.extract_candidate_skills(session.candidate) if session.candidate else []
        cand_name = session.candidate.member.name if (session.candidate and session.candidate.member) else "Candidate"
        cand_role = session.candidate.member.jobRole if (session.candidate and session.candidate.member) else "Software Engineer"

        match_metric = scoring_engine.calculate_job_match(
            candidate_skills=cand_skills,
            candidate_experience=[],
            candidate_projects=[],
            candidate_roles=[cand_role],
            job=job_obj
        )

        norm_prof = NormalizedCandidateProfile(
            platform="LinkedIn",
            profileUrl="",
            profileId=session.candidate.member.id if (session.candidate and session.candidate.member) else "cand_1",
            name=cand_name,
            headline=cand_role,
            skills=cand_skills
        )
        profile_readiness = scoring_engine.calculate_profile_readiness(norm_prof)

        if session.evaluations:
            avg_eval = sum(ev.score for ev in session.evaluations) / len(session.evaluations)
            readiness_score = int(min(98, max(45, round((avg_eval / 10.0) * 100))))
        else:
            job_match_val = match_metric.score if match_metric else 70
            missing_cnt = len(match_metric.missingSkills) if match_metric else 0
            job_readiness = scoring_engine.calculate_job_readiness(
                profile_readiness_score=profile_readiness.score,
                job_match_score=job_match_val,
                missing_skills_count=missing_cnt
            )
            readiness_score = job_readiness.score

        matched_skills = match_metric.matchedSkills if match_metric else []
        missing_skills = match_metric.missingSkills if match_metric else []
        match_score = match_metric.score if match_metric else 70

        req_skills = job_obj.skills or (matched_skills + missing_skills)
        return req_skills, cand_skills, missing_skills, match_score, readiness_score, match_metric

    async def process_turn(self, request: InterviewRequest) -> InterviewResponse:
        session_id = request.sessionId
        session = await session_service.get_session(session_id)

        # 1. Initialize session if new or profile/job payloaded
        if not session or request.candidate is not None or request.job is not None:
            session = SessionState(
                session_id=session_id,
                candidate=request.candidate,
                job=request.job
            )

            # Analyze job details if present
            if request.job:
                job_summary = job_analyzer_service.analyze_job(request.job)
                session.job_summary = job_summary
                job_days = job_analyzer_service.map_skills_to_curriculum_days(job_summary.detectedSkills)
            else:
                role_title = request.candidate.member.jobRole if (request.candidate and request.candidate.member) else "Technical Role"
                session.job_summary = JobAnalysisSummary(
                    company="Target Organization",
                    role=role_title,
                    detectedSkills=["Core Technical Requirements"],
                    matchScore=None,
                    readinessScore=None
                )
                job_days = [7, 10, 13, 21, 28]

            # Plan curriculum days combining candidate signals and job requirement skills
            if request.candidate:
                cand_days = candidate_analyzer.plan_interview_days(request.candidate)
                combined = []
                for d in job_days + cand_days:
                    if d not in combined:
                        combined.append(d)
                session.planned_days = combined[:6]
            else:
                session.planned_days = job_days[:5]

            first_day = session.planned_days[0]
            session.current_day = first_day
            session.days_covered.append(first_day)

            # Generate first question tailored to job and candidate
            try:
                question = await question_generator.generate_question(
                    day=first_day,
                    candidate=session.candidate,
                    job=session.job,
                    turn_index=1
                )
            except Exception as q_err:
                logger.warning(f"[ORCHESTRATOR] Question generation fallback notice: {q_err}")
                role_str = session.job_summary.role if session.job_summary else "Software Engineer"
                comp_str = session.job_summary.company if session.job_summary else "Target Company"
                question = f"Regarding the technical requirements for the {role_str} role at {comp_str}, how do you approach architecture and implementation when designing core system components?"

            session.current_question = question
            session.questions_asked = 1
            session.conversation_history.append({
                "role": "interviewer",
                "content": question
            })

            await session_service.save_session(session)

            candidate_name = session.candidate.member.name if session.candidate else "Candidate"
            company = session.job_summary.company
            role = session.job_summary.role
            req_skills, cand_skills, missing_skills, match_score, readiness_score, match_metric = self._compute_skill_analysis(session)

            first_day_info = curriculum_service.get_day_info(first_day)
            day_title = first_day_info.get("title", "Technical Architecture") if first_day_info else "Technical Architecture"

            from app.utils.helpers import safe_join
            why_asked = (
                f"• Job requires expertise in {safe_join(', ', req_skills[:2])} for {role} at {company}.\n"
                f"• Curriculum RAG targets module: {day_title}.\n"
                f"• Evaluating baseline technical depth for initial interview turn."
            )

            welcome_msg = (
                f"Welcome {candidate_name}. Preparing your AI Technical Interview for {role} at {company}.\n\n"
                f"Question 1: {question}"
            )

            return InterviewResponse(
                reply=welcome_msg,
                done=False,
                whyAsked=why_asked,
                matchScore=match_score,
                readinessScore=readiness_score,
                requiredSkills=req_skills,
                candidateSkills=cand_skills,
                missingSkills=missing_skills,
                jobSummary=session.job_summary,
                progress=self._compute_progress(session),
                matchMetricDetails=match_metric
            )

        # 2. Handle subsequent conversation turns
        user_message = request.message or ""
        session.conversation_history.append({
            "role": "candidate",
            "content": user_message
        })

        # Evaluate previous question turn
        if session.current_question and session.current_day:
            evaluation = await evaluator_engine.evaluate_turn(
                question=session.current_question,
                answer=user_message,
                day=session.current_day
            )
            session.evaluations.append(evaluation)

            # Store interview turn memory in Breeth
            try:
                from app.services.breeth_memory import breeth_memory_service
                cand_id = session.candidate.member.id if (session.candidate and session.candidate.member) else session_id
                await breeth_memory_service.store_interview_turn_memory(
                    candidate_id=cand_id,
                    question=session.current_question,
                    answer=user_message,
                    evaluation=evaluation
                )
            except Exception as b_err:
                logger.warning(f"[BREETH_UNAVAILABLE] Interview turn memory store notice: {b_err}")

        req_skills, cand_skills, missing_skills, match_score, readiness_score, match_metric = self._compute_skill_analysis(session)

        # Check completion criteria (8 questions & 4 distinct days)
        distinct_days_count = len(set(session.days_covered))
        if session.questions_asked >= settings.MIN_QUESTIONS and distinct_days_count >= settings.MIN_CURRICULUM_DAYS:
            session.done = True
            feedback = await feedback_generator.generate_feedback(session)
            session.feedback = feedback
            await session_service.save_session(session)

            return InterviewResponse(
                reply="Interview Complete. Generating your detailed skill gap analysis and executive report.",
                done=True,
                whyAsked="All curriculum modules completed. Interview concluded.",
                matchScore=feedback.matchScore,
                readinessScore=feedback.readinessScore,
                requiredSkills=req_skills,
                candidateSkills=cand_skills,
                missingSkills=missing_skills,
                jobSummary=session.job_summary,
                progress=self._compute_progress(session),
                feedback=feedback
            )

        # 3. Determine next question & curriculum day
        next_turn_index = session.questions_asked + 1

        day_index = (next_turn_index - 1) // 2
        if day_index < len(session.planned_days):
            next_day = session.planned_days[day_index]
        else:
            next_day = session.planned_days[-1]

        if next_day not in session.days_covered:
            session.days_covered.append(next_day)

        session.current_day = next_day

        cand_id_str = session.candidate.member.id if (session.candidate and session.candidate.member) else session_id

        # Generate next question
        if next_turn_index % 2 == 0 and user_message:
            next_question = await followup_generator.generate_followup(
                question=session.current_question or "",
                answer=user_message,
                day=next_day,
                candidate_id=cand_id_str
            )
            why_asked = (
                f"• Follow-up generated based on previous candidate response.\n"
                f"• Drilling deeper into trade-offs and edge cases for Day {next_day}.\n"
                f"• Validating practical implementation depth."
            )
        else:
            next_question = await question_generator.generate_question(
                day=next_day,
                candidate=session.candidate,
                job=session.job,
                turn_index=next_turn_index
            )
            next_day_info = curriculum_service.get_day_info(next_day)
            day_title = next_day_info.get("title", f"Day {next_day}") if next_day_info else f"Day {next_day}"
            why_asked = (
                f"• Advancing to next planned curriculum module: {day_title}.\n"
                f"• Role requires {session.job.jobTitle if session.job else 'AI Engineer'} proficiency.\n"
                f"• Validating candidate competency across skill matrix."
            )

        session.current_question = next_question
        session.questions_asked = next_turn_index
        session.conversation_history.append({
            "role": "interviewer",
            "content": next_question
        })

        await session_service.save_session(session)

        return InterviewResponse(
            reply=f"Question {next_turn_index}: {next_question}",
            done=False,
            whyAsked=why_asked,
            matchScore=match_score,
            readinessScore=readiness_score,
            requiredSkills=req_skills,
            candidateSkills=cand_skills,
            missingSkills=missing_skills,
            jobSummary=session.job_summary,
            progress=self._compute_progress(session)
        )


interview_orchestrator = InterviewOrchestrator()
