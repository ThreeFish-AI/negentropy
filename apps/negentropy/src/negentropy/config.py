import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for Negentropy agent."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    default_model: str = os.getenv("DEFAULT_MODEL", "openai/glm-4.7")

    # Database
    database_url: str = "postgresql+asyncpg://aigc:@localhost:5432/negentropy"
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_recycle: int = 3600
    db_echo: bool = False


settings = Settings()
