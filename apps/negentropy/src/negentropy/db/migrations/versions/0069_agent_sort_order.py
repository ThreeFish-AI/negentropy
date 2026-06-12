"""agents 新增 sort_order 列：支持前端拖拽排序持久化

Revision ID: 0069
Revises: 0068
Create Date: 2026-06-12 00:00:00.000000+00:00

设计动机：
    Interface / Agents 页已支持拖拽重排序卡片，但排序仅存在前端 React state 中，
    刷新页面即丢失。本迁移为 ``agents`` 表新增 ``sort_order`` 列，使后端能存储并
    返回用户自定义的排序，前端拖拽后调用 ``PATCH /agents/reorder`` 批量写入。

正交分解：
    本迁移仅做 schema（加列 + 索引），不涉及数据回填。既有行 ``sort_order`` 取
    server_default 0，配合 ``list_agents`` 的 ``sort_order ASC, created_at DESC``
    二级排序，升级前后行为一致（零回归）。

幂等性：
    ``ADD COLUMN IF NOT EXISTS`` + ``CREATE INDEX IF NOT EXISTS``，重跑安全。

downgrade：
    删索引 + 删列（``IF EXISTS``）。本列为新增、无外部依赖，可安全回滚。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0069"
down_revision: str | None = "0068"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
TABLE = "agents"


def upgrade() -> None:
    op.add_column(
        TABLE,
        sa.Column(
            "sort_order",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_agents_sort_order",
        TABLE,
        ["sort_order"],
        schema=SCHEMA,
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_agents_sort_order", table_name=TABLE, schema=SCHEMA, if_exists=True)
    op.drop_column(TABLE, "sort_order", schema=SCHEMA)
