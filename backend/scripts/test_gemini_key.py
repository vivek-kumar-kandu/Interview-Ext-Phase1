import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.utils.llm import get_llm
from langchain_core.messages import HumanMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_gemini_key")


async def main():
    key = settings.GEMINI_API_KEY
    model = settings.GEMINI_MODEL
    logger.info(f"Key fingerprint: {settings.get_key_fingerprint(key)}")
    logger.info(f"Model: {model}")
    logger.info(f"Key format: {'AQ. (OAuth Bearer wrapper)' if key.startswith('AQ.') else 'AIzaSy (API Key)'}")
    logger.info("=" * 60)

    if not key:
        logger.error("GEMINI_API_KEY is empty!")
        return

    llm = get_llm(temperature=0.1)
    if not llm:
        logger.error("get_llm() returned None!")
        return

    logger.info(f"LLM type: {type(llm).__name__}")

    try:
        logger.info("Sending test message via get_llm() wrapper...")
        res = await llm.ainvoke([HumanMessage(content='Reply with exactly this JSON: {"status": "ok", "message": "Gemini is working"}')])
        logger.info(f"\n✅ SUCCESS! Gemini is authenticated and working!")
        logger.info(f"Response: {res.content}")
    except Exception as e:
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err or "quota" in err.lower():
            logger.warning(f"\n⚠️  KEY IS AUTHENTICATED but rate-limited (429).")
            logger.warning(f"Auth = SUCCESS. Wait 1-2 minutes before retrying the interview.")
        elif "401" in err or "UNAUTHENTICATED" in err:
            logger.error(f"\n❌ Authentication failed (401). Key is invalid.")
        elif "403" in err or "PERMISSION_DENIED" in err:
            logger.error(f"\n❌ Permission denied (403). API not enabled for this project.")
        else:
            logger.error(f"\n❌ FAILED: {type(e).__name__} - {err[:300]}")


if __name__ == "__main__":
    asyncio.run(main())
