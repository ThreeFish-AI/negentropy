"""Seed: pdf_fidelity_patrol 系统调度任务（PDF→Markdown 高保真自拟合巡检）。

Revision ID: 0076
Revises: 0075
Create Date: 2026-06-27 00:00:00.000000+00:00

设计动机：
    将「PDF→Markdown 高保真自拟合巡检」注册为一条系统 ScheduledTask（``handler_kind=
    pdf_fidelity_patrol``，``interval=3600s``），作为巡检的**节奏权威**。每 tick 由
    ``pdf_fidelity_patrol`` handler：确保 Repository → 沉淀终态记忆 → 跳过在跑 → 选下一份
    待检 PDF → 预取源 PDF → 创建并启动一个绑定 Repo 的巡检 Routine（= NegentropyEngine，
    三系部循环拟合至满分；worktree + FINALIZE 开 PR；0-100 评估闭环）。

    节奏语义：``trigger_type=interval`` 下，``ScheduledTaskRegistry._compute_next_fire`` 以
    **handler 完成时刻** + ``interval_seconds`` 计 ``next_fire_at``，叠加 handler 的「在跑即 SKIP」
    互斥，天然满足「巡检进行中则等待其结束 + 1h 再启下一轮」。

幂等性：
    ``ON CONFLICT (key) DO NOTHING``（依赖 ``scheduled_tasks.key`` 唯一约束）；重跑安全。

灰度（safe-by-default）：
    种子任务 ``enabled=TRUE``（满足「默认每 1h 启动一次」），但 handler 以
    ``settings.routine.patrol_enabled``（默认 False）+ ``settings.routine.enabled`` 为二级门控：
    二者皆开 + ``patrol_repo_local_path`` 配置后巡检才真正干活。与 routine 子系统灰度范式一致。

References:
[1] 0046_seed_default_scheduled_tasks.py — 幂等 scheduled_tasks seed 范式。
[2] 0064_seed_pdf_fidelity_restore_skill.py — pdf-fidelity-restore 全局技能（巡检会话引用）。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0076"
down_revision: str | None = "0075"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
TABLE = f"{SCHEMA}.scheduled_tasks"

TASK_KEY = "pdf_fidelity_patrol"


def upgrade() -> None:
    op.execute(
        sa.text(
            f"""
            INSERT INTO {TABLE}
                (key, handler_kind, trigger_type, interval_seconds, cron_expr,
                 role, scenario, category, display_name, description,
                 payload, max_concurrency, token_budget, enabled, is_system, next_fire_at)
            VALUES
                (:key, :handler_kind, :trigger_type, :interval_seconds, :cron_expr,
                 :role, :scenario, :category, :display_name, :description,
                 :payload, :max_concurrency, :token_budget, :enabled, :is_system, NOW())
            ON CONFLICT (key) DO NOTHING
            """
        ).bindparams(
            sa.bindparam("key", value=TASK_KEY),
            sa.bindparam("handler_kind", value="pdf_fidelity_patrol"),
            sa.bindparam("trigger_type", value="interval"),
            sa.bindparam("interval_seconds", value=3600.0),
            sa.bindparam("cron_expr", value=None),
            sa.bindparam("role", value="supervisor"),
            sa.bindparam("scenario", value="pdf_fidelity"),
            sa.bindparam("category", value="cognitive"),
            sa.bindparam(
                "display_name",
                value="PDF Fidelity Patrol（PDF→Markdown 高保真自拟合巡检）",
            ),
            sa.bindparam(
                "description",
                value=(
                    "每 1h 轮询一份生产 PDF 文档，启动 NegentropyEngine 巡检 Routine：视觉对比 "
                    "Markdown↔PDF、改 perceives、重转、评分，拟合至满分；Perceives 改进经非回归"
                    "校验后以 PR 合回基线。灰度门控：routine.enabled + routine.patrol_enabled。"
                ),
            ),
            sa.bindparam("payload", value={}, type_=sa.dialects.postgresql.JSONB),
            sa.bindparam("max_concurrency", value=1),
            sa.bindparam("token_budget", value=None),
            sa.bindparam("enabled", value=True),
            sa.bindparam("is_system", value=True),
        )
    )


def downgrade() -> None:
    # 遵循 AGENTS.md「谨慎数据迁移回滚」：downgrade 删除本迁移种子的系统任务（精确 key 匹配）。
    op.execute(
        sa.text(f"DELETE FROM {TABLE} WHERE key = :key AND is_system = TRUE").bindparams(
            sa.bindparam("key", value=TASK_KEY),
        )
    )
