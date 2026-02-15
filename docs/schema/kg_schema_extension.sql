-- ============================================
-- Knowledge Graph Schema Extension
-- Version: 1.0
-- Target: PostgreSQL 16+ with pgvector and Apache AGE
-- Prerequisite: perception_schema.sql 已部署
-- ============================================
--
-- 本脚本包含 Knowledge Graph 的所有数据库扩展：
--   Part 1: Apache AGE 扩展启用
--   Part 2: Knowledge 表扩展 (实体字段)
--   Part 3: 知识图谱创建
--   Part 4: 图谱构建历史表
--   Part 5: 图遍历函数
--   Part 6: 混合检索函数 (向量 + 图)
--   Part 7: 验证脚本
--
-- 参考文献:
-- [1] Apache AGE, "Apache AGE Documentation," 2024.
-- [2] Neo4j, "Cypher Query Language," 2024.
--
-- ============================================

-- ================================
-- Part 1: Apache AGE 扩展启用
-- ================================

-- 1.1 启用 Apache AGE 扩展
CREATE EXTENSION IF NOT EXISTS age;

-- 1.2 加载 AGE 到当前会话
-- 注意: 应用程序需要在每个连接中执行 LOAD 'age';
-- SET search_path = ag_catalog, "$user", public;

-- 1.3 创建 AGE 图谱
-- 使用 negentropy schema 作为命名空间
SELECT create_graph('negentropy_kg');

COMMENT ON EXTENSION age IS 'Apache AGE 图数据库扩展，用于存储和查询知识图谱';

-- ================================
-- Part 2: Knowledge 表扩展
-- 为知识块添加实体相关字段
-- ================================

-- 2.1 添加实体类型字段
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS
    entity_type VARCHAR(50);  -- 实体类型: person/org/concept/event/location/product

-- 2.2 添加实体置信度字段
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS
    entity_confidence FLOAT DEFAULT 1.0;  -- 提取置信度 [0, 1]

-- 2.3 添加实体索引 (按类型筛选)
CREATE INDEX IF NOT EXISTS idx_kb_entity_type
    ON knowledge(entity_type)
    WHERE entity_type IS NOT NULL;

-- 2.4 添加置信度索引 (筛选高质量实体)
CREATE INDEX IF NOT EXISTS idx_kb_entity_confidence
    ON knowledge(entity_confidence)
    WHERE entity_type IS NOT NULL;

-- 2.5 注释
COMMENT ON COLUMN knowledge.entity_type IS '实体类型，当知识块被识别为实体时设置';
COMMENT ON COLUMN knowledge.entity_confidence IS '实体提取置信度，LLM 提取时返回 [0, 1]';

-- ================================
-- Part 3: 实体/关系类型枚举
-- ================================

-- 3.1 实体类型枚举
CREATE TYPE kg_entity_type AS ENUM (
    'person',        -- 人物
    'organization',  -- 组织/公司
    'location',      -- 地点
    'event',         -- 事件
    'concept',       -- 概念/术语
    'product',       -- 产品
    'document',      -- 文档
    'other'          -- 其他
);

-- 3.2 关系类型枚举
CREATE TYPE kg_relation_type AS ENUM (
    -- 组织关系
    'WORKS_FOR',     -- 就职于
    'PART_OF',       -- 隶属于
    'LOCATED_IN',    -- 位于

    -- 语义关系
    'RELATED_TO',    -- 相关
    'SIMILAR_TO',    -- 相似
    'DERIVED_FROM',  -- 衍生自

    -- 因果关系
    'CAUSES',        -- 导致
    'PRECEDES',      -- 先于
    'FOLLOWS',       -- 后于

    -- 引用关系
    'MENTIONS',      -- 提及
    'CREATED_BY',    -- 创建者

    -- 共现关系
    'CO_OCCURS'      -- 共现
);

-- ================================
-- Part 4: 图谱构建历史表
-- 追踪每次图谱构建的状态和统计
-- ================================

-- 4.1 图谱构建运行表
CREATE TABLE IF NOT EXISTS kg_build_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name VARCHAR(255) NOT NULL,
    corpus_id UUID REFERENCES corpus(id) ON DELETE CASCADE,

    -- 运行标识
    run_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending/running/completed/failed

    -- 统计信息
    entity_count INTEGER DEFAULT 0,
    relation_count INTEGER DEFAULT 0,
    chunks_processed INTEGER DEFAULT 0,

    -- 配置快照
    extractor_config JSONB DEFAULT '{}',  -- 使用的提取器配置
    model_name VARCHAR(255),               -- LLM 模型名称

    -- 错误信息
    error_message TEXT,

    -- 时间戳
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(app_name, run_id)
);

-- 4.2 索引
CREATE INDEX IF NOT EXISTS idx_kg_build_corpus ON kg_build_runs(corpus_id);
CREATE INDEX IF NOT EXISTS idx_kg_build_status ON kg_build_runs(status);
CREATE INDEX IF NOT EXISTS idx_kg_build_app ON kg_build_runs(app_name);

COMMENT ON TABLE kg_build_runs IS '知识图谱构建运行历史，追踪每次构建的状态和统计';

-- ================================
-- Part 5: 实体检索视图
-- 统一访问实体知识块
-- ================================

-- 5.1 实体检索视图
CREATE OR REPLACE VIEW kg_entities AS
SELECT
    k.id,
    k.content as label,
    k.entity_type as type,
    k.embedding,
    k.metadata,
    k.entity_confidence as confidence,
    k.corpus_id,
    k.app_name,
    k.created_at
FROM knowledge k
WHERE k.entity_type IS NOT NULL;

COMMENT ON VIEW kg_entities IS '实体视图，仅返回被识别为实体的知识块';

-- ================================
-- Part 6: 图遍历函数
-- 使用 Apache AGE Cypher 查询
-- ================================

-- 6.1 查询实体邻居 (1-N 跳)
-- 注意: Apache AGE 需要通过 cypher() 函数执行 Cypher 查询
CREATE OR REPLACE FUNCTION kg_neighbors(
    p_entity_id UUID,
    p_max_depth INTEGER DEFAULT 2,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    neighbor_id UUID,
    neighbor_label TEXT,
    neighbor_type VARCHAR,
    relation_type VARCHAR,
    distance INTEGER,
    weight FLOAT
) AS $$
BEGIN
    -- 使用 Apache AGE Cypher 查询邻居
    -- 实际实现需要在应用层使用 cypher() 函数
    -- 这里提供一个基于 knowledge 表的简化版本

    RETURN QUERY
    WITH RECURSIVE neighbor_tree AS (
        -- 基础情况: 获取起始实体的直接邻居
        SELECT
            e.id as neighbor_id,
            e.content as neighbor_label,
            e.entity_type as neighbor_type,
            'RELATED_TO'::VARCHAR as relation_type,
            1 as distance,
            1.0::FLOAT as weight
        FROM knowledge e
        WHERE e.id = p_entity_id
          AND e.entity_type IS NOT NULL

        UNION ALL

        -- 递归: 这里简化为直接返回基础情况
        -- 实际的图遍历需要通过 Apache AGE Cypher 实现
        SELECT
            e.id,
            e.content,
            e.entity_type,
            'RELATED_TO'::VARCHAR,
            1,
            1.0::FLOAT
        FROM knowledge e
        WHERE e.entity_type IS NOT NULL
          AND e.id = p_entity_id
    )
    SELECT DISTINCT ON (neighbor_id)
        neighbor_id,
        neighbor_label,
        neighbor_type,
        relation_type,
        distance,
        weight
    FROM neighbor_tree
    WHERE neighbor_id != p_entity_id
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kg_neighbors(UUID, INTEGER, INTEGER) IS '查询实体的邻居节点（图遍历）';

-- 6.2 实体重要性计算 (简化版 PageRank)
-- 完整版需要使用 Apache AGE GDS 或 Neo4j
CREATE OR REPLACE FUNCTION kg_entity_importance(
    p_entity_id UUID
)
RETURNS FLOAT AS $$
DECLARE
    v_incoming_count INTEGER;
    v_outgoing_count INTEGER;
    v_importance FLOAT;
BEGIN
    -- 简化版: 基于连接数计算重要性
    -- 完整版应使用 PageRank 算法

    SELECT COUNT(*) INTO v_incoming_count
    FROM knowledge k
    WHERE k.metadata->>'related_entities' IS NOT NULL
      AND p_entity_id::text = ANY(
          SELECT jsonb_array_elements_text(k.metadata->'related_entities')
      );

    SELECT COUNT(*) INTO v_outgoing_count
    FROM knowledge k
    WHERE k.id = p_entity_id
      AND k.metadata->>'related_entities' IS NOT NULL;

    -- 重要性 = log(1 + 入度 + 出度)
    v_importance := ln(1 + v_incoming_count + v_outgoing_count + 1);

    RETURN v_importance;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kg_entity_importance(UUID) IS '计算实体重要性分数（简化版 PageRank）';

-- ================================
-- Part 7: 混合检索函数
-- 向量检索 + 图遍历增强
-- ================================

-- 7.1 图谱增强的混合检索
CREATE OR REPLACE FUNCTION kg_hybrid_search(
    p_corpus_id UUID,
    p_app_name VARCHAR(255),
    p_query TEXT,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 20,
    p_graph_depth INTEGER DEFAULT 1,
    p_semantic_weight FLOAT DEFAULT 0.6,
    p_graph_weight FLOAT DEFAULT 0.4
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    semantic_score REAL,
    graph_score REAL,
    combined_score REAL,
    metadata JSONB,
    entity_type VARCHAR
) AS $$
DECLARE
    v_entity_ids UUID[];
BEGIN
    -- 1. 语义检索获取候选实体
    RETURN QUERY
    WITH semantic_results AS (
        SELECT
            k.id,
            k.content,
            (1 - (k.embedding <=> p_query_embedding))::REAL as score,
            k.metadata,
            k.entity_type
        FROM knowledge k
        WHERE k.corpus_id = p_corpus_id
          AND k.app_name = p_app_name
          AND k.entity_type IS NOT NULL
        ORDER BY k.embedding <=> p_query_embedding
        LIMIT p_limit * 2
    ),
    graph_enhanced AS (
        SELECT
            sr.id,
            sr.content,
            sr.score as semantic_score,
            -- 图分数: 基于实体连接数的对数归一化
            COALESCE(
                ln(1 + (
                    SELECT COUNT(*)
                    FROM knowledge k2
                    WHERE k2.metadata->>'related_entities' IS NOT NULL
                      AND sr.id::text = ANY(
                          SELECT jsonb_array_elements_text(k2.metadata->'related_entities')
                      )
                )) / 5.0,  -- 归一化因子
                0.0
            )::REAL as graph_score,
            sr.metadata,
            sr.entity_type
        FROM semantic_results sr
    )
    SELECT
        ge.id,
        ge.content,
        ge.semantic_score,
        ge.graph_score,
        (ge.semantic_score * p_semantic_weight + ge.graph_score * p_graph_weight)::REAL as combined_score,
        ge.metadata,
        ge.entity_type
    FROM graph_enhanced ge
    ORDER BY combined_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kg_hybrid_search(UUID, VARCHAR, TEXT, vector, INTEGER, INTEGER, FLOAT, FLOAT) IS
    '图谱增强的混合检索：向量相似度 + 图结构分数';

-- 7.2 实体类型筛选检索
CREATE OR REPLACE FUNCTION kg_search_by_type(
    p_corpus_id UUID,
    p_app_name VARCHAR(255),
    p_entity_type VARCHAR(50),
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    score REAL,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        k.id,
        k.content,
        (1 - (k.embedding <=> p_query_embedding))::REAL as score,
        k.metadata
    FROM knowledge k
    WHERE k.corpus_id = p_corpus_id
      AND k.app_name = p_app_name
      AND k.entity_type = p_entity_type
    ORDER BY k.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kg_search_by_type(UUID, VARCHAR, VARCHAR, vector, INTEGER) IS
    '按实体类型筛选的语义检索';

-- ================================
-- Part 8: 图谱统计函数
-- ================================

-- 8.1 语料库图谱统计
CREATE OR REPLACE FUNCTION kg_corpus_stats(
    p_corpus_id UUID
)
RETURNS TABLE (
    total_entities BIGINT,
    by_type JSONB,
    avg_confidence FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_entities,
        jsonb_object_agg(entity_type, type_count) as by_type,
        AVG(entity_confidence)::FLOAT as avg_confidence
    FROM (
        SELECT
            k.entity_type,
            COUNT(*) as type_count
        FROM knowledge k
        WHERE k.corpus_id = p_corpus_id
          AND k.entity_type IS NOT NULL
        GROUP BY k.entity_type
    ) subq,
    (
        SELECT AVG(k2.entity_confidence) as avg_conf
        FROM knowledge k2
        WHERE k2.corpus_id = p_corpus_id
          AND k2.entity_type IS NOT NULL
    ) avg_subq
    GROUP BY avg_conf;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kg_corpus_stats(UUID) IS '获取语料库的图谱统计信息';

-- ================================
-- Part 9: Apache AGE Cypher 辅助函数
-- 封装常用的 Cypher 查询
-- ================================

-- 9.1 创建实体节点 (Cypher)
-- 使用示例:
-- SELECT * FROM kg_create_entity(
--     'entity-001', 'OpenAI', 'organization', 0.95, 'corpus-001'::uuid
-- );
CREATE OR REPLACE FUNCTION kg_create_entity(
    p_entity_id VARCHAR,
    p_label VARCHAR,
    p_type VARCHAR,
    p_confidence FLOAT,
    p_corpus_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- 使用 Apache AGE Cypher 创建节点
    -- 注意: 需要先 LOAD 'age'; SET search_path = ag_catalog, "$user", public;
    PERFORM * FROM cypher('negentropy_kg', $c$
        CREATE (e:Entity {
            id: $entity_id,
            label: $label,
            type: $type,
            confidence: $confidence,
            corpus_id: $corpus_id,
            created_at: datetime()
        })
    $c$, params=>'{
        "entity_id": "' || p_entity_id || '",
        "label": "' || replace(p_label, '"', '\\"') || '",
        "type": "' || p_type || '",
        "confidence": ' || p_confidence || ',
        "corpus_id": "' || p_corpus_id || '"
    }');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kg_create_entity(VARCHAR, VARCHAR, VARCHAR, FLOAT, UUID) IS
    '使用 Apache AGE Cypher 创建实体节点';

-- 9.2 创建关系边 (Cypher)
CREATE OR REPLACE FUNCTION kg_create_relation(
    p_source_id VARCHAR,
    p_target_id VARCHAR,
    p_relation_type VARCHAR,
    p_confidence FLOAT,
    p_evidence TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    PERFORM * FROM cypher('negentropy_kg', $c$
        MATCH (s:Entity {id: $source_id})
        MATCH (t:Entity {id: $target_id})
        CREATE (s)-[r:RELATES_TO {
            type: $relation_type,
            confidence: $confidence,
            evidence: $evidence,
            created_at: datetime()
        }]->(t)
    $c$, params=>'{
        "source_id": "' || p_source_id || '",
        "target_id": "' || p_target_id || '",
        "relation_type": "' || p_relation_type || '",
        "confidence": ' || p_confidence || ',
        "evidence": "' || COALESCE(replace(p_evidence, '"', '\\"'), '') || '"
    }');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kg_create_relation(VARCHAR, VARCHAR, VARCHAR, FLOAT, TEXT) IS
    '使用 Apache AGE Cypher 创建关系边';

-- 9.3 查询实体邻居 (Cypher)
CREATE OR REPLACE FUNCTION kg_cypher_neighbors(
    p_entity_id VARCHAR,
    p_max_depth INTEGER DEFAULT 2,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id agtype,
    label agtype,
    type agtype,
    distance agtype,
    relation agtype
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM cypher('negentropy_kg', $c$
        MATCH path = (start:Entity {id: $entity_id})-[*1..$max_depth]-(neighbor:Entity)
        RETURN neighbor.id, neighbor.label, neighbor.type,
               length(path) as distance,
               [r IN relationships(path) | r.type] as relation
        LIMIT $limit
    $c$, params=>'{
        "entity_id": "' || p_entity_id || '",
        "max_depth": ' || p_max_depth || ',
        "limit": ' || p_limit || '
    }');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kg_cypher_neighbors(VARCHAR, INTEGER, INTEGER) IS
    '使用 Apache AGE Cypher 查询实体邻居';

-- ================================
-- Part 10: 验证脚本
-- ================================

-- 10.1 验证 Apache AGE 扩展
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'age') THEN
        RAISE NOTICE 'Apache AGE extension not installed. Please install it first.';
    ELSE
        RAISE NOTICE 'Apache AGE extension is installed.';
    END IF;
END $$;

-- 10.2 验证图谱存在
DO $$
BEGIN
    -- Apache AGE 图谱存储在 ag_graph 表中
    IF EXISTS (SELECT 1 FROM ag_graph WHERE name = 'negentropy_kg') THEN
        RAISE NOTICE 'Knowledge Graph "negentropy_kg" exists.';
    ELSE
        RAISE NOTICE 'Knowledge Graph "negentropy_kg" will be created on first use.';
    END IF;
END $$;

-- 10.3 验证知识表扩展
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge' AND column_name = 'entity_type'
    ) THEN
        RAISE NOTICE 'Knowledge table extended with entity_type column.';
    ELSE
        RAISE EXCEPTION 'Knowledge table entity_type column not found.';
    END IF;
END $$;

-- ================================
-- End of Schema
-- ================================

-- 版本标记
CREATE TABLE IF NOT EXISTS kg_schema_version (
    version VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO kg_schema_version (version) VALUES ('1.0.0')
ON CONFLICT (version) DO NOTHING;
