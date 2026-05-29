"""创建 negentropy.consolidation_jobs 表 — 补齐 0043 函数缺失的依赖表

Revision ID: 0044
Revises: 0043
Create Date: 2026-05-29 00:00:00.000000+00:00

设计动机：
    迁移 0043 将 SQL 函数 ``trigger_maintenance_consolidation`` 静态化进 negentropy
    schema，其函数体 ``INSERT INTO negentropy.consolidation_jobs ...``，但建表语句
    从未随之迁入——该表的权威定义只存在于 cognizes 应用的 hippocampus_schema.sql
    （无 schema 前缀）。导致 Scheduler「Maintenance Consolidation」任务每次触发即报
    ``UndefinedTableError: relation "negentropy.consolidation_jobs" does not exist``，
    已连续失败 25 次。

    本迁移在 negentropy schema 内补建 ``consolidation_jobs`` 表，列定义 1:1 对齐
    cognizes 权威定义，使 0043 的函数得以正常入队。表结构由配套 ORM 模型
    ``models.internalization.ConsolidationJob`` 镜像，避免 autogenerate 漂移。

幂等性：
    建表前以 information_schema 探测存在性（仿 0035），便于半失败重试。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0044"
down_revision: str | None = "0043"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    bind = op.get_bind()

    exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            f"WHERE table_schema = '{SCHEMA}' AND table_name = 'consolidation_jobs'"
        )
    ).scalar()
    if exists:
        return

    op.create_table(
        "consolidation_jobs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "thread_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.threads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("job_type", sa.String(length=50), nullable=False),
        sa.Column("result", postgresql.JSONB(), nullable=True, server_default=sa.text("'{}'::jsonb")),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema=SCHEMA,
    )
    op.create_index(
        "idx_consolidation_jobs_status",
        "consolidation_jobs",
        ["status"],
        schema=SCHEMA,
    )
    op.create_index(
        "idx_consolidation_jobs_thread",
        "consolidation_jobs",
        ["thread_id"],
        schema=SCHEMA,
    )
    op.create_index(
        "idx_consolidation_jobs_pending",
        "consolidation_jobs",
        ["created_at"],
        schema=SCHEMA,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    bind = op.get_bind()

    exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            f"WHERE table_schema = '{SCHEMA}' AND table_name = 'consolidation_jobs'"
        )
    ).scalar()
    if not exists:
        return

    op.drop_index("idx_consolidation_jobs_pending", table_name="consolidation_jobs", schema=SCHEMA)
    op.drop_index("idx_consolidation_jobs_thread", table_name="consolidation_jobs", schema=SCHEMA)
    op.drop_index("idx_consolidation_jobs_status", table_name="consolidation_jobs", schema=SCHEMA)
    op.drop_table("consolidation_jobs", schema=SCHEMA)
