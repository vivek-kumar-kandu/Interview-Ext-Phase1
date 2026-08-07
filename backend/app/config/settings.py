import os
from pathlib import Path
from dataclasses import dataclass, field


@dataclass
class Settings:
    APP_NAME: str = "InterviewOS Backend"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # OpenAI Settings
    OPENAI_API_KEY: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    OPENAI_MODEL: str = field(default_factory=lambda: os.getenv("OPENAI_MODEL", "gpt-4o-mini"))

    # Qdrant Settings
    QDRANT_URL: str = field(default_factory=lambda: os.getenv("QDRANT_URL", ":memory:"))
    QDRANT_COLLECTION_NAME: str = "interview_curriculum"

    # Redis Settings
    REDIS_URL: str = field(default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379/0"))

    # Data Paths
    BASE_DIR: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent)

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
