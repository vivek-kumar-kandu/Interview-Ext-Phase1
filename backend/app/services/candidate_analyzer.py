from typing import List, Dict, Any
from app.schemas.interview import CandidateProfile
from app.services.curriculum_service import curriculum_service


class CandidateAnalyzer:
    """
    Analyzes candidate mission signals and selects target curriculum days for interview planning.
    """
    def plan_interview_days(self, candidate: CandidateProfile, target_count: int = 5) -> List[int]:
        available_days = [d["day"] for d in curriculum_service.get_all_days()]
        if not available_days:
            # Fallback days if curriculum not loaded
            return [7, 10, 13, 21, 28]

        candidate_missions = {m.day: m for m in candidate.missions}
        
        # Priorities:
        # 1. Missions with high attempts (> 1) or passed == False (areas needing deeper technical evaluation)
        # 2. Skipped missions
        # 3. Passed missions
        priority_days: List[int] = []
        secondary_days: List[int] = []

        for m in candidate.missions:
            if m.day not in available_days:
                continue
            
            # High attempt or failed
            if (m.attempts and m.attempts > 1) or m.passed is False:
                priority_days.append(m.day)
            elif m.skipped:
                priority_days.append(m.day)
            else:
                secondary_days.append(m.day)

        # Combine priority and secondary days while preserving order and uniqueness
        selected: List[int] = []
        for d in priority_days + secondary_days:
            if d not in selected:
                selected.append(d)

        # If candidate has fewer missions than target_count, fill from curriculum core days
        if len(selected) < target_count:
            core_days = [7, 8, 10, 11, 12, 13, 16, 21, 22, 23, 28, 31]
            for d in core_days:
                if d in available_days and d not in selected:
                    selected.append(d)
                if len(selected) >= target_count:
                    break

        return selected[:max(target_count, 4)]


candidate_analyzer = CandidateAnalyzer()
