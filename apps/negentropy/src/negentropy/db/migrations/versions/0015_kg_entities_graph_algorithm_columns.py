"""新增 kg_entities 图算法列 (importance_score, community_id)

Revision ID: 0015
Revises: 0014
Create Date: 2026-05-02 00:00:00.000000+00:00

设计动机：
  为知识图谱图算法持久化结果添加列：
  - importance_score: PageRank 实体重要性分数 (Brin & Page, 1998)
  - community_id: Louvain 社区检测分配的社区编号 (Blondel et al., 2008)

  参考文献:
  [1] S. Brin and L. Page, "The anatomy of a large-scale hypertextual Web search
      engine," Comput. Netw. ISDN Syst., vol. 30, no. 1-7, pp. 107-117, 1998.
  [2] V. D. Blondel, J.-L. Guillaume, R. Lambiotte, and E. Lefebvre, "Fast unfolding
      of communities in large networks," J. Stat. Mech., P10008, 2008.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "kg_entities",
        sa.Column("importance_score", sa.Float(), nullable=True),
        schema="negentropy",
    )
    op.add_column(
        "kg_entities",
        sa.Column("community_id", sa.Integer(), nullable=True),
        schema="negentropy",
    )
    op.create_index(
        "ix_kg_entities_community",
        "kg_entities",
        ["corpus_id", "community_id"],
        schema="negentropy",
    )


def downgrade() -> None:
    op.drop_index("ix_kg_entities_community", table_name="kg_entities", schema="negentropy")
    op.drop_column("kg_entities", "community_id", schema="negentropy")
    op.drop_column("kg_entities", "importance_score", schema="negentropy")
