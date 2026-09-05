"""Retune: pdf_fidelity_patrol 巡检节奏 3600s(1h) → 600s(10min)。

Revision ID: 0091
Revises: 0090
Create Date: 2026-07-07 00:00:00.000000+00:00

设计动机：
    「PDF→Markdown 高保真自拟合巡检」系统任务（``key=pdf_fidelity_patrol``）原节奏为每
    ``interval_seconds=3600``（1h）触发一轮。为更高频推进高保真自拟合巡检闭环，将其收敛到
    每 ``600s``（10min）一次。

    该任务是**系统任务**（``is_system=TRUE``），Scheduler REST 端点 ``PUT /scheduler/tasks/{id}``
    对系统任务显式拒绝改写；且节奏权威是 ``scheduled_tasks.interval_seconds`` 列（仅由 0076 种子
    以 ``ON CONFLICT DO NOTHING`` 写入 3600，对已存在行无效）。故以本前向迁移 ``UPDATE`` 该行——
    「单一事实源＝全部迁移的累积结果」，新旧 DB 均收敛到 600s。

    额外：
    - ``next_fire_at = NOW()`` —— 令新节奏于下一 tick 即时生效（缩短 interval 时 ``NOW()`` 恒 ≤ 旧
      计划时刻，只把下一轮提前，符合「每 600s 检查」意图；叠加 handler「在跑即 SKIP」互斥与灰度门控
      ``routine.enabled`` + ``routine.patrol_enabled``，无并发/雪崩风险）。
    - 同步刷新 ``description`` 列的「每 1h」→「每 600s（10min）」，使 Scheduler UI 展示与真实节奏一致。

幂等性：
    精确 ``WHERE key = :key`` 的 ``UPDATE``；重跑安全。

References:
[1] 0076_seed_pdf_fidelity_patrol_task.py — 本任务的种子与节奏语义来源。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0091"
down_revision: str | None = "0090"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
TABLE = f"{SCHEMA}.scheduled_tasks"

TASK_KEY = "pdf_fidelity_patrol"

_INTERVAL_NEW = 600.0  # 每 600s（10min）
_INTERVAL_OLD = 3600.0  # 每 1h（0076 原值）

# description 与 0076 种子保持同构，仅节奏措辞随 interval 同步。
_DESC_NEW = (
    "每 600s（10min）轮询一份生产 PDF 文档，启动 NegentropyEngine 巡检 Routine："
    "视觉对比 Markdown↔PDF、改 perceives、重转、评分，拟合至满分；Perceives 改进经非回归"
    "校验后以 PR 合回基线。灰度门控：routine.enabled + routine.patrol_enabled。"
)
_DESC_OLD = (
    "每 1h 轮询一份生产 PDF 文档，启动 NegentropyEngine 巡检 Routine："
    "视觉对比 Markdown↔PDF、改 perceives、重转、评分，拟合至满分；Perceives 改进经非回归"
    "校验后以 PR 合回基线。灰度门控：routine.enabled + routine.patrol_enabled。"
)

_UPDATE_SQL = f"""
    UPDATE {TABLE}
       SET interval_seconds = :interval_seconds,
           description       = :description,
           next_fire_at      = NOW()
     WHERE key = :key
    """


def upgrade() -> None:
    op.execute(
        sa.text(_UPDATE_SQL).bindparams(
            sa.bindparam("interval_seconds", value=_INTERVAL_NEW),
            sa.bindparam("description", value=_DESC_NEW),
            sa.bindparam("key", value=TASK_KEY),
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(_UPDATE_SQL).bindparams(
            sa.bindparam("interval_seconds", value=_INTERVAL_OLD),
            sa.bindparam("description", value=_DESC_OLD),
            sa.bindparam("key", value=TASK_KEY),
        )
    )
