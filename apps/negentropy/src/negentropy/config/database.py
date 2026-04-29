"""
Database Configuration.
"""

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    """Database connection and pool configuration."""

    model_config = SettingsConfigDict(
        env_prefix="NE_DB_",
        env_nested_delimiter="__",
        extra="ignore",
        frozen=True,
    )

    url: PostgresDsn = Field(
        default="postgresql+asyncpg://aigc:@localhost:5432/negentropy",
        description="Database connection URL",
    )
    pool_size: int = Field(default=5, description="Connection pool size")
    max_overflow: int = Field(default=10, description="Max overflow connections")
    pool_recycle: int = Field(default=3600, description="Pool recycle time in seconds")
    echo: bool = Field(default=False, description="Echo SQL statements")

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
            YamlDictSource(settings_cls, get_yaml_section("database")),
            file_secret_settings,
        )
