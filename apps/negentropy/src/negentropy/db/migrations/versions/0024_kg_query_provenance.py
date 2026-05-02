"""kg_query_provenance — 多跳推理审计表

Revision ID: 0024
Revises: 0023
Create Date: 2026-05-02 14:00:00.000000+00:00

设计动机：
  G4 (Personalized PageRank + Provenance) 多跳推理产物的审计与"为什么这个答案"
  功能依赖物化历史：把 query / seed / top_entities / evidence_chain 留痕，
  支持后续抽检质量、回溯异常答案与生成训练数据。

参考文献:
  [1] B. Gutiérrez et al., "HippoRAG: Neurobiologically Inspired Long-Term
      Memory for LLMs," *NeurIPS*, 2024.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "kg_query_provenance",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "corpus_id",
            sa.UUID(),
            sa.ForeignKey("negentropy.corpus.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("query_text", sa.Text(), nullable=False),
        sa.Column("seeds", postgresql.JSONB(), nullable=True),
        sa.Column("top_entities", postgresql.JSONB(), nullable=True),
        sa.Column("evidence_chain", postgresql.JSONB(), nullable=True),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        schema="negentropy",
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_kg_query_provenance_corpus_created "
            "ON negentropy.kg_query_provenance(corpus_id, created_at DESC)"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.ix_kg_query_provenance_corpus_created"))
    op.drop_table("kg_query_provenance", schema="negentropy")
