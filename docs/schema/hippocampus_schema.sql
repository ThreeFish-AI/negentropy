-- ============================================
-- Agentic AI Engine - Hippocampus Schema Extension
-- Version: 1.0
-- Target: PostgreSQL 16+ with pgvector
-- Prerequisite: Phase 1 agent_schema.sql 已部署
-- ============================================

-- ============================================
-- 1. memories 表 (情景记忆: Episodic Memory)
-- ============================================
CREATE TABLE IF NOT EXISTS memories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id           UUID REFERENCES threads(id) ON DELETE SET NULL,
    user_id             VARCHAR(255) NOT NULL,
    app_name            VARCHAR(255) NOT NULL,
    -- 记忆类型
    memory_type         VARCHAR(50) NOT NULL DEFAULT 'episodic',    -- CHECK (memory_type IN ('episodic', 'semantic', 'summary'))
    -- 记忆内容
    content             TEXT NOT NULL,
    -- 向量嵌入 (用于语义检索)
    embedding           vector(1536),
    -- 元数据 (时间切片、来源事件等)
    metadata            JSONB DEFAULT '{}',
    -- 记忆保持机制 (艾宾浩斯衰减)
    retention_score     FLOAT NOT NULL DEFAULT 1.0,
    access_count        INTEGER NOT NULL DEFAULT 0,
    last_accessed_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_user_app ON memories(user_id, app_name);
CREATE INDEX IF NOT EXISTS idx_memories_thread ON memories(thread_id);
CREATE INDEX IF NOT EXISTS idx_memories_retention ON memories(retention_score DESC);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);
-- HNSW 向量索引 (用于语义检索)
CREATE INDEX IF NOT EXISTS idx_memories_embedding
    ON memories USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
-- 复合索引 (情景分块检索)
CREATE INDEX IF NOT EXISTS idx_memories_time_bucket
    ON memories(user_id, app_name, created_at DESC);

-- ============================================
-- 2. facts 表 (语义记忆: Semantic Memory / Key-Value Facts)
-- ============================================
CREATE TABLE IF NOT EXISTS facts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id           UUID REFERENCES threads(id) ON DELETE SET NULL,
    user_id             VARCHAR(255) NOT NULL,
    app_name            VARCHAR(255) NOT NULL,
    -- 事实类型与键
    fact_type           VARCHAR(50) NOT NULL DEFAULT 'preference',  -- CHECK (fact_type IN ('preference', 'rule', 'profile', 'custom'))
    key                 VARCHAR(255) NOT NULL,
    -- 事实值 (结构化 JSON)
    value               JSONB NOT NULL,
    -- 向量嵌入 (可选，用于语义检索)
    embedding           vector(1536),
    -- 事实置信度
    confidence          FLOAT NOT NULL DEFAULT 1.0,
    -- 有效期
    valid_from          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until         TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- 每个用户的每个 key 只有一个有效值 (可更新)
    CONSTRAINT facts_user_key_unique UNIQUE (user_id, app_name, fact_type, key)
);

CREATE INDEX IF NOT EXISTS idx_facts_user_app ON facts(user_id, app_name);
CREATE INDEX IF NOT EXISTS idx_facts_type_key ON facts(fact_type, key);
CREATE INDEX IF NOT EXISTS idx_facts_value ON facts USING GIN (value);
-- 有效期过滤索引
CREATE INDEX IF NOT EXISTS idx_facts_validity
    ON facts(user_id, app_name)
    WHERE valid_until IS NULL;

-- ============================================
-- 3. consolidation_jobs 表 (巩固任务队列)
-- ============================================
CREATE TABLE IF NOT EXISTS consolidation_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id           UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    -- 任务状态
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',     -- CHECK (job_type IN ('fast_replay', 'deep_reflection', 'full_consolidation'))
    -- 任务类型
    job_type            VARCHAR(50) NOT NULL,   -- CHECK (job_type IN ('fast_replay', 'deep_reflection', 'full_consolidation'))
    -- 处理结果
    result              JSONB DEFAULT '{}',
    error               TEXT,
    started_at          TIMESTAMP WITH TIME ZONE,
    completed_at        TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consolidation_jobs_status ON consolidation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_consolidation_jobs_thread ON consolidation_jobs(thread_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_jobs_pending
    ON consolidation_jobs(created_at)
    WHERE status = 'pending';

-- ============================================
-- 4. instructions 表 (程序性记忆)
-- ============================================
CREATE TABLE IF NOT EXISTS instructions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name            VARCHAR(255) NOT NULL,
    instruction_key     VARCHAR(255) NOT NULL,
    content             TEXT NOT NULL,
    version             INTEGER NOT NULL DEFAULT 1,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT instructions_app_key_version_unique UNIQUE (app_name, instruction_key, version)
);

CREATE INDEX IF NOT EXISTS idx_instructions_app ON instructions(app_name);
CREATE INDEX IF NOT EXISTS idx_instructions_key ON instructions(instruction_key);

-- ============================================
-- 5. SQL 函数: 艾宾浩斯衰减计算 (Ebbinghaus Decay)
-- ============================================
CREATE OR REPLACE FUNCTION calculate_retention_score(
    p_access_count INTEGER,
    p_last_accessed_at TIMESTAMP WITH TIME ZONE,
    p_decay_rate FLOAT DEFAULT 0.1  -- λ 衰减系数
)
RETURNS FLOAT AS $$
DECLARE
    days_elapsed FLOAT;
    time_decay FLOAT;
    frequency_boost FLOAT;
BEGIN
    -- 计算距离上次访问的天数
    days_elapsed := EXTRACT(EPOCH FROM (NOW() - p_last_accessed_at)) / 86400.0;
    -- 时间衰减 (指数衰减)
    time_decay := EXP(-p_decay_rate * days_elapsed);
    -- 频率加成 (对数平滑)
    frequency_boost := 1.0 + LN(1.0 + p_access_count);
    -- 综合保留分数 (归一化到 0-1)
    RETURN LEAST(1.0, time_decay * frequency_boost / 5.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 6. SQL 函数: 清理低价值记忆
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_low_value_memories(
    p_threshold FLOAT DEFAULT 0.1,      -- 保留分数阈值
    p_min_age_days INTEGER DEFAULT 7    -- 最小保留天数
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 先更新所有记忆的保留分数
    UPDATE memories
    SET retention_score = calculate_retention_score(access_count, last_accessed_at);

    -- 删除低于阈值且超过最小保留期的记忆
    DELETE FROM memories
    WHERE retention_score < p_threshold
      AND created_at < NOW() - INTERVAL '1 day' * p_min_age_days;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. pg_cron 定时任务 (可选)
-- ============================================
-- 每天凌晨 2 点执行记忆清理
-- SELECT cron.schedule('cleanup_memories', '0 2 * * *', $$SELECT cleanup_low_value_memories(0.1, 7)$$);
-- ============================================
-- 8. SQL 函数: Context Window 组装 (根据 Token 预算动态组装)
-- ============================================
CREATE OR REPLACE FUNCTION get_context_window(
    p_user_id VARCHAR(255),
    p_app_name VARCHAR(255),
    p_query TEXT,
    p_query_embedding vector(1536),
    p_max_tokens INTEGER DEFAULT 4000,
    p_memory_ratio FLOAT DEFAULT 0.3,  -- 记忆占比
    p_history_ratio FLOAT DEFAULT 0.5   -- 历史占比
)
RETURNS TABLE (
    context_type VARCHAR(50),
    content TEXT,
    relevance_score FLOAT,
    token_estimate INTEGER
) AS $$
DECLARE
    memory_budget INTEGER;
    history_budget INTEGER;
BEGIN
    -- 计算各部分 Token 预算
    memory_budget := (p_max_tokens * p_memory_ratio)::INTEGER;
    history_budget := (p_max_tokens * p_history_ratio)::INTEGER;

    -- 返回相关记忆 (按相似度 + 保留分数排序)
    RETURN QUERY
    SELECT
        'memory'::VARCHAR(50) AS context_type,
        m.content,
        (1 - (m.embedding <=> p_query_embedding)) * m.retention_score AS relevance_score,
        (LENGTH(m.content) / 4)::INTEGER AS token_estimate  -- 粗略估算
    FROM memories m
    WHERE m.user_id = p_user_id
        AND m.app_name = p_app_name
    ORDER BY relevance_score DESC
    LIMIT 10;

    -- 返回最近历史 (来自 events 表)
    RETURN QUERY
    SELECT
        'history'::VARCHAR(50) AS context_type,
        e.content::TEXT,
        1.0::FLOAT AS relevance_score,  -- 历史按时间排序
        (LENGTH(e.content::TEXT) / 4)::INTEGER AS token_estimate
    FROM events e
    JOIN threads t ON e.thread_id = t.id
    WHERE t.user_id = p_user_id
        AND t.app_name = p_app_name
    ORDER BY e.created_at DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. SQL 函数: 触发周期性巩固 (Cron Trigger)
-- ============================================
CREATE OR REPLACE FUNCTION trigger_maintenance_consolidation(
    p_interval INTERVAL DEFAULT '1 hour'
)
RETURNS INTEGER AS $$
DECLARE
    job_count INTEGER;
BEGIN
    WITH new_jobs AS (
        INSERT INTO consolidation_jobs (thread_id, job_type, status)
        SELECT id, 'full_consolidation', 'pending'
        FROM threads
        WHERE updated_at > NOW() - p_interval
          AND id NOT IN (
              SELECT thread_id FROM consolidation_jobs
              WHERE created_at > NOW() - p_interval
          )
        RETURNING 1
    )
    SELECT COUNT(*) INTO job_count FROM new_jobs;
    RETURN job_count;
END;
$$ LANGUAGE plpgsql;

