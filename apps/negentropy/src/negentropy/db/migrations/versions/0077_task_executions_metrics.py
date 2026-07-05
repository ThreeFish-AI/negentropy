"""Add task_executions.metrics JSONB — 持久化 HandlerResult.metrics。

Revision ID: 0077
Revises: 0076
Create Date: 2026-06-27 00:00:00.000000+00:00

设计动机：
    ``HandlerResult.metrics``（``handlers/__init__.py``）本是 handler 向调度框架回传的
    **结构化产物**（如 ``pdf_fidelity_patrol`` handler 的 ``{doc_id, routine_id}``），但
    ``TaskExecution`` 表无对应列，``registry._finalize_execution`` 此前将其**静默丢弃**，
    Scheduler 执行历史只能看到自由文本 ``output_summary``，无法结构化回链派生资源。

    本迁移给 ``task_executions`` 加 ``metrics JSONB NOT NULL DEFAULT '{}'``，使
    ``_finalize_execution`` 可持久化、``_serialize_execution`` 可下发，供 Scheduler UI
    渲染「派生 Routine」等深链（通用，惠及所有 handler，非巡检专属）。

幂等性：
    ``add_column`` 对已升级库是 no-op-safe（Alembic 记录版本号）；``downgrade`` 删列。

References:
[1] 0046_seed_default_scheduled_tasks.py — scheduled_tasks 列变更范式。
[2] AGENTS.md · 单一事实源：以 ``metrics`` 结构化字段而非散落文本维系回链。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0077"
down_revision: str | None = "0076"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.add_column(
        "task_executions",
        sa.Column(
            "metrics",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
            comment="HandlerResult.metrics 结构化产物（如巡检 routine_id/doc_id），供 UI 回链",
        ),
        schema=SCHEMA,
    )


def downgrade() -> None:
    # 遵循 AGENTS.md「谨慎数据迁移回滚」：downgrade 仅删列，不触碰既有行数据。
    op.drop_column("task_executions", "metrics", schema=SCHEMA)
