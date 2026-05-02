"""kg_relations 时态列 + kg_community_summaries 表

Revision ID: 0018
Revises: 0017
Create Date: 2026-05-02 00:00:00.000000+00:00

设计动机：
  B2: Snodgrass & Ahn (1985) 双时轴模型 — valid_from/valid_to 支持事实有效期与矛盾检测。
  B3: Edge et al. (2024) GraphRAG 层级社区摘要 — kg_community_summaries 存储每个社区的 LLM 摘要。

参考文献:
  [2] R. Snodgrass and I. Ahn, "A taxonomy of time in databases," Proc. ACM SIGMOD, pp. 236–246, 1985.
  [3] E. K. V. Edge et al., "From local to global: A graph RAG approach
      to query-focused summarization," Microsoft Research, 2024.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # B2: kg_relations 增加时态有效期列
    op.add_column(
        "kg_relations",
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        schema="negentropy",
    )
    op.add_column(
        "kg_relations",
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        schema="negentropy",
    )

    # B3: 社区摘要表
    op.create_table(
        "kg_community_summaries",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "corpus_id",
            sa.UUID(),
            sa.ForeignKey("negentropy.corpus.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("community_id", sa.Integer(), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("entity_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("relation_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("top_entities", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "corpus_id",
            "community_id",
            "level",
            name="uq_kg_community_summaries_corpus_level",
        ),
        schema="negentropy",
    )


def downgrade() -> None:
    op.drop_table("kg_community_summaries", schema="negentropy")
    op.drop_column("kg_relations", "valid_to", schema="negentropy")
    op.drop_column("kg_relations", "valid_from", schema="negentropy")
