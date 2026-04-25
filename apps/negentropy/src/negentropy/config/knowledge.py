"""
Knowledge Configuration.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, SecretStr
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict


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
                server_name="negentropy-perceives",
                tool_name="parse_webpage_to_markdown",
                timeout_ms=60_000,
            ),
            secondary=DefaultExtractorTargetSettings(
                server_name="negentropy-perceives",
                tool_name="parse_webpages_to_markdown",
                timeout_ms=120_000,
            ),
        )
    )
    file_pdf: DefaultExtractorRouteSettings = Field(
        default_factory=lambda: DefaultExtractorRouteSettings(
            primary=DefaultExtractorTargetSettings(
                server_name="negentropy-perceives",
                tool_name="parse_pdf_to_markdown",
                timeout_ms=300_000,
            ),
            secondary=DefaultExtractorTargetSettings(
                server_name="negentropy-perceives",
                tool_name="parse_pdfs_to_markdown",
                timeout_ms=600_000,
            ),
        )
    )


class WikiRevalidateSettings(BaseModel):
    """Wiki SSG ISR 主动 revalidate 触发配置。

    publish/unpublish 完成后，后端会向 ``url`` 发起 POST 通知 SSG 立即重渲染
    （相比仅靠 5 分钟 ISR 窗口被动等更新，UX 更新鲜）。

    所有字段可选；未配置 ``url`` 则跳过 webhook（行为与原有"被动 ISR"等价，
    不阻塞发布主链路）。
    """

    url: str | None = Field(
        default=None,
        description="SSG revalidate 端点完整 URL，例如 https://wiki.example.com/api/revalidate",
    )
    secret: SecretStr | None = Field(
        default=None,
        description="HMAC 签名密钥；与 SSG 路由共享。未配置则跳过签名头。",
    )
    timeout_seconds: float = Field(
        default=5.0,
        description="单次 POST 超时秒数。失败仅 WARN 不阻塞发布。",
    )


class KnowledgeSettings(BaseSettings):
    """Knowledge 相关后台配置。"""

    model_config = SettingsConfigDict(
        env_prefix="NE_KNOWLEDGE_",
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
        frozen=True,
    )

    default_extractor_routes: DefaultExtractorRoutesSettings = Field(
        default_factory=DefaultExtractorRoutesSettings,
    )
    wiki_revalidate: WikiRevalidateSettings = Field(
        default_factory=WikiRevalidateSettings,
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
            YamlDictSource(settings_cls, get_yaml_section("knowledge")),
            file_secret_settings,
        )
