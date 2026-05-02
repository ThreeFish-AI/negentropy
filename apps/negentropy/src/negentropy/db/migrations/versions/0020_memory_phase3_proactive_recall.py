"""新增主动召回预加载缓存表

Revision ID: 0020
Revises: 0019
Create Date: 2026-05-02 00:00:00.000000+00:00

设计动机：
  基于 Spreading Activation Theory (Collins & Loftus, 1975) 和
  Context-Dependent Memory (Godden & Baddeley, 1975)，在新会话创建时
  主动注入高相关性记忆，减少首次交互的冷启动延迟。

  预加载缓存按 (user_id, app_name) 存储，TTL 1小时自动失效，
  记忆巩固/事实插入/冲突解决时主动失效。

  参考文献:
  [1] A. M. Collins and E. F. Loftus, "A spreading-activation theory of
      semantic processing," Psychological Review, vol. 82, no. 6, pp. 407–428, 1975.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.create_table(
        "memory_preload_cache",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column("app_name", sa.String(255), nullable=False),
        sa.Column("preload_context", sa.Text(), nullable=False),
        sa.Column("memory_ids", postgresql.ARRAY(sa.UUID()), nullable=False),
        sa.Column("fact_ids", postgresql.ARRAY(sa.UUID()), server_default="{}", nullable=True),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("relevance_basis", sa.String(50), server_default="'importance_recency'", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "app_name", name="preload_cache_user_app_unique"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_preload_cache_user",
        "memory_preload_cache",
        ["user_id", "app_name"],
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_index("ix_preload_cache_user", table_name="memory_preload_cache", schema=SCHEMA)
    op.drop_table("memory_preload_cache", schema=SCHEMA)
