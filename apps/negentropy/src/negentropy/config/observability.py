"""
Observability Configuration.

Configures connection settings for external observability platforms (Langfuse, OTLP collectors).
"""

from typing import Optional

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class ObservabilitySettings(BaseSettings):
    """
    Observability settings (OpenTelemetry / Langfuse).
    Prefix: NE_OBSERVABILITY_
    """

    model_config = SettingsConfigDict(
        env_prefix="NE_OBSERVABILITY_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    # Langfuse Integration
    langfuse_host: str = Field(
        default="https://cloud.langfuse.com",
        description="Langfuse API Host (e.g. https://cloud.langfuse.com or self-hosted)",
    )
    langfuse_public_key: Optional[str] = Field(
        default=None,
        description="Langfuse Public Key (pk-lf-...)",
    )
    langfuse_secret_key: Optional[SecretStr] = Field(
        default=None,
        description="Langfuse Secret Key (sk-lf-...)",
    )
    langfuse_enabled: bool = Field(
        default=True,
        description="Enable Langfuse export if keys are present",
    )
