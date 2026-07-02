"""
Observability Configuration.

Configures connection settings for external observability platforms (Langfuse, OTLP collectors).
"""

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict


class ObservabilitySettings(BaseSettings):
    """
    Observability settings (OpenTelemetry / Langfuse).
    Prefix: NE_OBSERVABILITY_
    """

    model_config = SettingsConfigDict(
        env_prefix="NE_OBSERVABILITY_",
        env_nested_delimiter="__",
        extra="ignore",
        frozen=True,
    )

    # Langfuse Integration
    langfuse_host: str = Field(
        default="https://cloud.langfuse.com",
        description="Langfuse API Host (e.g. https://cloud.langfuse.com or self-hosted)",
    )
    langfuse_public_key: str | None = Field(
        default=None,
        description="Langfuse Public Key (pk-lf-...)",
    )
    langfuse_secret_key: SecretStr | None = Field(
        default=None,
        description="Langfuse Secret Key (sk-lf-...)",
    )
    langfuse_enabled: bool = Field(
        default=True,
        description="Enable Langfuse export if keys are present",
    )
    tool_telemetry_enabled: bool = Field(
        default=False,
        description="工具调用遥测采集总开关（默认关）。关闭时 ADK before/after_tool_callback 不挂载"
        "（make_* 工厂返回 None）+ aggregate job no-op。灰度开启后写入 tool_invocations。",
    )

    @property
    def langfuse_otlp_endpoint(self) -> str:
        """Full Langfuse OTLP endpoint with correct path for HTTP/protobuf."""
        base = self.langfuse_host.rstrip("/")
        return f"{base}/api/public/otel/v1/traces"

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
            YamlDictSource(settings_cls, get_yaml_section("observability")),
            file_secret_settings,
        )
