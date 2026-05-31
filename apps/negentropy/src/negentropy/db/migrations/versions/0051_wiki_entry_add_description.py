"""wiki_publication_entries 新增 entry_description 列以同步 Catalog 节点描述

Revision ID: 0051
Revises: 0050
Create Date: 2026-05-31 00:00:00.000000+00:00

设计动机：
    Wiki 站点首页「内容主题」卡片按 Publication 的导航树一级节点（CONTAINER
    容器条目）渲染，需展示各节点的描述。描述源自 Catalog 节点
    ``DocCatalogEntry.description``，但此前 CONTAINER 条目（``WikiPublicationEntry``）
    仅持久化 ``entry_title``、未携带描述，导致描述无法经「同步落库 → 导航树 →
    API → SSG」链路抵达首页卡片。

    新增 ``entry_description`` 列，作为 ``entry_title`` 的同生命周期姊妹字段：
    在 ``wiki_service.sync_entries_from_catalog`` 同步时从 Catalog 节点
    ``description`` 拷入，发布快照（SNAPSHOT 模式）一并冻结，保持「定版快照」语义。

幂等性：
    使用 ``ADD COLUMN IF NOT EXISTS`` 保证重复执行安全；downgrade 仅
    ``DROP COLUMN`` 该新增列，不触碰其它业务数据。既有行 ``entry_description``
    为 ``NULL``，需用户主动触发「从 Catalog 同步」/「同步并发布」回填
    （与 0040 ``display_name`` 同范式，不在迁移中隐式回填）。

参考文献：
[1] 0040_add_knowledge_document_display_name.py — Wiki 显示字段幂等加列范式。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0051"
down_revision: str | None = "0050"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"


def upgrade() -> None:
    op.execute(
        sa.text(f"ALTER TABLE {SCHEMA}.wiki_publication_entries ADD COLUMN IF NOT EXISTS entry_description TEXT")
    )


def downgrade() -> None:
    op.execute(sa.text(f"ALTER TABLE {SCHEMA}.wiki_publication_entries DROP COLUMN IF EXISTS entry_description"))
