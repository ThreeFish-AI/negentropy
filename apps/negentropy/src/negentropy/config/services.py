"""
ADK Services Configuration.
"""

from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ServicesSettings(BaseSettings):
    """ADK Services backend configuration."""

    model_config = SettingsConfigDict(
        env_prefix="NE_SVC_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Credential Service Backend: postgres | inmemory | session
    credential_backend: str = Field(
        default="inmemory",
        description="Credential service backend (postgres, inmemory, session)",
    )

    # Memory Service Backend: inmemory | vertexai | postgres
    memory_backend: str = Field(
        default="inmemory",
        description="Memory service backend (inmemory, vertexai, postgres)",
    )

    # Session Service Backend: inmemory | vertexai | database | postgres
    session_backend: str = Field(
        default="inmemory",
        description="Session service backend (inmemory, vertexai, database, postgres)",
    )

    # Artifact Service Backend: inmemory | gcs
    artifact_backend: str = Field(
        default="inmemory",
        description="Artifact service backend (inmemory, gcs)",
    )

    # GCS Configuration
    gcs_bucket_name: Optional[str] = Field(default=None, description="GCS bucket name for artifact storage")

    # VertexAI Configuration
    vertex_project_id: Optional[str] = Field(default=None, description="VertexAI project ID")
    vertex_location: Optional[str] = Field(default=None, description="VertexAI location")
    vertex_agent_engine_id: Optional[str] = Field(default=None, description="VertexAI Agent Engine ID")
