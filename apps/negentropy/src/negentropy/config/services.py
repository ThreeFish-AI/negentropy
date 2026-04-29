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
    GCS = "gcs"


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

    # GCS Configuration
    gcs_bucket_name: str | None = Field(default=None, description="GCS bucket name for artifact storage")

    # VertexAI Configuration
    vertex_project_id: str | None = Field(default=None, description="VertexAI project ID")
    vertex_location: str | None = Field(default=None, description="VertexAI location")
    vertex_agent_engine_id: str | None = Field(default=None, description="VertexAI Agent Engine ID")

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
