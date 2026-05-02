"""kg_build_runs 增加 progress_percent 和 warnings 列

Revision ID: 0016
Revises: 0015
Create Date: 2026-05-02 00:00:00.000000+00:00

设计动机：
  为构建管线健壮性 (Nygard, Release It!, 2018 <sup>[[16]]</sup>) 增加可观测性基础设施：
  - progress_percent: 构建进度百分比，支持前端进度条展示
  - warnings: 非致命警告（如 PageRank 收敛失败）的结构化存储

  参考文献:
  [16] M. T. Nygard, "Release It!," 2nd ed. Pragmatic Bookshelf, 2018.
  [17] M. Kleppmann, "Designing Data-Intensive Applications," O'Reilly, 2017.
  [18] C. Majors et al., "Observability Engineering," O'Reilly, 2022.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # kg_build_runs 基表从未被任何 migration 创建，在此补建（幂等）
    op.execute(
        sa.text("""
        CREATE TABLE IF NOT EXISTS negentropy.kg_build_runs (
            id UUID PRIMARY KEY,
            app_name VARCHAR(255),
            corpus_id UUID,
            run_id VARCHAR(255),
            status VARCHAR(50) DEFAULT 'running',
            extractor_config JSONB DEFAULT '{}',
            model_name VARCHAR(255),
            entity_count INTEGER DEFAULT 0,
            relation_count INTEGER DEFAULT 0,
            error_message TEXT,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    )
    op.add_column(
        "kg_build_runs",
        sa.Column("progress_percent", sa.Float(), nullable=True, server_default="0"),
        schema="negentropy",
    )
    op.add_column(
        "kg_build_runs",
        sa.Column("warnings", sa.JSON(), nullable=True, server_default="[]"),
        schema="negentropy",
    )


def downgrade() -> None:
    op.drop_column("kg_build_runs", "warnings", schema="negentropy")
    op.drop_column("kg_build_runs", "progress_percent", schema="negentropy")
