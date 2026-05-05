"""新增记忆关联表（轻量关联图谱）

Revision ID: 0021
Revises: 0020
Create Date: 2026-05-02 00:00:00.000000+00:00

设计动机：
  基于 Associative Memory Theory (Tulving, 1972) 和 Spreading Activation
  (Collins & Loftus, 1975)，为记忆和事实之间建立轻量关联，支持多跳检索。

  关联类型：semantic（语义相似）、temporal（时间邻近）、thread_shared（同线程）、
  entity（共享实体）。自动链接策略在巩固后异步触发。

  参考文献:
  [1] E. Tulving, "Episodic and semantic memory," in Organization of Memory,
      E. Tulving and W. Donaldson, Eds. New York: Academic Press, 1972, pp. 381–403.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.create_table(
        "memory_associations",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=False),
        sa.Column("source_type", sa.String(20), nullable=False, server_default="'memory'"),
        sa.Column("target_id", sa.UUID(), nullable=False),
        sa.Column("target_type", sa.String(20), nullable=False, server_default="'memory'"),
        sa.Column("association_type", sa.String(50), nullable=False, server_default="'semantic'"),
        sa.Column("weight", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("metadata", sa.dialects.postgresql.JSONB(), server_default="{}", nullable=True),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column("app_name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_id", "target_id", "association_type", name="assoc_unique"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_memory_assoc_source",
        "memory_associations",
        ["source_id", "association_type"],
        schema=SCHEMA,
    )
    op.create_index(
        "ix_memory_assoc_target",
        "memory_associations",
        ["target_id", "association_type"],
        schema=SCHEMA,
    )
    op.create_index(
        "ix_memory_assoc_user",
        "memory_associations",
        ["user_id", "app_name"],
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_index("ix_memory_assoc_user", table_name="memory_associations", schema=SCHEMA)
    op.drop_index("ix_memory_assoc_target", table_name="memory_associations", schema=SCHEMA)
    op.drop_index("ix_memory_assoc_source", table_name="memory_associations", schema=SCHEMA)
    op.drop_table("memory_associations", schema=SCHEMA)
