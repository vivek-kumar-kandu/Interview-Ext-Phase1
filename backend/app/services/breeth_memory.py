import logging
import time
import json
import httpx
from typing import List, Dict, Any, Optional
from app.config import settings
from app.schemas.interview import CandidateProfileAnalysis

logger = logging.getLogger(__name__)

class BreethMemoryService:
    """
    Persistent AI Memory Layer integration using Breeth.
    Stores and retrieves candidate demonstrated knowledge, project experience,
    interview turn evidence, strengths, and weaknesses.
    
    Includes graceful degradation (BREETH_UNAVAILABLE) if Breeth key is missing
    or network service is unreachable.
    """
    def __init__(self):
        self._in_memory_store: Dict[str, List[Dict[str, Any]]] = {}

    @property
    def api_key(self) -> str:
        return settings.BREETH_API_KEY

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def _get_safe_key_fp(self) -> str:
        return settings.get_key_fingerprint(self.api_key)

    async def store_candidate_profile_memories(
        self, candidate_id: str, profile: CandidateProfileAnalysis
    ) -> bool:
        """
        Converts CandidateProfileAnalysis technical evidence (skills, experience,
        projects, education) into atomic, granular candidate memories.
        """
        if not candidate_id:
            candidate_id = profile.profileId or "cand_default"

        from app.utils.helpers import safe_str, safe_str_list, safe_join

        memories: List[str] = []

        # 1. Technical Skills evidence
        if profile.technicalSkills:
            safe_skills = safe_str_list(profile.technicalSkills[:10])
            if safe_skills:
                skills_str = safe_join(", ", safe_skills)
                memories.append(f"Candidate demonstrated proficiency in technical skills: {skills_str}.")

        # 2. Key Headline / Role
        if profile.headline:
            memories.append(f"Candidate primary headline direction: {safe_str(profile.headline)}.")

        # 3. Work Experience evidence
        if profile.experience:
            for exp in profile.experience[:3]:
                if isinstance(exp, str) and exp.strip():
                    memories.append(f"Candidate experience evidence: {exp.strip()}.")
                elif isinstance(exp, dict):
                    comp = safe_str(exp.get("company", ""))
                    role = safe_str(exp.get("jobTitle") or exp.get("role", ""))
                    desc_val = exp.get("description") or exp.get("keyWork", "")
                    desc = safe_join("; ", desc_val) if isinstance(desc_val, list) else safe_str(desc_val)
                    memories.append(f"Candidate worked as {role} at {comp}. Details: {desc[:150]}.")

        # 4. Project evidence
        if profile.projects:
            for proj in profile.projects[:3]:
                if isinstance(proj, str) and proj.strip():
                    memories.append(f"Candidate project evidence: {proj.strip()}.")
                elif isinstance(proj, dict):
                    name = safe_str(proj.get("name", "Project"))
                    desc = safe_str(proj.get("description", ""))
                    techs = safe_join(", ", proj.get("technologies", []))
                    memories.append(f"Candidate built project '{name}' using {techs}. Details: {desc[:150]}.")

        # 5. Target roles
        if profile.targetRoles:
            safe_roles = safe_str_list(profile.targetRoles[:3])
            if safe_roles:
                roles_str = safe_join(", ", safe_roles)
                memories.append(f"Candidate targeting roles based on evidence: {roles_str}.")

        if not memories:
            logger.info(f"[BREETH] No explicit profile evidence memories to store for candidate {candidate_id}")
            return True

        return await self._store_memories_batch(candidate_id, memories, memory_type="profile_evidence")

    async def store_interview_turn_memory(
        self,
        candidate_id: str,
        question: str,
        answer: str,
        evaluation: Optional[Any] = None
    ) -> bool:
        """
        Analyzes an interview turn and stores durable evidence memories
        (demonstrated technical knowledge, strengths, identified weaknesses, misconceptions).
        """
        if not candidate_id:
            candidate_id = "cand_default"
        if not question or not answer:
            return False

        from app.utils.helpers import safe_str, safe_str_list, safe_join

        memories: List[str] = []
        score = getattr(evaluation, "score", None) if evaluation else None
        feedback = safe_str(getattr(evaluation, "feedback", "") if evaluation else "")
        skills_tested = safe_str_list(getattr(evaluation, "skillsTested", []) if evaluation else [])

        skills_str = safe_join(", ", skills_tested) if skills_tested else "technical topic"

        if score is not None:
            if score >= 7.5:
                memories.append(
                    f"Candidate demonstrated strong understanding of {skills_str} when asked '{question[:100]}...'. Answer snippet: '{answer[:150]}'."
                )
            elif score <= 4.5:
                memories.append(
                    f"Candidate identified gap/weakness in {skills_str} for question '{question[:100]}...'. Feedback: {feedback[:150]}."
                )
            else:
                memories.append(
                    f"Candidate demonstrated partial knowledge of {skills_str} for question '{question[:100]}...'."
                )
        else:
            memories.append(f"Candidate answered question on {skills_str}: '{answer[:150]}'.")

        return await self._store_memories_batch(candidate_id, memories, memory_type="interview_turn")

    async def query_candidate_memories(
        self, candidate_id: str, query_topic: str = "", top_k: int = 5
    ) -> List[str]:
        """
        Retrieves relevant candidate memories for the specified topic/query.
        Falls back seamlessly to local store if Breeth service is unreachable.
        """
        if not candidate_id:
            candidate_id = "cand_default"

        if self.is_configured:
            try:
                # HTTP API request to Breeth Memory endpoint
                url = "https://api.breeth.ai/v1/memories/query"
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "candidate_id": candidate_id,
                    "query": query_topic or "candidate demonstrated technical skills and background",
                    "top_k": top_k
                }
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        results = data.get("memories") or data.get("results") or []
                        if results and isinstance(results, list):
                            logger.info(f"[BREETH] Retrieved {len(results)} memories from Breeth API for candidate {candidate_id}")
                            return [m.get("text", str(m)) if isinstance(m, dict) else str(m) for m in results[:top_k]]
            except Exception as e:
                logger.warning(f"[BREETH_UNAVAILABLE] Failed to query Breeth API ({e}). Falling back to local memory store.")

        # Fallback to local in-memory store
        local_mems = self._in_memory_store.get(candidate_id, [])
        if not local_mems:
            return []

        if not query_topic:
            return [m["text"] for m in local_mems[-top_k:]]

        # Simple keyword matching fallback
        keywords = [k.lower() for k in query_topic.split() if len(k) > 2]
        scored_mems = []
        for item in local_mems:
            text = item["text"]
            match_score = sum(1 for kw in keywords if kw in text.lower())
            scored_mems.append((match_score, item["timestamp"], text))

        scored_mems.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return [text for score, ts, text in scored_mems[:top_k]]

    async def _store_memories_batch(
        self, candidate_id: str, memories: List[str], memory_type: str
    ) -> bool:
        ts = time.time()
        # Always update local fallback store
        if candidate_id not in self._in_memory_store:
            self._in_memory_store[candidate_id] = []

        for m in memories:
            self._in_memory_store[candidate_id].append({
                "text": m,
                "type": memory_type,
                "timestamp": ts
            })

        if not self.is_configured:
            logger.info(f"[BREETH_LOCAL] Stored {len(memories)} candidate memories in local store (Breeth API key not configured)")
            return True

        try:
            url = "https://api.breeth.ai/v1/memories/batch"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "candidate_id": candidate_id,
                "memories": [{"text": m, "metadata": {"type": memory_type, "timestamp": ts}} for m in memories]
            }
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    logger.info(f"[BREETH] Successfully stored {len(memories)} memories in Breeth API for candidate {candidate_id}")
                    return True
                else:
                    logger.warning(f"[BREETH_UNAVAILABLE] Breeth API returned status {resp.status_code}. Using local memory fallback.")
        except Exception as e:
            logger.warning(f"[BREETH_UNAVAILABLE] Could not push memories to Breeth API ({e}). Saved to local fallback.")

        return True


breeth_memory_service = BreethMemoryService()
