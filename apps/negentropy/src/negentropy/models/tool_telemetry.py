"""工具调用遥测模型 — tool_invocations 事实表 + tool_stats_daily 聚合表。

设计蓝图：``docs/concepts/design/self-evolving-agents.md`` §3（遥测子系统）。
Phase 1 遥测地基——ADK callback 采集器写入 tool_invocations，每日聚合 job 汇入
tool_stats_daily。是后续 agent/skill/knowledge 面 GEPA 提案器的共同证据源。

范式对齐 ``models/evolution.py``：模块级白名单常量 + Base+UUIDMixin+TimestampMixin
+ NEGENTROPY_SCHEMA + __table_args__ 多 Index 元组。String + 代码常量（非 PG ENUM）。

参考文献：
[1] C. Jiang et al., "Self-Improving Agents in the Era of Experience,"
    2026. §3 遥测子系统（tool_invocations 统一事实表）。
[2] OpenTelemetry GenAI semconv, "execute_tool" span.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin

# =============================================================================
# 白名单常量（代码层单一事实源）
# =============================================================================

# caller_kind —— 调用源
CALLER_KIND_ADK_AGENT = "adk_agent"  # ADK callback（本切片主源）
CALLER_KIND_ROUTINE = "routine"  # 后续切片：streaming_persister 旁路
CALLER_KIND_MCP = "mcp"  # 后续切片：McpToolExecutionService 旁路
ALLOWED_CALLER_KINDS: tuple[str, ...] = (CALLER_KIND_ADK_AGENT, CALLER_KIND_ROUTINE, CALLER_KIND_MCP)

# tool_kind —— 工具类别（_resolve_tool_kind 输出）
TOOL_KIND_ADK_FUNCTION = "adk_function"  # 项目 FunctionTool（agents/tools/*）
TOOL_KIND_BUILTIN = "builtin"  # ADK 内置（transfer_to_agent / builtins）
TOOL_KIND_SKILL = "skill"  # expand_skill / list_available_skills
TOOL_KIND_MCP = "mcp"  # MCP 工具（当前未接入 agents/）
ALLOWED_TOOL_KINDS: tuple[str, ...] = (
    TOOL_KIND_ADK_FUNCTION,
    TOOL_KIND_BUILTIN,
    TOOL_KIND_SKILL,
    TOOL_KIND_MCP,
)

# status —— 调用结果
STATUS_SUCCESS = "success"
STATUS_ERROR = "error"
STATUS_SKIPPED = "skipped"  # before_tool_callback 短路返回（callback 自身处理）
ALLOWED_STATUSES: tuple[str, ...] = (STATUS_SUCCESS, STATUS_ERROR, STATUS_SKIPPED)

# outcome_source —— 评分来源（本切片留 none，后续 agent/skill 面填）
OUTCOME_SOURCE_NONE = "none"
OUTCOME_SOURCE_ROUTINE_EVAL = "routine_eval"
OUTCOME_SOURCE_USER_FEEDBACK = "user_feedback"


# =============================================================================
# 表 1：tool_invocations（事实表，append-only）
# =============================================================================


class ToolInvocation(Base, UUIDMixin, TimestampMixin):
    """单次工具调用事实记录。

    三源写入：ADK callback（caller_kind=adk_agent）、Routine streaming_persister 旁路
    （routine）、McpToolExecutionService 旁路（mcp）。本切片仅 ADK 源。
    ``tokens_in/out`` 与 ``cost_usd`` 在 ADK tool callback 不可获取（仅 LiteLLM LLM 层），
    本切片置 NULL，留 ``trace_id`` 作后续 LiteLLM 关联回填 hook。
    """

    __tablename__ = "tool_invocations"

    caller_kind: Mapped[str] = mapped_column(
        String(32), nullable=False, comment="adk_agent|routine|mcp；本切片默认 adk_agent"
    )
    agent_name: Mapped[str | None] = mapped_column(
        String(128), comment="五翼 Faculty 名 / root_agent 名；ADK 取 invocation_context.agent_name"
    )
    thread_id: Mapped[str | None] = mapped_column(String(128), comment="ADK session.id")
    routine_iteration_id: Mapped[str | None] = mapped_column(String(128), comment="Routine 旁路切片填；ADK 源 NULL")

    tool_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    tool_ref: Mapped[str] = mapped_column(String(255), nullable=False, comment="BaseTool.name")
    tool_version: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="unversioned",
        server_default="'unversioned'",
        comment="SemVer；ADK FunctionTool 无版本元数据，默认 unversioned",
    )
    skill_ref: Mapped[str | None] = mapped_column(String(255), comment="expand_skill 触发时关联的 skill_id；否则 NULL")

    status: Mapped[str] = mapped_column(String(32), nullable=False)
    latency_ms: Mapped[int | None] = mapped_column(
        Integer, comment="before→after monotonic 差值（毫秒）；error 路径可能 NULL"
    )
    error_class: Mapped[str | None] = mapped_column(String(255))

    # 体积保护：input/output 截断到 16KB + sha256[:12] 短 hash（_make_digest）
    input_digest: Mapped[str | None] = mapped_column(Text)
    output_digest: Mapped[str | None] = mapped_column(Text)

    # 本切片置 NULL（LiteLLM 层才有 token/cost）；留 trace_id 作关联 hook
    tokens_in: Mapped[int | None] = mapped_column(Integer)
    tokens_out: Mapped[int | None] = mapped_column(Integer)
    cost_usd: Mapped[float | None] = mapped_column(Numeric(12, 6))

    trace_id: Mapped[str | None] = mapped_column(String(64))
    span_id: Mapped[str | None] = mapped_column(String(32))

    canary_assignment: Mapped[str | None] = mapped_column(
        String(128), comment="后续 evolution canary 面：bucket 标识；本切片 NULL"
    )
    outcome_score: Mapped[float | None] = mapped_column(Numeric(4, 3), comment="0~1 标量分；后续 agent/skill 面填")
    outcome_source: Mapped[str] = mapped_column(
        String(32), nullable=False, default=OUTCOME_SOURCE_NONE, server_default=OUTCOME_SOURCE_NONE
    )

    __table_args__ = (
        Index("ix_tool_invocations_ref_version", "tool_ref", "tool_version"),
        Index("ix_tool_invocations_created_at", "created_at"),
        Index("ix_tool_invocations_caller_status", "caller_kind", "status"),
        {"schema": NEGENTROPY_SCHEMA},
    )


# =============================================================================
# 表 2：tool_stats_daily（聚合表，upsert）
# =============================================================================


class ToolStatsDaily(Base, UUIDMixin, TimestampMixin):
    """每日工具调用统计聚合（按 tool_ref + version + stat_date 分桶）。

    聚合 job（tool_stats_aggregate handler）每日从 tool_invocations 聚合，覆盖式 upsert
    （ON CONFLICT DO UPDATE SET = EXCLUDED.*，跨日重跑幂等）。
    是后续 GEPA proposer 的工具效果证据源（成功率/p50·p95 延迟/成本/调用量）。
    """

    __tablename__ = "tool_stats_daily"

    tool_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    tool_version: Mapped[str] = mapped_column(String(50), nullable=False)
    stat_date: Mapped[date] = mapped_column(Date, nullable=False)
    invocation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    p50_latency_ms: Mapped[float | None] = mapped_column(Numeric(10, 2))
    p95_latency_ms: Mapped[float | None] = mapped_column(Numeric(10, 2))
    total_cost_usd: Mapped[float | None] = mapped_column(Numeric(12, 6))

    __table_args__ = (
        UniqueConstraint("tool_ref", "tool_version", "stat_date", name="uq_tool_stats_daily_ref_version_date"),
        {"schema": NEGENTROPY_SCHEMA},
    )
