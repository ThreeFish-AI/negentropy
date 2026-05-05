"""
Environment Configuration.

Implements multi-environment support following the Strategy Pattern.
The environment is determined by the `NE_ENV` environment variable.
"""

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict

Environment = Literal["development", "testing", "staging", "production"]


class EnvironmentSettings(BaseSettings):
    """
    Environment detection and configuration.

    The environment is determined by `NE_ENV`.
    """

    model_config = SettingsConfigDict(
        env_prefix="NE_",
        env_nested_delimiter="__",
        extra="ignore",
        frozen=True,
    )

    env: Environment = Field(
        default="development",
        description="Current environment (development, testing, staging, production)",
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        from ._base import YamlDictSource, get_yaml_section

        return (
            init_settings,
            env_settings,
            dotenv_settings,
            YamlDictSource(settings_cls, get_yaml_section("environment")),
            file_secret_settings,
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
    def debug(self) -> bool:
        """Debug mode is enabled in non-production environments by default."""
        return self.env != "production"
