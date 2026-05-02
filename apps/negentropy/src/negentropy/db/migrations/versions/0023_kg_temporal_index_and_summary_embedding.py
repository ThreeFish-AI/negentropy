"""kg_relations 时态索引 + kg_community_summaries 摘要嵌入

Revision ID: 0023
Revises: 0022
Create Date: 2026-05-02 12:00:00.000000+00:00

设计动机：
  G1 (GraphRAG Global Search): 为 kg_community_summaries.summary_text 落地预计算 embedding，
      支撑 query-focused 摘要召回（Map 阶段的相关性筛选），避免每次全量扫描。
  G3 (双时态 as-of 查询): 为 kg_relations 的"当前活跃"快查路径增加部分索引，
      避免 valid_to IS NULL AND is_active=true 谓词全表扫描；同时 backfill
      valid_from = created_at（历史关系视为从写入时刻起即生效）。

参考文献:
  [1] D. Edge et al., "From local to global: A graph RAG approach to query-focused
      summarization," Microsoft Research, 2024.
  [2] R. Snodgrass and I. Ahn, "A taxonomy of time in databases," Proc. ACM SIGMOD,
      pp. 236–246, 1985.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    # G1: kg_community_summaries 增加摘要 embedding 列
    has_pgvector = bind.execute(sa.text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")).scalar()

    if has_pgvector:
        op.execute(
            sa.text("ALTER TABLE negentropy.kg_community_summaries ADD COLUMN IF NOT EXISTS embedding vector(1536)")
        )
    else:
        # 非生产环境/SQLite/无 pgvector 时回退为 JSON 数组字段，
        # 保证迁移可在所有环境下完成；运行时检测 vector 扩展决定路径。
        op.execute(sa.text("ALTER TABLE negentropy.kg_community_summaries ADD COLUMN IF NOT EXISTS embedding TEXT"))

    # G1: 摘要陈旧度判断 — corpus_id + updated_at 复合索引（DESC）
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_kg_community_summaries_corpus_updated "
            "ON negentropy.kg_community_summaries(corpus_id, updated_at DESC)"
        )
    )

    # G3: kg_relations 当前活跃事实部分索引（NULL valid_to + is_active）
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_kg_relations_valid_active "
            "ON negentropy.kg_relations(corpus_id) "
            "WHERE valid_to IS NULL AND is_active = true"
        )
    )

    # G3: backfill valid_from — 历史关系视为从 created_at 起即生效
    # 仅更新 NULL 行，避免覆盖已被 temporal_resolver 显式赋值的行。
    op.execute(
        sa.text(
            "UPDATE negentropy.kg_relations "
            "SET valid_from = created_at "
            "WHERE valid_from IS NULL AND created_at IS NOT NULL"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.ix_kg_relations_valid_active"))
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.ix_kg_community_summaries_corpus_updated"))
    op.execute(sa.text("ALTER TABLE negentropy.kg_community_summaries DROP COLUMN IF EXISTS embedding"))
