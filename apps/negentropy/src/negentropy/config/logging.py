"""
Logging Configuration.
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class LoggingSettings(BaseSettings):
    """Logging infrastructure configuration."""

    model_config = SettingsConfigDict(
        env_prefix="NE_LOG_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    level: str = Field(default="INFO", description="Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)")
    sinks: str = Field(default="stdio", description="Comma-separated sink names (stdio, file, gcloud)")
    format: str = Field(default="console", description="Output format (console, json)")
    file_path: str = Field(default="logs/negentropy.log", description="Path for file sink")
    gcloud_log_name: str = Field(default="negentropy", description="Log name for GCloud sink")
