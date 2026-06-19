"""
ADK Services Configuration.
"""

from enum import Enum

from pydantic import Field
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict


class CredentialBackend(str, Enum):
    POSTGRES = "postgres"
    INMEMORY = "inmemory"
    SESSION = "session"


class MemoryBackend(str, Enum):
    INMEMORY = "inmemory"
    VERTEXAI = "vertexai"
    POSTGRES = "postgres"


class SessionBackend(str, Enum):
    INMEMORY = "inmemory"
    VERTEXAI = "vertexai"
    DATABASE = "database"
    POSTGRES = "postgres"


class ArtifactBackend(str, Enum):
    INMEMORY = "inmemory"
    POSTGRES = "postgres"


class ServicesSettings(BaseSettings):
    """ADK Services backend configuration."""

    model_config = SettingsConfigDict(
        env_prefix="NE_SVC_",
        env_nested_delimiter="__",
        extra="ignore",
        frozen=True,
    )

    # Credential Service Backend
    credential_backend: CredentialBackend = Field(
        default=CredentialBackend.INMEMORY,
        description="Credential service backend",
    )

    # Memory Service Backend
    memory_backend: MemoryBackend = Field(
        default=MemoryBackend.INMEMORY,
        description="Memory service backend",
    )

    # Session Service Backend
    session_backend: SessionBackend = Field(
        default=SessionBackend.INMEMORY,
        description="Session service backend",
    )

    # Artifact Service Backend
    artifact_backend: ArtifactBackend = Field(
        default=ArtifactBackend.INMEMORY,
        description="Artifact service backend",
    )

    # VertexAI Configuration
    vertex_project_id: str | None = Field(default=None, description="VertexAI project ID")
    vertex_location: str | None = Field(default=None, description="VertexAI location")
    vertex_agent_engine_id: str | None = Field(default=None, description="VertexAI Agent Engine ID")

    # Session Title Auto-Generation Inspector
    # 反应式触发（首条 user 消息）由 PostgresSessionService 内联完成；
    # 这里的巡检负责：(a) 为历史 / 失败 session 补齐标题；(b) 在事件量显著增长后刷新。
    # 仅处理 metadata.title_source == "auto"（含缺省默认值），永不覆盖 manual / legacy。
    session_title_inspect_enabled: bool = Field(
        default=True,
        description="Enable periodic session-title backfill/refresh job",
    )
    session_title_inspect_interval: int = Field(
        default=300,
        description="Tick interval seconds (default 5min)",
    )
    session_title_inspect_concurrency: int = Field(
        default=2,
        description="Max concurrent LLM title generations per tick",
    )
    session_title_inspect_batch_size: int = Field(
        default=20,
        description="Max sessions inspected per tick",
    )
    session_title_inspect_min_events: int = Field(
        default=1,
        description="Minimum event count required before a session is eligible",
    )
    session_title_inspect_refresh_event_delta: int = Field(
        default=20,
        description="Refresh existing auto-title once max(sequence_num) grew by this many events",
    )
    session_title_inspect_max_attempts: int = Field(
        default=5,
        description="Skip session after this many consecutive generation failures",
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
            YamlDictSource(settings_cls, get_yaml_section("services")),
            file_secret_settings,
        )
