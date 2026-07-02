"""tool_invocations 事实表 + tool_stats_daily 聚合表 + seed tool_stats_aggregate job

Revision ID: 0082
Revises: 0081_evolution_subsystem
Create Date: 2026-07-02 00:00:00.000000+00:00

设计动机：
    四层自进化架构（docs/concepts/design/self-evolving-agents.md §3）Phase 1 遥测地基。
    tool_invocations 是工具调用统一事实表（三源：ADK callback / Routine 旁路 / MCP 旁路），
    tool_stats_daily 是每日聚合（成功率/p50·p95 延迟/成本/调用量），供后续 agent/skill/knowledge
    面 GEPA proposer 作工具效果证据源。本迁移只建表 + seed 聚合 job；采集器与消费方在代码层。

    表定义 1:1 对齐 ORM 模型 ``models/tool_telemetry.py``，避免 autogenerate 漂移。

幂等性：
    建表/索引前以 information_schema 探测存在性（仿 0081），便于半失败重试。
    seed 行用 ``WHERE NOT EXISTS`` 守卫幂等。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0082"
down_revision: str | None = "0081"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


# =============================================================================
# 辅助：information_schema 存在性探测（仿 0081）
# =============================================================================


def _table_exists(bind, table_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(f"SELECT 1 FROM information_schema.tables WHERE table_schema = '{SCHEMA}' AND table_name = :n"),
            {"n": table_name},
        ).scalar()
    )


def _index_exists(bind, index_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(f"SELECT 1 FROM pg_indexes WHERE schemaname = '{SCHEMA}' AND indexname = :n"),
            {"n": index_name},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    # -------------------------------------------------------------------------
    # 1) tool_invocations（事实表，append-only）
    # -------------------------------------------------------------------------
    if not _table_exists(bind, "tool_invocations"):
        op.create_table(
            "tool_invocations",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("caller_kind", sa.String(length=32), nullable=False),
            sa.Column("agent_name", sa.String(length=128), nullable=True),
            sa.Column("thread_id", sa.String(length=128), nullable=True),
            sa.Column("routine_iteration_id", sa.String(length=128), nullable=True),
            sa.Column("tool_kind", sa.String(length=32), nullable=False),
            sa.Column("tool_ref", sa.String(length=255), nullable=False),
            sa.Column(
                "tool_version",
                sa.String(length=50),
                nullable=False,
                server_default=sa.text("'unversioned'"),
            ),
            sa.Column("skill_ref", sa.String(length=255), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("latency_ms", sa.Integer(), nullable=True),
            sa.Column("error_class", sa.String(length=255), nullable=True),
            sa.Column("input_digest", sa.Text(), nullable=True),
            sa.Column("output_digest", sa.Text(), nullable=True),
            sa.Column("tokens_in", sa.Integer(), nullable=True),
            sa.Column("tokens_out", sa.Integer(), nullable=True),
            sa.Column("cost_usd", sa.Numeric(precision=12, scale=6), nullable=True),
            sa.Column("trace_id", sa.String(length=64), nullable=True),
            sa.Column("span_id", sa.String(length=32), nullable=True),
            sa.Column("canary_assignment", sa.String(length=128), nullable=True),
            sa.Column("outcome_score", sa.Numeric(precision=4, scale=3), nullable=True),
            sa.Column(
                "outcome_source",
                sa.String(length=32),
                nullable=False,
                server_default=sa.text("'none'"),
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            schema=SCHEMA,
        )
        op.create_index(
            "ix_tool_invocations_ref_version",
            "tool_invocations",
            ["tool_ref", "tool_version"],
            schema=SCHEMA,
        )
        op.create_index("ix_tool_invocations_created_at", "tool_invocations", ["created_at"], schema=SCHEMA)
        op.create_index(
            "ix_tool_invocations_caller_status",
            "tool_invocations",
            ["caller_kind", "status"],
            schema=SCHEMA,
        )

    # -------------------------------------------------------------------------
    # 2) tool_stats_daily（聚合表，upsert）
    # -------------------------------------------------------------------------
    if not _table_exists(bind, "tool_stats_daily"):
        op.create_table(
            "tool_stats_daily",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("tool_ref", sa.String(length=255), nullable=False),
            sa.Column("tool_version", sa.String(length=50), nullable=False),
            sa.Column("stat_date", sa.Date(), nullable=False),
            sa.Column("invocation_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("success_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("error_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("p50_latency_ms", sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column("p95_latency_ms", sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column("total_cost_usd", sa.Numeric(precision=12, scale=6), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            schema=SCHEMA,
        )
        op.create_unique_constraint(
            "uq_tool_stats_daily_ref_version_date",
            "tool_stats_daily",
            ["tool_ref", "tool_version", "stat_date"],
            schema=SCHEMA,
        )

    # -------------------------------------------------------------------------
    # 3) seed tool_stats_aggregate scheduled_task（默认禁用，灰度门控）
    # -------------------------------------------------------------------------
    bind.execute(
        sa.text(
            f"""
            INSERT INTO {SCHEMA}.scheduled_tasks
                (key, handler_kind, trigger_type, interval_seconds, cron_expr,
                 role, scenario, category, display_name, description,
                 payload, max_concurrency, token_budget, enabled, is_system, next_fire_at)
            SELECT 'tool_stats_aggregate', 'tool_stats_aggregate', 'cron', NULL,
                   '5 3 * * *',
                   'supervisor', 'evolution', 'cognitive',
                   :display_name, :description,
                   :payload, 1, NULL, FALSE, TRUE, NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM {SCHEMA}.scheduled_tasks WHERE key = 'tool_stats_aggregate'
            )
            """
        ).bindparams(
            sa.bindparam("display_name", value="Tool Stats Daily Aggregator"),
            sa.bindparam(
                "description",
                value="每日聚合 tool_invocations → tool_stats_daily（成功率/p50p95延迟/成本）。",
            ),
            sa.bindparam(
                "payload",
                value={"job_type": "daily_aggregate", "lookback_days": 1},
                type_=postgresql.JSONB(),
            ),
        )
    )


def downgrade() -> None:
    # 遵循 AGENTS.md「谨慎数据迁移回滚」：仅删本迁移引入的表/种子，不动其他表。
    bind = op.get_bind()

    bind.execute(
        sa.text(f"DELETE FROM {SCHEMA}.scheduled_tasks WHERE key = 'tool_stats_aggregate' AND is_system = TRUE")
    )

    if _table_exists(bind, "tool_stats_daily"):
        op.drop_table("tool_stats_daily", schema=SCHEMA)

    if _table_exists(bind, "tool_invocations"):
        op.drop_index("ix_tool_invocations_caller_status", table_name="tool_invocations", schema=SCHEMA)
        op.drop_index("ix_tool_invocations_created_at", table_name="tool_invocations", schema=SCHEMA)
        op.drop_index("ix_tool_invocations_ref_version", table_name="tool_invocations", schema=SCHEMA)
        op.drop_table("tool_invocations", schema=SCHEMA)
