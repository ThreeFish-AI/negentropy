"""skill_schedules 表 — 应用层定时调度（Phase 3）

Revision ID: 0028
Revises: 0027
Create Date: 2026-05-05 00:30:00.000000+00:00

设计动机：
  Phase 3 把 Paper Hunter 等 Skill 升级为「定时自跑」。本表存储 cron 表达式与
  调度状态；AsyncScheduler 启动 60s tick 扫此表 ``WHERE enabled AND next_run_at
  <= now() FOR UPDATE SKIP LOCKED`` 触发执行 + 更新 next_run_at。

  暂不启用 PostgreSQL pg_cron（云厂商兼容性差，托管 PG 多数不支持创建扩展）；
  本方案与现有 ``memory_automation_service`` 的应用层调度模式一致，将来若部署
  环境支持 pg_cron 可平滑迁移。

字段：
  - id UUID
  - skill_id UUID FK skills(id) ON DELETE CASCADE
  - owner_id str
  - cron_expr str（POSIX 5 字段：minute hour dom month dow）
  - enabled bool（默认 true）
  - vars JSONB（invoke 透传变量）
  - last_run_at / next_run_at timestamptz
  - last_error text（最近一次失败的错误信息）
  - created_at / updated_at

索引：
  - skill_id 查找
  - (enabled, next_run_at) 调度扫描

参考文献：
  [1] PostgreSQL Documentation, "FOR UPDATE SKIP LOCKED" — 多 worker 安全消费
  [2] croniter PyPI — POSIX cron 表达式解析
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0028"
down_revision: str | None = "0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    table_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'negentropy' AND table_name = 'skill_schedules'"
        )
    ).scalar()
    if table_exists:
        return

    op.create_table(
        "skill_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "skill_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("negentropy.skills.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("owner_id", sa.String(length=255), nullable=False),
        sa.Column("cron_expr", sa.String(length=64), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("vars", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema="negentropy",
    )
    op.create_index(
        "ix_skill_schedules_skill_id",
        "skill_schedules",
        ["skill_id"],
        schema="negentropy",
    )
    op.create_index(
        "ix_skill_schedules_due",
        "skill_schedules",
        ["enabled", "next_run_at"],
        schema="negentropy",
    )


def downgrade() -> None:
    bind = op.get_bind()
    table_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'negentropy' AND table_name = 'skill_schedules'"
        )
    ).scalar()
    if table_exists:
        op.drop_index("ix_skill_schedules_due", table_name="skill_schedules", schema="negentropy")
        op.drop_index("ix_skill_schedules_skill_id", table_name="skill_schedules", schema="negentropy")
        op.drop_table("skill_schedules", schema="negentropy")
