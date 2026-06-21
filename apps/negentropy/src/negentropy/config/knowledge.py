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
                timeout_ms=3_600_000,  # 1h，对齐 YAML timeout_long_ms（大 PDF 分批串行 + 续传）
            ),
            secondary=DefaultExtractorTargetSettings(
                server_name="negentropy-perceives",
                tool_name="parse_pdfs_to_markdown",
                timeout_ms=7_200_000,  # 2h：批量 PDF（与 YAML timeout_xlong_ms 对齐）
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


class WikiRedeploySettings(BaseModel):
    """Wiki 静态站点「内容导出 + 重建」触发配置。

    wiki 纯静态化后不再有运行时 ISR；publish/unpublish 完成后，后端通过本配置
    指向的触发端点（如 GitHub ``repository_dispatch`` 或自建 webhook）驱动 CI：
    重新导出静态内容包 → 提交 ``content/`` → 重建并重新部署 wiki。

    所有字段可选；未配置 ``url`` 则跳过（等价被动，等下一次定时/手动重建）。
    """

    url: str | None = Field(
        default=None,
        description=(
            "触发端点 URL。GitHub repository_dispatch 形如 https://api.github.com/repos/{owner}/{repo}/dispatches。"
        ),
    )
    event_type: str = Field(
        default="wiki_content_export",
        description="repository_dispatch 的 event_type（CI workflow 据此筛选）。",
    )
    token: SecretStr | None = Field(
        default=None,
        description="触发端点鉴权 token（GitHub dispatch 需 PAT/GITHUB_TOKEN，Bearer 头）。",
    )
    secret: SecretStr | None = Field(
        default=None,
        description="可选 HMAC 签名密钥（自建 webhook 鉴权用）。未配置则跳过签名头。",
    )
    timeout_seconds: float = Field(
        default=5.0,
        description="单次 POST 超时秒数。失败仅 WARN 不阻塞发布。",
    )


class WikiExportSettings(BaseModel):
    """Wiki 静态内容导出配置。

    wiki 纯静态站独立部署，运行期不连主站 DB。导出 entry markdown 时，内嵌的
    衍生资产图片（``/api/documents/{doc}/assets/{file}``）需重写为可被 wiki
    站点访问的绝对 URL。

    GCS 退役（#932）后，资产字节存于主站 PostgreSQL，由主站公开端点
    ``/knowledge/wiki/documents/{doc}/assets/{file}`` 提供（从 bytea 流式返回）。
    ``asset_base_url`` 即该端点的主站可达前缀。

    图片处理有两条互斥路径：

    - ``bake_assets=True``（**自包含**，公网 Pages / 本地主站推荐）：导出期把资产
      **字节**写入 ``content/assets/{doc}/{file}`` 静态文件，markdown 图片改为
      相对路径 ``/assets/{doc}/{file}``。产物零主站依赖，可发布到任意公网静态托管
      （如 GitHub Pages），即使主站不公网可达图片也正常显示。
    - ``bake_assets=False`` + ``asset_base_url``（**URL 重写**，分域反代部署）：
      图片重写为 ``{asset_base_url}/knowledge/wiki/documents/{doc}/assets/{file}``
      绝对 URL（``asset_base_url`` 为空则为同源相对路径）。运行期由主站端点供图，
      要求主站对访客可达。
    """

    bake_assets: bool = Field(
        default=False,
        description=(
            "True：导出期把图片字节烘焙为 content/assets/ 静态文件、markdown 改相对路径"
            "（自包含、零主站依赖，公网 Pages 部署推荐）；False：走 asset_base_url URL 重写。"
        ),
    )
    asset_base_url: str | None = Field(
        default=None,
        description=(
            "bake_assets=False 时生效：主站可达前缀，把 wiki markdown 资产图片重写为绝对 URL，"
            "例如 https://api.example.com。末尾斜杠自动去除。"
        ),
    )


class WikiPagesPublishSettings(BaseModel):
    """Wiki 本地自动发布到静态托管（如 GitHub Pages）配置。

    适用「主站纯本地（DB 不公网暴露）→ publish 后本地导出+构建+推送到独立 Pages 仓库」
    场景：云端 CI 连不上本地 DB，故由后端在 publish 后**后台 spawn** 本地脚本
    （``script``）完成「导出（烘焙图片）→ next build → 推 out/ 到目标仓库分支」。

    与 ``wiki_redeploy``（webhook → 云端 CI）正交：本地用本块、分域/云端用 webhook。

    **默认 ``enabled=False``** —— 不影响生产与现有 publish 流程；仅本地显式开启。
    spawn 为 fire-and-forget（不阻塞 publish 返回、失败仅 WARN）。
    """

    enabled: bool = Field(
        default=False,
        description="True 时 publish 后后台 spawn script 自动发布到 Pages；默认关闭。",
    )
    script: str = Field(
        default="scripts/publish-wiki-pages.sh",
        description="发布脚本路径（相对仓库根）。仅 enabled 时执行。",
    )
    repo: str | None = Field(
        default=None,
        description=(
            "目标 Pages 仓库（透传脚本 env WIKI_PAGES_REPO），"
            "如 git@github.com:ThreeFish-AI/threefish-ai.github.io.git。"
        ),
    )
    branch: str = Field(
        default="main",
        description="目标 Pages 分支（透传脚本 env WIKI_PAGES_BRANCH）。",
    )


class KnowledgeMcpSettings(BaseModel):
    """知识库检索 MCP 端点配置（供 Routine 的 Claude Code 经 streamable-HTTP 接入）。

    端点由常驻引擎进程内挂载（``/mcp/knowledge``），凭证不出引擎进程 ——
    Claude Code 仅持低权限只读 bearer token。

    - ``self_base_url``：引擎自身可达地址（如 ``http://127.0.0.1:3292``）。
      由 ``negentropy serve`` 启动时按端口自动推导（env
      ``NE_KNOWLEDGE_MCP__SELF_BASE_URL``）；缺席时 MCP 全链路优雅 no-op
      （非 serve 启动场景，如裸 adk web / 单测）。
    - ``auth_token``：静态部署 token；缺省则每进程随机生成（重启轮换）。
    """

    enabled: bool = True
    self_base_url: str | None = None
    auth_token: SecretStr | None = None
    default_top_k: int = Field(default=5, ge=1, le=20)


class KnowledgeFeatureFlags(BaseModel):
    """联邦知识图谱与跨 Corpus 检索的 feature flag

    控制 Phase 1-3 的渐进上线：
      - enable_canonical_linker：开关 canonical 后台合并 batch（默认开，只写不读）
      - enable_cross_corpus_kg：开关 HybridPlanner 路径与 @graph mention 透传
      - cross_corpus_kg_app_allowlist：按 app_name 白名单灰度
      - cross_corpus_kg_user_sample_rate：按 user_id hash 灰度（0.0-1.0）
    """

    enable_canonical_linker: bool = True
    enable_cross_corpus_kg: bool = False
    cross_corpus_kg_app_allowlist: list[str] = Field(default_factory=list)
    cross_corpus_kg_user_sample_rate: float = Field(default=0.0, ge=0.0, le=1.0)


class KnowledgeSettings(BaseSettings):
    """Knowledge 相关后台配置。"""

    model_config = SettingsConfigDict(
        env_prefix="NE_KNOWLEDGE_",
        env_nested_delimiter="__",
        extra="ignore",
        frozen=True,
    )

    max_file_size_mb: int = Field(
        default=200,
        ge=1,
        le=1024,
        description="Knowledge 文件上传大小上限 (MB)。",
    )

    default_extractor_routes: DefaultExtractorRoutesSettings = Field(
        default_factory=DefaultExtractorRoutesSettings,
    )
    wiki_revalidate: WikiRevalidateSettings = Field(
        default_factory=WikiRevalidateSettings,
    )
    wiki_redeploy: WikiRedeploySettings = Field(
        default_factory=WikiRedeploySettings,
    )
    wiki_export: WikiExportSettings = Field(
        default_factory=WikiExportSettings,
    )
    wiki_pages_publish: WikiPagesPublishSettings = Field(
        default_factory=WikiPagesPublishSettings,
    )
    feature_flags: KnowledgeFeatureFlags = Field(
        default_factory=KnowledgeFeatureFlags,
    )
    mcp: KnowledgeMcpSettings = Field(
        default_factory=KnowledgeMcpSettings,
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
