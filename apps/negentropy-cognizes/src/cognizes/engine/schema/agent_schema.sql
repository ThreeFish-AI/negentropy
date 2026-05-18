-- ============================================
-- Agentic AI Engine - Unified Schema
-- Version: 1.0
-- Target: PostgreSQL 16+ with pgvector
-- ============================================

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- 1. threads 表 (会话容器)
-- ============================================
CREATE TABLE IF NOT EXISTS threads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name        VARCHAR(255) NOT NULL,
    user_id         VARCHAR(255) NOT NULL,
    -- 会话状态 (无前缀作用域)
    state           JSONB NOT NULL DEFAULT '{}',
    -- 乐观锁版本号 (OCC)
    version         INTEGER NOT NULL DEFAULT 1,
    -- 元数据
    metadata        JSONB DEFAULT '{}',
    -- 时间戳
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT threads_app_user_unique UNIQUE (app_name, user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_threads_app_user ON threads(app_name, user_id);
CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at DESC);

-- ============================================
-- 2. events 表 (不可变事件流)
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    invocation_id   UUID NOT NULL,
    author          VARCHAR(50) NOT NULL,   -- 'user', 'agent', 'tool'
    event_type      VARCHAR(50) NOT NULL,   -- 'message', 'tool_call', 'state_update'
    -- 事件内容
    content         JSONB NOT NULL DEFAULT '{}',
    -- 事件动作 (state_delta, tool_calls 等)
    actions         JSONB DEFAULT '{}',
    -- 时间戳
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- 序列号 (用于排序)
    sequence_num    BIGSERIAL
);

CREATE INDEX IF NOT EXISTS idx_events_thread_id ON events(thread_id);
CREATE INDEX IF NOT EXISTS idx_events_invocation_id ON events(invocation_id);
CREATE INDEX IF NOT EXISTS idx_events_sequence ON events(thread_id, sequence_num);

-- ============================================
-- 3. runs 表 (执行链路)
-- ============================================
CREATE TABLE IF NOT EXISTS runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    -- 执行状态
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 思考步骤 (用于可观测性)
    -- CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
    thinking_steps  JSONB DEFAULT '[]',
    tool_calls      JSONB DEFAULT '[]',  -- 工具调用记录
    -- 错误信息
    error           TEXT,
    -- 时间戳
    started_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at    TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_runs_thread_id ON runs(thread_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);

-- ============================================
-- 4. messages 表 (带 Embedding 的消息内容)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
    -- 消息元数据
    role            VARCHAR(20) NOT NULL,  -- 'user', 'assistant', 'tool', 'system'
    -- 消息内容
    content         TEXT NOT NULL,
    -- 向量嵌入 (Phase 2 将使用)
    embedding       vector(1536),  -- OpenAI text-embedding-3-small / Gemini embedding
    -- 元数据
    metadata        JSONB DEFAULT '{}',
    -- 时间戳
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_event_id ON messages(event_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
-- HNSW 向量索引 (Phase 2 启用)
-- CREATE INDEX IF NOT EXISTS idx_messages_embedding ON messages USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- 5. snapshots 表 (状态检查点)
-- ============================================
CREATE TABLE IF NOT EXISTS snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    -- 快照版本 (与 threads.version 对应)
    version         INTEGER NOT NULL,
    -- 状态快照
    state           JSONB NOT NULL,
    -- 事件摘要 (可选，用于快速恢复)
    events_summary  JSONB DEFAULT '{}',
    -- 时间戳
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- 每个 thread 的每个 version 只有一个快照
    CONSTRAINT snapshots_thread_version_unique UNIQUE (thread_id, version)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_thread_id ON snapshots(thread_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots(created_at DESC);

-- ============================================
-- 6. user_states 表 (用户级持久状态)
-- ============================================
CREATE TABLE IF NOT EXISTS user_states (
    user_id         VARCHAR(255) NOT NULL,
    app_name        VARCHAR(255) NOT NULL,
    state           JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, app_name)
);

-- JSONB GIN 索引 (支持快速 key 查询)
CREATE INDEX IF NOT EXISTS idx_user_states_state ON user_states USING GIN (state);

-- ============================================
-- 7. app_states 表 (应用级持久状态)
-- ============================================
CREATE TABLE IF NOT EXISTS app_states (
    app_name        VARCHAR(255) PRIMARY KEY,
    state           JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- JSONB GIN 索引
CREATE INDEX IF NOT EXISTS idx_app_states_state ON app_states USING GIN (state);

-- ============================================
-- 8. NOTIFY 触发器 (实时事件流)
-- ============================================
CREATE OR REPLACE FUNCTION notify_event_insert()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'event_stream',
        json_build_object(
            'event_id', NEW.id,
            'thread_id', NEW.thread_id,
            'author', NEW.author,
            'event_type', NEW.event_type,
            'created_at', NEW.created_at
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_event_notify
    AFTER INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION notify_event_insert();

-- ============================================
-- 9. 自动更新 updated_at 触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_threads_updated_at
    BEFORE UPDATE ON threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();