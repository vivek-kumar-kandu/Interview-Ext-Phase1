import re
import logging
from typing import List, Dict, Any, Optional
from app.schemas.interview import (
    EvidenceItem,
    MetricBreakdownItem,
    MetricScore,
    DynamicSkillGap,
    JobDetails,
    NormalizedCandidateProfile
)

logger = logging.getLogger(__name__)


# Normalized Skill Synonym Dictionary
SYNONYM_MAP: Dict[str, str] = {
    "js": "javascript",
    "javascript": "javascript",
    "react": "react",
    "react.js": "react",
    "reactjs": "react",
    "node": "node.js",
    "node.js": "node.js",
    "nodejs": "node.js",
    "mongo": "mongodb",
    "mongodb": "mongodb",
    "rest api": "rest api",
    "restful api": "rest api",
    "rest": "rest api",
    "ts": "typescript",
    "typescript": "typescript",
    "py": "python",
    "python": "python",
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "docker": "docker",
    "containerization": "docker",
    "aws": "aws",
    "amazon web services": "aws",
    "gcp": "gcp",
    "google cloud platform": "gcp",
    "azure": "azure",
    "microsoft azure": "azure",
    "k8s": "kubernetes",
    "kubernetes": "kubernetes",
    "cpp": "c++",
    "c++": "c++",
    "c#": "c#",
    "csharp": "c#",
    "html": "html",
    "html5": "html",
    "css": "css",
    "css3": "css",
    "vue": "vue",
    "vue.js": "vue",
    "vuejs": "vue",
    "angular": "angular",
    "angularjs": "angular"
}

def normalize_skill_term(term: Any) -> str:
    from app.utils.helpers import safe_str
    cleaned = safe_str(term).strip().lower()
    return SYNONYM_MAP.get(cleaned, cleaned)


class DeterministicScoringEngine:
    """
    Centralized Backend Scoring Engine for InterviewOS.
    Converts structured candidate & job evidence into reproducible numerical metrics with explainability breakdowns.

    Weights:
    - Skill Match = 50%
    - Experience Alignment = 20%
    - Project Relevance = 15%
    - Education Match = 5%
    - Keyword/Responsibility Alignment = 10%
    """

    def calculate_job_match(
        self,
        candidate_skills: List[str],
        candidate_experience: List[str],
        candidate_projects: List[str],
        candidate_roles: List[str],
        candidate_education: Optional[List[str]] = None,
        job: Optional[JobDetails] = None,
        provenance_map: Optional[Dict[str, List[str]]] = None
    ) -> Optional[MetricScore]:
        if not job or (not job.jobTitle and not job.description and not job.skills):
            logger.warning("[SCORING_ENGINE] Insufficient job information provided to calculate match.")
            return None

        from app.utils.helpers import safe_str, safe_str_list, safe_join

        cand_skills = safe_str_list(candidate_skills)
        cand_exp_list = safe_str_list(candidate_experience)
        cand_proj_list = safe_str_list(candidate_projects)
        cand_roles_list = safe_str_list(candidate_roles)
        cand_edu_list = safe_str_list(candidate_education)

        if not cand_skills and not cand_exp_list and not cand_roles_list:
            logger.warning("[SCORING_ENGINE] Insufficient candidate profile information to calculate match.")
            return None

        req_skills = safe_str_list(job.skills)
        job_title = (job.jobTitle or "Technical Role").strip()
        job_desc = (job.description or "").strip()

        if not req_skills:
            from app.services.job_analyzer import job_analyzer_service
            req_skills = safe_str_list(job_analyzer_service.extract_skills_from_job_title_and_desc(job_title, job_desc))

        if not req_skills and len(job_desc) < 20:
            logger.warning("[SCORING_ENGINE] Insufficient job details/requirements extracted.")
            return None

        # Normalized Candidate Skills Lookup Map
        cand_norm_map: Dict[str, str] = {}
        for s in cand_skills:
            cand_norm_map[normalize_skill_term(s)] = s

        matched_skills: List[str] = []
        partially_matched_skills: List[str] = []
        missing_skills: List[str] = []
        evidence_items: List[EvidenceItem] = []
        evidence_texts: List[str] = []

        for req in req_skills:
            norm_req = normalize_skill_term(req)
            if norm_req in cand_norm_map:
                matched_skills.append(cand_norm_map[norm_req])
                sources = safe_str_list(provenance_map.get(norm_req, ["Profile Technical Skills"]) if provenance_map else ["Profile Technical Skills"])
                evidence_items.append(
                    EvidenceItem(
                        category="Technical Skill Match",
                        title=f"Verified Skill: {req}",
                        detail=f"Candidate possesses verified competency in {req} supported by {safe_join(', ', sources)}.",
                        sourcePlatform=sources[0] if sources else "Candidate Profile"
                    )
                )
                evidence_texts.append(f"Candidate satisfies requirement for {req}.")
            else:
                partial_match = None
                for c_norm, c_orig in cand_norm_map.items():
                    if c_norm in norm_req or norm_req in c_norm:
                        partial_match = c_orig
                        break
                if partial_match:
                    partially_matched_skills.append(req)
                    evidence_items.append(
                        EvidenceItem(
                            category="Skill Partial Match",
                            title=f"Partial Alignment: {req}",
                            detail=f"Candidate demonstrates related technical capability in {partial_match}.",
                            sourcePlatform="Candidate Profile"
                        )
                    )
                    evidence_texts.append(f"Candidate has partial alignment for {req} via {partial_match}.")
                else:
                    missing_skills.append(req)

        # 1. Skill Match Sub-Score (Weight: 50%)
        total_req = len(req_skills) if req_skills else 1
        effective_matches = len(matched_skills) + (len(partially_matched_skills) * 0.5)
        skill_match_pct = int(min(100, max(0, round((effective_matches / total_req) * 100))))

        # 2. Experience Alignment Sub-Score (Weight: 20%)
        req_exp_years = self._extract_exp_years(job.experience or job_desc)
        cand_exp_years = max(2.0, len(cand_exp_list) * 1.5)
        if cand_exp_years >= req_exp_years:
            exp_alignment_pct = 100
        else:
            exp_alignment_pct = int(min(100, max(30, round((cand_exp_years / max(1, req_exp_years)) * 100))))

        if cand_exp_list:
            evidence_texts.append(f"Candidate experience depth (~{round(cand_exp_years, 1)} yrs) evaluated against {req_exp_years} yrs requirement.")

        # 3. Project Relevance Sub-Score (Weight: 15%)
        proj_count = len(cand_proj_list)
        project_tech_matches = 0
        cand_proj_str = (safe_join(" ", cand_proj_list) + " " + safe_join(" ", cand_exp_list)).lower()
        for req in req_skills:
            if req.lower() in cand_proj_str:
                project_tech_matches += 1

        if project_tech_matches > 0:
            project_relevance_pct = int(min(100, max(75, 75 + project_tech_matches * 10)))
            evidence_texts.append(f"Candidate technical projects demonstrate practical implementation of required technologies.")
        elif proj_count > 0:
            project_relevance_pct = int(min(90, max(60, round(60 + skill_match_pct * 0.25))))
        else:
            project_relevance_pct = int(round(skill_match_pct * 0.6))

        # 4. Education Match Sub-Score (Weight: 5%)
        edu_str = safe_join(" ", cand_edu_list).lower()
        if any(term in edu_str for term in ["computer", "engineering", "b.tech", "b.e", "b.s", "master", "m.tech", "bca", "mca", "degree"]):
            education_pct = 100
            evidence_texts.append("Candidate holds degree aligning with technical requirements.")
        elif cand_edu_list:
            education_pct = 85
        else:
            education_pct = 75

        # 5. Keyword & Responsibility Alignment Sub-Score (Weight: 10%)
        kw_matches = 0
        job_words = set(re.findall(r'\w+', (job_title + " " + job_desc).lower()))
        cand_words = set(re.findall(r'\w+', (safe_join(" ", cand_skills) + " " + safe_join(" ", cand_exp_list) + " " + safe_join(" ", cand_roles_list)).lower()))
        overlap = job_words.intersection(cand_words)
        if len(job_words) > 0:
            keyword_pct = int(min(100, max(40, round((len(overlap) / min(20, len(job_words))) * 100))))
        else:
            keyword_pct = 60


        # Weighted Final Score Calculation (Exact formula from spec)
        weighted_score = (
            (skill_match_pct * 0.50) +
            (exp_alignment_pct * 0.20) +
            (project_relevance_pct * 0.15) +
            (education_pct * 0.05) +
            (keyword_pct * 0.10)
        )
        final_score = int(round(weighted_score))

        label = (
            "Exceptional Match" if final_score >= 88 else
            "Strong Match" if final_score >= 75 else
            "Good Match" if final_score >= 60 else
            "Potential Fit"
        )

        breakdown = [
            MetricBreakdownItem(
                metric="Technical Skill Match",
                score=skill_match_pct,
                weight=0.50,
                weightedScore=round(skill_match_pct * 0.50, 1),
                evidence=f"{len(matched_skills)} matched, {len(partially_matched_skills)} partial of {total_req} required skills"
            ),
            MetricBreakdownItem(
                metric="Experience Alignment",
                score=exp_alignment_pct,
                weight=0.20,
                weightedScore=round(exp_alignment_pct * 0.20, 1),
                evidence=f"Candidate experience (~{round(cand_exp_years, 1)} yrs) vs Job requirement ({req_exp_years} yrs)"
            ),
            MetricBreakdownItem(
                metric="Project Relevance",
                score=project_relevance_pct,
                weight=0.15,
                weightedScore=round(project_relevance_pct * 0.15, 1),
                evidence=f"{proj_count} technical projects evaluated against role"
            ),
            MetricBreakdownItem(
                metric="Education Match",
                score=education_pct,
                weight=0.05,
                weightedScore=round(education_pct * 0.05, 1),
                evidence="Education background alignment"
            ),
            MetricBreakdownItem(
                metric="Keyword Alignment",
                score=keyword_pct,
                weight=0.10,
                weightedScore=round(keyword_pct * 0.10, 1),
                evidence=f"{len(overlap)} domain keywords overlapping with job description"
            ),
        ]

        calc_str = (
            f"Skill Match ({skill_match_pct}% × 50%) + "
            f"Experience ({exp_alignment_pct}% × 20%) + "
            f"Projects ({project_relevance_pct}% × 15%) + "
            f"Education ({education_pct}% × 5%) + "
            f"Keywords ({keyword_pct}% × 10%) = {final_score}%"
        )

        weights_map = {
            "Skill Match": 0.50,
            "Experience Alignment": 0.20,
            "Project Relevance": 0.15,
            "Education Match": 0.05,
            "Keyword Alignment": 0.10,
        }

        # Build human-readable explanation string
        if missing_skills:
            missing_str = safe_join(", ", missing_skills[:3])
            explanation = f"{final_score}% match because candidate satisfies technical requirements for {safe_join(', ', matched_skills[:3]) if matched_skills else 'core skills'}, but lacks {missing_str} experience."
        else:
            explanation = f"{final_score}% match with strong technical alignment across all required competencies for {job_title}."

        return MetricScore(
            score=final_score,
            label=label,
            calculation=calc_str,
            weights=weights_map,
            breakdown=breakdown,
            evidence=evidence_items,
            confidence=0.95,
            matchedSkills=matched_skills,
            missingSkills=missing_skills
        )

    def calculate_skill_gaps(
        self,
        candidate_skills: List[str],
        job_skills: List[str],
        provenance_map: Optional[Dict[str, List[str]]] = None
    ) -> List[DynamicSkillGap]:
        from app.utils.helpers import safe_str, safe_str_list
        cand_norm_map: Dict[str, str] = {normalize_skill_term(s): safe_str(s) for s in safe_str_list(candidate_skills)}
        gaps: List[DynamicSkillGap] = []

        for req in safe_str_list(job_skills):
            norm_req = normalize_skill_term(req)
            if norm_req in cand_norm_map:
                matched_orig = cand_norm_map[norm_req]
                sources = safe_str_list(provenance_map.get(norm_req, ["Candidate Profile"]) if provenance_map else ["Candidate Profile"])
                gaps.append(
                    DynamicSkillGap(
                        skill=req,
                        status="matched",
                        evidence=f"Verified competency in {matched_orig} matching {req}.",
                        sourcePlatform=sources[0] if sources else "Candidate Profile"
                    )
                )
            else:
                partial = None
                for c_norm, c_orig in cand_norm_map.items():
                    if c_norm in norm_req or norm_req in c_norm:
                        partial = c_orig
                        break
                if partial:
                    gaps.append(
                        DynamicSkillGap(
                            skill=req,
                            status="partially_matched",
                            evidence=f"Related competency in {partial} matching {req}.",
                            sourcePlatform="Candidate Profile"
                        )
                    )
                else:
                    gaps.append(
                        DynamicSkillGap(
                            skill=req,
                            status="missing",
                            evidence=f"No direct evidence of {req} detected in candidate profile.",
                            sourcePlatform=None
                        )
                    )
        return gaps

    def calculate_profile_readiness(self, profile: NormalizedCandidateProfile) -> MetricScore:
        from app.utils.helpers import safe_str_list, safe_join
        score = 50
        evidence: List[EvidenceItem] = []

        if profile.headline and len(profile.headline.strip()) > 3:
            score += 10
            evidence.append(EvidenceItem(category="Profile Completeness", title="Headline Specified", detail=profile.headline, sourcePlatform=profile.platform))
        summary_text = getattr(profile, "summary", None) or getattr(profile, "about", None)
        if summary_text and isinstance(summary_text, str) and len(summary_text.strip()) > 10:
            score += 5
            evidence.append(EvidenceItem(category="Profile Completeness", title="Summary Synthesized", detail=summary_text[:100], sourcePlatform=profile.platform))
        if profile.location:
            score += 5
        if profile.skills:
            sk_list = safe_str_list(profile.skills)
            sk_gain = min(15, len(sk_list) * 3)
            score += sk_gain
            evidence.append(EvidenceItem(category="Skill Breadth", title=f"{len(sk_list)} Technical Skills Verified", detail=safe_join(", ", sk_list[:5]), sourcePlatform=profile.platform))
        if profile.experience:
            score += min(10, len(profile.experience) * 2)
        if profile.education:
            score += min(5, len(profile.education) * 2)
        if profile.projects:
            score += min(5, len(profile.projects) * 2)

        final_score = int(min(98, max(50, score)))
        label = "High Readiness" if final_score >= 82 else "Good Readiness" if final_score >= 70 else "Developing Profile"

        calc_str = f"Base Completeness (50) + Headline (10) + Summary (10) + Skills ({min(15, len(profile.skills)*3)}) + Exp ({min(10, len(profile.experience)*2)}) = {final_score}%"

        return MetricScore(
            score=final_score,
            label=label,
            calculation=calc_str,
            weights={"Completeness": 0.35, "Skill Depth": 0.35, "Experience Depth": 0.30},
            breakdown=[
                MetricBreakdownItem(metric="Completeness Signals", score=final_score, weight=0.35, weightedScore=round(final_score * 0.35, 1), evidence=f"{profile.platform} evidence completeness")
            ],
            evidence=evidence,
            confidence=0.92,
            matchedSkills=profile.skills,
            missingSkills=[]
        )

    def calculate_job_readiness(
        self,
        profile_readiness_score: int,
        job_match_score: int,
        missing_skills_count: int
    ) -> MetricScore:
        penalty = missing_skills_count * 3
        job_readiness_pct = int(min(98, max(45, round((profile_readiness_score * 0.4) + (job_match_score * 0.6) - penalty))))

        calc_str = f"Profile Readiness ({profile_readiness_score}% × 40%) + Job Match ({job_match_score}% × 60%) - Gap Penalty ({penalty}%) = {job_readiness_pct}%"

        return MetricScore(
            score=job_readiness_pct,
            label="Ready for Interview" if job_readiness_pct >= 75 else "Requires Targeted Preparation",
            calculation=calc_str,
            weights={"Job Match Weight": 0.60, "Profile Readiness Weight": 0.40},
            breakdown=[
                MetricBreakdownItem(metric="Job Specific Compatibility", score=job_match_score, weight=0.60, weightedScore=round(job_match_score * 0.60, 1), evidence="Direct job requirements alignment"),
                MetricBreakdownItem(metric="Profile Base Readiness", score=profile_readiness_score, weight=0.40, weightedScore=round(profile_readiness_score * 0.40, 1), evidence="General technical profile readiness"),
            ],
            evidence=[],
            confidence=0.91,
            matchedSkills=[],
            missingSkills=[]
        )

    def _extract_exp_years(self, text: str) -> int:
        if not text:
            return 2
        match = re.search(r'(\d+)\+?\s*(?:years?|yrs?)', text, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                return 2
        return 2


scoring_engine = DeterministicScoringEngine()
