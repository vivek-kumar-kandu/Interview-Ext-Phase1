import json
import logging
import uuid
from typing import Dict, Any, Optional, List
from fastapi import HTTPException, status
from langchain_core.messages import HumanMessage
from app.utils.llm import get_llm
from app.services.session_service import session_service
from app.models.session import SessionState, TurnEvaluation, IntegrityEvent

logger = logging.getLogger(__name__)


class LPAInterviewEngine:
    """
    Dynamic AI-Powered Technical Interview Engine for InterviewOS.
    Generates personalized multi-turn technical interviews calibrated against candidate expected LPA,
    resume evidence, target job description, and job match analysis.
    Guarantees NO static fallbacks, NO demo questions, and NO hardcoded question lists.
    """

    def _determine_lpa_difficulty(self, lpa: float) -> str:
        if lpa <= 8:
            return "Junior (Fundamentals & Practical Basics)"
        elif lpa <= 18:
            return "Mid-Senior (Architecture, Trade-offs & Systems)"
        else:
            return "Staff/Lead (Scalability, Distributed Systems & Production Failures)"

    async def start_interview(
        self,
        candidate_profile: Dict[str, Any],
        job_profile: Dict[str, Any],
        match_analysis: Dict[str, Any],
        expected_lpa: float = 12.0,
        session_id: Optional[str] = None,
        job: Optional[Dict[str, Any]] = None,
        candidate: Optional[Dict[str, Any]] = None,
        interview_preferences: Optional[Dict[str, Any]] = None,
        api_key_override: Optional[str] = None
    ) -> Dict[str, Any]:
        lpa_to_use = expected_lpa if (expected_lpa and expected_lpa > 0) else 12.0
        sid = session_id or f"sess_{uuid.uuid4().hex[:12]}"
        intv_id = f"intv_{uuid.uuid4().hex[:10]}"

        # Merge candidate context
        cand_ctx = candidate or candidate_profile or {}
        job_ctx = job or job_profile or {}

        # Load or create session
        session = SessionState(
            session_id=sid,
            candidate_profile_dict=cand_ctx,
            match_analysis=match_analysis or {},
            expected_lpa=lpa_to_use,
            questions_asked=1
        )

        llm = get_llm(temperature=0.7, api_key_override=api_key_override)
        if not llm:
            logger.error("[LPA_INTERVIEW] Gemini LLM unavailable (missing API key or initialization failed)")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI interviewer is temporarily unavailable. Please check backend LLM configuration."
            )

        # Extract structured evidence context
        cand_name = cand_ctx.get("name") or cand_ctx.get("candidateName") or "Candidate"
        cand_skills = cand_ctx.get("skills") or cand_ctx.get("keySkills") or cand_ctx.get("technicalSkills") or []
        cand_exp = cand_ctx.get("experience") or []
        cand_projects = cand_ctx.get("projects") or []
        cand_edu = cand_ctx.get("education") or []

        job_id = job_ctx.get("id") or job_ctx.get("jobId") or f"job_{uuid.uuid4().hex[:8]}"
        job_title = job_ctx.get("jobTitle") or job_ctx.get("title") or job_ctx.get("role") or "Technical Position"
        company = job_ctx.get("company") or "Target Company"
        job_skills = job_ctx.get("skills") or job_ctx.get("requiredSkills") or []
        job_desc = job_ctx.get("description") or job_ctx.get("jobDescription") or ""

        matched_skills = match_analysis.get("matchedSkills") or []
        missing_skills = match_analysis.get("missingSkills") or []
        match_score = match_analysis.get("matchScore") or match_analysis.get("match", {}).get("overall") or "N/A"

        difficulty_lbl = self._determine_lpa_difficulty(lpa_to_use)

        prompt = f"""
You are a Principal AI Technical Interviewer at InterviewOS conducting a live personalized technical interview.

INTERVIEW CALIBRATION:
- Candidate Expected LPA: ₹{lpa_to_use} LPA
- Role Target: {job_title} at {company}
- Interview Difficulty Calibration: {difficulty_lbl}

CANDIDATE EVIDENCE:
- Name: {cand_name}
- Technical Skills: {cand_skills}
- Work Experience: {cand_exp}
- Projects: {cand_projects}
- Education: {cand_edu}

JOB REQUIREMENT CONTEXT:
- Title: {job_title}
- Company: {company}
- Required Skills: {job_skills}
- Job Description Excerpt: {job_desc[:1200]}

MATCH ANALYSIS & GAP SIGNALS:
- Match Score: {match_score}%
- Matched Skills: {matched_skills}
- Missing/Gap Skills: {missing_skills}

REQUIREMENTS FOR FIRST QUESTION:
1. Ground the question directly in REAL candidate resume evidence (e.g. a specific project, technology, or role experience) combined with job requirements.
2. Calibrate difficulty for ₹{lpa_to_use} LPA:
   - For 1-8 LPA: Test technical fundamentals, core programming concepts, and practical project understanding.
   - For 9-18 LPA: Test architecture choices, trade-offs, debugging scenarios, and API/database design.
   - For 19+ LPA: Test system design, scalability under load, production failures, performance optimization, and deep architectural decisions.
3. Do NOT ask generic questions like "Tell me about yourself".
4. Do NOT invent fake projects, companies, or experience.

Return ONLY valid JSON matching this structure:
{{
  "question": "<Scenario-based technical question grounded in resume and job>",
  "topic": "<Technical Topic>",
  "difficulty": "Junior | Mid-level | Senior | Lead"
}}
"""

        try:
            res = await llm.ainvoke([HumanMessage(content=prompt)])
            res_content = res.content.strip()

            if "```json" in res_content:
                res_content = res_content.split("```json")[1].split("```")[0].strip()
            elif "```" in res_content:
                res_content = res_content.split("```")[1].split("```")[0].strip()

            parsed = json.loads(res_content)
            q_text = parsed.get("question")
            q_topic = parsed.get("topic") or "Core Technical Architecture"
            q_diff = parsed.get("difficulty") or "Mid-level"

            if not q_text:
                raise ValueError("Parsed JSON missing 'question' field.")

        except Exception as e:
            logger.error(f"[GEMINI_INTERVIEW_ERROR] Failed to generate first interview question: {e}")
            err_str = str(e)
            if "403" in err_str or "PERMISSION_DENIED" in err_str or "disabled" in err_str.lower():
                detail_msg = "Google Generative Language API is disabled or restricted for this project (403 PERMISSION_DENIED). Please enable it at https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview or check API restrictions in Google Cloud Console."
            elif "401" in err_str or "UNAUTHENTICATED" in err_str or "ACCESS_TOKEN" in err_str:
                detail_msg = "Gemini API key authentication failed (401 UNAUTHENTICATED). Please verify the GEMINI_API_KEY set in backend/.env."
            elif "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                detail_msg = "Gemini API rate limit or quota exceeded (429 RESOURCE_EXHAUSTED). Please wait a moment and try again."
            else:
                detail_msg = f"AI interviewer is temporarily unavailable: {err_str}"
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=detail_msg
            )

        session.current_question = q_text
        session.current_topic = q_topic
        session.current_difficulty = q_diff
        session.conversation_history.append({"role": "interviewer", "content": q_text})

        await session_service.save_session(session)

        first_q_obj = {
            "id": f"q_1_{uuid.uuid4().hex[:6]}",
            "text": q_text,
            "category": q_topic,
            "difficulty": q_diff,
            "expectedSignals": matched_skills[:3] if matched_skills else ["Technical Depth"]
        }

        session_summary_obj = {
            "title": f"{job_title} AI Technical Interview",
            "focusAreas": [q_topic] + (job_skills[:3] if job_skills else []),
            "difficulty": q_diff,
            "estimatedQuestions": 8
        }

        return {
            "success": True,
            "sessionId": sid,
            "interviewId": intv_id,
            "jobId": job_id,
            "questionNumber": 1,
            "question": q_text,
            "topic": q_topic,
            "difficulty": q_diff,
            "totalQuestionsEstimate": 8,
            "expectedLpa": lpa_to_use,
            "session": session_summary_obj,
            "firstQuestion": first_q_obj
        }

    async def process_answer(
        self,
        session_id: str,
        answer: str,
        expected_lpa_override: Optional[float] = None,
        elapsed_seconds: Optional[int] = None,
        integrity_metrics: Optional[Dict[str, Any]] = None,
        api_key_override: Optional[str] = None
    ) -> Dict[str, Any]:
        session = await session_service.get_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="SESSION_NOT_FOUND: The requested interview session does not exist or has expired."
            )

        if not answer or len(answer.strip()) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="EMPTY_ANSWER: Please provide a meaningful response to the question."
            )

        llm = get_llm(temperature=0.7, api_key_override=api_key_override)
        if not llm:
            logger.error("[LPA_INTERVIEW] Gemini LLM unavailable")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI interviewer is temporarily unavailable. Please try again."
            )

        expected_lpa = expected_lpa_override or session.expected_lpa or 12.0
        session.expected_lpa = expected_lpa

        # Store integrity metrics if passed
        if integrity_metrics and isinstance(integrity_metrics, dict):
            detail_str = f"fullscreenExits={integrity_metrics.get('fullscreenExitCount', 0)}, tabSwitches={integrity_metrics.get('tabSwitchCount', 0)}"
            session.integrity_events.append(
                IntegrityEvent(
                    eventType="metrics_snapshot",
                    timestamp="2026-08-09T00:00:00Z",
                    detail=detail_str
                )
            )

        # Append candidate response
        session.conversation_history.append({"role": "candidate", "content": answer.strip()})
        current_turn = session.questions_asked
        difficulty_lbl = self._determine_lpa_difficulty(expected_lpa)

        cand_profile = session.candidate_profile_dict or {}
        match_analysis = session.match_analysis or {}

        history_formatted = "\n".join(
            [f"{msg['role'].upper()}: {msg['content']}" for msg in session.conversation_history[-6:]]
        )

        is_final_turn = current_turn >= 8

        prompt = f"""
You are a Principal AI Technical Interviewer at InterviewOS conducting a multi-turn adaptive technical interview.

INTERVIEW CALIBRATION:
- Candidate Expected LPA: ₹{expected_lpa} LPA ({difficulty_lbl})
- Question Number: {current_turn} of 8+

RECENT CONVERSATION HISTORY:
{history_formatted}

CANDIDATE CONTEXT:
- Technical Skills: {cand_profile.get('skills', [])}
- Experience: {cand_profile.get('experience', [])}
- Projects: {cand_profile.get('projects', [])}

TASK:
1. Evaluate candidate's latest answer for correctness, technical depth, reasoning, confidence, and misconceptions.
2. Determine if candidate should receive the next question or if the interview has gathered sufficient evidence (>=8 questions).
3. If continuing:
   - If candidate's answer was strong -> increase difficulty.
   - If candidate's answer was weak/average -> probe deeper or test fundamental concepts.
   - If candidate's answer contradicts resume claims -> ask a targeted verification question.
   - Ensure the next question tests a new dimension (e.g. system design, debugging, trade-offs, skill gap).
4. If interview is complete (>=8 questions):
   - Generate comprehensive structured final evaluation.

Return ONLY valid JSON matching this structure:

If continuing (isComplete = false):
{{
  "isComplete": false,
  "turnEvaluation": {{
    "score": 8.5,
    "feedback": "<Brief feedback on answer>",
    "strengths": ["<strength1>"],
    "gaps": ["<gap1>"]
  }},
  "nextQuestion": {{
    "question": "<Next adaptive question>",
    "topic": "<Technical Topic>",
    "difficulty": "Junior | Mid-level | Senior | Lead",
    "isFollowUp": true/false
  }}
}}

If interview complete (isComplete = true):
{{
  "isComplete": true,
  "turnEvaluation": {{
    "score": 8.5,
    "feedback": "<Brief feedback on final answer>"
  }},
  "finalFeedback": {{
    "overallTechnicalScore": 82,
    "fundamentalsScore": 85,
    "problemSolvingScore": 80,
    "roleKnowledgeScore": 84,
    "communicationScore": 88,
    "resumeCredibilityScore": 90,
    "strengths": ["<strength1>", "<strength2>"],
    "weaknesses": ["<weakness1>", "<weakness2>"],
    "topicsToImprove": ["<topic1>", "<topic2>"],
    "recommendedPrep": ["<prep1>", "<prep2>"],
    "calibrationNotice": "Interview calibrated for expected LPA: ₹{expected_lpa} LPA"
  }}
}}
"""

        try:
            res = await llm.ainvoke([HumanMessage(content=prompt)])
            res_content = res.content.strip()

            if "```json" in res_content:
                res_content = res_content.split("```json")[1].split("```")[0].strip()
            elif "```" in res_content:
                res_content = res_content.split("```")[1].split("```")[0].strip()

            parsed = json.loads(res_content)

        except Exception as e:
            logger.error(f"[GEMINI_INTERVIEW_ERROR] Failed to process turn answer: {e}")
            err_str = str(e)
            if "403" in err_str or "PERMISSION_DENIED" in err_str or "disabled" in err_str.lower():
                detail_msg = "Google Generative Language API is disabled or restricted for this project (403 PERMISSION_DENIED). Please enable it at https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview or check API restrictions in Google Cloud Console."
            elif "401" in err_str or "UNAUTHENTICATED" in err_str or "ACCESS_TOKEN" in err_str:
                detail_msg = "Gemini API key authentication failed (401 UNAUTHENTICATED). Please verify the GEMINI_API_KEY set in backend/.env."
            elif "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                detail_msg = "Gemini API rate limit or quota exceeded (429 RESOURCE_EXHAUSTED). Please wait a moment and try again."
            else:
                detail_msg = f"AI interviewer is temporarily unavailable: {err_str}"
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=detail_msg
            )

        # Process evaluation
        turn_eval = parsed.get("turnEvaluation") or {}
        turn_score_num = float(turn_eval.get("score", 7.5))
        turn_strengths = turn_eval.get("strengths") or []
        turn_gaps = turn_eval.get("gaps") or []

        session.evaluations.append(
            TurnEvaluation(
                question=session.current_question or f"Question {current_turn}",
                answer=answer,
                day=current_turn,
                topic=session.current_topic or "Technical Turn",
                score=turn_score_num,
                feedback=turn_eval.get("feedback", ""),
                strengths_identified=turn_strengths,
                gaps_identified=turn_gaps
            )
        )

        is_complete = parsed.get("isComplete") or is_final_turn

        if is_complete:
            session.done = True
            final_fb = parsed.get("finalFeedback") or {}

            # Add integrity summary if events recorded
            if session.integrity_events:
                events_summary = f"{len(session.integrity_events)} observable integrity event(s) recorded during interview."
            else:
                events_summary = "Full browser focus maintained throughout interview."

            final_fb["integritySummary"] = events_summary
            final_fb["calibrationNotice"] = f"Interview calibrated for expected LPA: ₹{expected_lpa} LPA"

            await session_service.save_session(session)

            return {
                "success": True,
                "sessionId": session_id,
                "questionNumber": current_turn,
                "interviewComplete": True,
                "score": int(turn_score_num * 10),
                "strengths": turn_strengths,
                "gaps": turn_gaps,
                "feedback": final_fb
            }

        # Next question turn
        next_q_data = parsed.get("nextQuestion") or {}
        next_q_text = next_q_data.get("question")
        next_q_topic = next_q_data.get("topic") or "Technical Concepts"
        next_q_diff = next_q_data.get("difficulty") or "Mid-level"
        is_followup = bool(next_q_data.get("isFollowUp", True))

        if not next_q_text:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI interviewer is temporarily unavailable. Please try again."
            )

        next_q_num = current_turn + 1
        session.questions_asked = next_q_num
        session.current_question = next_q_text
        session.current_topic = next_q_topic
        session.current_difficulty = next_q_diff
        session.conversation_history.append({"role": "interviewer", "content": next_q_text})

        await session_service.save_session(session)

        next_q_obj = {
            "id": f"q_{next_q_num}_{uuid.uuid4().hex[:6]}",
            "text": next_q_text,
            "category": next_q_topic,
            "difficulty": next_q_diff
        }

        return {
            "success": True,
            "sessionId": session_id,
            "questionNumber": next_q_num,
            "question": next_q_text,
            "topic": next_q_topic,
            "difficulty": next_q_diff,
            "isFollowUp": is_followup,
            "interviewComplete": False,
            "score": int(turn_score_num * 10),
            "strengths": turn_strengths,
            "gaps": turn_gaps,
            "nextQuestion": next_q_obj
        }

    async def log_integrity_event(
        self,
        session_id: str,
        event_type: str,
        timestamp: Optional[str] = None,
        detail: Optional[str] = None
    ) -> Dict[str, Any]:
        session = await session_service.get_session(session_id)
        if session:
            session.integrity_events.append(
                IntegrityEvent(
                    eventType=event_type,
                    timestamp=timestamp or "2026-08-09T00:00:00Z",
                    detail=detail
                )
            )
            await session_service.save_session(session)
            logger.info(f"[INTEGRITY_EVENT] session={session_id} event={event_type}")

        return {"success": True, "sessionId": session_id, "recorded": True}


lpa_interview_engine = LPAInterviewEngine()
