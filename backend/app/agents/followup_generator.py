from typing import Optional
from app.config import settings
from app.utils.llm import get_llm


class FollowupGenerator:
    """
    Generates adaptive follow-up questions when a candidate's answer requires elaboration or clarification.
    """
    async def generate_followup(self, question: str, answer: str, day: int) -> str:
        llm = get_llm(temperature=0.7)
        if llm:
            try:
                from langchain_core.messages import HumanMessage

                prompt = (
                    f"You are a technical interviewer following up on a candidate's answer.\n"
                    f"Previous Question: {question}\n"
                    f"Candidate Answer: {answer}\n"
                    f"Ask a concise, deep-dive follow-up question to test their underlying architectural or implementation understanding."
                )

                response = await llm.ainvoke([HumanMessage(content=prompt)])
                return response.content.strip()
            except Exception:
                pass


        return f"That's an interesting point regarding your approach. Could you elaborate on how you handle edge cases or performance optimization in that scenario?"


followup_generator = FollowupGenerator()
