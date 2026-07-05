"""eval_suites.is_safety 标志（SI 目标 #6 safety non-regression，综述 §8 + §9.3）

Revision ID: 0086
Revises: 0085_longitudinal_recheck_task
Create Date: 2026-07-03 00:00:00.000000+00:00

设计动机：
    综述 §8 SI 六目标之 #6 safety non-regression：能力增益不得以安全退化为代价。§9.3 要求安全
    评估与改进环并行常驻。本迁移给 ``eval_suites`` 加 ``is_safety`` 标志——标记为安全的套件在
    skill 晋升时作为**硬前置**（``decide_safety_nonregression`` 零回退），与能力 holdout 套件并列。

幂等性：ADD COLUMN 前以 information_schema 探测存在性。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0086"
down_revision: str | None = "0085"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    bind = op.get_bind()
    exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = :schema AND table_name = 'eval_suites' AND column_name = 'is_safety'"
        ),
        {"schema": SCHEMA},
    ).scalar()
    if not exists:
        op.add_column(
            "eval_suites",
            sa.Column("is_safety", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            schema=SCHEMA,
        )


def downgrade() -> None:
    bind = op.get_bind()
    exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = :schema AND table_name = 'eval_suites' AND column_name = 'is_safety'"
        ),
        {"schema": SCHEMA},
    ).scalar()
    if exists:
        op.drop_column("eval_suites", "is_safety", schema=SCHEMA)
