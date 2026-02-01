-- ============================================
-- Agentic AI Engine - Perception Schema Extension
-- Version: 2.0
-- Target: PostgreSQL 16+ with pgvector
-- Prerequisite: Phase 2 hippocampus_schema.sql 已部署
-- ============================================
--
-- 本脚本包含 Phase 3 Perception 的所有数据库对象：
--   Part 1: Knowledge Base Schema (corpus + knowledge 表)
--   Part 2: Memory Schema 扩展 (search_vector 列 + 触发器)
--   Part 3: JSONB Complex Predicates 索引
--   Part 4: Hybrid Search 函数 (用于 memories 表)
--   Part 5: RRF Search 函数 (用于 memories 表)
--   Part 6: Knowledge Base Hybrid Search 函数 (用于 knowledge 表)
--   Part 7: 验证脚本
--
-- ============================================

-- ================================
-- Part 1: Knowledge Base Schema
-- 用于存储静态知识 (PDF/Markdown/FAQ)
-- ================================

-- 1.1 Corpus 表 (语料库管理)
CREATE TABLE IF NOT EXISTS corpus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}',  -- chunking_strategy, embedding_model, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(app_name, name)
);

CREATE INDEX IF NOT EXISTS idx_corpus_app_name ON corpus(app_name);

COMMENT ON TABLE corpus IS '语料库管理表，用于管理 Knowledge Base 的顶层容器';

-- 1.2 Knowledge 表 (知识块存储)
CREATE TABLE IF NOT EXISTS knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corpus_id UUID NOT NULL REFERENCES corpus(id) ON DELETE CASCADE,
    app_name VARCHAR(255) NOT NULL,

    -- 内容字段
    content TEXT NOT NULL,
    embedding vector(1536),
    search_vector tsvector,

    -- 来源追溯
    source_uri TEXT,                -- 原始文件路径/URL
    chunk_index INTEGER DEFAULT 0,   -- 分块序号

    -- 元数据
    metadata JSONB DEFAULT '{}',     -- author, tags, version, etc.

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.3 Knowledge Base 索引
-- 向量索引 (HNSW)
CREATE INDEX IF NOT EXISTS idx_kb_embedding
    ON knowledge USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 全文索引 (GIN)
CREATE INDEX IF NOT EXISTS idx_kb_search_vector
    ON knowledge USING GIN (search_vector);

-- 过滤索引
CREATE INDEX IF NOT EXISTS idx_kb_corpus_app
    ON knowledge(corpus_id, app_name);

-- JSONB 元数据索引
CREATE INDEX IF NOT EXISTS idx_kb_metadata_gin
    ON knowledge USING GIN (metadata);

-- 1.4 Knowledge Base 触发器
CREATE OR REPLACE FUNCTION kb_search_vector_trigger()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_kb_search_vector ON knowledge;
CREATE TRIGGER trigger_kb_search_vector
    BEFORE INSERT OR UPDATE ON knowledge
    FOR EACH ROW
    EXECUTE FUNCTION kb_search_vector_trigger();

COMMENT ON TABLE knowledge IS '知识块存储表，用于 RAG Pipeline 的静态知识检索';

-- ================================
-- Part 2: Memory Schema 扩展
-- 为 memories 表添加全文搜索支持
-- ================================

-- 2.1 添加全文搜索列
ALTER TABLE memories ADD COLUMN IF NOT EXISTS
    search_vector tsvector;

-- 2.2 创建触发器自动更新 search_vector
CREATE OR REPLACE FUNCTION memories_search_vector_trigger()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_memories_search_vector ON memories;
CREATE TRIGGER trigger_memories_search_vector
    BEFORE INSERT OR UPDATE ON memories
    FOR EACH ROW
    EXECUTE FUNCTION memories_search_vector_trigger();

-- 2.3 回填已有数据的 search_vector
UPDATE memories SET search_vector = to_tsvector('english', content)
WHERE search_vector IS NULL;

-- 2.4 创建 GIN 全文索引
CREATE INDEX IF NOT EXISTS idx_memories_search_vector
    ON memories USING GIN (search_vector);

-- 2.5 创建复合索引 (高频过滤场景)
CREATE INDEX IF NOT EXISTS idx_memories_user_app_created
    ON memories(user_id, app_name, created_at DESC);

-- ================================
-- Part 3: JSONB Complex Predicates 索引
-- 支持任意深度的布尔逻辑过滤
-- ================================

-- 3.1 GIN 索引：支持 @>、?、?&、?| 操作符
CREATE INDEX IF NOT EXISTS idx_memories_metadata_gin
    ON memories USING GIN (metadata);

-- 3.2 表达式索引：针对高频查询路径
-- 场景：频繁按 author.role 过滤
CREATE INDEX IF NOT EXISTS idx_memories_author_role
    ON memories ((metadata->'author'->>'role'));

-- 场景：频繁按 priority 范围过滤
CREATE INDEX IF NOT EXISTS idx_memories_metadata_priority
    ON memories (((metadata->>'priority')::int));

-- ================================
-- Part 4: Hybrid Search 函数 (用于 memories 表)
-- One-Shot 混合检索：语义 + 关键词
-- 任务 ID: P3-1-5
-- ================================

CREATE OR REPLACE FUNCTION hybrid_search(
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
    -- 1. 语义检索 (向量)
    semantic_results AS (
        SELECT
            m.id,
            m.content,
            1 - (m.embedding <=> p_query_embedding) AS score,
            m.metadata
        FROM memories m
        WHERE m.user_id = p_user_id
          AND m.app_name = p_app_name
          AND (p_metadata_filter IS NULL OR m.metadata @> p_metadata_filter)
        ORDER BY m.embedding <=> p_query_embedding
        LIMIT p_limit * 2  -- 召回 2 倍用于融合
    ),
    -- 2. 关键词检索 (BM25)
    keyword_results AS (
        SELECT
            m.id,
            m.content,
            ts_rank_cd(m.search_vector, plainto_tsquery('english', p_query)) AS score,
            m.metadata
        FROM memories m
        WHERE m.user_id = p_user_id
          AND m.app_name = p_app_name
          AND m.search_vector @@ plainto_tsquery('english', p_query)
          AND (p_metadata_filter IS NULL OR m.metadata @> p_metadata_filter)
        ORDER BY score DESC
        LIMIT p_limit * 2
    ),
    -- 3. 合并去重
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
    -- 4. 加权融合排序
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

-- ================================
-- Part 5: RRF Search 函数 (用于 memories 表)
-- Reciprocal Rank Fusion 融合检索
-- 任务 ID: P3-1-7
-- ================================

CREATE OR REPLACE FUNCTION rrf_search(
    p_user_id VARCHAR(255),
    p_app_name VARCHAR(255),
    p_query TEXT,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 50,
    p_k INTEGER DEFAULT 60  -- RRF 平滑常数
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    rrf_score REAL,
    semantic_rank INTEGER,
    keyword_rank INTEGER,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH
    -- 1. 语义检索 + 排名
    semantic_ranked AS (
        SELECT
            m.id, m.content, m.metadata,
            ROW_NUMBER() OVER (ORDER BY m.embedding <=> p_query_embedding) AS rank
        FROM memories m
        WHERE m.user_id = p_user_id AND m.app_name = p_app_name
        ORDER BY m.embedding <=> p_query_embedding
        LIMIT p_limit * 3
    ),
    -- 2. 关键词检索 + 排名
    keyword_ranked AS (
        SELECT
            m.id, m.content, m.metadata,
            ROW_NUMBER() OVER (
                ORDER BY ts_rank_cd(m.search_vector, plainto_tsquery('english', p_query)) DESC
            ) AS rank
        FROM memories m
        WHERE m.user_id = p_user_id
          AND m.app_name = p_app_name
          AND m.search_vector @@ plainto_tsquery('english', p_query)
        ORDER BY ts_rank_cd(m.search_vector, plainto_tsquery('english', p_query)) DESC
        LIMIT p_limit * 3
    ),
    -- 3. RRF 融合
    rrf_combined AS (
        SELECT
            COALESCE(s.id, k.id) AS id,
            COALESCE(s.content, k.content) AS content,
            COALESCE(s.metadata, k.metadata) AS metadata,
            s.rank AS semantic_rank,
            k.rank AS keyword_rank,
            -- RRF 公式: sum(1 / (k + rank))
            (COALESCE(1.0 / (p_k + s.rank), 0) +
            COALESCE(1.0 / (p_k + k.rank), 0))::REAL AS rrf_score
        FROM semantic_ranked s
        FULL OUTER JOIN keyword_ranked k ON s.id = k.id
    )
    -- 4. 按 RRF 分数排序
    SELECT
        c.id,
        c.content,
        c.rrf_score,
        c.semantic_rank::INTEGER,
        c.keyword_rank::INTEGER,
        c.metadata
    FROM rrf_combined c
    ORDER BY c.rrf_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- Part 6: Knowledge Base Hybrid Search 函数
-- 用于 knowledge 表的混合检索
-- 任务 ID: P3-4-10
-- ================================

CREATE OR REPLACE FUNCTION kb_hybrid_search(
    p_corpus_id UUID,
    p_app_name VARCHAR(255),
    p_query TEXT,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 50,
    p_semantic_weight FLOAT DEFAULT 0.7,
    p_keyword_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    source_uri TEXT,
    semantic_score REAL,
    keyword_score REAL,
    combined_score REAL,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH
    -- 1. 语义检索 (向量)
    semantic_results AS (
        SELECT
            kb.id, kb.content, kb.source_uri,
            (1 - (kb.embedding <=> p_query_embedding))::REAL AS score,
            kb.metadata
        FROM knowledge kb
        WHERE kb.corpus_id = p_corpus_id AND kb.app_name = p_app_name
        ORDER BY kb.embedding <=> p_query_embedding
        LIMIT p_limit * 2
    ),
    -- 2. 关键词检索 (BM25)
    keyword_results AS (
        SELECT
            kb.id, kb.content, kb.source_uri,
            ts_rank_cd(kb.search_vector, plainto_tsquery('english', p_query))::REAL AS score,
            kb.metadata
        FROM knowledge kb
        WHERE kb.corpus_id = p_corpus_id
          AND kb.app_name = p_app_name
          AND kb.search_vector @@ plainto_tsquery('english', p_query)
        ORDER BY score DESC
        LIMIT p_limit * 2
    ),
    -- 3. 合并去重
    combined AS (
        SELECT
            COALESCE(s.id, k.id) AS id,
            COALESCE(s.content, k.content) AS content,
            COALESCE(s.source_uri, k.source_uri) AS source_uri,
            COALESCE(s.score, 0)::REAL AS semantic_score,
            COALESCE(k.score, 0)::REAL AS keyword_score,
            COALESCE(s.metadata, k.metadata) AS metadata
        FROM semantic_results s
        FULL OUTER JOIN keyword_results k ON s.id = k.id
    )
    -- 4. 加权融合排序
    SELECT
        c.id,
        c.content,
        c.source_uri,
        c.semantic_score,
        c.keyword_score,
        (c.semantic_score * p_semantic_weight + c.keyword_score * p_keyword_weight)::REAL AS combined_score,
        c.metadata
    FROM combined c
    ORDER BY combined_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- Part 7: 验证脚本
-- ================================

-- 7.1 验证表结构
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('corpus', 'knowledge', 'memories')
  AND column_name IN ('embedding', 'search_vector', 'metadata', 'corpus_id')
ORDER BY table_name, ordinal_position;

-- 7.2 验证索引
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('corpus', 'knowledge', 'memories')
ORDER BY tablename, indexname;

-- 7.3 验证函数
SELECT proname, pronargs, prokind
FROM pg_proc
WHERE proname IN (
    'hybrid_search',
    'rrf_search',
    'kb_hybrid_search',
    'memories_search_vector_trigger',
    'kb_search_vector_trigger'
);

-- 7.4 验证触发器
SELECT tgname, relname
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE relname IN ('memories', 'knowledge')
  AND tgname LIKE 'trigger_%';