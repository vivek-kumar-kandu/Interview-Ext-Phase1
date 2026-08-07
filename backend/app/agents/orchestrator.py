import logging
from typing import Optional, List
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
        for day in session.days_covered:
            day_info = curriculum_service.get_day_info(day)
            if day_info:
                topics_covered.append(day_info.get("title", f"Day {day}"))
            else:
                topics_covered.append(f"Day {day}")

        remaining_topics = []
        for day in session.planned_days:
            if day not in session.days_covered:
                day_info = curriculum_service.get_day_info(day)
                title = day_info.get("title", f"Day {day}") if day_info else f"Day {day}"
                if title not in remaining_topics:
                    remaining_topics.append(title)

        return ProgressMetrics(
            questionsCount=session.questions_asked,
            totalQuestions=settings.MIN_QUESTIONS,
            topicsCovered=list(dict.fromkeys(topics_covered)),
            remainingTopics=remaining_topics
        )

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
                session.job_summary = JobAnalysisSummary(
                    company="Target Company",
                    role=request.candidate.member.jobRole if request.candidate else "AI Engineer",
                    detectedSkills=["Python", "FastAPI", "LangGraph", "RAG", "Docker", "Redis"]
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
            question = await question_generator.generate_question(
                day=first_day,
                candidate=session.candidate,
                job=session.job,
                turn_index=1
            )

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

            welcome_msg = (
                f"Welcome {candidate_name}. Preparing your AI Technical Interview for {role} at {company}.\n\n"
                f"Question 1: {question}"
            )

            return InterviewResponse(
                reply=welcome_msg,
                done=False,
                jobSummary=session.job_summary,
                progress=self._compute_progress(session)
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

        # Check completion criteria (8 questions & 4 distinct days)
        distinct_days_count = len(set(session.days_covered))
        if session.questions_asked >= settings.MIN_QUESTIONS and distinct_days_count >= settings.MIN_CURRICULUM_DAYS:
            session.done = True
            feedback = await feedback_generator.generate_feedback(session)
            session.feedback = feedback
            await session_service.save_session(session)

            return InterviewResponse(
                reply="Interview Complete. Generating your detailed skill gap analysis and candidate report.",
                done=True,
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

        # Generate next question
        if next_turn_index % 2 == 0 and user_message:
            next_question = await followup_generator.generate_followup(
                question=session.current_question or "",
                answer=user_message,
                day=next_day
            )
        else:
            next_question = await question_generator.generate_question(
                day=next_day,
                candidate=session.candidate,
                job=session.job,
                turn_index=next_turn_index
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
            jobSummary=session.job_summary,
            progress=self._compute_progress(session)
        )


interview_orchestrator = InterviewOrchestrator()
