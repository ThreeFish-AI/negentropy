"""新增 importance_score 列（记忆重要性评分）

Revision ID: 0018
Revises: 0017
Create Date: 2026-05-02 00:00:00.000000+00:00

设计动机：
  基于 ACT-R 认知架构的基础水平激活公式，为记忆和事实引入重要性评分。
  importance_score 综合访问频率、记忆类型、时效性、事实支撑等因素，
  用于主动召回优先级排序、上下文组装权重、记忆衰减策略。

  参考文献:
  [1] J. R. Anderson et al., "An integrated theory of the mind,"
      Psychological Review, vol. 111, no. 4, pp. 1036–1060, 2004.
  [2] FadeMem, "Biologically-inspired forgetting for agent memory,"
      arXiv preprint arXiv:2601.18642, 2026.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.add_column(
        "memories",
        sa.Column("importance_score", sa.Float(), nullable=False, server_default="0.5"),
        schema=SCHEMA,
    )
    op.add_column(
        "facts",
        sa.Column("importance_score", sa.Float(), nullable=False, server_default="0.5"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_memories_importance",
        "memories",
        ["importance_score"],
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_index("ix_memories_importance", table_name="memories", schema=SCHEMA)
    op.drop_column("facts", "importance_score", schema=SCHEMA)
    op.drop_column("memories", "importance_score", schema=SCHEMA)
