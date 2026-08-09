import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.config import settings

logger = logging.getLogger(__name__)

# Primary candidate directories to discover organiser files
POSSIBLE_DATA_DIRS = [
    Path(__file__).parent.parent / "data",
    Path(__file__).parent.parent.parent,
    Path(__file__).parent.parent.parent.parent,
]

KNOWN_FILES_METADATA = {
    "curriculum.json": {
        "displayName": "AI Cohort Curriculum",
        "fileType": "JSON",
        "description": "31-day AI Cohort curriculum with 8 modules, daily topics, tools, objectives, and learning progression."
    },
    "candidates.json": {
        "displayName": "Evaluation Candidate Profiles",
        "fileType": "JSON",
        "description": "Organiser evaluation dataset containing 5 candidate profiles, completed missions, and performance signals."
    },
    "technical-spec.md": {
        "displayName": "Interview Technical Specification",
        "fileType": "Markdown",
        "description": "API technical specification and submission contract for HTTP endpoints, payloads, and feedback format."
    }
}


class JudgeService:
    @staticmethod
    def resolve_file_path(file_id: str) -> Optional[Path]:
        """Locates an organiser file across known backend and project data directories."""
        safe_name = os.path.basename(file_id)
        for data_dir in POSSIBLE_DATA_DIRS:
            candidate = data_dir / safe_name
            if candidate.exists() and candidate.is_file():
                return candidate
        return None

    def discover_judge_files(self) -> List[Dict[str, Any]]:
        """
        Discovers all actual organiser evaluation files available in the project.
        Does NOT hardcode fake files. Returns real file metadata from disk.
        """
        discovered = []
        for file_name, meta in KNOWN_FILES_METADATA.items():
            file_path = self.resolve_file_path(file_name)
            if file_path:
                stat = file_path.stat()
                discovered.append({
                    "fileId": file_name,
                    "fileName": file_name,
                    "displayName": meta["displayName"],
                    "fileType": meta["fileType"],
                    "sizeBytes": stat.st_size,
                    "description": meta["description"],
                    "path": str(file_path.resolve())
                })
            else:
                logger.warning(f"[JudgeService] Organiser file '{file_name}' not found on disk.")
        
        return discovered

    async def analyze_judge_file(self, file_id: str) -> Dict[str, Any]:
        """
        Reads and dynamically extracts real content from the selected organiser file.
        Invokes Gemini for AI summary if available.
        Never fabricates scores, percentages, skills, modules, or recommendations.
        """
        file_path = self.resolve_file_path(file_id)
        if not file_path:
            return {
                "success": False,
                "error": "Unable to analyze this organiser-provided file.",
                "detail": f"File '{file_id}' was not found in project repository."
            }

        try:
            content_text = file_path.read_text(encoding="utf-8")
        except Exception as e:
            logger.error(f"[JudgeService] Failed reading '{file_id}': {e}")
            return {
                "success": False,
                "error": "Unable to analyze this organiser-provided file.",
                "detail": str(e)
            }

        file_name = file_path.name

        if file_name.endswith(".json"):
            try:
                json_data = json.loads(content_text)
            except Exception as e:
                return {
                    "success": False,
                    "error": "Unable to analyze this organiser-provided file.",
                    "detail": f"Invalid JSON syntax in {file_name}: {str(e)}"
                }

            if file_name == "curriculum.json":
                return await self._analyze_curriculum_json(json_data, content_text)
            elif file_name == "candidates.json":
                return await self._analyze_candidates_json(json_data, content_text)
            else:
                return await self._analyze_generic_json(file_name, json_data, content_text)

        elif file_name.endswith(".md"):
            return await self._analyze_markdown_spec(file_name, content_text)

        else:
            return {
                "success": False,
                "error": "Unable to analyze this organiser-provided file.",
                "detail": f"Unsupported file type for {file_name}"
            }

    async def _analyze_curriculum_json(self, data: Dict[str, Any], raw_text: str) -> Dict[str, Any]:
        """Dynamically extracts curriculum structure and tools from curriculum.json."""
        cohort_title = data.get("cohort", "AI Cohort")
        modules_raw = data.get("modules", [])
        days_raw = data.get("days", [])

        # Dynamic derivation of metrics
        module_count = len(modules_raw)
        
        max_day = 0
        all_tools = set()
        daily_topics = []

        for d in days_raw:
            day_num = d.get("day", 0)
            if day_num > max_day:
                max_day = day_num
            
            for tool in d.get("tools", []):
                if isinstance(tool, str) and tool.strip():
                    all_tools.add(tool.strip())
            
            daily_topics.append({
                "day": day_num,
                "title": d.get("title", ""),
                "type": d.get("type", "LESSON"),
                "tools": d.get("tools", []),
                "objectives": d.get("objectives", [])
            })

        # Ensure max_day fallback to modules if days array is missing or empty
        if max_day == 0 and modules_raw:
            for m in modules_raw:
                days_range = m.get("days", [])
                if isinstance(days_range, list) and len(days_range) == 2:
                    if days_range[1] > max_day:
                        max_day = days_range[1]

        modules_formatted = [
            {
                "number": m.get("n"),
                "title": m.get("title"),
                "days": m.get("days"),
                "dayRangeText": f"Days {m.get('days')[0]}–{m.get('days')[1]}" if isinstance(m.get("days"), list) and len(m.get("days")) == 2 else ""
            }
            for m in modules_raw
        ]

        learning_progression = [m.get("title") for m in modules_raw if m.get("title")]

        extracted_data = {
            "title": cohort_title,
            "duration": max_day,
            "modules": module_count,
            "moduleList": modules_formatted,
            "topics": daily_topics,
            "tools": sorted(list(all_tools)),
            "learningProgression": learning_progression,
        }

        # AI Summary via Gemini if available
        ai_result = await self._generate_ai_summary(
            prompt=f"Summarize this AI Cohort Curriculum evaluation key takeaways in 3 short bullet points:\n{raw_text[:2500]}"
        )

        return {
            "success": True,
            "fileId": "curriculum.json",
            "fileType": "curriculum",
            "extracted": extracted_data,
            "aiSummary": ai_result.get("summary"),
            "aiAvailable": ai_result.get("available", False),
            "aiMessage": ai_result.get("message")
        }

    async def _analyze_candidates_json(self, data: Dict[str, Any], raw_text: str) -> Dict[str, Any]:
        """Dynamically extracts evaluation candidates data from candidates.json."""
        candidates_raw = data.get("candidates", [])
        candidate_count = len(candidates_raw)

        candidate_summaries = []
        skills_set = set()

        for c in candidates_raw:
            member = c.get("member", {})
            missions = c.get("missions", [])
            signals = c.get("signals", {})

            for m in missions:
                title = m.get("title", "")
                if title:
                    skills_set.add(title)

            candidate_summaries.append({
                "id": member.get("id"),
                "name": member.get("name"),
                "role": member.get("jobRole"),
                "experience": member.get("yearsExperience"),
                "education": member.get("education"),
                "status": member.get("status"),
                "missionsCompleted": signals.get("missionsCompleted", len(missions)),
                "commitDays": signals.get("commitDays", 0)
            })

        extracted_data = {
            "title": "Organiser Candidate Evaluation Dataset",
            "totalCandidates": candidate_count,
            "candidates": candidate_summaries,
            "trackedMissionsCount": len(skills_set),
            "uniqueMissionTopics": sorted(list(skills_set))[:10]
        }

        ai_result = await self._generate_ai_summary(
            prompt=f"Summarize this candidate evaluation dataset in 3 key findings:\n{raw_text[:2500]}"
        )

        return {
            "success": True,
            "fileId": "candidates.json",
            "fileType": "candidates",
            "extracted": extracted_data,
            "aiSummary": ai_result.get("summary"),
            "aiAvailable": ai_result.get("available", False),
            "aiMessage": ai_result.get("message")
        }

    async def _analyze_markdown_spec(self, file_name: str, raw_text: str) -> Dict[str, Any]:
        """Dynamically extracts technical specification from technical-spec.md."""
        lines = raw_text.splitlines()
        headings = [line.lstrip("#").strip() for line in lines if line.startswith("#")]
        endpoints = [line.strip() for line in lines if "POST " in line or "GET " in line or "/api/" in line]

        extracted_data = {
            "title": headings[0] if headings else "Technical Specification",
            "sections": headings,
            "detectedEndpoints": endpoints,
            "linesCount": len(lines),
            "charactersCount": len(raw_text)
        }

        ai_result = await self._generate_ai_summary(
            prompt=f"Summarize this technical API specification requirement in 3 concise bullet points:\n{raw_text[:2000]}"
        )

        return {
            "success": True,
            "fileId": file_name,
            "fileType": "specification",
            "extracted": extracted_data,
            "aiSummary": ai_result.get("summary"),
            "aiAvailable": ai_result.get("available", False),
            "aiMessage": ai_result.get("message")
        }

    async def _analyze_generic_json(self, file_name: str, data: Any, raw_text: str) -> Dict[str, Any]:
        extracted_data = {
            "title": file_name,
            "keys": list(data.keys()) if isinstance(data, dict) else [],
            "itemCount": len(data) if isinstance(data, (list, dict)) else 1
        }
        return {
            "success": True,
            "fileId": file_name,
            "fileType": "json",
            "extracted": extracted_data,
            "aiSummary": None,
            "aiAvailable": False,
            "aiMessage": None
        }

    async def _generate_ai_summary(self, prompt: str) -> Dict[str, Any]:
        """Executes Gemini LLM request using existing backend infrastructure."""
        key = settings.GEMINI_API_KEY
        if not key:
            return {
                "available": False,
                "summary": None,
                "message": "AI analysis is temporarily unavailable."
            }

        try:
            from app.utils.llm import get_llm
            from langchain_core.messages import HumanMessage

            llm = get_llm(temperature=0.2, model_name=settings.GEMINI_MODEL, api_key_override=key)
            if not llm:
                return {
                    "available": False,
                    "summary": None,
                    "message": "AI analysis is temporarily unavailable."
                }

            res = await llm.ainvoke([HumanMessage(content=prompt)])
            summary_text = res.content if hasattr(res, "content") else str(res)
            return {
                "available": True,
                "summary": summary_text,
                "message": None
            }
        except Exception as e:
            logger.warning(f"[JudgeService] Gemini LLM execution failed: {e}")
            return {
                "available": False,
                "summary": None,
                "message": "AI analysis is temporarily unavailable."
            }

    async def get_candidate_by_id(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        """Fetches detailed candidate object from candidates.json by candidate ID."""
        file_path = self.resolve_file_path("candidates.json")
        if not file_path:
            return None
        try:
            raw_text = file_path.read_text(encoding="utf-8")
            data = json.loads(raw_text)
            candidates_raw = data.get("candidates", [])
            for c in candidates_raw:
                member = c.get("member", {})
                if member.get("id") == candidate_id:
                    return {
                        "id": member.get("id"),
                        "name": member.get("name"),
                        "role": member.get("jobRole"),
                        "experience": member.get("yearsExperience"),
                        "education": member.get("education"),
                        "status": member.get("status"),
                        "missions": c.get("missions", []),
                        "signals": c.get("signals", {})
                    }
        except Exception as e:
            logger.error(f"[JudgeService] Error reading candidate ID '{candidate_id}': {e}")
        return None


judge_service = JudgeService()
