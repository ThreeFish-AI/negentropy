"""
Logging Configuration.
"""

from enum import Enum

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class LogFormat(str, Enum):
    CONSOLE = "console"
    JSON = "json"


class LoggingSettings(BaseSettings):
    """Logging infrastructure configuration."""

    model_config = SettingsConfigDict(
        env_prefix="NE_LOG_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    level: LogLevel = Field(default=LogLevel.INFO, description="Log level")
    sinks: str = Field(default="stdio", description="Comma-separated sink names (stdio, file, gcloud)")
    format: LogFormat = Field(default=LogFormat.CONSOLE, description="Output format")
    file_path: str = Field(default="logs/negentropy.log", description="Path for file sink")
    gcloud_log_name: str = Field(default="negentropy", description="Log name for GCloud sink")
