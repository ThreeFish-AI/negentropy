"""Alter catalog_entries.position from INTEGER to DOUBLE PRECISION

Revision ID: 0061
Revises: 0060
Create Date: 2026-06-05 00:00:00.000000+00:00

设计动机：
    前端目录树拖拽排序采用分数索引（Fractional Indexing）策略：取相邻节点
    ``sort_order`` 的中点（如 ``(0 + 1625) / 2 = 812.5``）作为新位置。
    后端 ``position`` 列为 ``INTEGER``，无法存储浮点值，导致 Pydantic 验证
    在 API 边界即拦截并返回 422 Unprocessable Entity。

    本迁移将 ``position`` 列从 ``INTEGER`` 改为 ``DOUBLE PRECISION``，使后端
    全栈（Pydantic schema → Service → DAO → DB）均支持浮点排序值。

    现有整数数据在类型变更后语义不变（``1000`` 作为 ``1000.0`` 存储）。
"""

from alembic import op

revision = "0061"
down_revision = "0060"
branch_labels = None
depends_on = None

SCHEMA = "negentropy"
TABLE = f"{SCHEMA}.doc_catalog_entries"


def upgrade() -> None:
    op.execute(f"ALTER TABLE {TABLE} ALTER COLUMN position TYPE DOUBLE PRECISION")


def downgrade() -> None:
    op.execute(f"ALTER TABLE {TABLE} ALTER COLUMN position TYPE INTEGER USING position::INTEGER")
