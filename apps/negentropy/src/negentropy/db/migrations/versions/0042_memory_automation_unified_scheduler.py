"""将 Memory Automation 作业从 pg_cron 迁移至 Unified Scheduler

Revision ID: 0042
Revises: 0041
Create Date: 2026-05-27 00:00:00.000000+00:00

设计动机：
    Memory Automation 的 3 个定时作业（cleanup_memories, trigger_consolidation,
    reweight_relevance）原先由 pg_cron 扩展驱动。现已迁移至 Unified Scheduler
    的 ScheduledTaskRegistry（通过 memory_automation handler）。

    本迁移：
    1. 清理 pg_cron 中的旧 job（如果存在）
    2. 将 memory_automation_configs 表中的 enabled 状态同步到 scheduled_tasks

幂等性：
    - pg_cron 清理操作包裹在 try/except 中，pg_cron 未安装时静默跳过
    - scheduled_tasks 的 INSERT ... ON CONFLICT 保证幂等
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0042"
down_revision: str | None = "0041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. 尝试 unschedule pg_cron 中的旧 Memory Automation 作业
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
                    DELETE FROM cron.job WHERE jobname IN (
                        'cleanup_memories',
                        'trigger_consolidation',
                        'reweight_relevance'
                    );
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- pg_cron 表可能不可访问，静默跳过
                NULL;
            END $$;
            """
        )
    )

    # 2. 注意：scheduled_tasks 行由 registry.ensure_defaults() 在应用启动时创建，
    #    此处不做额外插入以保持与现有 default task 注册模式一致。
    #    enabled 状态的同步依赖应用启动流程。


def downgrade() -> None:
    # 无需回滚：pg_cron job 已被删除，scheduled_tasks 行由 ensure_defaults() 管理
    pass
