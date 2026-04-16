"""
Application Configuration.
"""

from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict


class AppSettings(BaseSettings):
    """Basic application metadata."""

    model_config = SettingsConfigDict(
        env_prefix="NE_APP_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    name: str = "negentropy"

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
            YamlDictSource(settings_cls, get_yaml_section("app")),
            file_secret_settings,
        )
