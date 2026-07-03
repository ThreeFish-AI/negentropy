"""重建 uq_evolution_proposals_one_inflight 部分唯一索引（纳入 runtime_canary 状态）

Revision ID: 0087
Revises: 0086_eval_suite_is_safety
Create Date: 2026-07-03 00:00:00.000000+00:00

设计动机：
    R3-b runtime canary 新增 ``status='runtime_canary'`` 非终态（综述 §9.3 受控发布窗口）。
    单在途不变量（每 target_ref 至多一个非终态提案）的 DB 级兜底 ``uq_evolution_proposals_one_inflight``
    部分唯一索引的 WHERE 子句须同步纳入 ``runtime_canary``，否则两条 runtime_canary 提案可并存。
    本迁移 DROP + CREATE 该索引（WHERE 增加 'runtime_canary'）。

幂等性：CREATE 前 DROP IF EXISTS。
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0087"
down_revision: str | None = "0086"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {SCHEMA}.uq_evolution_proposals_one_inflight")
    op.create_index(
        "uq_evolution_proposals_one_inflight",
        "evolution_proposals",
        ["target_ref"],
        unique=True,
        postgresql_where="status IN ('draft','shadow_eval','pending_approval','canary','runtime_canary')",
        schema=SCHEMA,
    )


def downgrade() -> None:
    # 回退到 0081 的原 WHERE（不含 runtime_canary）
    op.execute(f"DROP INDEX IF EXISTS {SCHEMA}.uq_evolution_proposals_one_inflight")
    op.create_index(
        "uq_evolution_proposals_one_inflight",
        "evolution_proposals",
        ["target_ref"],
        unique=True,
        postgresql_where="status IN ('draft','shadow_eval','pending_approval','canary')",
        schema=SCHEMA,
    )
