import logging
import asyncio
import re
from typing import Optional, Any, List
from app.config import settings

logger = logging.getLogger(__name__)

# How long to wait (seconds) between retries for 429 RESOURCE_EXHAUSTED
_RETRY_DELAYS = [2, 4, 8]


def _parse_retry_delay(err_str: str) -> Optional[float]:
    """Extract the retryDelay value (e.g. '36s') from a Gemini 429 error string."""
    match = re.search(r"retryDelay[^:=]*[:=][^0-9]*(\d+(?:\.\d+)?)s", err_str, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None


class _AQGeminiWrapper:
    """
    LangChain-compatible async wrapper for AQ. format Gemini credentials.

    Google AI Studio now generates AQ. OAuth Bearer tokens instead of
    AIzaSy API keys. These tokens work with google.genai.Client(credentials=...)
    but NOT with ChatGoogleGenerativeAI(google_api_key=...).

    This wrapper provides an ainvoke() interface matching LangChain's convention
    so the rest of the codebase (lpa_interview_engine, etc.) works unchanged.

    Automatically retries on 429 RESOURCE_EXHAUSTED and rotates through available API keys.
    """

    def __init__(self, key: str, model: str, temperature: float = 0.7, keys: Optional[List[str]] = None):
        from google import genai
        self._model = model
        self._temperature = temperature
        self._keys = [key] if key else []
        pool_keys = keys if keys else settings.GEMINI_API_KEYS
        for k in pool_keys:
            if k and k not in self._keys:
                self._keys.append(k)
        self._clients = {}
        for k in self._keys:
            try:
                self._clients[k] = genai.Client(api_key=k)
            except Exception as e:
                logger.warning(f"[GEMINI_AQ_WRAPPER] Could not init client for key: {e}")
        logger.info(f"[GEMINI_AQ_WRAPPER] Initialized google.genai.Client with {len(self._clients)} key(s) (model={model})")

    async def ainvoke(self, messages: List[Any]) -> Any:
        """
        Accepts a list of LangChain message objects and returns a response
        object with a .content attribute — same interface as ChatGoogleGenerativeAI.
        Rotates across available keys on 429 RESOURCE_EXHAUSTED and 401 UNAUTHENTICATED.
        """
        parts = []
        for m in messages:
            if hasattr(m, "content"):
                parts.append(m.content)
            elif isinstance(m, dict):
                parts.append(m.get("content", str(m)))
            else:
                parts.append(str(m))
        prompt = "\n\n".join(parts)

        last_exc = None
        # Round 1: Try each key immediately
        for key in self._keys:
            client = self._clients.get(key)
            if not client:
                continue
            try:
                response = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda c=client: c.models.generate_content(
                        model=self._model,
                        contents=prompt,
                    )
                )

                class _Response:
                    def __init__(self, text: str):
                        self.content = text

                return _Response(response.text)

            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "401" in err_str or "UNAUTHENTICATED" in err_str:
                    logger.warning(f"[GEMINI_RETRY] Key {settings.get_key_fingerprint(key)} failed ({err_str[:60]}) — trying next key...")
                    last_exc = e
                    continue
                raise

        # Round 2: If all keys failed on first attempt, do brief backoffs
        for delay in [3, 8]:
            logger.warning(f"[GEMINI_RETRY] All keys rate limited / unavailable — waiting {delay}s before retry...")
            await asyncio.sleep(delay)
            for key in self._keys:
                client = self._clients.get(key)
                if not client:
                    continue
                try:
                    response = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda c=client: c.models.generate_content(
                            model=self._model,
                            contents=prompt,
                        )
                    )

                    class _Response:
                        def __init__(self, text: str):
                            self.content = text

                    return _Response(response.text)

                except Exception as e:
                    err_str = str(e)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "401" in err_str or "UNAUTHENTICATED" in err_str:
                        last_exc = e
                        continue
                    raise

        # Round 3: Fallback models if primary model hit 429 quota limit 0
        fallback_models = [m for m in ["gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-flash-latest"] if m != self._model]
        for fallback_model in fallback_models:
            logger.warning(f"[GEMINI_RETRY] Primary model '{self._model}' quota exhausted. Trying fallback model '{fallback_model}'...")
            for key in self._keys:
                client = self._clients.get(key)
                if not client:
                    continue
                try:
                    response = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda c=client, m=fallback_model: c.models.generate_content(
                            model=m,
                            contents=prompt,
                        )
                    )

                    class _Response:
                        def __init__(self, text: str):
                            self.content = text

                    return _Response(response.text)
                except Exception as e:
                    err_str = str(e)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "401" in err_str or "UNAUTHENTICATED" in err_str:
                        last_exc = e
                        continue
                    raise

        assert last_exc is not None
        raise last_exc


class _LangChainGeminiWithRetry:
    """
    Thin wrapper around ChatGoogleGenerativeAI that adds retry-on-429 logic,
    because langchain_google_genai does not natively back off on free-tier quota limits.
    """

    def __init__(self, llm: Any):
        self._llm = llm

    async def ainvoke(self, messages: List[Any]) -> Any:
        retry_delays = list(_RETRY_DELAYS)
        last_exc = None
        for attempt, delay in enumerate([0] + retry_delays):
            if delay > 0:
                logger.warning(
                    f"[GEMINI_RETRY] 429 quota hit — waiting {delay}s before retry "
                    f"(attempt {attempt}/{len(retry_delays)})…"
                )
                await asyncio.sleep(delay)
            try:
                return await self._llm.ainvoke(messages)
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    last_exc = e
                    api_delay = _parse_retry_delay(err_str)
                    if api_delay and attempt < len(retry_delays):
                        retry_delays[attempt] = max(retry_delays[attempt], api_delay + 5)
                    continue
                raise

        assert last_exc is not None
        raise last_exc


def get_llm(
    temperature: float = 0.7,
    model_name: Optional[str] = None,
    api_key_override: Optional[str] = None,
    provider: Optional[str] = None,
    purpose: Optional[str] = None
) -> Optional[Any]:
    """
    Unified LLM Factory.

    Supports:
    - AIzaSy... format (legacy simple API keys) → ChatGoogleGenerativeAI (with retry wrapper)
    - AQ. format (new Google AI Studio OAuth2 credentials) → _AQGeminiWrapper (with retry)
    - Purpose-based key routing ("resume" vs "interview")

    Returns None if no valid key is present.
    """
    if api_key_override:
        gemini_key = api_key_override
        pool_keys = [api_key_override]
    elif purpose == "interview":
        gemini_key = settings.GEMINI_INTERVIEW_API_KEY
        pool_keys = settings.GEMINI_INTERVIEW_API_KEYS
    elif purpose == "resume":
        gemini_key = settings.GEMINI_RESUME_API_KEY
        pool_keys = settings.GEMINI_RESUME_API_KEYS
    else:
        gemini_key = settings.GEMINI_API_KEY
        pool_keys = settings.GEMINI_API_KEYS

    gemini_model = model_name or settings.GEMINI_MODEL

    # Auto-upgrade deprecated Gemini 1.5 models to gemini-flash-latest to prevent 404 NOT_FOUND errors
    if gemini_model and "1.5" in gemini_model:
        logger.warning(f"[GEMINI_MODEL_UPGRADE] Model '{gemini_model}' is deprecated. Upgrading to 'gemini-flash-latest'.")
        gemini_model = "gemini-flash-latest"

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

    # Gemini request
    if gemini_key and provider != "openai":
        fp = settings.get_key_fingerprint(gemini_key)
        key_len = len(gemini_key)
        is_aq = gemini_key.startswith("AQ.")

        logger.info(
            f"[GEMINI_CONFIG]\n"
            f"purpose={purpose or 'general'}\n"
            f"configured=true\n"
            f"key_length={key_len}\n"
            f"key_fingerprint={fp}\n"
            f"key_format={'AQ. (OAuth Bearer)' if is_aq else 'AIzaSy (API Key)'}\n"
            f"model={gemini_model}"
        )

        if is_aq:
            # New Google AI Studio AQ. format — use OAuth Bearer wrapper (has built-in retry)
            try:
                return _AQGeminiWrapper(key=gemini_key, model=gemini_model, temperature=temperature, keys=pool_keys)
            except Exception as e:
                logger.warning(f"[GEMINI_AQ_INIT_ERROR] Failed to initialize AQ wrapper: {e}")
        else:
            # Standard AIzaSy API key — wrap ChatGoogleGenerativeAI with retry logic
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                base_llm = ChatGoogleGenerativeAI(
                    model=gemini_model,
                    google_api_key=gemini_key,
                    temperature=temperature,
                    max_retries=0  # We handle retries ourselves
                )
                return _LangChainGeminiWithRetry(base_llm)
            except Exception as e:
                logger.warning(f"[GEMINI_INIT_ERROR] Failed to initialize ChatGoogleGenerativeAI ({gemini_model}): {e}")

    # Fallback to OpenAI
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
