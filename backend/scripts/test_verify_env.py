import asyncio
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.utils.llm import get_llm

def verify():
    print("=== 1. Environment Keys ===")
    print("GEMINI_API_KEY          :", settings.get_key_fingerprint(settings.GEMINI_API_KEY))
    print("GEMINI_RESUME_API_KEY   :", settings.get_key_fingerprint(settings.GEMINI_RESUME_API_KEY))
    print("GEMINI_INTERVIEW_API_KEY:", settings.get_key_fingerprint(settings.GEMINI_INTERVIEW_API_KEY))
    print("GEMINI_MODEL            :", settings.GEMINI_MODEL)
    
    print("\n=== 2. Key Pools ===")
    print("Default Pool   :", [settings.get_key_fingerprint(k) for k in settings.GEMINI_API_KEYS])
    print("Resume Pool    :", [settings.get_key_fingerprint(k) for k in settings.GEMINI_RESUME_API_KEYS])
    print("Interview Pool :", [settings.get_key_fingerprint(k) for k in settings.GEMINI_INTERVIEW_API_KEYS])

    print("\n=== 3. Purpose Routing ===")
    llm_default = get_llm(temperature=0.7)
    print("Default LLM   :", type(llm_default).__name__, "Keys:", [settings.get_key_fingerprint(k) for k in llm_default._keys])

    llm_resume = get_llm(temperature=0.1, purpose="resume")
    print("Resume LLM    :", type(llm_resume).__name__, "Keys:", [settings.get_key_fingerprint(k) for k in llm_resume._keys])

    llm_interview = get_llm(temperature=0.7, purpose="interview")
    print("Interview LLM :", type(llm_interview).__name__, "Keys:", [settings.get_key_fingerprint(k) for k in llm_interview._keys])

if __name__ == "__main__":
    verify()
