"""Phase 4 — Memory Core Blocks（常驻摘要块） + 类型分层差异化

Revision ID: 0022
Revises: 0021
Create Date: 2026-05-02 12:00:00.000000+00:00

设计动机：
  借鉴 Letta/MemGPT 的 Hierarchical Memory（Core/Recall/Archival）设计，
  引入 "Core Memory Block"：每个 (user_id × app_name × scope) 维度
  下的常驻摘要块，受 Self-editing Tools 主控，不参与遗忘曲线衰减，
  每次主动召回时必加载，是 Agent 最高优先级的语境锚定来源。

  scope 三档：user（跨 thread 的人格画像）/ app（应用级常识）/ thread（会话级目标）。

  与现有 memory_summaries（自动生成的画像缓存）正交：
  - memory_summaries：LLM 自动总结，会被新巩固覆盖
  - memory_core_blocks：用户/Agent 主动维护，不会被自动覆盖

  参考文献：
  [1] C. Packer et al., "MemGPT: Towards LLMs as Operating Systems," arXiv:2310.08560, 2023.
  [2] J. L. McClelland et al., "Why there are complementary learning systems in the
      hippocampus and neocortex," *Psychological Review*, vol. 102, no. 3, 1995.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.create_table(
        "memory_core_blocks",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column("app_name", sa.String(255), nullable=False),
        sa.Column("scope", sa.String(20), nullable=False, server_default="'user'"),
        sa.Column("thread_id", sa.UUID(), nullable=True),
        sa.Column("label", sa.String(64), nullable=False, server_default="'persona'"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by", sa.String(64), nullable=True),
        sa.Column("metadata", sa.dialects.postgresql.JSONB(), server_default="{}", nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "scope IN ('user', 'app', 'thread')",
            name="memory_core_blocks_scope_check",
        ),
        sa.UniqueConstraint(
            "user_id",
            "app_name",
            "scope",
            "thread_id",
            "label",
            name="memory_core_blocks_unique",
            # PG 15+ NULLS NOT DISTINCT：scope='user'/'app' 时 thread_id 强制为 NULL，
            # 默认 NULL 之间互为 distinct 会让唯一约束失效，导致并发 upsert 重复落库；
            # 项目要求 PostgreSQL 16+（详见 docs/user-guide.md），可安全启用此选项。
            postgresql_nulls_not_distinct=True,
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_memory_core_blocks_user",
        "memory_core_blocks",
        ["user_id", "app_name", "scope"],
        schema=SCHEMA,
    )

    # 自动 updated_at 触发器
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION {SCHEMA}.memory_core_blocks_set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER trg_memory_core_blocks_updated_at
            BEFORE UPDATE ON {SCHEMA}.memory_core_blocks
            FOR EACH ROW EXECUTE FUNCTION {SCHEMA}.memory_core_blocks_set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute(f"DROP TRIGGER IF EXISTS trg_memory_core_blocks_updated_at ON {SCHEMA}.memory_core_blocks")
    op.execute(f"DROP FUNCTION IF EXISTS {SCHEMA}.memory_core_blocks_set_updated_at()")
    op.drop_index("ix_memory_core_blocks_user", table_name="memory_core_blocks", schema=SCHEMA)
    op.drop_table("memory_core_blocks", schema=SCHEMA)
