import time
import json
import logging
from typing import Dict, Any, List, Optional
from app.config import settings
from app.services.judge_service import judge_service

logger = logging.getLogger(__name__)

# Global in-memory session store for Judge Panel simulated sessions
_JUDGE_SESSIONS: Dict[str, Dict[str, Any]] = {}


class JudgeInterviewEngine:
    def _calculate_turn_score(self, answer: str, topic: str) -> int:
        """Calculates 0-100 turn accuracy score based strictly on candidate response."""
        ans = (answer or "").strip()
        words = [w for w in ans.split() if w]
        word_count = len(words)
        ans_lower = ans.lower()

        if word_count < 4 or len(ans) < 8:
            return min(25, max(10, word_count * 5))

        uncertainty_phrases = ["don't know", "dont know", "not sure", "no idea", "skipped", "haven't used"]
        if any(p in ans_lower for p in uncertainty_phrases):
            return 30

        key_tech_terms = [
            "vector", "embedding", "rag", "langchain", "mcp", "fastapi", "docker", "python",
            "hnsw", "cosine", "prompt", "agent", "orchestration", "pipeline", "model", "llm",
            "context", "retrieval", "database", "index", "api", "json", "schema", "token",
            "transformer", "fine-tuning", "lora", "eval", "benchmark", "quantization",
            "ollama", "qwen", "copilot", "vscode", "environment", "pandas", "dataset", "virtualenv"
        ]
        matched = [t for t in key_tech_terms if t in ans_lower]
        if matched:
            return min(98, 65 + (len(matched) * 8) + (10 if word_count > 10 else 0))

        if word_count >= 15:
            return 80

        return 50

    def _get_expected_answer(self, topic: str, question: str) -> str:
        """Returns ideal expected technical answer for a given curriculum topic and question."""
        top_lower = (topic or "").lower()
        q_lower = (question or "").lower()

        if "vs code" in top_lower or "environment setup" in top_lower or "vs code" in q_lower:
            return "Configure an isolated virtual environment (`python -m venv .venv`), set up `pyproject.toml` or `requirements.txt`, enable official Python and Pylance extensions in VS Code, and automate code formatting using Ruff/Black."
        elif "local llm" in top_lower or "ai coding assistant" in top_lower or "ollama" in q_lower or "copilot" in q_lower:
            return "Run local open-weights LLMs via Ollama (`ollama run qwen2.5-coder`), point VS Code AI assistant extensions to localhost:11434/v1 API endpoints, and monitor local VRAM/CPU memory footprint."
        elif "react" in top_lower or "github" in top_lower or "frontend" in top_lower:
            return "Build Vite React frontend application connected via REST/WebSockets to FastAPI backend, manage component state cleanly, setup CORS headers, and push version-controlled code to GitHub."
        elif "pandas" in top_lower or "structured data" in top_lower or "data foundations" in top_lower:
            return "Process datasets using pandas with vectorized operations and streaming chunk sizes, validate input data schemas with Pydantic, handle missing values, and export normalized JSON/Parquet outputs."
        elif "embeddings" in top_lower or "vector search" in top_lower or "faiss" in q_lower or "hnsw" in q_lower:
            return "Generate dense text embeddings using SentenceTransformers, chunk documents recursively (500 tokens with 50 overlap), build an HNSW FAISS/Qdrant vector index, and execute cosine similarity search."
        elif "rag" in top_lower or "llm api" in top_lower or "end-to-end" in top_lower:
            return "Construct end-to-end RAG pipelines by retrieving top-k vector context chunks, injecting system prompt guardrails, calling LLM endpoints with temperature=0.2, and validating structured Pydantic responses."
        elif "chatbot" in top_lower or "fastapi" in top_lower or "backend integration" in top_lower:
            return "Develop asynchronous FastAPI web backend with stateful session management, stream LLM token outputs via Server-Sent Events (SSE), and handle connection lifecycle events."
        elif "agent" in top_lower or "orchestration" in top_lower or "langchain" in top_lower:
            return "Implement agentic control loops using LangGraph/LangChain, binding tool calling schemas, handling tool execution fallbacks, and maintaining conversational state history."
        elif "mcp" in top_lower or "model context protocol" in top_lower:
            return "Expose MCP server resources and tools following JSON-RPC protocol over stdio/SSE transports, validating requests against tool schemas and returning structured responses."
        elif "capstone" in top_lower or "deployment" in top_lower or "docker" in top_lower or "kubernetes" in top_lower:
            return "Containerize microservices with multi-stage Dockerfiles, deploy on Kubernetes/Cloud Run, set up health checks, auto-scaling, and telemetry logging with Prometheus/Grafana."
        else:
            return "Apply industry standard technical practices, modular software design, schema validation, error handling, and robust automated test suites."

    async def start_session(
        self,
        session_id: str,
        candidate_id: Optional[str] = None,
        candidate_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Initializes a personalized hackathon interview session for Judge Panel mode.
        Combines curriculum.json + selected candidate profile context.
        Strictly isolated from normal candidate sessions.
        """
        # Load curriculum dynamically
        curriculum_res = await judge_service.analyze_judge_file("curriculum.json")
        curriculum_extracted = curriculum_res.get("extracted", {}) if curriculum_res.get("success") else {}
        
        daily_topics = curriculum_extracted.get("topics", [])
        modules_list = curriculum_extracted.get("moduleList", [])
        tools_list = curriculum_extracted.get("tools", [])

        # Load candidate dynamically
        cand = None
        if candidate_data:
            cand = candidate_data
        elif candidate_id:
            cand = await judge_service.get_candidate_by_id(candidate_id)
        
        if not cand:
            # Fallback to first candidate in dataset
            candidates_res = await judge_service.analyze_judge_file("candidates.json")
            cand_list = candidates_res.get("extracted", {}).get("candidates", []) if candidates_res.get("success") else []
            cand = cand_list[0] if cand_list else {
                "id": "CAND-001",
                "name": "Sarah Johnson",
                "role": "Senior Data Engineer",
                "experience": 9,
                "education": "MS Computer Science"
            }

        # Build initial target question topics covering distinct curriculum days
        covered_days = set()
        planned_topics = []
        
        # Sourced default curriculum days if topics array is sparse
        default_curriculum_days = [
            {"day": 1, "title": "VS Code & Python Setup", "tools": ["VS Code", "Python"]},
            {"day": 4, "title": "Data Foundations & Pandas", "tools": ["Pandas", "Python"]},
            {"day": 7, "title": "Embeddings & Vector Search", "tools": ["Embeddings", "Vector DB"]},
            {"day": 11, "title": "RAG End-to-End & LLMs", "tools": ["RAG", "LLM API"]},
            {"day": 16, "title": "Chatbot Backend Integration", "tools": ["FastAPI", "Chatbot"]},
            {"day": 21, "title": "Agentic AI & Orchestration", "tools": ["LangChain", "Agents"]},
            {"day": 25, "title": "Model Context Protocol (MCP)", "tools": ["MCP", "Tools"]},
            {"day": 31, "title": "Production Capstone & Deployment", "tools": ["Docker", "Kubernetes"]}
        ]

        if daily_topics:
            for topic in daily_topics:
                day_num = topic.get("day", 1)
                if day_num not in covered_days:
                    covered_days.add(day_num)
                    planned_topics.append(topic)

        # Fallback to default curriculum days if less than 8 planned
        if len(planned_topics) < 8:
            for d_topic in default_curriculum_days:
                if d_topic["day"] not in covered_days and len(planned_topics) < 8:
                    covered_days.add(d_topic["day"])
                    planned_topics.append(d_topic)

        cand_name = cand.get("name") or cand.get("member", {}).get("name") or "Candidate"
        cand_role = cand.get("role") or cand.get("jobRole") or cand.get("member", {}).get("jobRole") or "AI Engineer"
        
        first_topic = planned_topics[0] if planned_topics else default_curriculum_days[0]
        first_topic_title = first_topic.get("title", "Core Architecture")
        first_day = first_topic.get("day", 1)
        first_tools = ", ".join(first_topic.get("tools", ["Python"])[:3])

        prompt = (
            f"You are a senior technical hackathon interviewer conducting a structured technical evaluation.\n"
            f"Candidate: {cand_name} ({cand_role})\n"
            f"Topic: Day {first_day} - {first_topic_title} (Tools: {first_tools})\n"
            f"Task: Ask Question 1 (out of min 8). Ask a realistic, practical technical question about {first_topic_title}.\n"
            f"Keep question concise, technical, professional, and clear."
        )

        first_question_text = await self._call_llm(
            prompt,
            fallback=f"Welcome {cand_name}. To begin our technical evaluation on Day {first_day} ({first_topic_title}), how do you configure and optimize your implementation using {first_tools}?"
        )

        session_state = {
            "sessionId": session_id,
            "candidate": cand,
            "startTime": time.time(),
            "turns": [],
            "coveredDays": [first_day],
            "coveredModules": [1],
            "questionsAskedCount": 1,
            "plannedTopics": planned_topics,
            "currentTopic": first_topic,
            "isDone": False,
            "report": None,
            "questionMetadataList": [
                {
                    "questionNumber": 1,
                    "question": first_question_text,
                    "candidateAnswer": None,
                    "expectedAnswer": self._get_expected_answer(first_topic_title, first_question_text),
                    "curriculumDay": first_day,
                    "curriculumTopic": first_topic_title,
                    "module": "Module 1: Environment & Tooling",
                    "difficulty": "Foundational",
                    "questionType": "Practical Architecture",
                    "followUpOf": None,
                    "evaluation": None
                }
            ]
        }

        _JUDGE_SESSIONS[session_id] = session_state

        return {
            "success": True,
            "sessionId": session_id,
            "candidate": cand,
            "reply": first_question_text,
            "done": False,
            "progress": {
                "questionNumber": 1,
                "minQuestionsRequired": 8,
                "coveredDaysCount": 1,
                "minDaysRequired": 4,
                "currentDay": first_day,
                "currentTopic": first_topic_title
            }
        }

    def _evaluate_answer_dynamically(self, question: str, topic: str, answer: str) -> str:
        """
        Dynamically analyzes candidate response text in real-time.
        Evaluates length, technical keyword presence, gibberish/short response, or technical accuracy.
        """
        ans = (answer or "").strip()
        words = ans.split()
        word_count = len(words)
        ans_lower = ans.lower()

        # 1. Very short or gibberish response (e.g. "jf", "asdf", "ok", "yes", < 4 words)
        if word_count < 4 or len(ans) < 8:
            return f"Response '{ans}' is brief/incomplete. Candidate provided minimal technical explanation for {topic}."

        # 2. Candidate explicitly states uncertainty (e.g. "i don't know", "not sure", "no idea")
        uncertainty_phrases = ["don't know", "dont know", "not sure", "no idea", "skipped", "haven't used"]
        if any(phrase in ans_lower for phrase in uncertainty_phrases):
            return f"Candidate acknowledged gap in technical familiarity regarding {topic}."

        # 3. Dynamic keyword recognition
        key_tech_terms = [
            "vector", "embedding", "rag", "langchain", "mcp", "fastapi", "docker", "python",
            "hnsw", "cosine", "prompt", "agent", "orchestration", "pipeline", "model", "llm",
            "context", "retrieval", "database", "index", "api", "json", "schema", "token",
            "transformer", "fine-tuning", "lora", "eval", "benchmark", "quantization",
            "ollama", "qwen", "copilot", "vscode", "environment", "pandas", "dataset"
        ]
        matched_terms = [term for term in key_tech_terms if term in ans_lower]

        if matched_terms:
            terms_str = ", ".join(matched_terms[:3])
            return f"Candidate demonstrated technical understanding referencing {terms_str} for {topic}."
        elif word_count >= 15:
            return f"Candidate provided detailed response on {topic}, explaining implementation concepts."
        else:
            return f"Candidate provided general explanation for {topic} requiring further architectural depth."

    async def process_turn(self, session_id: str, candidate_answer: str) -> Dict[str, Any]:
        """
        Processes candidate turn in Judge Panel mode.
        Evaluates answer, generates contextual follow-up, tracks question metadata.
        """
        session = _JUDGE_SESSIONS.get(session_id)
        if not session:
            # Auto-initialize fallback session if missing
            start_res = await self.start_session(session_id)
            session = _JUDGE_SESSIONS[session_id]

        current_q_meta = session["questionMetadataList"][-1]
        current_q_meta["candidateAnswer"] = candidate_answer
        
        dynamic_eval_fallback = self._evaluate_answer_dynamically(
            question=current_q_meta['question'],
            topic=current_q_meta['curriculumTopic'],
            answer=candidate_answer
        )

        # Evaluate previous response dynamically
        eval_prompt = (
            f"You are a strict technical interviewer. Evaluate this candidate response in 1 concise sentence.\n"
            f"Topic: {current_q_meta['curriculumTopic']}\n"
            f"Question: {current_q_meta['question']}\n"
            f"Candidate Answer: '{candidate_answer}'\n\n"
            f"If the answer is brief, gibberish (e.g. 'jf'), or 'i don't know', explicitly state that the response is incomplete or lacks technical depth for {current_q_meta['curriculumTopic']}.\n"
            f"If the answer contains technical details, highlight the specific concepts demonstrated."
        )
        eval_summary = await self._call_llm(
            eval_prompt,
            fallback=dynamic_eval_fallback
        )
        current_q_meta["evaluation"] = eval_summary

        session["turns"].append({
            "question": current_q_meta["question"],
            "answer": candidate_answer,
            "day": current_q_meta["curriculumDay"],
            "topic": current_q_meta["curriculumTopic"],
            "evaluation": eval_summary
        })

        q_count = session["questionsAskedCount"]
        covered_days = session["coveredDays"]
        planned_topics = session["plannedTopics"]

        # Check completion criteria: candidate has answered 8 turns or questionsAskedCount >= 8
        if len(session["turns"]) >= 8:
            session["isDone"] = True
            report = await self._generate_final_report(session)
            session["report"] = report

            return {
                "success": True,
                "sessionId": session_id,
                "reply": "Thank you. Personalized hackathon interview evaluation is now complete.",
                "done": True,
                "feedback": report.get("organiserFeedback"),
                "report": report
            }

        # Select next topic dynamically from planned topics or curriculum
        next_topic_idx = q_count % len(planned_topics) if planned_topics else 0
        next_topic = planned_topics[next_topic_idx] if planned_topics else {"day": (q_count % 8) + 1, "title": "System Scalability"}
        next_day = next_topic.get("day", (q_count % 8) + 1)
        next_topic_title = next_topic.get("title", "Technical Architecture")
        next_tools = ", ".join(next_topic.get("tools", ["FastAPI", "Python"])[:3])

        if next_day not in covered_days:
            covered_days.append(next_day)

        cand = session["candidate"]
        cand_name = cand.get("name") or cand.get("member", {}).get("name") or "Candidate"

        followup_prompt = (
            f"You are conducting a structured technical interview for candidate {cand_name}.\n"
            f"Previous Question: {current_q_meta['question']}\n"
            f"Candidate Answer: {candidate_answer}\n"
            f"Next Curriculum Focus: Day {next_day} - {next_topic_title} ({next_tools})\n"
            f"Task: Ask Question {q_count + 1} of 8+. Formulate a contextual follow-up question that builds on their previous response while probing Day {next_day} topics ({next_topic_title}).\n"
            f"Keep it concise, technical, and direct."
        )

        next_q_text = await self._call_llm(
            followup_prompt,
            fallback=f"Following up on your answer regarding {current_q_meta['curriculumTopic']} — for Day {next_day} ({next_topic_title}), how would you scale and monitor your design using {next_tools}?"
        )

        q_count += 1
        session["questionsAskedCount"] = q_count

        module_num = min(8, (next_day // 4) + 1)
        if module_num not in session["coveredModules"]:
            session["coveredModules"].append(module_num)

        next_meta = {
            "questionNumber": q_count,
            "question": next_q_text,
            "candidateAnswer": None,
            "expectedAnswer": self._get_expected_answer(next_topic_title, next_q_text),
            "curriculumDay": next_day,
            "curriculumTopic": next_topic_title,
            "module": f"Module {module_num}",
            "difficulty": "Intermediate" if q_count < 5 else "Advanced",
            "questionType": "Contextual Follow-up" if candidate_answer else "Practical Architecture",
            "followUpOf": current_q_meta['curriculumTopic'],
            "evaluation": None
        }
        session["questionMetadataList"].append(next_meta)
        session["currentTopic"] = next_topic

        return {
            "success": True,
            "sessionId": session_id,
            "reply": next_q_text,
            "done": False,
            "progress": {
                "questionNumber": q_count,
                "minQuestionsRequired": 8,
                "coveredDaysCount": len(set(covered_days)),
                "minDaysRequired": 4,
                "currentDay": next_day,
                "currentTopic": next_topic_title
            }
        }

    async def get_session_report(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Idempotently fetches Judge Evaluation Report for session."""
        session = _JUDGE_SESSIONS.get(session_id)
        if not session:
            return None
        if not session.get("report"):
            session["report"] = await self._generate_final_report(session)
        return session["report"]

    async def _generate_final_report(self, session: Dict[str, Any]) -> Dict[str, Any]:
        """Generates comprehensive Judge Evaluation Report from actual session turns and candidate answers."""
        cand = session.get("candidate", {})
        cand_name = cand.get("name") or cand.get("member", {}).get("name") or "Candidate"
        cand_role = cand.get("role") or cand.get("jobRole") or cand.get("member", {}).get("jobRole") or "AI Engineer"
        cand_exp = cand.get("experience") or cand.get("yearsExperience") or cand.get("member", {}).get("yearsExperience") or 3

        questions_meta = session.get("questionMetadataList", [])
        turns = session.get("turns", [])
        
        unique_days = sorted(list(set(session.get("coveredDays", [1]))))
        unique_modules = sorted(list(set(session.get("coveredModules", [1]))))
        
        # Calculate coverage % dynamically against 31 days & 8 modules
        days_coverage_pct = round((len(unique_days) / 31.0) * 100, 1)
        modules_coverage_pct = round((len(unique_modules) / 8.0) * 100, 1)

        # Dynamic transcript construction from actual candidate responses
        turns_summary = []
        strong_topics = []
        weak_topics = []
        total_words = 0

        for idx, t in enumerate(turns, 1):
            q_text = t.get("question", "")
            ans_text = (t.get("answer") or "").strip()
            topic = t.get("topic", f"Topic {idx}")
            day = t.get("day", idx)
            eval_text = t.get("evaluation", "")

            word_count = len(ans_text.split())
            total_words += word_count
            turns_summary.append(
                f"Turn {idx} [Day {day} - {topic}]:\n"
                f"Question: {q_text}\n"
                f"Candidate Answer: {ans_text if ans_text else '(No response provided)'}\n"
                f"Evaluation: {eval_text}\n"
            )

            # Analyze answer strength dynamically
            if word_count >= 8 and "don't know" not in ans_text.lower() and "dunno" not in ans_text.lower():
                strong_topics.append(f"{topic} (Day {day})")
            else:
                weak_topics.append(f"{topic} (Day {day})")

        transcript_block = "\n".join(turns_summary)
        topics_evaluated = [q.get("curriculumTopic") for q in questions_meta if q.get("curriculumTopic")]

        # Dynamic fallback grounded strictly in actual candidate answers
        if strong_topics:
            fallback_summary = (
                f"Candidate {cand_name} completed {len(turns)} technical evaluation turns covering {len(unique_days)} curriculum days. "
                f"In candidate's actual responses, clear technical proficiency was demonstrated on {', '.join(strong_topics[:3])}."
            )
            fallback_strengths = [f"Technical depth in {t}" for t in strong_topics[:3]]
        else:
            fallback_summary = (
                f"Candidate {cand_name} completed {len(turns)} evaluation turns across {len(unique_days)} curriculum days. "
                f"Candidate responses were brief and highlighted foundational concepts requiring deeper practice."
            )
            fallback_strengths = [f"Engaged across {len(unique_days)} curriculum evaluation days"]

        if weak_topics:
            fallback_gaps = [f"Requires deeper implementation coverage for {t}" for t in weak_topics[:2]]
            fallback_next = [f"Practice hands-on architecture implementation for {t}" for t in weak_topics[:2]]
        else:
            fallback_gaps = ["Production edge-case handling and fault tolerance"]
            fallback_next = ["Advanced multi-agent orchestration and MCP tool integration"]

        # Prompt Gemini to generate 100% real-time dynamic feedback based ONLY on the actual transcript
        feedback_prompt = (
            f"You are an expert AI technical interviewer. Conduct a strict, dynamic evaluation of candidate {cand_name} ({cand_role}) based SOLELY on their actual interview answers below.\n\n"
            f"--- ACTUAL CANDIDATE INTERVIEW TRANSCRIPT ---\n"
            f"{transcript_block}\n"
            f"--- END TRANSCRIPT ---\n\n"
            f"Instructions:\n"
            f"1. 'summary': Write a 2-3 sentence technical summary specifically referencing what candidate {cand_name} actually explained in their answers, mentioning specific tools/concepts they typed.\n"
            f"2. 'strengths': List 2-3 specific technical strengths demonstrated in their actual answers.\n"
            f"3. 'gaps': List 1-2 specific technical gaps or weak areas revealed by their actual answers.\n"
            f"4. 'next': List 1-2 specific recommended next learning steps tailored to their actual answers.\n\n"
            f"Output ONLY a raw JSON object with keys: summary, strengths, gaps, next."
        )

        raw_feedback = await self._call_llm(
            feedback_prompt,
            fallback=json.dumps({
                "summary": fallback_summary,
                "strengths": fallback_strengths,
                "gaps": fallback_gaps,
                "next": fallback_next
            })
        )

        try:
            feedback_obj = json.loads(raw_feedback) if isinstance(raw_feedback, str) and raw_feedback.strip().startswith("{") else {
                "summary": fallback_summary,
                "strengths": fallback_strengths,
                "gaps": fallback_gaps,
                "next": fallback_next
            }
        except Exception:
            feedback_obj = {
                "summary": fallback_summary,
                "strengths": fallback_strengths,
                "gaps": fallback_gaps,
                "next": fallback_next
            }

        # Calculate real preparedness percentage based on candidate's actual typed answers
        turn_scores = []
        for q_meta in questions_meta:
            ans_text = q_meta.get("candidateAnswer") or ""
            topic = q_meta.get("curriculumTopic") or ""
            q_score = self._calculate_turn_score(ans_text, topic)
            q_meta["score"] = q_score
            if q_meta.get("candidateAnswer") is not None:
                turn_scores.append(q_score)

        if turn_scores:
            real_preparedness_pct = int(sum(turn_scores) / len(turn_scores))
        else:
            real_preparedness_pct = 0

        preparedness_status = "High Preparedness" if real_preparedness_pct >= 75 else ("Moderate Preparedness" if real_preparedness_pct >= 50 else "Needs Preparation")

        performance_scores = {
            "overallScore": real_preparedness_pct,
            "realPreparednessPct": real_preparedness_pct,
            "preparednessStatus": preparedness_status,
            "technicalUnderstanding": min(98, max(real_preparedness_pct, 15)),
            "problemSolving": min(98, max(real_preparedness_pct - 3, 10)),
            "practicalKnowledge": min(98, max(real_preparedness_pct, 12)),
            "systemThinking": min(98, max(real_preparedness_pct - 2, 10)),
            "communication": min(98, max(real_preparedness_pct + 5, 20)),
            "curriculumUnderstanding": min(98, max(real_preparedness_pct, 15))
        }

        elapsed_sec = int(time.time() - session.get("startTime", time.time()))

        return {
            "sessionId": session.get("sessionId"),
            "candidateOverview": {
                "candidateId": cand.get("id") or cand.get("member", {}).get("id") or "CAND-001",
                "name": cand_name,
                "role": cand_role,
                "experienceYears": cand_exp,
                "durationSeconds": elapsed_sec,
                "questionCount": len(questions_meta)
            },
            "curriculumCoverage": {
                "daysCovered": unique_days,
                "daysCount": len(unique_days),
                "daysCoveragePct": days_coverage_pct,
                "modulesCovered": unique_modules,
                "modulesCount": len(unique_modules),
                "modulesCoveragePct": modules_coverage_pct,
                "topicsEvaluated": topics_evaluated
            },
            "questionAnalysis": questions_meta,
            "performanceScores": performance_scores,
            "strengths": feedback_obj.get("strengths", []),
            "gaps": feedback_obj.get("gaps", []),
            "recommendations": feedback_obj.get("next", []),
            "organiserFeedback": {
                "summary": feedback_obj.get("summary", ""),
                "strengths": feedback_obj.get("strengths", []),
                "gaps": feedback_obj.get("gaps", []),
                "next": feedback_obj.get("next", [])
            }
        }

    async def _call_llm(self, prompt: str, fallback: str) -> str:
        """Helper to invoke Gemini LLM with fallback on rate limits or missing key."""
        key = settings.GEMINI_API_KEY
        if not key:
            return fallback

        try:
            from app.utils.llm import get_llm
            from langchain_core.messages import HumanMessage

            llm = get_llm(temperature=0.3, model_name=settings.GEMINI_MODEL, api_key_override=key)
            if not llm:
                return fallback

            res = await llm.ainvoke([HumanMessage(content=prompt)])
            text = res.content if hasattr(res, "content") else str(res)
            return text.strip() if text else fallback
        except Exception as e:
            logger.warning(f"[JudgeInterviewEngine] LLM call notice: {e}")
            return fallback


judge_interview_engine = JudgeInterviewEngine()
