"""seed longitudinal_recheck scheduled_task（纵向复评，综述 §8 #3 + §10.5 + §9.3）

Revision ID: 0085
Revises: 0084_skill_active_version
Create Date: 2026-07-03 00:00:00.000000+00:00

设计动机：
    已晋升的进化对象（skill 等）不会自动再验证——流量漂移、依赖变更、模型升级都可能让一次通过
    晋升门的对象静默退化。综述 §10.5 明确「experience→capability 无 scaling-law 类关系」，§9.3
    要求「安全评估须与改进环并行常驻，非一次性前置门」。本迁移 seed 一个 ``longitudinal_recheck``
    cron 任务（默认每日 04:17 off-peak，``enabled=False``），驱动
    ``EvolutionOrchestrator.recheck_promoted``：对有 eval 基座的面复跑 holdout 集 vs 晋升均值，
    drift 超阈则回退 ``active_version``。

幂等性：seed 行用 ``WHERE NOT EXISTS`` 守卫。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0085"
down_revision: str | None = "0084"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            f"""
            INSERT INTO {SCHEMA}.scheduled_tasks
                (key, handler_kind, trigger_type, interval_seconds, cron_expr,
                 role, scenario, category, display_name, description,
                 payload, max_concurrency, token_budget, enabled, is_system, next_fire_at)
            SELECT 'longitudinal_recheck', 'longitudinal_recheck', 'cron', NULL,
                   '17 4 * * *',
                   'supervisor', 'evolution', 'cognitive',
                   :display_name, :description,
                   :payload, 1, NULL, FALSE, TRUE, NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM {SCHEMA}.scheduled_tasks WHERE key = 'longitudinal_recheck'
            )
            """
        ).bindparams(
            sa.bindparam("display_name", value="Evolution Longitudinal Recheck"),
            sa.bindparam(
                "description",
                value="已晋升进化对象纵向复评：复跑 holdout 集 vs 晋升均值，drift 回退 active_version（综述 §8 #3）。",
            ),
            sa.bindparam(
                "payload",
                value={"job_type": "longitudinal_recheck"},
                type_=postgresql.JSONB(),
            ),
        )
    )


def downgrade() -> None:
    # 遵循 AGENTS.md「谨慎数据迁移回滚」：仅删本迁移引入的 seed 行。
    bind = op.get_bind()
    bind.execute(
        sa.text(f"DELETE FROM {SCHEMA}.scheduled_tasks WHERE key = 'longitudinal_recheck' AND is_system = TRUE")
    )
