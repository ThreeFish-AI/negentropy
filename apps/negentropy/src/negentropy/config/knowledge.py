"""
Knowledge Configuration.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DefaultExtractorTargetSettings(BaseModel):
    """后台默认的 MCP Tool 绑定。"""

    server_name: str
    tool_name: str
    enabled: bool = True
    timeout_ms: int | None = None
    tool_options: dict[str, object] = Field(default_factory=dict)


class DefaultExtractorRouteSettings(BaseModel):
    """单一路由的主备默认配置。"""

    primary: DefaultExtractorTargetSettings | None = None
    secondary: DefaultExtractorTargetSettings | None = None


class DefaultExtractorRoutesSettings(BaseModel):
    """Document Extraction Settings 默认路由集合。"""

    url: DefaultExtractorRouteSettings = Field(
        default_factory=lambda: DefaultExtractorRouteSettings(
            primary=DefaultExtractorTargetSettings(
                server_name="data-extractor",
                tool_name="convert_webpage_to_markdown",
                timeout_ms=60_000,
            ),
            secondary=DefaultExtractorTargetSettings(
                server_name="data-extractor",
                tool_name="batch_convert_webpages_to_markdown",
                timeout_ms=120_000,
            ),
        )
    )
    file_pdf: DefaultExtractorRouteSettings = Field(
        default_factory=lambda: DefaultExtractorRouteSettings(
            primary=DefaultExtractorTargetSettings(
                server_name="data-extractor",
                tool_name="convert_pdf_to_markdown",
                timeout_ms=300_000,
            ),
            secondary=DefaultExtractorTargetSettings(
                server_name="data-extractor",
                tool_name="batch_convert_pdfs_to_markdown",
                timeout_ms=600_000,
            ),
        )
    )


class KnowledgeSettings(BaseSettings):
    """Knowledge 相关后台配置。"""

    model_config = SettingsConfigDict(
        env_prefix="NE_KNOWLEDGE_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    default_extractor_routes: DefaultExtractorRoutesSettings = Field(
        default_factory=DefaultExtractorRoutesSettings,
    )
