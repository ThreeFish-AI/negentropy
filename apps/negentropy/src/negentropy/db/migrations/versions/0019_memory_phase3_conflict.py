"""新增记忆冲突解决机制（AGM 信念修正）

Revision ID: 0019
Revises: 0018
Create Date: 2026-05-02 00:00:00.000000+00:00

设计动机：
  基于 AGM 信念修正理论 (Alchourrón, Gärdenfors, Makinson, 1985)，
  当新事实与现有事实矛盾时（如用户偏好变化），通过三阶段检测
  (Key-based → Embedding-based → LLM-based) 识别冲突，
  并以 supersede 语义解决，保持知识一致性。

  同时为 facts 表添加 status/superseded_by/superseded_at 字段，
  支持事实版本链追踪。

  参考文献:
  [1] C. E. Alchourrón, P. Gärdenfors, and D. Makinson,
      "On the logic of theory change," J. Symbolic Logic, vol. 50, no. 2,
      pp. 510–530, 1985.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.add_column(
        "facts",
        sa.Column("superseded_by", sa.UUID(), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        "facts",
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        schema=SCHEMA,
    )
    op.add_column(
        "facts",
        sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True),
        schema=SCHEMA,
    )
    op.create_table(
        "memory_conflicts",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column("app_name", sa.String(255), nullable=False),
        sa.Column("old_fact_id", sa.UUID(), nullable=True),
        sa.Column("new_fact_id", sa.UUID(), nullable=True),
        sa.Column("conflict_type", sa.String(50), nullable=False, server_default="contradiction"),
        sa.Column("resolution", sa.String(50), nullable=False, server_default="supersede"),
        sa.Column("confidence_delta", sa.Float(), nullable=True),
        sa.Column("detected_by", sa.String(50), nullable=False, server_default="key_collision"),
        sa.Column("metadata", postgresql.JSONB(), server_default="{}", nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["old_fact_id"], [f"{SCHEMA}.facts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["new_fact_id"], [f"{SCHEMA}.facts.id"], ondelete="CASCADE"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_memory_conflicts_user_app",
        "memory_conflicts",
        ["user_id", "app_name", "created_at"],
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_index("ix_memory_conflicts_user_app", table_name="memory_conflicts", schema=SCHEMA)
    op.drop_table("memory_conflicts", schema=SCHEMA)
    op.drop_column("facts", "superseded_at", schema=SCHEMA)
    op.drop_column("facts", "status", schema=SCHEMA)
    op.drop_column("facts", "superseded_by", schema=SCHEMA)
