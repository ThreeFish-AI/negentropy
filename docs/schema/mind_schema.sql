-- tools: 动态工具注册表
CREATE TABLE IF NOT EXISTS tools (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name        VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    display_name    VARCHAR(255),
    description     TEXT,

    -- OpenAPI Schema (JSON 格式)
    openapi_schema  JSONB NOT NULL,

    -- 权限与配置
    permissions     JSONB DEFAULT '{}',
    -- 示例: {"allowed_users": ["*"], "rate_limit": 100, "requires_confirmation": false}

    -- 状态
    is_active       BOOLEAN NOT NULL DEFAULT true,

    -- 统计信息
    call_count      INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms  FLOAT DEFAULT 0,

    -- 时间戳
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 每个应用的工具名称唯一
    CONSTRAINT tools_app_name_unique UNIQUE (app_name, name)
);

CREATE INDEX IF NOT EXISTS idx_tools_app_name ON tools(app_name);
CREATE INDEX IF NOT EXISTS idx_tools_is_active ON tools(app_name, is_active);

-- tool_executions: 工具执行记录审计
CREATE TABLE IF NOT EXISTS tool_executions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id         UUID REFERENCES tools(id),
    run_id          UUID, -- REFERENCES runs(id) ON DELETE CASCADE, -- 可选关联，取决于 runs 表是否存在
    
    input_params    JSONB,
    output_result   JSONB,
    status          VARCHAR(50), -- 'pending', 'success', 'failed'
    latency_ms      FLOAT,
    error           TEXT,
    
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- traces: OpenTelemetry Trace 结构化存储
CREATE TABLE IF NOT EXISTS traces (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID, -- REFERENCES runs(id) ON DELETE CASCADE,

    -- OpenTelemetry 标识
    trace_id            VARCHAR(32) NOT NULL,
    span_id             VARCHAR(16) NOT NULL,
    parent_span_id      VARCHAR(16),

    -- Span 信息
    operation_name      VARCHAR(255) NOT NULL,
    span_kind           VARCHAR(20) NOT NULL DEFAULT 'INTERNAL',
    -- CHECK (span_kind IN ('INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER'))

    -- 属性与事件
    attributes          JSONB DEFAULT '{}',
    events              JSONB DEFAULT '[]',

    -- 时间信息
    start_time          TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time            TIMESTAMP WITH TIME ZONE,
    duration_ns         BIGINT,

    -- 状态
    status_code         VARCHAR(10) DEFAULT 'UNSET',
    -- CHECK (status_code IN ('UNSET', 'OK', 'ERROR'))
    status_message      TEXT,

    -- 创建时间
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traces_run_id ON traces(run_id);
CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_start_time ON traces(start_time DESC);

-- sandbox_executions: 沙箱执行记录
CREATE TABLE IF NOT EXISTS sandbox_executions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID, -- REFERENCES runs(id),
    sandbox_type    VARCHAR(50), -- 'microsandbox', 'docker', 'wasm'
    code            TEXT,
    environment     JSONB,
    stdout          TEXT,
    stderr          TEXT,
    exit_code       INTEGER,
    execution_time_ms FLOAT,
    resource_usage  JSONB,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
