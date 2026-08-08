import logging
import json
from typing import Dict, Optional
from app.models.session import SessionState
from app.config import settings

logger = logging.getLogger(__name__)


class SessionService:
    """
    Production-grade Session Storage Service with Redis persistence
    and seamless in-memory fallback.
    """
    def __init__(self):
        self._memory_sessions: Dict[str, SessionState] = {}
        self._redis_client = None
        self._redis_initialized = False

    async def _get_redis(self):
        if not self._redis_initialized:
            self._redis_initialized = True
            try:
                import redis.asyncio as redis
                client = redis.from_url(settings.REDIS_URL, decode_responses=True)
                await client.ping()
                self._redis_client = client
                logger.info(f"Connected to Redis session store at {settings.REDIS_URL}")
            except Exception:
                logger.info("Local Redis server not running. Falling back to built-in in-memory session store.")
                self._redis_client = None
        return self._redis_client

    async def get_session(self, session_id: str) -> Optional[SessionState]:
        redis_client = await self._get_redis()
        if redis_client:
            try:
                data = await redis_client.get(f"interview_session:{session_id}")
                if data:
                    return SessionState.model_validate_json(data)
            except Exception as e:
                logger.error(f"Failed to fetch session from Redis: {e}")
        
        return self._memory_sessions.get(session_id)

    async def create_session(self, session_id: str, state: SessionState) -> SessionState:
        return await self.save_session(state)

    async def save_session(self, state: SessionState) -> SessionState:
        self._memory_sessions[state.session_id] = state
        redis_client = await self._get_redis()
        if redis_client:
            try:
                # Expire sessions after 24 hours (86400 seconds)
                await redis_client.setex(
                    f"interview_session:{state.session_id}",
                    86400,
                    state.model_dump_json()
                )
            except Exception as e:
                logger.error(f"Failed to save session to Redis: {e}")
        return state

    async def delete_session(self, session_id: str) -> bool:
        if session_id in self._memory_sessions:
            del self._memory_sessions[session_id]
        
        redis_client = await self._get_redis()
        if redis_client:
            try:
                await redis_client.delete(f"interview_session:{session_id}")
            except Exception as e:
                logger.error(f"Failed to delete session from Redis: {e}")
        return True


# Singleton instance for session management
session_service = SessionService()
