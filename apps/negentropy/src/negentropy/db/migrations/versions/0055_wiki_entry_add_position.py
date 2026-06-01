"""wiki_publication_entries 新增 entry_position 列以持久化 Catalog 排序顺序

Revision ID: 0055
Revises: 0054
Create Date: 2026-06-01 00:00:00.000000+00:00

设计动机：
    Catalog 目录树支持通过拖拽调整节点（含 DOCUMENT_REF 叶子节点）的排序，
    排序值存储于 ``DocCatalogEntry.position``。但 Wiki 同步链路
    （``wiki_service.sync_entries_from_catalog``）此前未将该 position 传递到
    ``WikiPublicationEntry``，导致 Wiki 站点导航树只能按 slug 字母序排列文档，
    无法反映用户在 Catalog 中设定的顺序。

    新增 ``entry_position`` 列（INTEGER NOT NULL DEFAULT 0）：
      - 值为 0 表示"未显式排序"，回退到 slug 字母序（向后兼容既有数据）；
      - 非 0 值反映 Catalog 侧的 ``position``（或 ``sort_order``）排序权重。

幂等性：
    加列前以 ``information_schema`` 探测列存在性（仿 0051 范式），便于半失败重试。

参考文献：
[1] 0051_wiki_entry_add_description.py — information_schema 幂等加列范式。
[2] 0003_catalog_global_phase1_add_tables.py — ``doc_catalog_entries.position`` 列定义。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0055"
down_revision: str | None = "0054"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
TABLE = f"{SCHEMA}.wiki_publication_entries"
COL = "entry_position"


def upgrade() -> None:
    op.execute(
        sa.text(
            f"""
            ALTER TABLE {TABLE}
            ADD COLUMN IF NOT EXISTS {COL} INTEGER NOT NULL DEFAULT 0
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text(f"ALTER TABLE {TABLE} DROP COLUMN IF EXISTS {COL}"))
