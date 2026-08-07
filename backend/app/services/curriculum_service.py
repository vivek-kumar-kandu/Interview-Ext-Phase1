import json
from typing import Dict, List, Any, Optional
from app.config import settings


class CurriculumService:
    """
    Service for loading, querying, and structuring data from curriculum.json
    """
    def __init__(self):
        self._data: Dict[str, Any] = {}
        self._days_map: Dict[int, Dict[str, Any]] = {}
        self._load_curriculum()

    def _load_curriculum(self):
        if settings.CURRICULUM_FILE.exists():
            with open(settings.CURRICULUM_FILE, "r", encoding="utf-8") as f:
                self._data = json.load(f)
                days_list = self._data.get("days", [])
                for d in days_list:
                    if "day" in d:
                        self._days_map[d["day"]] = d

    def get_all_days(self) -> List[Dict[str, Any]]:
        return self._data.get("days", [])

    def get_day_info(self, day_number: int) -> Optional[Dict[str, Any]]:
        return self._days_map.get(day_number)

    def get_modules(self) -> List[Dict[str, Any]]:
        return self._data.get("modules", [])

    def get_topics_for_days(self, day_numbers: List[int]) -> List[Dict[str, Any]]:
        return [self._days_map[d] for d in day_numbers if d in self._days_map]


curriculum_service = CurriculumService()
