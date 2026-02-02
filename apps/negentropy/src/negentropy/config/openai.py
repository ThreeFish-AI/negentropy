"""
OpenAI API Configuration.
"""

from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class OpenAISettings(BaseSettings):
    """OpenAI API configuration."""

    model_config = SettingsConfigDict(
        env_prefix="",  # Use standard OPENAI_* env vars
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Standard OpenAI env vars (no prefix)
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    openai_base_url: Optional[str] = Field(default=None, alias="OPENAI_BASE_URL")
