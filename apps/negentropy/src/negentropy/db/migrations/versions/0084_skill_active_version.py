"""skills.active_version 指针（区分「最新」与「已晋升」，Skill 进化发布机制）

Revision ID: 0084
Revises: 0083_eval_subsystem
Create Date: 2026-07-02 00:00:00.000000+00:00

设计动机：
    Skill 进化闭环（综述 §3.5 + §7）：GEPA proposer 变异 ``prompt_template`` → 离线 eval suite
    双相门裁决 → 晋升。发布机制 = ``skills.active_version`` 指针翻转（promoted 快照），与
    ``skills.version``（最新/head）解耦。运行时 skills_injector 在未显式锁版本（spec=="*"）时
    解析 ``active_version`` 指向的 ``skill_versions`` 快照。

    Skills 无 sync 覆写（无 sync_negentropy_skills 对偶，已核），故免 ADR-3 Sync 守卫。

幂等性：
    ADD COLUMN 前以 information_schema 探测存在性（仿 0082），便于半失败重试。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0084"
down_revision: str | None = "0083"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    bind = op.get_bind()
    exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = :schema AND table_name = 'skills' AND column_name = 'active_version'"
        ),
        {"schema": SCHEMA},
    ).scalar()
    if not exists:
        op.add_column(
            "skills",
            sa.Column("active_version", sa.String(length=50), nullable=True),
            schema=SCHEMA,
        )


def downgrade() -> None:
    # 遵循 AGENTS.md「谨慎数据迁移回滚」：仅删本迁移引入的列。
    bind = op.get_bind()
    exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = :schema AND table_name = 'skills' AND column_name = 'active_version'"
        ),
        {"schema": SCHEMA},
    ).scalar()
    if exists:
        op.drop_column("skills", "active_version", schema=SCHEMA)
