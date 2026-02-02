"""
Application Configuration.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """Basic application metadata."""

    model_config = SettingsConfigDict(
        env_prefix="NE_APP_",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    name: str = "negentropy"
