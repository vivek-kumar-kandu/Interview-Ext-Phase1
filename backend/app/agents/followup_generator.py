from typing import Optional
from app.config import settings
from app.utils.llm import get_llm
from app.services.curriculum_service import curriculum_service


class FollowupGenerator:
    """
    Generates adaptive follow-up questions when a candidate's answer requires elaboration or clarification.
    """
    async def generate_followup(self, question: str, answer: str, day: int, candidate_id: str = "cand_default") -> str:
        day_info = curriculum_service.get_day_info(day)
        day_title = day_info.get("title", f"Day {day}") if day_info else f"Day {day}"

        # Retrieve relevant candidate memories for context
        memories = []
        try:
            from app.services.breeth_memory import breeth_memory_service
            memories = await breeth_memory_service.query_candidate_memories(
                candidate_id=candidate_id,
                query_topic=f"{day_title} previous answer weakness strength",
                top_k=3
            )
        except Exception:
            pass

        memory_ctx = "\n".join([f"- {m}" for m in memories]) if memories else "None available"

        llm = get_llm(temperature=0.7)
        if llm:
            try:
                from langchain_core.messages import HumanMessage

                prompt = (
                    f"You are a technical interviewer following up on a candidate's answer for topic: {day_title}.\n"
                    f"Previous Question: {question}\n"
                    f"Candidate Answer: {answer}\n"
                    f"Candidate Demonstrated Breeth Memories:\n{memory_ctx}\n\n"
                    f"Ask a concise, deep-dive follow-up question probing practical production trade-offs, edge cases, or bottleneck mitigation in {day_title} while accounting for demonstrated candidate strengths/weaknesses."
                )

                response = await llm.ainvoke([HumanMessage(content=prompt)])
                return response.content.strip()
            except Exception:
                pass

        return f"That's a solid point regarding your approach. In production with {day_title}, how do you handle edge cases, state corruption, or performance bottlenecks under heavy concurrent load?"


followup_generator = FollowupGenerator()

