import logging
from typing import Optional, Any
from app.config import settings

logger = logging.getLogger(__name__)


def get_llm(temperature: float = 0.7) -> Optional[Any]:
    """
    Unified LLM Factory returning either ChatGoogleGenerativeAI (Gemini)
    or ChatOpenAI depending on configured environment keys.
    Returns None if no valid API key is present.
    """
    # 1. Prefer Gemini API if GEMINI_API_KEY / GOOGLE_API_KEY is present
    if settings.GEMINI_API_KEY:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            logger.info(f"Initializing Gemini LLM ({settings.GEMINI_MODEL})")
            return ChatGoogleGenerativeAI(
                model=settings.GEMINI_MODEL,
                google_api_key=settings.GEMINI_API_KEY,
                temperature=temperature
            )
        except Exception as e:
            logger.warning(f"Failed to initialize ChatGoogleGenerativeAI: {e}")

    # 2. Fall back to OpenAI if OPENAI_API_KEY is present
    if settings.OPENAI_API_KEY:
        try:
            from langchain_openai import ChatOpenAI
            logger.info(f"Initializing OpenAI LLM ({settings.OPENAI_MODEL})")
            return ChatOpenAI(
                model=settings.OPENAI_MODEL,
                api_key=settings.OPENAI_API_KEY,
                temperature=temperature
            )
        except Exception as e:
            logger.warning(f"Failed to initialize ChatOpenAI: {e}")

    return None
