"""为 Routine 新增隔离 worktree 三列，支撑「基于基线分支的隔离工作区 + 自动 PR 回基线」。

Revision ID: 0054
Revises: 0053
Create Date: 2026-06-01 00:00:00.000000+00:00

设计动机：
    Routine 执行时此前直接在 ``cwd`` 的当前 checkout 上工作，无隔离——既可能污染用户分支，
    也缺乏「基于基线分支建隔离工作区 → 工作 → 以 PR 回基线」的标准化交付流水线。本迁移引入：

      - ``baseline_branch``（用户输入）：隔离 worktree 的基线分支 + PR base（如 ``origin/feature/1.x.x``）。
        非空即启用 worktree 隔离 + 通用 FINALIZE/PR。``cwd`` 在该模式下语义收敛为 git 仓库根。
      - ``work_branch``（引擎管理的运行期）：本轮创建的工作分支（如 ``routine/<key>-<ts>``）。
      - ``worktree_path``（引擎管理的运行期）：隔离 worktree 的文件系统路径（= Claude Code 实际 cwd）。

    三列均 ``nullable``：既有行安全（语义上等价「未启用 worktree」）；新建可执行 routine 的
    ``baseline_branch`` 必填由 API 层（``routine_api``）强制，DB 不设 NOT NULL 以免破坏既有数据，
    回填留给运维 / 用户经 PUT 补齐（引擎不臆测基线）。

幂等性：
    加列前以 information_schema 探测列存在性（仿 0048/0049/0052 范式），便于半失败重试。

参考文献：
[1] 0052_routine_eval_floor_seq.py — information_schema 幂等加列 + schema 限定范式。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0054"
down_revision: str | None = "0053"
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

    if not _column_exists(bind, "routines", "baseline_branch"):
        op.add_column(
            "routines",
            sa.Column(
                "baseline_branch",
                sa.String(length=255),
                nullable=True,
                comment="worktree 基线分支 + PR base；非空即启用隔离工作区与通用 FINALIZE/PR",
            ),
            schema=SCHEMA,
        )
    if not _column_exists(bind, "routines", "work_branch"):
        op.add_column(
            "routines",
            sa.Column(
                "work_branch",
                sa.String(length=255),
                nullable=True,
                comment="引擎管理的运行期：本轮创建的隔离工作分支（routine/<key>-<ts>）",
            ),
            schema=SCHEMA,
        )
    if not _column_exists(bind, "routines", "worktree_path"):
        op.add_column(
            "routines",
            sa.Column(
                "worktree_path",
                sa.Text(),
                nullable=True,
                comment="引擎管理的运行期：隔离 worktree 文件系统路径（= Claude Code 实际 cwd）；终态回收后置空",
            ),
            schema=SCHEMA,
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _column_exists(bind, "routines", "worktree_path"):
        op.drop_column("routines", "worktree_path", schema=SCHEMA)
    if _column_exists(bind, "routines", "work_branch"):
        op.drop_column("routines", "work_branch", schema=SCHEMA)
    if _column_exists(bind, "routines", "baseline_branch"):
        op.drop_column("routines", "baseline_branch", schema=SCHEMA)
