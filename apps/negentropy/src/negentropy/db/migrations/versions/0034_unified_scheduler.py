"""scheduled_tasks + task_executions — Phase 4 统一心跳调度引擎

Revision ID: 0034
Revises: 0033
Create Date: 2026-05-17 00:00:00.000000+00:00

设计动机：
    现有定时任务散落 6 处（``engine/bootstrap.py`` 的 6 个 startup hook、
    ``agents/skill_scheduler.py``、``engine/title_inspector.py``、
    ``engine/schedulers/async_scheduler.py``），无统一注册中心与执行历史表。

    本 migration 创建：
    - ``scheduled_tasks``：所有定时任务的单一事实源（替代 register 的内存 dict）；
    - ``task_executions``：执行历史 append-only 事实表，驱动 Dashboard 多维统计。

    并行兼容：保留旧 ``skill_schedules`` 表与 ``/skills/{id}/schedules/*`` API；
    每行 ``skill_schedules`` 通过 data migration 回填为一条
    ``scheduled_tasks(handler_kind='skill_invoke')`` 记录，``payload`` 携带
    ``skill_schedule_id`` 指针。

参考文献：
    [1] MindStudio, *Heartbeat Pattern Beats Persistent Sessions for AI Agents*, 2025.
    [2] PostgreSQL Docs, *FOR UPDATE SKIP LOCKED*.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0034"
down_revision: str | None = "0033"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    # 幂等保护：表已存在则跳过（与 0028 同款风格，便于半失败重试）
    tasks_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'negentropy' AND table_name = 'scheduled_tasks'"
        )
    ).scalar()

    if not tasks_exists:
        op.create_table(
            "scheduled_tasks",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("key", sa.String(length=192), nullable=False),
            sa.Column("handler_kind", sa.String(length=64), nullable=False),
            sa.Column("trigger_type", sa.String(length=16), nullable=False),
            sa.Column("interval_seconds", sa.Float(), nullable=True),
            sa.Column("cron_expr", sa.String(length=64), nullable=True),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("owner_id", sa.String(length=255), nullable=True),
            sa.Column("participant_id", sa.String(length=255), nullable=True),
            sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("role", sa.String(length=64), nullable=True),
            sa.Column("scenario", sa.String(length=64), nullable=True),
            sa.Column("category", sa.String(length=32), nullable=True),
            sa.Column("display_name", sa.String(length=192), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("last_fire_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("next_fire_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_status", sa.String(length=16), nullable=True),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column(
                "consecutive_failures",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.Column("total_runs", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("max_concurrency", sa.Integer(), nullable=False, server_default=sa.text("1")),
            sa.Column("token_budget", sa.Integer(), nullable=True),
            sa.Column("backoff_until", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("key", name="uq_scheduled_tasks_key"),
            schema="negentropy",
        )
        op.create_index(
            "ix_scheduled_tasks_due",
            "scheduled_tasks",
            ["enabled", "next_fire_at"],
            schema="negentropy",
        )
        op.create_index(
            "ix_scheduled_tasks_handler",
            "scheduled_tasks",
            ["handler_kind", "enabled"],
            schema="negentropy",
        )
        op.create_index(
            "ix_scheduled_tasks_agent",
            "scheduled_tasks",
            ["agent_id"],
            schema="negentropy",
        )
        op.create_index(
            "ix_scheduled_tasks_scenario",
            "scheduled_tasks",
            ["scenario", "category"],
            schema="negentropy",
        )
        op.create_index(
            "ix_scheduled_tasks_owner",
            "scheduled_tasks",
            ["owner_id"],
            schema="negentropy",
        )

    exec_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'negentropy' AND table_name = 'task_executions'"
        )
    ).scalar()

    if not exec_exists:
        op.create_table(
            "task_executions",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "task_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("negentropy.scheduled_tasks.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(length=16), nullable=False),
            sa.Column("duration_ms", sa.Integer(), nullable=True),
            sa.Column("tokens_used", sa.Integer(), nullable=True),
            sa.Column("skill_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("skill_schedule_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("memory_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("pipeline_run_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("output_summary", sa.Text(), nullable=True),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("fire_reason", sa.String(length=16), nullable=False, server_default=sa.text("'tick'")),
            schema="negentropy",
        )
        op.create_index(
            "ix_task_executions_task_time",
            "task_executions",
            ["task_id", "started_at"],
            schema="negentropy",
        )
        op.create_index(
            "ix_task_executions_status_time",
            "task_executions",
            ["status", "started_at"],
            schema="negentropy",
        )

    # ------------------------------------------------------------------
    # Data migration: 把现存 skill_schedules 行回填为 scheduled_tasks 记录
    # 让 Dashboard 在新表里立即可见所有已存在的 Skill 调度，
    # 而 /skills/{id}/schedules/* 旧 API 仍按原表写入。
    # 旧 handler（agents/skill_scheduler._tick）仍读旧表，避免双写冲突。
    # Phase 5 之后切到新 handler 后再考虑去掉旧表。
    # ------------------------------------------------------------------
    bind.execute(
        sa.text(
            """
            INSERT INTO negentropy.scheduled_tasks (
                key, handler_kind, trigger_type, cron_expr, enabled,
                owner_id, role, scenario, category,
                display_name, payload,
                last_fire_at, next_fire_at, last_error, max_concurrency,
                created_at, updated_at
            )
            SELECT
                'skill_invoke:' || ss.skill_id::text || ':' || ss.id::text  AS key,
                'skill_invoke'                                              AS handler_kind,
                'cron'                                                      AS trigger_type,
                ss.cron_expr                                                AS cron_expr,
                ss.enabled                                                  AS enabled,
                ss.owner_id                                                 AS owner_id,
                'faculty'                                                   AS role,
                COALESCE(s.category, 'general')                             AS scenario,
                'cognitive'                                                 AS category,
                COALESCE(s.display_name, s.name)                            AS display_name,
                jsonb_build_object(
                    'skill_id',          ss.skill_id::text,
                    'skill_schedule_id', ss.id::text,
                    'vars',              ss.vars
                )                                                            AS payload,
                ss.last_run_at                                              AS last_fire_at,
                ss.next_run_at                                              AS next_fire_at,
                ss.last_error                                               AS last_error,
                1                                                            AS max_concurrency,
                ss.created_at                                               AS created_at,
                ss.updated_at                                               AS updated_at
            FROM negentropy.skill_schedules ss
            JOIN negentropy.skills s ON s.id = ss.skill_id
            ON CONFLICT (key) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()

    exec_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'negentropy' AND table_name = 'task_executions'"
        )
    ).scalar()
    if exec_exists:
        op.drop_index("ix_task_executions_status_time", table_name="task_executions", schema="negentropy")
        op.drop_index("ix_task_executions_task_time", table_name="task_executions", schema="negentropy")
        op.drop_table("task_executions", schema="negentropy")

    tasks_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'negentropy' AND table_name = 'scheduled_tasks'"
        )
    ).scalar()
    if tasks_exists:
        op.drop_index("ix_scheduled_tasks_owner", table_name="scheduled_tasks", schema="negentropy")
        op.drop_index("ix_scheduled_tasks_scenario", table_name="scheduled_tasks", schema="negentropy")
        op.drop_index("ix_scheduled_tasks_agent", table_name="scheduled_tasks", schema="negentropy")
        op.drop_index("ix_scheduled_tasks_handler", table_name="scheduled_tasks", schema="negentropy")
        op.drop_index("ix_scheduled_tasks_due", table_name="scheduled_tasks", schema="negentropy")
        op.drop_table("scheduled_tasks", schema="negentropy")
