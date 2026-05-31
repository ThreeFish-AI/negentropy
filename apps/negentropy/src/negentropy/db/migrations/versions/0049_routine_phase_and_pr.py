"""为 Routine 相位化工作流新增 current_phase / pr_url / iteration.phase 列。

Revision ID: 0049
Revises: 0048
Create Date: 2026-05-31 06:00:00.000000+00:00

设计动机：
    支撑「PLAN → IMPLEMENT → FINALIZE(建 PR)」相位状态机（用户描述的全流程）。

      1. ``routines.current_phase``：相位状态机指针（plan|implement|finalize）。
         server_default='implement' —— 对既有行（含扁平工作流 routine）安全回填为
         「实施」相位，行为与相位化前完全一致；相位化 routine 在创建时显式置为 'plan'。
      2. ``routines.pr_url``：FINALIZE 阶段 Claude Code 创建的 PR 链接；非空 + succeeded
         即「等待人工 Merge」。
      3. ``routine_iterations.phase``：每迭代不可变相位记录，驱动 UI 徽标与
         「首个 implement 迭代审批门控」判定。

幂等性：
    加列前以 information_schema 探测列存在性（仿 0048 建表幂等范式），便于半失败重试。

参考文献：
[1] 0048_routine_tables.py — information_schema 幂等 DDL 范式。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0049"
down_revision: str | None = "0048"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = :s AND table_name = :t AND column_name = :c"
            ),
            {"s": SCHEMA, "t": table_name, "c": column_name},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    if not _column_exists(bind, "routines", "current_phase"):
        op.add_column(
            "routines",
            sa.Column(
                "current_phase",
                sa.String(length=16),
                nullable=False,
                server_default=sa.text("'implement'"),
                comment="plan|implement|finalize — 相位状态机指针（仅 phased 工作流推进三相位）",
            ),
            schema=SCHEMA,
        )

    if not _column_exists(bind, "routines", "pr_url"):
        op.add_column(
            "routines",
            sa.Column(
                "pr_url",
                sa.Text(),
                nullable=True,
                comment="FINALIZE 阶段创建的 PR 链接；非空 + succeeded 表示等待人工 Merge",
            ),
            schema=SCHEMA,
        )

    if not _column_exists(bind, "routine_iterations", "phase"):
        op.add_column(
            "routine_iterations",
            sa.Column(
                "phase",
                sa.String(length=16),
                nullable=True,
                comment="plan|implement|finalize — 本迭代所属相位（派发时定格）",
            ),
            schema=SCHEMA,
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _column_exists(bind, "routine_iterations", "phase"):
        op.drop_column("routine_iterations", "phase", schema=SCHEMA)
    if _column_exists(bind, "routines", "pr_url"):
        op.drop_column("routines", "pr_url", schema=SCHEMA)
    if _column_exists(bind, "routines", "current_phase"):
        op.drop_column("routines", "current_phase", schema=SCHEMA)
