"""
Negentropy Configuration Module.

Implements the Nested Settings Pattern for orthogonal configuration domains.
Each sub-module represents an independent concern with its own environment variable prefix.

Multi-Environment Support:
    Set `NE_ENV` to one of: development, testing, staging, production
    The system will load .env files in this order (later overrides earlier):
    1. .env
    2. .env.local
    3. .env.{environment}
    4. .env.{environment}.local

Usage:
    from negentropy.config import settings

    # Check current environment
    settings.environment.env  # "development"
    settings.environment.is_production  # False

    # Access LLM configuration
    settings.llm.full_model_name
    settings.llm.to_litellm_kwargs()

    # Access database configuration
    settings.database.url

    # Access logging configuration
    settings.logging.level
"""

from functools import cached_property
import os

from pydantic_settings import BaseSettings, SettingsConfigDict

from .app import AppSettings
from .database import DatabaseSettings
from .environment import EnvironmentSettings
from .llm import LlmSettings
from .logging import LoggingSettings
from .openai import OpenAISettings
from .services import ServicesSettings


def _get_env_files() -> tuple[str, ...]:
    """
    Determine which .env files to load based on NE_ENV.

    This function is called at module import time to configure the Settings class.
    """
    env = os.getenv("NE_ENV", "development")
    return (
        ".env",
        ".env.local",
        f".env.{env}",
        f".env.{env}.local",
    )


class Settings(BaseSettings):
    """
    Composite settings aggregating all orthogonal configuration domains.

    This class follows the Composition over Construction principle,
    delegating to specialized sub-settings for each concern.

    Environment-aware loading:
        Settings are loaded from multiple .env files based on NE_ENV.
        See module docstring for file resolution order.
    """

    model_config = SettingsConfigDict(
        env_file=_get_env_files(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Environment detection (loaded first to determine other configs)
    @cached_property
    def environment(self) -> EnvironmentSettings:
        return EnvironmentSettings()

    # Composed sub-settings (each loads from its own env prefix)
    @cached_property
    def app(self) -> AppSettings:
        return AppSettings()

    @cached_property
    def llm(self) -> LlmSettings:
        return LlmSettings()

    @cached_property
    def logging(self) -> LoggingSettings:
        return LoggingSettings()

    @cached_property
    def database(self) -> DatabaseSettings:
        return DatabaseSettings()

    @cached_property
    def services(self) -> ServicesSettings:
        return ServicesSettings()

    @cached_property
    def openai(self) -> OpenAISettings:
        return OpenAISettings()


    # =========================================================================
    # Legacy Compatibility Layer
    # =========================================================================
    # These properties maintain backward compatibility with existing code
    # that references flat attributes like `settings.default_model`.
    # They delegate to the new structured sub-settings.

    @property
    def app_name(self) -> str:
        return self.app.name

    @property
    def default_model(self) -> str:
        return self.llm.full_model_name

    @property
    def orchestrator_model(self) -> str:
        return self.llm.full_model_name

    @property
    def faculty_model(self) -> str:
        return self.llm.full_model_name

    @property
    def model_kwargs(self) -> dict:
        return self.llm.to_litellm_kwargs()

    @property
    def log_level(self) -> str:
        return self.logging.level

    @property
    def log_sinks(self) -> str:
        return self.logging.sinks

    @property
    def log_format(self) -> str:
        return self.logging.format

    @property
    def log_file_path(self) -> str:
        return self.logging.file_path

    @property
    def gcloud_log_name(self) -> str:
        return self.logging.gcloud_log_name

    @property
    def database_url(self) -> str:
        return self.database.url

    @property
    def db_pool_size(self) -> int:
        return self.database.pool_size

    @property
    def db_max_overflow(self) -> int:
        return self.database.max_overflow

    @property
    def db_pool_recycle(self) -> int:
        return self.database.pool_recycle

    @property
    def db_echo(self) -> bool:
        return self.database.echo

    @property
    def credential_service_backend(self) -> str:
        return self.services.credential_backend

    @property
    def memory_service_backend(self) -> str:
        return self.services.memory_backend

    @property
    def session_service_backend(self) -> str:
        return self.services.session_backend

    @property
    def artifact_service_backend(self) -> str:
        return self.services.artifact_backend

    @property
    def gcs_bucket_name(self) -> str | None:
        return self.services.gcs_bucket_name

    @property
    def vertex_project_id(self) -> str | None:
        return self.services.vertex_project_id

    @property
    def vertex_location(self) -> str | None:
        return self.services.vertex_location

    @property
    def vertex_agent_engine_id(self) -> str | None:
        return self.services.vertex_agent_engine_id

    @property
    def openai_api_key(self) -> str | None:
        return self.openai.openai_api_key

    @property
    def openai_base_url(self) -> str | None:
        return self.openai.openai_base_url

    # Deprecated: Use settings.llm directly
    @property
    def llm_config(self) -> LlmSettings:
        """Deprecated. Use settings.llm instead."""
        return self.llm


# Singleton instance
settings = Settings()

__all__ = [
    "Settings",
    "settings",
    "AppSettings",
    "LlmSettings",
    "LoggingSettings",
    "DatabaseSettings",
    "ServicesSettings",
    "OpenAISettings",
]
