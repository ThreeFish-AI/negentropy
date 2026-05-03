"""kg_relations 时态索引 + kg_community_summaries 摘要嵌入

Revision ID: 0024
Revises: 0023
Create Date: 2026-05-02 12:00:00.000000+00:00

注：本迁移最初标记为 0023，与 feature/1.x.x 上独立合入的
``0023_memory_phase4_core_blocks`` 撞号；为消除 Alembic multi-head
（CI: "Revision 0023 is present more than once"），重命名为 0024
并将 down_revision 改为 0023（指向 memory_phase4_core_blocks）。

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

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    # 探测前置迁移产物是否真正落库（alembic_version 推进 ≠ DDL 已执行 — 历史
    # 事务回滚故障下两者会脱钩）；此处幂等防御并补建缺失结构，确保 0023 与
    # 后续迁移链完整。
    summaries_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'negentropy' AND table_name = 'kg_community_summaries'"
        )
    ).scalar()
    relations_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'negentropy' AND table_name = 'kg_relations'"
        )
    ).scalar()

    # 修补 0022 — 若 kg_community_summaries 不存在，按 0022 原始定义补建
    if not summaries_exists:
        op.execute(
            sa.text(
                """
                CREATE TABLE IF NOT EXISTS negentropy.kg_community_summaries (
                    id UUID PRIMARY KEY,
                    corpus_id UUID NOT NULL REFERENCES negentropy.corpus(id) ON DELETE CASCADE,
                    community_id INTEGER NOT NULL,
                    level INTEGER NOT NULL DEFAULT 1,
                    summary_text TEXT NOT NULL,
                    entity_count INTEGER NOT NULL DEFAULT 0,
                    relation_count INTEGER NOT NULL DEFAULT 0,
                    top_entities JSONB NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_kg_community_summaries_corpus_level
                        UNIQUE (corpus_id, community_id, level)
                )
                """
            )
        )
        summaries_exists = True

    # G1: kg_community_summaries 增加摘要 embedding 列
    #
    # pgvector 是 Phase 4 GraphRAG Global Search 的硬依赖：
    #   - community_summarizer._persist_summary 用 ``:embedding::vector`` 写入；
    #   - global_search._select_relevant_summaries 用 ``embedding <=> ...`` 检索。
    # 之前的 TEXT 回退会让无 pgvector 部署在写入/检索阶段才发现 ``type vector
    # does not exist`` —— 远比迁移期 fail-fast 难诊断。改为硬要求并附引导信息。
    if summaries_exists:
        has_pgvector = bind.execute(sa.text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")).scalar()
        if not has_pgvector:
            raise RuntimeError(
                "pgvector extension is required for Phase 4 GraphRAG Global Search "
                "(kg_community_summaries.embedding). Install via "
                "`CREATE EXTENSION IF NOT EXISTS vector;` then re-run alembic upgrade."
            )
        op.execute(
            sa.text("ALTER TABLE negentropy.kg_community_summaries ADD COLUMN IF NOT EXISTS embedding vector(1536)")
        )
        op.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_kg_community_summaries_corpus_updated "
                "ON negentropy.kg_community_summaries(corpus_id, updated_at DESC)"
            )
        )

    # G3: kg_relations 当前活跃事实部分索引 + valid_from backfill
    # 防御性修复：在历史故障导致 0022 未真正添加时态列时，此处补上以满足 0023 索引依赖
    if relations_exists:
        op.execute(sa.text("ALTER TABLE negentropy.kg_relations ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NULL"))
        op.execute(sa.text("ALTER TABLE negentropy.kg_relations ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ NULL"))
        op.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_kg_relations_valid_active "
                "ON negentropy.kg_relations(corpus_id) "
                "WHERE valid_to IS NULL AND is_active = true"
            )
        )
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
