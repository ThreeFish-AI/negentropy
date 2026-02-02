"""
ADK Services Configuration.
"""

from enum import Enum
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
        env_file=".env",
        env_file_encoding="utf-8",
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
    gcs_bucket_name: Optional[str] = Field(default=None, description="GCS bucket name for artifact storage")

    # VertexAI Configuration
    vertex_project_id: Optional[str] = Field(default=None, description="VertexAI project ID")
    vertex_location: Optional[str] = Field(default=None, description="VertexAI location")
    vertex_agent_engine_id: Optional[str] = Field(default=None, description="VertexAI Agent Engine ID")
