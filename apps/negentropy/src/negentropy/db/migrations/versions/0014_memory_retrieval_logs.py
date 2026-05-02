"""新增 memory_retrieval_logs 表（检索效果反馈追踪）

Revision ID: 0014
Revises: 0013
Create Date: 2026-05-02 00:00:00.000000+00:00

设计动机：
  建立记忆检索的反馈闭环，追踪"检索了什么→是否被使用→是否有帮助"。
  基于 Rocchio 相关性反馈和 Learning-to-Rank 范式。

  参考文献:
  [1] J. J. Rocchio, "Relevance feedback in information retrieval,"
      in The SMART Retrieval System, Prentice-Hall, 1971, pp. 313-323.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.create_table(
        "memory_retrieval_logs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column("app_name", sa.String(255), nullable=False),
        sa.Column("thread_id", sa.UUID(), nullable=True),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("retrieved_memory_ids", postgresql.ARRAY(sa.UUID()), nullable=False),
        sa.Column("retrieved_fact_ids", postgresql.ARRAY(sa.UUID()), nullable=True),
        sa.Column("was_referenced", sa.Boolean(), nullable=True),
        sa.Column("reference_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("outcome_feedback", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_memory_retrieval_logs_user_app",
        "memory_retrieval_logs",
        ["user_id", "app_name", "created_at"],
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_index("ix_memory_retrieval_logs_user_app", table_name="memory_retrieval_logs", schema=SCHEMA)
    op.drop_table("memory_retrieval_logs", schema=SCHEMA)
