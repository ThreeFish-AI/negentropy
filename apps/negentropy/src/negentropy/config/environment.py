"""
Environment Configuration.

Implements multi-environment support following the Strategy Pattern.
The environment is determined by the `NE_ENV` environment variable.
"""

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


Environment = Literal["development", "testing", "staging", "production"]


class EnvironmentSettings(BaseSettings):
    """
    Environment detection and configuration.

    The environment is determined by `NE_ENV` and controls which .env file is loaded.

    File Resolution Order:
    1. `.env.{environment}.local` (local overrides, gitignored)
    2. `.env.{environment}` (environment-specific)
    3. `.env.local` (local overrides, gitignored)
    4. `.env` (base defaults)
    """

    model_config = SettingsConfigDict(
        env_prefix="NE_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: Environment = Field(
        default="development",
        description="Current environment (development, testing, staging, production)",
    )

    @property
    def is_development(self) -> bool:
        return self.env == "development"

    @property
    def is_testing(self) -> bool:
        return self.env == "testing"

    @property
    def is_staging(self) -> bool:
        return self.env == "staging"

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def env_files(self) -> tuple[str, ...]:
        """
        Returns the list of .env files to load in priority order.

        Lower index = higher priority (loaded last, overrides earlier).
        """
        return (
            ".env",
            ".env.local",
            f".env.{self.env}",
            f".env.{self.env}.local",
        )

    @property
    def debug(self) -> bool:
        """Debug mode is enabled in non-production environments by default."""
        return self.env != "production"
