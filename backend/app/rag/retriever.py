import json
from typing import List, Dict, Any, Optional
from app.services.curriculum_service import curriculum_service


class CurriculumRetriever:
    """
    RAG retriever service for curriculum context retrieval.
    Chunks curriculum days and provides targeted topic context retrieval.
    """
    def __init__(self):
        self._chunks: List[Dict[str, Any]] = []
        self._index_curriculum()

    def _index_curriculum(self):
        all_days = curriculum_service.get_all_days()
        for day in all_days:
            day_num = day.get("day")
            title = day.get("title", "")
            day_type = day.get("type", "")
            tools = ", ".join(day.get("tools", []))
            
            content = f"Day {day_num}: {title}. Type: {day_type}. Key Tools/Technologies: {tools}."
            
            self._chunks.append({
                "day": day_num,
                "title": title,
                "type": day_type,
                "tools": day.get("tools", []),
                "content": content
            })

    def get_day_context(self, day_number: int) -> str:
        """
        Retrieve concise curriculum context for a given day.
        """
        info = curriculum_service.get_day_info(day_number)
        if not info:
            return f"Day {day_number} technical concepts."
        
        tools = ", ".join(info.get("tools", []))
        return (
            f"Day {info.get('day')}: {info.get('title')} "
            f"(Type: {info.get('type')}, Tech Stack: {tools})"
        )

    def search_relevant_context(self, query: str, top_k: int = 2) -> List[str]:
        """
        Keyword search over indexed curriculum chunks.
        """
        query_terms = set(query.lower().split())
        scored_chunks = []
        for chunk in self._chunks:
            chunk_text = chunk["content"].lower()
            score = sum(1 for term in query_terms if term in chunk_text)
            scored_chunks.append((score, chunk["content"]))

        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        return [c[1] for c in scored_chunks[:top_k]]


curriculum_retriever = CurriculumRetriever()
