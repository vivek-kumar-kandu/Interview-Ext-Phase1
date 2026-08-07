from typing import Dict, Optional
from app.models.session import SessionState


class SessionService:
    """
    Session storage service. Holds active SessionState objects in memory
    with a clean async interface for Redis migration.
    """
    def __init__(self):
        self._sessions: Dict[str, SessionState] = {}

    async def get_session(self, session_id: str) -> Optional[SessionState]:
        return self._sessions.get(session_id)

    async def create_session(self, session_id: str, state: SessionState) -> SessionState:
        self._sessions[session_id] = state
        return state

    async def save_session(self, state: SessionState) -> SessionState:
        self._sessions[state.session_id] = state
        return state

    async def delete_session(self, session_id: str) -> bool:
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False


# Singleton instance for in-memory session management
session_service = SessionService()
