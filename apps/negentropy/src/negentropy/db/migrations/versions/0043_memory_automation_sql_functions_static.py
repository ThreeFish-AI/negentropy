"""将 Memory Automation SQL 函数从运行时 reconcile 迁移为静态迁移定义

Revision ID: 0043
Revises: 0042
Create Date: 2026-05-28 00:00:00.000000+00:00

设计动机：
    Memory Automation 的 SQL 函数（cleanup_low_value_memories, trigger_maintenance_consolidation,
    calculate_retention_score）原先由 MemoryAutomationService._reconcile_functions() 在运行时
    CREATE OR REPLACE。现移除该服务，改为迁移静态定义。

    本迁移仅覆盖 handler 直接或间接调用的 3 个函数：
    - calculate_retention_score：被 cleanup_low_value_memories 内部调用
    - cleanup_low_value_memories：被 handler _run_cleanup 调用
    - trigger_maintenance_consolidation：被 handler _run_consolidation 调用

    不再需要的函数（get_context_window, reweight_all_users_relevance）不在此迁移中创建。
    Rocchio 重加权由 handler 直接调用 Python，不依赖 SQL 函数。

幂等性：
    CREATE OR REPLACE FUNCTION 保证幂等。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0043"
down_revision: str | None = "0042"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.execute(
        sa.text(
            f"""
CREATE OR REPLACE FUNCTION {SCHEMA}.calculate_retention_score(
    p_access_count INTEGER,
    p_last_accessed_at TIMESTAMP WITH TIME ZONE,
    p_decay_rate FLOAT DEFAULT 0.1
)
RETURNS FLOAT AS $$
DECLARE
    days_elapsed FLOAT;
    time_decay FLOAT;
    frequency_boost FLOAT;
BEGIN
    days_elapsed := EXTRACT(EPOCH FROM (NOW() - p_last_accessed_at)) / 86400.0;
    time_decay := EXP(-p_decay_rate * days_elapsed);
    frequency_boost := 1.0 + LN(1.0 + p_access_count);
    RETURN LEAST(1.0, time_decay * frequency_boost / 5.0);
END;
$$ LANGUAGE plpgsql;
            """.strip()
        )
    )

    op.execute(
        sa.text(
            f"""
CREATE OR REPLACE FUNCTION {SCHEMA}.cleanup_low_value_memories(
    p_threshold FLOAT DEFAULT 0.1,
    p_min_age_days INTEGER DEFAULT 7,
    p_decay_rate FLOAT DEFAULT 0.1
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE {SCHEMA}.memories
    SET retention_score = {SCHEMA}.calculate_retention_score(
        access_count,
        COALESCE(last_accessed_at, created_at),
        p_decay_rate
    );

    DELETE FROM {SCHEMA}.memories
    WHERE retention_score < p_threshold
      AND created_at < NOW() - make_interval(days => p_min_age_days);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
            """.strip()
        )
    )

    op.execute(
        sa.text(
            f"""
CREATE OR REPLACE FUNCTION {SCHEMA}.trigger_maintenance_consolidation(
    p_interval INTERVAL DEFAULT '1 hour'
)
RETURNS INTEGER AS $$
DECLARE
    job_count INTEGER;
BEGIN
    WITH new_jobs AS (
        INSERT INTO {SCHEMA}.consolidation_jobs (thread_id, job_type, status)
        SELECT t.id, 'full_consolidation', 'pending'
        FROM {SCHEMA}.threads t
        WHERE t.updated_at > NOW() - p_interval
          AND NOT EXISTS (
              SELECT 1
              FROM {SCHEMA}.consolidation_jobs cj
              WHERE cj.thread_id = t.id
                AND cj.created_at > NOW() - p_interval
          )
        RETURNING 1
    )
    SELECT COUNT(*) INTO job_count FROM new_jobs;

    RETURN job_count;
END;
$$ LANGUAGE plpgsql;
            """.strip()
        )
    )


def downgrade() -> None:
    # 函数保留：handler 运行时依赖这些函数，不随 downgrade 删除
    pass
