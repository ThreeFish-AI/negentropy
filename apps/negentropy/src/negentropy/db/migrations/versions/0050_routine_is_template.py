"""为 routines 表新增 is_template 列 — 将 Routine 与 Template 统一为同一张表。

Revision ID: 0050
Revises: 0049
Create Date: 2026-05-31 00:00:00.000000+00:00

设计动机：
    将「Routine Template」合并到 ``routines`` 表中，通过 ``is_template = true``
    标记模板行。模板与普通 Routine 共享相同的数据结构（goal / acceptance_criteria /
    预算守卫 / config 等），无需独立的模板表，保持数据模型正交简洁。

    使用流程：
    - 创建模板：POST /routines with is_template=true
    - 浏览模板：GET /routines?is_template=true（含内置 YAML 预设合并）
    - 从模板创建 Routine：复制模板字段到新 Routine 行（is_template=false）
    - 编辑/删除模板：常规 Routine CRUD，限定 is_template=true 过滤

    server_default='false'：对既有行安全回填，所有现有 Routine 保持为非模板。

幂等性：
    加列前以 information_schema 探测列存在性（仿 0049 范式）。

参考文献：
[1] 0049_routine_phase_and_pr.py — information_schema 幂等加列范式。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0050"
down_revision: str | None = "0049"
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

    if not _column_exists(bind, "routines", "is_template"):
        op.add_column(
            "routines",
            sa.Column(
                "is_template",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
                comment="true 时本行为 Routine Template，可作为创建 Routine 的模板来源",
            ),
            schema=SCHEMA,
        )
        op.create_index("ix_routines_is_template", "routines", ["is_template"], schema=SCHEMA)


def downgrade() -> None:
    bind = op.get_bind()

    if _column_exists(bind, "routines", "is_template"):
        op.drop_index("ix_routines_is_template", table_name="routines", schema=SCHEMA)
        op.drop_column("routines", "is_template", schema=SCHEMA)
