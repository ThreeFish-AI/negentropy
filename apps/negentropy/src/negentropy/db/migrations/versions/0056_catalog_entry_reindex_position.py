"""Reindex catalog entries with position=0 to incrementing SORT_GAP intervals

Revision ID: 0056
Revises: 0055
Create Date: 2026-06-01 00:00:00.000000+00:00

设计动机：
    历史 ``assign_document`` 未设置 ``position``，导致所有 DOCUMENT_REF
    叶子节点 ``position`` 默认为 0。前端拖拽排序的分数索引算法在全部兄弟
    sort_order 相同时坍缩为同一值，致使拖拽移动被 no-op 检查跳过。

    本迁移按 ``parent_entry_id`` 分组、``created_at`` 排序，为 ``position=0``
    的记录赋予 ``(ROW_NUMBER * 1000)`` 递增值，确保存量数据可正常拖拽排序。
"""

from alembic import op

revision = "0056"
down_revision = "0055"
branch_labels = None
depends_on = None

SCHEMA = "negentropy"
TABLE = f"{SCHEMA}.doc_catalog_entries"
SORT_GAP = 1000


def upgrade() -> None:
    op.execute(f"""
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY parent_entry_id
                    ORDER BY created_at
                ) AS rn
            FROM {TABLE}
            WHERE position = 0
        )
        UPDATE {TABLE} e
        SET position = r.rn * {SORT_GAP}
        FROM ranked r
        WHERE e.id = r.id
    """)


def downgrade() -> None:
    # Reindexing is not reversible to a meaningful prior state.
    pass
