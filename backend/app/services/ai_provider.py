import json
import logging
import time
import re
import httpx
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from app.config import settings

logger = logging.getLogger(__name__)

class AIProvider(ABC):
    """
    Abstract AI Provider Interface for InterviewOS.
    Decouples LLM capabilities (Resume Analysis, Profile Analysis, Question Generation, Turn Evaluation)
    from specific vendor implementations (Gemini, Breeth, OpenAI).
    """

    @abstractmethod
    async def analyze_resume(
        self,
        resume_text: str,
        filename: str = "resume.pdf",
        resume_hash: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyzes raw resume text and returns structured candidate JSON.
        Must NOT fabricate skills, experience, education, or target roles.
        """
        pass

    @abstractmethod
    async def analyze_profile(
        self,
        profile_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyzes candidate profile context extracted from web/social pages.
        """
        pass

    @abstractmethod
    async def generate_interview_question(
        self,
        day_title: str,
        curriculum_context: str,
        job_role: str,
        company: str,
        required_skills: str,
        years_exp: int,
        memories_ctx: str = "",
        turn_index: int = 1
    ) -> str:
        """
        Generates a tailored technical interview question based on resume, job, and curriculum.
        """
        pass


class GeminiProvider(AIProvider):
    """
    Google Gemini 2.0 / Flash AI Provider Implementation.
    """

    def _get_system_instruction() -> str:
        return (
            "You are InterviewOS Resume Intelligence Engine.\n"
            "Your task is to extract structured candidate information from the supplied resume.\n"
            "The uploaded resume is the ONLY source of truth. DO NOT fabricate information.\n"
            "DO NOT inject default skills, experience, education, projects, or roles.\n"
            "If evidence is absent from the resume, return an empty array [] or empty string.\n\n"
            "CRITICAL RULES:\n"
            "1. candidateSummary MUST be 2-3 concise sentences answering: Who is candidate, strongest areas, realistic career direction.\n"
            "2. technicalSkills must contain ONLY technologies explicitly supported by the resume.\n"
            "3. softSkills (Teamwork, Communication, Leadership, Adaptability, Problem Solving) MUST be separate.\n"
            "4. targetRoles MUST be derived from ACTUAL resume evidence. Each item has role, fitScore (0-100), whyFit.\n"
            "5. If evidence is insufficient for target roles, return targetRoles as [].\n"
            "6. strongestAreas: 2-4 areas derived strictly from resume evidence.\n"
            "7. developmentAreas: Gaps between current resume evidence and target roles.\n\n"
            "Return ONLY valid JSON matching the requested schema."
        )

    async def analyze_resume(
        self,
        resume_text: str,
        filename: str = "resume.pdf",
        resume_hash: Optional[str] = None
    ) -> Dict[str, Any]:
        from app.utils.llm import get_llm
        from langchain_core.messages import SystemMessage, HumanMessage

        keys_to_try = settings.GEMINI_API_KEYS
        if not keys_to_try:
            raise RuntimeError("No Gemini API key available")

        system_instruction = GeminiProvider._get_system_instruction()
        prompt = (
            f"RESUME TEXT TO ANALYZE ({filename}):\n"
            f"==================================================\n"
            f"{resume_text[:14000]}\n"
            f"==================================================\n\n"
            "Return ONLY a valid JSON object matching this exact schema:\n"
            "{\n"
            '  "candidateSummary": "2-3 concise sentences describing who the candidate is, strongest areas, and realistic career direction.",\n'
            '  "candidate": {\n'
            '    "name": "Full Name or null",\n'
            '    "headline": "Title/Headline or null",\n'
            '    "contact": {\n'
            '      "email": "Email or null",\n'
            '      "phone": "Phone or null",\n'
            '      "linkedin": "LinkedIn URL or null",\n'
            '      "github": "GitHub URL or null",\n'
            '      "portfolio": "Portfolio URL or null",\n'
            '      "location": "Location or null"\n'
            '    }\n'
            '  },\n'
            '  "education": [\n'
            '    {\n'
            '      "degree": "Degree Title",\n'
            '      "institution": "University/Institution",\n'
            '      "year": "Graduation Year or Duration",\n'
            '      "evidence": "Field or evidence detail"\n'
            '    }\n'
            '  ],\n'
            '  "experience": [\n'
            '    {\n'
            '      "role": "Job Title",\n'
            '      "company": "Company Name",\n'
            '      "duration": "Dates/Duration",\n'
            '      "keyWork": "One concise sentence describing core work."\n'
            '    }\n'
            '  ],\n'
            '  "technicalSkills": ["Skill 1", "Skill 2"],\n'
            '  "softSkills": ["Soft Skill 1"],\n'
            '  "projects": [\n'
            '    {\n'
            '      "name": "Project Title",\n'
            '      "description": "One concise sentence.",\n'
            '      "technologies": ["Tech 1"]\n'
            '    }\n'
            '  ],\n'
            '  "achievements": ["Achievement 1"],\n'
            '  "targetRoles": [\n'
            '    {\n'
            '      "role": "Role Title",\n'
            '      "fitScore": 88,\n'
            '      "whyFit": "One concise evidence-based sentence."\n'
            '    }\n'
            '  ],\n'
            '  "strongestAreas": ["Area 1", "Area 2"],\n'
            '  "developmentAreas": ["Area 1", "Area 2"],\n'
            '  "profileCompleteness": 75\n'
            "}\n"
        )

        last_error = None
        for key in keys_to_try:
            llm = get_llm(temperature=0.1, model_name=settings.GEMINI_MODEL, api_key_override=key)
            if not llm:
                continue
            try:
                t0 = time.time()
                response = await llm.ainvoke([
                    SystemMessage(content=system_instruction),
                    HumanMessage(content=prompt)
                ])
                duration_ms = int((time.time() - t0) * 1000)
                logger.info(f"[GEMINI_PROVIDER] analyze_resume success duration_ms={duration_ms}")

                text = str(response.content).strip()
                json_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
                if json_match:
                    text = json_match.group(1).strip()
                else:
                    brace_match = re.search(r'\{[\s\S]*\}', text)
                    if brace_match:
                        text = brace_match.group(0).strip()

                return json.loads(text)
            except Exception as e:
                last_error = e
                logger.warning(f"[GEMINI_PROVIDER] analyze_resume key attempt error: {e}")

        raise RuntimeError(f"Gemini API analysis failed: {last_error}")

    async def analyze_profile(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        return await self.analyze_resume(json.dumps(profile_data), "profile.json")

    async def generate_interview_question(
        self,
        day_title: str,
        curriculum_context: str,
        job_role: str,
        company: str,
        required_skills: str,
        years_exp: int,
        memories_ctx: str = "",
        turn_index: int = 1
    ) -> str:
        from app.utils.llm import get_llm
        from langchain_core.messages import HumanMessage

        llm = get_llm(temperature=0.7)
        if not llm:
            raise RuntimeError("Gemini LLM unavailable for question generation")

        prompt = (
            f"You are a Principal AI Technical Interviewer evaluating a candidate for the {job_role} role at {company}.\n"
            f"Job Skill Requirements: {required_skills}\n"
            f"Curriculum Topic: {day_title}\n"
            f"Curriculum Context: {curriculum_context}\n"
            f"Candidate Background: {years_exp} yrs exp in {job_role}.\n"
            f"Demonstrated Candidate Memories:\n{memories_ctx}\n\n"
            f"Ask ONE scenario-based technical question (Question #{turn_index}) directly referencing the role at {company}, candidate demonstrated memories, and testing practical knowledge of {day_title}."
        )

        resp = await llm.ainvoke([HumanMessage(content=prompt)])
        return str(resp.content).strip()


class BreethProvider(AIProvider):
    """
    Breeth Hackathon Token AI Provider Implementation.
    Uses Breeth API endpoint if configured, or Breeth Memory/LLM completions.
    """

    @property
    def api_key(self) -> str:
        return settings.BREETH_API_KEY

    async def analyze_resume(
        self,
        resume_text: str,
        filename: str = "resume.pdf",
        resume_hash: Optional[str] = None
    ) -> Dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("BREETH_API_KEY is not configured")

        logger.info("[BREETH_PROVIDER] Executing resume analysis via Breeth API...")
        # Breeth HTTP API call for structured resume intelligence
        url = "https://api.breeth.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        system_instruction = GeminiProvider._get_system_instruction()
        prompt = (
            f"RESUME TEXT TO ANALYZE ({filename}):\n"
            f"{resume_text[:10000]}\n\n"
            "Return ONLY valid JSON matching candidate analysis schema with candidateSummary, candidate, education, experience, technicalSkills, softSkills, projects, targetRoles, profileCompleteness."
        )
        payload = {
            "model": "breeth-1.0",
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    data = resp.json()
                    content_str = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    json_match = re.search(r'\{[\s\S]*\}', content_str)
                    if json_match:
                        return json.loads(json_match.group(0))
                else:
                    logger.warning(f"[BREETH_PROVIDER] API returned status {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"[BREETH_PROVIDER] HTTP request failed: {e}")

        # If direct Breeth chat endpoint is unavailable, check if OpenAI key / Gemini key fallback works
        raise RuntimeError("Breeth LLM API endpoint returned invalid response")

    async def analyze_profile(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        return await self.analyze_resume(json.dumps(profile_data), "profile.json")

    async def generate_interview_question(
        self,
        day_title: str,
        curriculum_context: str,
        job_role: str,
        company: str,
        required_skills: str,
        years_exp: int,
        memories_ctx: str = "",
        turn_index: int = 1
    ) -> str:
        if not self.api_key:
            raise RuntimeError("BREETH_API_KEY is not configured")

        url = "https://api.breeth.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        prompt = (
            f"You are a Principal AI Technical Interviewer evaluating a candidate for the {job_role} role at {company}.\n"
            f"Job Skill Requirements: {required_skills}\n"
            f"Curriculum Topic: {day_title}\n"
            f"Curriculum Context: {curriculum_context}\n"
            f"Candidate Background: {years_exp} yrs exp in {job_role}.\n"
            f"Demonstrated Candidate Memories:\n{memories_ctx}\n\n"
            f"Ask ONE scenario-based technical question (Question #{turn_index}) directly referencing the role at {company} and practical implementation of {day_title}."
        )
        payload = {
            "model": "breeth-1.0",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        except Exception as e:
            logger.warning(f"[BREETH_PROVIDER] generate_interview_question failed: {e}")

        raise RuntimeError("Breeth question generation API unavailable")


class LocalDeterministicProvider(AIProvider):
    """
    Evidence-based Local Deterministic Provider.
    Used for evidence extraction without LLM hallucination.
    """

    async def analyze_resume(
        self,
        resume_text: str,
        filename: str = "resume.pdf",
        resume_hash: Optional[str] = None
    ) -> Dict[str, Any]:
        from app.services.resume_pipeline import (
            normalize_resume_text,
            extract_contact_and_entities,
            classify_skills
        )
        norm_text = normalize_resume_text(resume_text)
        contact = extract_contact_and_entities(norm_text)
        tech_skills = classify_skills(norm_text.split())["technicalSkills"]

        return {
            "candidateSummary": f"Extracted candidate profile from {filename}.",
            "candidate": {
                "name": contact.get("name") or "Candidate",
                "headline": contact.get("headline"),
                "contact": contact
            },
            "education": [],
            "experience": [],
            "technicalSkills": tech_skills,
            "softSkills": [],
            "projects": [],
            "achievements": [],
            "targetRoles": [],
            "strongestAreas": tech_skills[:4],
            "developmentAreas": [],
            "profileCompleteness": 30
        }

    async def analyze_profile(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        return await self.analyze_resume(json.dumps(profile_data), "profile.json")

    async def generate_interview_question(
        self,
        day_title: str,
        curriculum_context: str,
        job_role: str,
        company: str,
        required_skills: str,
        years_exp: int,
        memories_ctx: str = "",
        turn_index: int = 1
    ) -> str:
        return (
            f"Question {turn_index}: Regarding the technical requirements for the {job_role} role at {company}, "
            f"how do you approach the design and production implementation of {day_title} ({required_skills})?"
        )


class AIProviderFactory:
    """
    Factory for instantiating the active AI Provider based on settings and availability.
    Supports cascade: Configured Provider (Breeth / Gemini) -> Fallback Provider -> Explicit Error
    """

    @staticmethod
    def get_provider() -> AIProvider:
        provider_setting = settings.AI_PROVIDER.lower().strip()

        if provider_setting == "breeth":
            if settings.BREETH_API_KEY:
                logger.info("[AI_PROVIDER] Primary provider: BreethProvider")
                return BreethProvider()
            logger.warning("[AI_PROVIDER] Breeth configured but BREETH_API_KEY missing. Falling back to GeminiProvider.")

        if settings.GEMINI_API_KEY:
            logger.info("[AI_PROVIDER] Provider active: GeminiProvider")
            return GeminiProvider()

        if settings.BREETH_API_KEY:
            logger.info("[AI_PROVIDER] Provider active: BreethProvider")
            return BreethProvider()

        logger.info("[AI_PROVIDER] Provider active: LocalDeterministicProvider (Offline)")
        return LocalDeterministicProvider()


ai_provider_factory = AIProviderFactory()
