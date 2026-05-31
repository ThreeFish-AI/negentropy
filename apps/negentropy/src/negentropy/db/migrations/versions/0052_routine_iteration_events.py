"""创建 routine_iteration_events 表 — 迭代「全过程」动作级审计事实流。

Revision ID: 0052
Revises: 0051
Create Date: 2026-05-31 00:00:00.000000+00:00

设计动机：
    现有 ``routine_iterations`` 仅持久化迭代粒度的最终摘要（summary≤2000 字符）与评分，
    丢弃了 Claude Code 在一轮迭代内执行的**所有动作**（工具调用 tool_use / 工具结果
    tool_result / 中间 assistant 文本 / 最终 result），以及评估阶段的命令门控（gate）与
    LLM-as-Judge（evaluation）的输入/输出。本表把这些动作各落一行，按 ``seq`` 顺序还原
    「全过程」，供事后审计与 Review，并经 SSE ``action`` 事件实时投递（边跑边看）。

    表结构镜像 ORM 模型 ``models.routine.RoutineIterationEvent``，避免 autogenerate 漂移：
      - 双外键 ``iteration_id`` / ``routine_id`` 均 ``ON DELETE CASCADE``：随 iteration /
        routine 删除级联清理（Postgres 对同一行的重叠级联安全）。
      - ``UniqueConstraint(iteration_id, seq)``：单迭代内 seq 唯一；写入侧配合
        ``ON CONFLICT DO NOTHING`` 兜底 reaper/abort/重试竞态。
      - ``payload`` 为归一化结构化载荷（截断到 ~16KB/字段、~1000 条/迭代）。

幂等性：
    建表前以 information_schema 探测存在性（仿 0048），便于半失败重试。

参考文献：
[1] 0048_routine_tables.py — Routine 表族 information_schema 幂等建表范式。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0052"
down_revision: str | None = "0051"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def _table_exists(bind, table_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(f"SELECT 1 FROM information_schema.tables WHERE table_schema = '{SCHEMA}' AND table_name = :t"),
            {"t": table_name},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "routine_iteration_events"):
        op.create_table(
            "routine_iteration_events",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "iteration_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey(f"{SCHEMA}.routine_iterations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "routine_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey(f"{SCHEMA}.routines.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("seq", sa.Integer(), nullable=False),
            sa.Column(
                "event_type",
                sa.String(length=24),
                nullable=False,
                comment="system|assistant|tool_use|tool_result|result|gate|evaluation",
            ),
            sa.Column("tool_name", sa.String(length=128), nullable=True),
            sa.Column("title", sa.String(length=255), nullable=True),
            sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("cost_usd", sa.Float(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("iteration_id", "seq", name="uq_routine_iteration_events_seq"),
            schema=SCHEMA,
        )
        op.create_index(
            "ix_routine_iteration_events_iter_seq",
            "routine_iteration_events",
            ["iteration_id", "seq"],
            schema=SCHEMA,
        )
        op.create_index(
            "ix_routine_iteration_events_routine",
            "routine_iteration_events",
            ["routine_id"],
            schema=SCHEMA,
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _table_exists(bind, "routine_iteration_events"):
        op.drop_index("ix_routine_iteration_events_routine", table_name="routine_iteration_events", schema=SCHEMA)
        op.drop_index("ix_routine_iteration_events_iter_seq", table_name="routine_iteration_events", schema=SCHEMA)
        op.drop_table("routine_iteration_events", schema=SCHEMA)
