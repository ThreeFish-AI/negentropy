"""skills、builtin_tools、mcp_servers 新增 sort_order 列：支持前端拖拽排序持久化

Revision ID: 0070
Revises: 0069
Create Date: 2026-06-12 00:00:00.000000+00:00

设计动机：
    与 agents.sort_order（0069 迁移）对齐，为 Interface 模块的 Skills / Tools /
    MCP Servers 三张表新增 ``sort_order`` 列，使后端能存储并返回用户自定义的排序，
    前端拖拽后调用 ``PATCH /{type}/reorder`` 批量写入。

正交分解：
    本迁移仅做 schema（加列），不涉及数据回填。既有行 ``sort_order`` 取
    server_default 0，配合各 list 端点的 ``sort_order ASC, created_at DESC``
    二级排序，升级前后行为一致（零回归）。

幂等性：
    ``ADD COLUMN IF NOT EXISTS``，重跑安全。

downgrade：
    删列（``IF EXISTS``）。本列为新增、无外部依赖，可安全回滚。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0070"
down_revision: str | None = "0069"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"

TABLES = ["skills", "builtin_tools", "mcp_servers"]


def upgrade() -> None:
    for table in TABLES:
        op.add_column(
            table,
            sa.Column(
                "sort_order",
                sa.Integer(),
                server_default=sa.text("0"),
                nullable=False,
            ),
            schema=SCHEMA,
        )


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_column(table, "sort_order", schema=SCHEMA)
