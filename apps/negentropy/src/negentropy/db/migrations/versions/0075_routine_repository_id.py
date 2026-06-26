"""为 routines 新增可选 repository_id（FK→repositories.id, ondelete=SET NULL）。

Revision ID: 0075
Revises: 0074
Create Date: 2026-06-26 00:00:01.000000+00:00

设计动机：
    Routine 以 ``repository_id`` 指针关联已注册 Repository（单一事实源）。非空时由
    workspace.resolve_effective_repo 派生有效 cwd(=local_path)/baseline_branch；为空则
    回退现有手填 cwd/baseline_branch（保留向后兼容，不破坏存量 Routine）。

    ondelete=SET NULL：删除 Repository 仅把引用它的 routines.repository_id 置空（解除关联），
    不级联删除 Routine；之后解析回退到手填值。

幂等性：
    加列 / 索引前以 information_schema 探测（仿 0054）。FK 目标表 repositories 由 0074 保证先建。

参考文献：
[1] 0054_routine_worktree.py — information_schema 幂等加列范式。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0075"
down_revision: str | None = "0074"
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
    if not _column_exists(bind, "routines", "repository_id"):
        op.add_column(
            "routines",
            sa.Column(
                "repository_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey(f"{SCHEMA}.repositories.id", ondelete="SET NULL"),
                nullable=True,
                comment="可选关联 Repository（单一事实源指针）；非空时派生 cwd/baseline_branch；SET NULL 仅解除关联",
            ),
            schema=SCHEMA,
        )
        op.create_index("ix_routines_repository_id", "routines", ["repository_id"], schema=SCHEMA)


def downgrade() -> None:
    bind = op.get_bind()
    if _column_exists(bind, "routines", "repository_id"):
        op.drop_index("ix_routines_repository_id", table_name="routines", schema=SCHEMA)
        op.drop_column("routines", "repository_id", schema=SCHEMA)
