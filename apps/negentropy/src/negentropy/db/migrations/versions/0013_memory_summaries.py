"""新增 memory_summaries 表（用户记忆画像摘要缓存）

Revision ID: 0013
Revises: 0012
Create Date: 2026-05-02 00:00:00.000000+00:00

设计动机：
  MemorySummarizer 将用户的碎片记忆和事实重蒸馏为结构化画像摘要，
  缓存在 memory_summaries 表中供 ContextAssembler 注入。借鉴认知科学
  记忆再巩固 (Reconsolidation) 理论和 Claude Code CLAUDE.md 的文件摘要模式。

  参考文献:
  [1] S. J. Sara, "Reconsolidation and the stability of memory traces,"
      Current Opinion in Neurobiology, vol. 35, pp. 110-115, 2015.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.create_table(
        "memory_summaries",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column("app_name", sa.String(255), nullable=False),
        sa.Column("summary_type", sa.String(50), nullable=False, server_default="'user_profile'"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("source_memory_count", sa.Integer(), nullable=True),
        sa.Column("source_fact_count", sa.Integer(), nullable=True),
        sa.Column("model_used", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("user_id", "app_name", "summary_type", name="memory_summaries_user_type_unique"),
        sa.PrimaryKeyConstraint("id"),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_table("memory_summaries", schema=SCHEMA)
