import os
from dataclasses import dataclass


@dataclass
class Settings:
    """Central configuration for Negentropy agent."""

    default_model: str = os.getenv("DEFAULT_MODEL", "openai/glm-4.7")

    # Future: Add other configuration items here (e.g. API keys, thresholds)


settings = Settings()
