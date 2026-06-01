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
