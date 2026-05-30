"""为 memories 表补齐全文检索基建并创建 hybrid_search() 函数

Revision ID: 0047
Revises: 0046
Create Date: 2026-05-30 00:00:00.000000+00:00

设计动机（修复预存缺陷）：
    ``PostgresMemoryService._hybrid_search_native`` 调用 ``negentropy.hybrid_search()``
    DB 函数完成「语义 + BM25」一次性融合检索，但该函数从未被任何 alembic 迁移创建
    （仅存在于 docs/reference/.../perception_schema.sql 与 cognizes app 的 schema 文件，
    未移植到 negentropy）。memories 表也缺 ``search_vector tsvector`` 列。

    后果：Hybrid 检索（主模块 C2 / P0）一直抛 UndefinedFunction 并静默回退到纯向量
    检索；同时 F1 HippoRAG PPR 仅在 Hybrid 分支融合，故 PPR 也被连带架空。

    本迁移以 perception_schema.sql 的权威定义为准，schema 限定到 ``negentropy``：
    1) memories 增 ``search_vector`` 列 + BEFORE INSERT/UPDATE 触发器自动维护
    2) 回填存量行 + 建 GIN 索引
    3) 创建 ``hybrid_search()`` 函数（FULL OUTER JOIN 融合 + 加权排序）

幂等性：
    全部使用 IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS，可重复执行。

数据安全：
    纯新增列 + 回填，不删除/改写任何既有记忆内容。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0047"
down_revision: str | None = "0046"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    # 1) 全文检索列（tsvector）+ 自动维护触发器
    op.execute(
        sa.text(
            f"""
ALTER TABLE {SCHEMA}.memories
    ADD COLUMN IF NOT EXISTS search_vector tsvector;
            """.strip()
        )
    )

    op.execute(
        sa.text(
            f"""
CREATE OR REPLACE FUNCTION {SCHEMA}.memories_update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
            """.strip()
        )
    )

    op.execute(
        sa.text(
            f"""
DROP TRIGGER IF EXISTS trigger_memories_search_vector ON {SCHEMA}.memories;
            """.strip()
        )
    )
    op.execute(
        sa.text(
            f"""
CREATE TRIGGER trigger_memories_search_vector
    BEFORE INSERT OR UPDATE OF content ON {SCHEMA}.memories
    FOR EACH ROW
    EXECUTE FUNCTION {SCHEMA}.memories_update_search_vector();
            """.strip()
        )
    )

    # 2) 回填存量行 + GIN 索引
    op.execute(
        sa.text(
            f"""
UPDATE {SCHEMA}.memories
SET search_vector = to_tsvector('english', COALESCE(content, ''))
WHERE search_vector IS NULL;
            """.strip()
        )
    )
    op.execute(
        sa.text(
            f"""
CREATE INDEX IF NOT EXISTS idx_memories_search_vector
    ON {SCHEMA}.memories USING GIN (search_vector);
            """.strip()
        )
    )

    # 3) hybrid_search() 函数（语义 + BM25 加权融合，权威定义见 perception_schema.sql）
    op.execute(
        sa.text(
            f"""
CREATE OR REPLACE FUNCTION {SCHEMA}.hybrid_search(
    p_user_id VARCHAR(255),
    p_app_name VARCHAR(255),
    p_query TEXT,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 50,
    p_semantic_weight FLOAT DEFAULT 0.7,
    p_keyword_weight FLOAT DEFAULT 0.3,
    p_metadata_filter JSONB DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    semantic_score REAL,
    keyword_score REAL,
    combined_score REAL,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH
    semantic_results AS (
        SELECT
            m.id,
            m.content,
            (1 - (m.embedding <=> p_query_embedding))::REAL AS score,
            m.metadata
        FROM {SCHEMA}.memories m
        WHERE m.user_id = p_user_id
          AND m.app_name = p_app_name
          AND m.embedding IS NOT NULL
          AND (p_metadata_filter IS NULL OR m.metadata @> p_metadata_filter)
        ORDER BY m.embedding <=> p_query_embedding
        LIMIT p_limit * 2
    ),
    keyword_results AS (
        SELECT
            m.id,
            m.content,
            ts_rank_cd(m.search_vector, plainto_tsquery('english', p_query)) AS score,
            m.metadata
        FROM {SCHEMA}.memories m
        WHERE m.user_id = p_user_id
          AND m.app_name = p_app_name
          AND m.search_vector @@ plainto_tsquery('english', p_query)
          AND (p_metadata_filter IS NULL OR m.metadata @> p_metadata_filter)
        ORDER BY score DESC
        LIMIT p_limit * 2
    ),
    combined AS (
        SELECT
            COALESCE(s.id, k.id) AS id,
            COALESCE(s.content, k.content) AS content,
            COALESCE(s.score, 0)::REAL AS semantic_score,
            COALESCE(k.score, 0)::REAL AS keyword_score,
            COALESCE(s.metadata, k.metadata) AS metadata
        FROM semantic_results s
        FULL OUTER JOIN keyword_results k ON s.id = k.id
    )
    SELECT
        c.id,
        c.content,
        c.semantic_score,
        c.keyword_score,
        (c.semantic_score * p_semantic_weight + c.keyword_score * p_keyword_weight)::REAL AS combined_score,
        c.metadata
    FROM combined c
    ORDER BY combined_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
            """.strip()
        )
    )


def downgrade() -> None:
    # 函数 / 列保留：运行时检索依赖；回退仅删除本迁移新建的索引与触发器，避免破坏数据。
    op.execute(sa.text(f"DROP INDEX IF EXISTS {SCHEMA}.idx_memories_search_vector;"))
    op.execute(sa.text(f"DROP TRIGGER IF EXISTS trigger_memories_search_vector ON {SCHEMA}.memories;"))
    op.execute(
        sa.text(
            f"DROP FUNCTION IF EXISTS {SCHEMA}.hybrid_search"
            "(VARCHAR, VARCHAR, TEXT, vector, INTEGER, FLOAT, FLOAT, JSONB);"
        )
    )
    op.execute(sa.text(f"DROP FUNCTION IF EXISTS {SCHEMA}.memories_update_search_vector();"))
