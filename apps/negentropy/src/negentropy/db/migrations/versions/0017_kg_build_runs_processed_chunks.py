"""kg_build_runs 增加 processed_chunk_ids 列（增量构建追踪）

Revision ID: 0017
Revises: 0016
Create Date: 2026-05-02 00:00:00.000000+00:00

设计动机：
  支持增量图谱构建 (Hogan et al., 2021 §6.3)。
  processed_chunk_ids 存储每次构建已处理的 chunk ID 列表，
  后续增量构建时仅处理新增 chunk，避免全量重建 (Graphiti, 2025)。

  参考文献:
  [1] A. Hogan et al., "Knowledge graphs," ACM Comput. Surv., vol. 54, no. 4, 2021.
  [6] P. Tripathi et al., "Zep: A temporal knowledge graph architecture," arXiv:2501.13956, 2025.
  [17] M. Kleppmann, "Designing Data-Intensive Applications," O'Reilly, 2017.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "kg_build_runs",
        sa.Column("processed_chunk_ids", sa.JSON(), nullable=True, server_default="[]"),
        schema="negentropy",
    )


def downgrade() -> None:
    op.drop_column("kg_build_runs", "processed_chunk_ids", schema="negentropy")
