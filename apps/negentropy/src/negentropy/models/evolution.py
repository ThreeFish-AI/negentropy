"""自进化子系统数据模型 — 进化提案登记簿 + 记忆配置版本表。

设计蓝图：``docs/concepts/design/self-evolving-agents.md``（四层自进化架构）。
第一切片仅落「记忆检索权重」面的自进化闭环；本模块两张表设计为泛型可扩展
（EvolutionProposal 的 target_kind/target_ref/payload 已与具体面解耦，后续
agent_prompt / skill_template 面直接复用同表，仅扩 target_kind 白名单值）。

范式对齐：
- ``skill_versions``（models/skill.py）的 SemVer + JSONB snapshot + UNIQUE(parent,version)；
- ``routine`` 子系统的 status 用 String + 代码常量白名单（非 PG ENUM，便于灰度期调整）。

参考文献：
[1] L. A. Agrawal et al., "GEPA: Reflective prompt evolution can outperform
    reinforcement learning," in Proc. ICLR (Oral), 2026. arXiv:2507.19457.
    (轨迹, 标量分, 反思文本) 三元组驱动反思式变异。
[2] Q. Zhang et al., "Agentic context engineering," in Proc. ICLR, 2026.
    arXiv:2510.04618. Curator 确定性合并 + delta 更新。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, Index, String, Text, UniqueConstraint
from sqlalchemy import text as _sa_text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import NEGENTROPY_SCHEMA, TIMESTAMP, Base, TimestampMixin, UUIDMixin

# =============================================================================
# 部分索引 WHERE 子句（集中常量，便于审计/改值；须在类定义前可解析）
# =============================================================================


def sa_text_non_terminal():
    """部分唯一索引的 WHERE 子句：status 属于非终态集（含 runtime_canary）。"""
    return _sa_text("status IN ('draft','shadow_eval','pending_approval','canary','runtime_canary')")


def sa_text_is_active_true():
    """部分唯一索引的 WHERE 子句：is_active 为真。"""
    return _sa_text("is_active = TRUE")


# =============================================================================
# 白名单常量（代码层单一事实源；新增 target_kind 在此追加）
# =============================================================================

# target_kind —— retrieval_config（检索权重）/ skill_template（Skill prompt）
#                / memory_pipeline_prompt（抽取·反思·摘要 prompt）
TARGET_KIND_RETRIEVAL_CONFIG = "retrieval_config"
TARGET_KIND_SKILL_TEMPLATE = "skill_template"
TARGET_KIND_MEMORY_PIPELINE_PROMPT = "memory_pipeline_prompt"
TARGET_KIND_BUILTIN_TOOL_CONFIG = "builtin_tool_config"
TARGET_KIND_KNOWLEDGE_STRATEGY = "knowledge_strategy"
ALLOWED_TARGET_KINDS: tuple[str, ...] = (
    TARGET_KIND_RETRIEVAL_CONFIG,
    TARGET_KIND_SKILL_TEMPLATE,
    TARGET_KIND_MEMORY_PIPELINE_PROMPT,
    TARGET_KIND_BUILTIN_TOOL_CONFIG,
    TARGET_KIND_KNOWLEDGE_STRATEGY,
)

# target_ref —— retrieval_config 面 = config_scope（如 "retrieval"）

# origin —— 提案来源
ORIGIN_REFLECTION = "reflection"
ORIGIN_TELEMETRY_ANOMALY = "telemetry_anomaly"
ORIGIN_HUMAN = "human"
ALLOWED_PROPOSAL_ORIGINS: tuple[str, ...] = (ORIGIN_REFLECTION, ORIGIN_TELEMETRY_ANOMALY, ORIGIN_HUMAN)

# status —— 状态机取值（draft→shadow_eval→pending_approval|canary→promoted|rejected|rolled_back）
STATUS_DRAFT = "draft"
STATUS_SHADOW_EVAL = "shadow_eval"
STATUS_PENDING_APPROVAL = "pending_approval"
STATUS_CANARY = "canary"
STATUS_RUNTIME_CANARY = "runtime_canary"  # 离线门通过后的在线分桶灰度窗口（综述 §9.3 受控发布）
STATUS_PROMOTED = "promoted"
STATUS_REJECTED = "rejected"
STATUS_ROLLED_BACK = "rolled_back"
# 非终态集合（单在途不变量覆盖集）
PROPOSAL_NON_TERMINAL: tuple[str, ...] = (
    STATUS_DRAFT,
    STATUS_SHADOW_EVAL,
    STATUS_PENDING_APPROVAL,
    STATUS_CANARY,
    STATUS_RUNTIME_CANARY,
)
PROPOSAL_TERMINAL: tuple[str, ...] = (STATUS_PROMOTED, STATUS_REJECTED, STATUS_ROLLED_BACK)

# risk_level
RISK_LOW = "low"
RISK_MEDIUM = "medium"
RISK_HIGH = "high"

# memory_config_versions.config_scope
CONFIG_SCOPE_RETRIEVAL = "retrieval"
# memory_config_versions.origin
CONFIG_ORIGIN_CODE_SYNC = "code_sync"
CONFIG_ORIGIN_EVOLUTION = "evolution"
CONFIG_ORIGIN_MANUAL = "manual"


# =============================================================================
# 表 1：evolution_proposals（统一登记簿）
# =============================================================================


class EvolutionProposal(Base, UUIDMixin, TimestampMixin):
    """进化提案登记簿（状态机载体）。

    状态流转：``draft → shadow_eval → (low+auto: canary | else: pending_approval)
    → promoted | rejected | rolled_back``。每 ``target_ref`` 至多一个非终态提案
    （``uq_evolution_proposals_one_inflight`` 部分唯一索引兜底）。

    ``payload`` 为结构化 diff，随 target_kind 不同 schema 不同：
    - ``retrieval_config``：``{"semantic_weight": float, "keyword_weight": float}``。
    """

    __tablename__ = "evolution_proposals"

    target_kind: Mapped[str] = mapped_column(String(64), nullable=False, comment="白名单：retrieval_config")
    target_ref: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        comment="target 稳定标识；retrieval_config 面 = config_scope，如 'retrieval'",
    )
    base_version: Mapped[str] = mapped_column(String(50), nullable=False, comment="基线 SemVer")
    proposed_version: Mapped[str] = mapped_column(String(50), nullable=False, comment="候选 SemVer")

    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default="{}", comment="结构化 diff；schema 随 target_kind"
    )
    origin: Mapped[str] = mapped_column(String(32), nullable=False, comment="reflection|telemetry_anomaly|human")
    rationale: Mapped[str | None] = mapped_column(Text)
    evidence: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default="{}",
        comment="触发本提案的指标快照 {zero_hit_rate, helpful_ratio, referenced_rate, window, n}",
    )

    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=STATUS_DRAFT,
        server_default=STATUS_DRAFT,
        comment="draft|shadow_eval|pending_approval|canary|promoted|rejected|rolled_back",
    )

    shadow_eval_result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    canary_config: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, comment="{bucket_ratio, window_seconds, started_at, min_samples}"
    )
    canary_metrics: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, comment="canary 窗口结束时的在线指标快照 {candidate, baseline, n_candidate, n_baseline}"
    )

    risk_level: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=RISK_MEDIUM,
        server_default=RISK_MEDIUM,
        comment="low|medium|high；low+auto 档可跳过 pending_approval 直入 canary",
    )
    decided_by: Mapped[str | None] = mapped_column(String(255))
    decided_at: Mapped[datetime | None] = mapped_column(TIMESTAMP, nullable=True)

    __table_args__ = (
        Index("ix_evolution_proposals_target_status", "target_kind", "status"),
        Index("ix_evolution_proposals_target_ref", "target_ref"),
        # 单在途不变量：每 target_ref 至多一个非终态提案（部分唯一索引）
        Index(
            "uq_evolution_proposals_one_inflight",
            "target_ref",
            unique=True,
            postgresql_where=sa_text_non_terminal(),
        ),
        {"schema": NEGENTROPY_SCHEMA},
    )


# =============================================================================
# 表 2：memory_config_versions（记忆配置版本表，retrieval 面专用）
# =============================================================================


class MemoryConfigVersion(Base, UUIDMixin, TimestampMixin):
    """记忆配置版本表（retrieval 面第一切片）。

    snapshot schema：``{"semantic_weight": float, "keyword_weight": float}``，后续可扩 top_k 等。
    每个 ``config_scope`` 至多一行 ``is_active=true``（``uq_memory_config_active`` 部分唯一索引）。
    promote / rollback = 新写一行 + 翻转 is_active 指针（不删旧行，保留全历史）。
    """

    __tablename__ = "memory_config_versions"

    config_scope: Mapped[str] = mapped_column(String(64), nullable=False, comment="本切片仅 'retrieval'")
    version: Mapped[str] = mapped_column(String(50), nullable=False, comment="SemVer")
    snapshot: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="{semantic_weight, keyword_weight}；后续可扩"
    )
    origin: Mapped[str] = mapped_column(String(32), nullable=False, comment="code_sync|evolution|manual")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    rationale: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        UniqueConstraint("config_scope", "version", name="uq_memory_config_scope_version"),
        # is_active 单一性：每个 config_scope 至多一行 is_active=true（部分唯一索引）
        Index(
            "uq_memory_config_active",
            "config_scope",
            unique=True,
            postgresql_where=sa_text_is_active_true(),
        ),
        {"schema": NEGENTROPY_SCHEMA},
    )
