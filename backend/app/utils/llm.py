import logging
from typing import Optional, Any
from app.config import settings

logger = logging.getLogger(__name__)


def get_llm(
    temperature: float = 0.7,
    model_name: Optional[str] = None,
    api_key_override: Optional[str] = None,
    provider: Optional[str] = None
) -> Optional[Any]:
    """
    Unified LLM Factory returning either ChatGoogleGenerativeAI (Gemini)
    or ChatOpenAI depending on configured environment keys and provider.
    Returns None if no valid API key is present.
    """
    gemini_key = api_key_override or settings.GEMINI_API_KEY
    gemini_model = model_name or settings.GEMINI_MODEL

    # Explicit OpenAI request
    if provider == "openai":
        if settings.OPENAI_API_KEY:
            try:
                from langchain_openai import ChatOpenAI
                logger.info(f"Initializing OpenAI LLM ({settings.OPENAI_MODEL})")
                return ChatOpenAI(
                    model=settings.OPENAI_MODEL,
                    api_key=settings.OPENAI_API_KEY,
                    temperature=temperature,
                    max_retries=1
                )
            except Exception as e:
                logger.warning(f"Failed to initialize ChatOpenAI: {e}")
        return None

    # Default / Gemini request
    if gemini_key and provider != "openai":
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            fp = settings.get_key_fingerprint(gemini_key)
            key_len = len(gemini_key)
            logger.info(
                f"[GEMINI_CONFIG]\n"
                f"configured=true\n"
                f"key_length={key_len}\n"
                f"key_fingerprint={fp}\n"
                f"model={gemini_model}"
            )
            return ChatGoogleGenerativeAI(
                model=gemini_model,
                google_api_key=gemini_key,
                temperature=temperature,
                max_retries=0
            )
        except Exception as e:
            logger.warning(f"[GEMINI_INIT_ERROR] Failed to initialize ChatGoogleGenerativeAI ({gemini_model}): {e}")


    # Fall back to OpenAI if OPENAI_API_KEY is present
    if settings.OPENAI_API_KEY:
        try:
            from langchain_openai import ChatOpenAI
            logger.info(f"Initializing OpenAI LLM fallback ({settings.OPENAI_MODEL})")
            return ChatOpenAI(
                model=settings.OPENAI_MODEL,
                api_key=settings.OPENAI_API_KEY,
                temperature=temperature,
                max_retries=1
            )
        except Exception as e:
            logger.warning(f"Failed to initialize ChatOpenAI fallback: {e}")

    return None

