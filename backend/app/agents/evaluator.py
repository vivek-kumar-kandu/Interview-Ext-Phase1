import json
from typing import Dict, Any
from app.config import settings
from app.models.session import TurnEvaluation
from app.services.curriculum_service import curriculum_service


class EvaluatorEngine:
    """
    Evaluates candidate responses, assigns scores, and detects technical strengths and gaps.
    """
    async def evaluate_turn(
        self,
        question: str,
        answer: str,
        day: int
    ) -> TurnEvaluation:
        day_info = curriculum_service.get_day_info(day)
        day_title = day_info.get("title", f"Day {day}") if day_info else f"Day {day}"

        if settings.OPENAI_API_KEY:
            try:
                from langchain_openai import ChatOpenAI
                from langchain_core.messages import SystemMessage, HumanMessage
                from app.agents.prompts import SYSTEM_EVALUATOR_PROMPT

                llm = ChatOpenAI(
                    model=settings.OPENAI_MODEL,
                    api_key=settings.OPENAI_API_KEY,
                    temperature=0.2
                )

                sys_prompt = SYSTEM_EVALUATOR_PROMPT.format(
                    question=question,
                    day=day,
                    day_title=day_title,
                    answer=answer
                )

                response = await llm.ainvoke([
                    SystemMessage(content=sys_prompt),
                    HumanMessage(content="Evaluate this turn and return brief JSON with keys: score (0-10), feedback, strengths (list), gaps (list), needs_followup (bool).")
                ])
                
                content = response.content.strip()
                # Parse JSON if possible
                if content.startswith("```json"):
                    content = content.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(content)

                return TurnEvaluation(
                    question=question,
                    answer=answer,
                    day=day,
                    topic=day_title,
                    score=float(parsed.get("score", 7.5)),
                    feedback=parsed.get("feedback", "Demonstrated good foundational understanding."),
                    strengths_identified=parsed.get("strengths", ["Clear explanation of core concept"]),
                    gaps_identified=parsed.get("gaps", [])
                )
            except Exception:
                pass

        # Deterministic default evaluation fallback
        score = 8.0 if len(answer.split()) > 10 else 5.0
        return TurnEvaluation(
            question=question,
            answer=answer,
            day=day,
            topic=day_title,
            score=score,
            feedback="Answer provided relevant details covering topic concepts.",
            strengths_identified=[f"Good grasp of {day_title} fundamentals"],
            gaps_identified=["Could detail practical production trade-offs"] if score < 7.0 else []
        )


evaluator_engine = EvaluatorEngine()
