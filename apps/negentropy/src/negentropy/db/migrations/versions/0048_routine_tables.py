"""创建 Routine 长周期自主任务表 + 种子 routine_inspector 心跳任务。

Revision ID: 0048
Revises: 0047
Create Date: 2026-05-30 00:00:00.000000+00:00

设计动机：
    落地「持续自迭代自主决策任务执行」能力（Evaluator-Optimizer + Reflexion 闭环）。

      1. ``routines``：长周期自主任务注册源（goal / acceptance_criteria / 预算守卫 /
         生命周期状态机 / Reflexion 反思记忆）。表结构由 ORM 模型 ``models.routine.Routine``
         镜像，避免 autogenerate 漂移。
      2. ``routine_iterations``：单次 Execute→Evaluate→Decide 周期事实表，含执行结果
         （Claude Code summary/session_id/cost）与评估结果（score/verdict/reflection）。
      3. 种子 1 条 ``routine_inspector`` ScheduledTask（interval=25s）作为编排心跳，
         由统一调度引擎 tick 驱动 ``RoutineOrchestrator.inspect_once()``。
         INSERT ... ON CONFLICT (key) DO NOTHING 幂等。

幂等性：
    建表前以 information_schema 探测存在性（仿 0044），便于半失败重试。

参考文献：
[1] 0044_create_consolidation_jobs.py — information_schema 幂等建表范式。
[2] 0046_seed_default_scheduled_tasks.py — ScheduledTask 幂等 seed 范式。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0048"
down_revision: str | None = "0047"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
SCHEDULED_TASKS = f"{SCHEMA}.scheduled_tasks"

# 种子 inspector 心跳任务的 key，供 DELETE 保护与 downgrade 使用。
INSPECTOR_KEY = "routine_inspector"


def _table_exists(bind, table_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(f"SELECT 1 FROM information_schema.tables WHERE table_schema = '{SCHEMA}' AND table_name = :t"),
            {"t": table_name},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    # --- 1. routines ---
    if not _table_exists(bind, "routines"):
        op.create_table(
            "routines",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("key", sa.String(length=192), nullable=False, unique=True),
            sa.Column("owner_id", sa.String(length=255), nullable=True),
            sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("display_name", sa.String(length=255), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("goal", sa.Text(), nullable=False),
            sa.Column("acceptance_criteria", sa.Text(), nullable=False),
            sa.Column("cwd", sa.Text(), nullable=True),
            sa.Column("verification_command", sa.Text(), nullable=True),
            sa.Column(
                "status",
                sa.String(length=24),
                nullable=False,
                server_default=sa.text("'pending'"),
                comment="pending|running|paused|succeeded|failed|cancelled",
            ),
            sa.Column(
                "termination_reason",
                sa.String(length=48),
                nullable=True,
                comment="success|max_iterations|max_cost|deadline|no_progress|oscillation|unrecoverable_error|user_cancelled",
            ),
            sa.Column("max_iterations", sa.Integer(), nullable=True),
            sa.Column("max_cost_usd", sa.Float(), nullable=True),
            sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("success_score_threshold", sa.Integer(), nullable=False, server_default=sa.text("85")),
            sa.Column("no_progress_patience", sa.Integer(), nullable=False, server_default=sa.text("3")),
            sa.Column(
                "approval_mode",
                sa.String(length=16),
                nullable=False,
                server_default=sa.text("'auto'"),
                comment="auto|first|every — 迭代执行前的人工审批级别",
            ),
            sa.Column("iteration_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("total_cost_usd", sa.Float(), nullable=False, server_default=sa.text("0")),
            sa.Column("best_score", sa.Integer(), nullable=True),
            sa.Column("last_score", sa.Integer(), nullable=True),
            sa.Column("claude_session_id", sa.String(length=128), nullable=True),
            sa.Column("reflections", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            schema=SCHEMA,
        )
        op.create_index("ix_routines_status", "routines", ["status"], schema=SCHEMA)
        op.create_index("ix_routines_owner", "routines", ["owner_id"], schema=SCHEMA)

    # --- 2. routine_iterations ---
    if not _table_exists(bind, "routine_iterations"):
        op.create_table(
            "routine_iterations",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "routine_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey(f"{SCHEMA}.routines.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("seq", sa.Integer(), nullable=False),
            sa.Column(
                "status",
                sa.String(length=24),
                nullable=False,
                server_default=sa.text("'dispatched'"),
                comment="pending_approval|dispatched|in_flight|executed|evaluated|reaped|aborted",
            ),
            sa.Column("prompt", sa.Text(), nullable=True),
            sa.Column("resume_session_id", sa.String(length=128), nullable=True),
            sa.Column("exec_status", sa.String(length=16), nullable=True),
            sa.Column("summary", sa.Text(), nullable=True),
            sa.Column("claude_session_id", sa.String(length=128), nullable=True),
            sa.Column("cost_usd", sa.Float(), nullable=False, server_default=sa.text("0")),
            sa.Column("turn_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("exec_error", sa.Text(), nullable=True),
            sa.Column("score", sa.Integer(), nullable=True),
            sa.Column(
                "verdict",
                sa.String(length=24),
                nullable=True,
                comment="pass|progressing|stalled|regressed|unrecoverable",
            ),
            sa.Column("reflection", sa.Text(), nullable=True),
            sa.Column("eval_error", sa.Text(), nullable=True),
            sa.Column("gate_exit_code", sa.Integer(), nullable=True),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("metrics", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.UniqueConstraint("routine_id", "seq", name="uq_routine_iterations_seq"),
            schema=SCHEMA,
        )
        op.create_index(
            "ix_routine_iterations_routine_seq",
            "routine_iterations",
            ["routine_id", "seq"],
            schema=SCHEMA,
        )
        op.create_index(
            "ix_routine_iterations_lease",
            "routine_iterations",
            ["status", "lease_expires_at"],
            schema=SCHEMA,
        )

    # --- 3. 种子 routine_inspector 心跳任务（幂等）---
    op.execute(
        sa.text(
            f"""
            INSERT INTO {SCHEDULED_TASKS}
                (key, handler_kind, trigger_type, interval_seconds, cron_expr,
                 role, scenario, category, display_name, description,
                 payload, max_concurrency, token_budget, enabled, is_system, next_fire_at)
            VALUES
                (:key, :handler_kind, :trigger_type, :interval_seconds, :cron_expr,
                 :role, :scenario, :category, :display_name, :description,
                 :payload, :max_concurrency, :token_budget, :enabled, :is_system, NOW())
            ON CONFLICT (key) DO NOTHING
            """
        ).bindparams(
            sa.bindparam("key", value=INSPECTOR_KEY),
            sa.bindparam("handler_kind", value="routine_inspector"),
            sa.bindparam("trigger_type", value="interval"),
            sa.bindparam("interval_seconds", value=25.0),
            sa.bindparam("cron_expr", value=None),
            sa.bindparam("role", value="supervisor"),
            sa.bindparam("scenario", value="routine_orchestration"),
            sa.bindparam("category", value="cognitive"),
            sa.bindparam("display_name", value="Routine Inspector"),
            sa.bindparam("description", value="巡检活跃 Routine，驱动评估-决策-调度闭环"),
            sa.bindparam("payload", value={}, type_=postgresql.JSONB),
            sa.bindparam("max_concurrency", value=1),
            sa.bindparam("token_budget", value=None),
            sa.bindparam("enabled", value=True),
            sa.bindparam("is_system", value=True),
        )
    )


def downgrade() -> None:
    bind = op.get_bind()

    # 删除种子 inspector 任务（系统种子，downgrade 时清理）。
    op.execute(
        sa.text(f"DELETE FROM {SCHEDULED_TASKS} WHERE key = :key").bindparams(sa.bindparam("key", value=INSPECTOR_KEY))
    )

    if _table_exists(bind, "routine_iterations"):
        op.drop_index("ix_routine_iterations_lease", table_name="routine_iterations", schema=SCHEMA)
        op.drop_index("ix_routine_iterations_routine_seq", table_name="routine_iterations", schema=SCHEMA)
        op.drop_table("routine_iterations", schema=SCHEMA)

    if _table_exists(bind, "routines"):
        op.drop_index("ix_routines_owner", table_name="routines", schema=SCHEMA)
        op.drop_index("ix_routines_status", table_name="routines", schema=SCHEMA)
        op.drop_table("routines", schema=SCHEMA)
