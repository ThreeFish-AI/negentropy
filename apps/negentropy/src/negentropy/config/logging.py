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
    console_timestamp_format: str = Field(
        default="%Y-%m-%d %H:%M:%S",
        description="Console timestamp format",
    )
    console_level_width: int = Field(default=8, description="Console level column width")
    console_logger_width: int = Field(default=48, description="Console logger column width")
    console_separator: str = Field(default=" | ", description="Console column separator")
