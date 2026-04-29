"""
Negentropy Configuration Module.

Implements layered configuration loading with YAML support.

Loading priority (highest → lowest):
    1. Environment variables  (e.g. NE_DB_POOL_SIZE=20)
    2. config.local.yaml  (cwd-relative runtime config, gitignored)
    3. CLI-specified YAML  (NE_CONFIG_PATH or ``negentropy -c path``)
    4. ~/.negentropy/config.yaml  (user-level overrides)
    5. config.default.yaml  (package defaults)
    6. Field defaults in code

Usage:
    from negentropy.config import settings

    settings.environment.env       # "development"
    settings.database.url          # PostgresDsn
    settings.logging.level         # LogLevel.INFO

Note:
    LLM/Embedding 模型配置已迁移至 DB (model_configs 表)，
    通过 Admin UI 管理，使用 model_resolver 解析。
"""

from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict

from .app import AppSettings
from .auth import AuthSettings
from .database import DatabaseSettings
from .environment import EnvironmentSettings
from .knowledge import KnowledgeSettings
from .logging import LoggingSettings
from .observability import ObservabilitySettings
from .search import SearchSettings
from .services import ServicesSettings


class Settings(BaseSettings):
    """
    Composite settings aggregating all orthogonal configuration domains.

    This class follows the Composition over Construction principle,
    delegating to specialized sub-settings for each concern.

    Configuration sources (highest priority first):
        env vars → YAML chain (local > user > NE_CONFIG_PATH > default) → Field defaults
    """

    model_config = SettingsConfigDict(
        env_nested_delimiter="__",
        extra="ignore",
    )

    def __init__(self, **kwargs):
        # Pre-load and distribute YAML sections BEFORE sub-settings are instantiated.
        # This populates the section registry so that each sub-settings class
        # can read its YAML data via settings_customise_sources.
        from ._base import set_yaml_section
        from .yaml_loader import load_merged_yaml_config

        yaml_config = load_merged_yaml_config()

        for section in (
            "app",
            "logging",
            "database",
            "services",
            "auth",
            "search",
            "observability",
            "knowledge",
        ):
            set_yaml_section(section, yaml_config.get(section, {}))

        # EnvironmentSettings reads the "environment" section; the legacy
        # top-level "env" key (pre-refactor layout) is merged in so that
        # user-level ~/.negentropy/config.yaml written against the old layout
        # keeps working without migration.
        environment_section = dict(yaml_config.get("environment") or {})
        legacy_env = yaml_config.get("env")
        if legacy_env is not None:
            environment_section["env"] = legacy_env
        if "env" not in environment_section:
            environment_section["env"] = "development"
        set_yaml_section("environment", environment_section)

        super().__init__(**kwargs)

    # Environment detection (loaded first to determine other configs)
    @cached_property
    def environment(self) -> EnvironmentSettings:
        return EnvironmentSettings()

    # Composed sub-settings (each loads from its own env prefix + YAML section)
    @cached_property
    def app(self) -> AppSettings:
        return AppSettings()

    @cached_property
    def logging(self) -> LoggingSettings:
        return LoggingSettings()

    @cached_property
    def observability(self) -> ObservabilitySettings:
        return ObservabilitySettings()

    @cached_property
    def database(self) -> DatabaseSettings:
        return DatabaseSettings()

    @cached_property
    def services(self) -> ServicesSettings:
        return ServicesSettings()

    @cached_property
    def auth(self) -> AuthSettings:
        return AuthSettings()

    @cached_property
    def search(self) -> SearchSettings:
        return SearchSettings()

    @cached_property
    def knowledge(self) -> KnowledgeSettings:
        return KnowledgeSettings()

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
    def log_level(self) -> str:
        return self.logging.level.value

    @property
    def log_sinks(self) -> str:
        return self.logging.sinks

    @property
    def log_format(self) -> str:
        return self.logging.format.value

    @property
    def log_file_path(self) -> str:
        return self.logging.file_path

    @property
    def gcloud_log_name(self) -> str:
        return self.logging.gcloud_log_name

    @property
    def log_console_timestamp_format(self) -> str:
        return self.logging.console_timestamp_format

    @property
    def log_console_level_width(self) -> int:
        return self.logging.console_level_width

    @property
    def log_console_logger_width(self) -> int:
        return self.logging.console_logger_width

    @property
    def log_console_separator(self) -> str:
        return self.logging.console_separator

    @property
    def database_url(self) -> str:
        return str(self.database.url)

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
        return self.services.credential_backend.value

    @property
    def memory_service_backend(self) -> str:
        return self.services.memory_backend.value

    @property
    def session_service_backend(self) -> str:
        return self.services.session_backend.value

    @property
    def artifact_service_backend(self) -> str:
        return self.services.artifact_backend.value

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


# Singleton instance
settings = Settings()

__all__ = [
    "Settings",
    "settings",
    "AppSettings",
    "EnvironmentSettings",
    "KnowledgeSettings",
    "LoggingSettings",
    "ObservabilitySettings",
    "DatabaseSettings",
    "ServicesSettings",
    "AuthSettings",
    "SearchSettings",
]
