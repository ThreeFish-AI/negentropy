"""Memory Phase 5 Feature Flags.

承载 Phase 5 高级特性的配置开关：F1 HippoRAG / F2 Reflexion / F3 Memify / F4 Presidio。
所有特性默认关闭、向后兼容。

env 前缀 ``NE_MEMORY_``；YAML 节点 ``memory:``。
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict


class HippoRAGSettings(BaseSettings):
    """F1 HippoRAG PPR-Boosted Hybrid Retrieval."""

    model_config = SettingsConfigDict(extra="ignore", frozen=True)

    enabled: bool = Field(default=False, description="是否启用 PPR 通道（默认关闭，灰度白名单优先）")
    depth: int = Field(default=2, ge=1, le=5, description="BFS 扩散深度")
    alpha: float = Field(default=0.5, ge=0.0, le=1.0, description="PageRank 衰减系数")
    rrf_k: int = Field(default=60, ge=1, description="Reciprocal Rank Fusion 常数")
    timeout_ms: int = Field(default=120, ge=10, description="Cypher 单次扩散超时；超时降级回 Hybrid")
    seed_top_k: int = Field(default=5, ge=1, description="Entity linker 取 top-K 种子节点")
    seed_threshold: float = Field(default=0.75, ge=0.0, le=1.0, description="种子链接 cosine 阈值")
    min_kg_associations: int = Field(default=100, ge=0, description="启动期门控：KG 关联数低于此值强制关闭")
    gray_users: list[str] = Field(default_factory=list, description="灰度白名单 user_id；为空表示对全部启用用户生效")


class ReflectionSettings(BaseSettings):
    """F2 Reflexion Episodic Replay."""

    model_config = SettingsConfigDict(extra="ignore", frozen=True)

    enabled: bool = Field(default=False, description="是否启用失败反思生成 + Few-Shot 召回")
    dedup_window_days: int = Field(default=7, ge=1, description="反思去重时间窗口（天）")
    dedup_cosine: float = Field(default=0.92, ge=0.5, le=1.0, description="反思 query embedding 簇判定阈值")
    daily_limit_per_user: int = Field(default=10, ge=1, description="单用户单日反思生成上限")
    fewshot_k: int = Field(default=2, ge=1, description="Few-Shot 注入条数")
    budget_ratio: float = Field(default=0.10, ge=0.0, le=0.5, description="反思 token 预算占 memory_tokens 比例")
    min_intent_confidence: float = Field(
        default=0.55, ge=0.0, le=1.0, description="Query Intent 置信度门槛（procedural/episodic 才注入）"
    )
    max_inflight_tasks: int = Field(
        default=8,
        ge=1,
        description=(
            "后台反思任务并发上限。超过该值时新触发的失败反馈被静默丢弃，"
            "避免反馈风暴下 LLM 调用扇出失控（每任务最多 1+2+4s 退避）。"
        ),
    )


class ConsolidationSettings(BaseSettings):
    """F3 Memify Consolidation Pipeline."""

    model_config = SettingsConfigDict(extra="ignore", frozen=True)

    legacy: bool = Field(default=False, description="True 回退到 Phase 4 硬编码两步（fact_extract → auto_link）")
    policy: str = Field(default="serial", description="serial | parallel | fail_tolerant")
    timeout_per_step_ms: int = Field(default=30000, ge=100, description="单 step 超时")
    steps: list[str] = Field(
        default_factory=lambda: ["fact_extract", "auto_link"],
        description="启用的 step 列表，按顺序执行；默认与 Phase 4 行为一致",
    )


class PIISettings(BaseSettings):
    """F4 Presidio 生产级 PII 治理。"""

    model_config = SettingsConfigDict(extra="ignore", frozen=True)

    engine: str = Field(default="regex", description="regex | presidio；默认向后兼容")
    policy: str = Field(default="mark", description="mark | mask | anonymize（写入策略）")
    languages: list[str] = Field(default_factory=lambda: ["en", "zh"], description="Presidio analyzer 语言")
    score_threshold: float = Field(default=0.6, ge=0.0, le=1.0, description="Presidio 置信度阈值")
    gatekeeper_enabled: bool = Field(default=False, description="检索路径是否启用 PIIGatekeeper")
    acl_role_threshold: str = Field(default="editor", description="低于此角色看到 anonymized 副本")
    allow_engine_fallback: bool = Field(
        default=False,
        description=(
            "engine='presidio' 初始化失败时是否允许静默降级到 regex；默认 False"
            "（保密性优先，缺模型直接抛错），运维确认可降级时显式置 True。"
        ),
    )


class MemorySettings(BaseSettings):
    """Memory 子系统配置 — Phase 5 高级特性。"""

    model_config = SettingsConfigDict(
        env_prefix="NE_MEMORY_",
        env_nested_delimiter="__",
        extra="ignore",
        frozen=True,
    )

    hipporag: HippoRAGSettings = Field(default_factory=HippoRAGSettings)
    reflection: ReflectionSettings = Field(default_factory=ReflectionSettings)
    consolidation: ConsolidationSettings = Field(default_factory=ConsolidationSettings)
    pii: PIISettings = Field(default_factory=PIISettings)

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
            YamlDictSource(settings_cls, get_yaml_section("memory")),
            file_secret_settings,
        )


__all__ = [
    "MemorySettings",
    "HippoRAGSettings",
    "ReflectionSettings",
    "ConsolidationSettings",
    "PIISettings",
]
