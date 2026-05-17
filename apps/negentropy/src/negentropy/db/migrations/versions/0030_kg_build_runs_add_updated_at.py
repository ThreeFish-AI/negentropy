"""kg_build_runs 增加 updated_at 列

Revision ID: 0030
Revises: 0029
Create Date: 2026-05-11 00:00:00.000000+00:00

设计动机：
  看门狗 finalize_stale_kg_build_runs 使用 COALESCE(completed_at, created_at) 判断
  running 任务是否超时，但 running 任务 completed_at 为 NULL 且 created_at 不变，
  导致超时判定永远不触发。添加 updated_at 列后，看门狗改用 COALESCE(updated_at, created_at)
  即可正确检测卡死任务。

  Migration 同时回填已有行的 updated_at，使当前卡死的 running 任务在下次看门狗轮询时
  立即被收敛到 failed 终态。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TABLE negentropy.kg_build_runs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ"))
    op.execute(
        sa.text(
            "UPDATE negentropy.kg_build_runs "
            "SET updated_at = COALESCE(completed_at, created_at) "
            "WHERE updated_at IS NULL"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE negentropy.kg_build_runs "
            "ALTER COLUMN updated_at SET DEFAULT NOW(), "
            "ALTER COLUMN updated_at SET NOT NULL"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("ALTER TABLE negentropy.kg_build_runs DROP COLUMN IF EXISTS updated_at"))
