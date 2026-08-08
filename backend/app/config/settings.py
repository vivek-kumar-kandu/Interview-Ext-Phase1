import os
from pathlib import Path
from dataclasses import dataclass, field
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent.parent / ".env"

def _reload_env():
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=True)

_reload_env()


class Settings:
    APP_NAME: str = "InterviewOS Backend"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    @property
    def AI_PROVIDER(self) -> str:
        _reload_env()
        return os.getenv("AI_PROVIDER", "gemini").strip()

    @property
    def GEMINI_API_KEY(self) -> str:
        _reload_env()
        return os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", "")).strip()

    @property
    def GEMINI_MODEL(self) -> str:
        _reload_env()
        return os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip()

    @property
    def GEMINI_API_KEYS(self) -> list[str]:
        _reload_env()
        keys = []
        for env_var in ["GEMINI_API_KEY", "GEMINI_API_KEYS", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GOOGLE_API_KEY"]:
            raw_val = os.getenv(env_var)
            if raw_val and raw_val.strip():
                for sub_key in raw_val.split(","):
                    cleaned = sub_key.strip()
                    if cleaned and cleaned not in keys:
                        keys.append(cleaned)
        return keys

    @staticmethod
    def get_key_fingerprint(key: str = None) -> str:
        if key is None:
            key = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", "")).strip()
        if not key:
            return "NONE"
        key = key.strip()
        if len(key) <= 10:
            return f"{key[:2]}...{key[-2:]} (length={len(key)})"
        return f"{key[:6]}...{key[-4:]} (length={len(key)})"

    @property
    def BREETH_API_KEY(self) -> str:
        _reload_env()
        return os.getenv("BREETH_API_KEY", "").strip()

    @property
    def OPENAI_API_KEY(self) -> str:
        _reload_env()
        return os.getenv("OPENAI_API_KEY", "").strip()

    @property
    def OPENAI_MODEL(self) -> str:
        _reload_env()
        return os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()

    @property
    def QDRANT_URL(self) -> str:
        _reload_env()
        return os.getenv("QDRANT_URL", ":memory:").strip()

    QDRANT_COLLECTION_NAME: str = "interview_curriculum"

    @property
    def REDIS_URL(self) -> str:
        _reload_env()
        return os.getenv("REDIS_URL", "redis://localhost:6379/0").strip()

    @property
    def BASE_DIR(self) -> Path:
        return Path(__file__).resolve().parent.parent

    @property
    def DATA_DIR(self) -> Path:
        return self.BASE_DIR / "data"

    @property
    def CANDIDATES_FILE(self) -> Path:
        return self.DATA_DIR / "candidates.json"

    @property
    def CURRICULUM_FILE(self) -> Path:
        return self.DATA_DIR / "curriculum.json"

    # Interview Constraints
    MIN_QUESTIONS: int = 8
    MIN_CURRICULUM_DAYS: int = 4
    MAX_TURNS: int = 15


settings = Settings()

