"""Wiki 条目持久化容器：引入 entry_kind + catalog_node_id 双轨

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-26 00:30:00.000000+00:00

设计动机（消除 Wiki 树状结构压平假象）：
  历史 ``WikiPublicationEntry`` 仅为文档建条目（``document_id NOT NULL``），
  Catalog 中的 FOLDER（含历史 CATEGORY/COLLECTION）容器节点无对应 Wiki 条目；
  导航树重建时 ``wiki_tree.py::_ensure_container`` 用 path slug 字符串当 title
  合成虚拟容器，导致：
    1. 空 FOLDER 子树（无后代文档）在 Wiki 端彻底消失；
    2. 含文档的 FOLDER 容器丢失 ``name`` / ``description`` / ``id`` 等所有 Catalog 元数据。

  本迁移通过引入 ``entry_kind`` 区分 CONTAINER / DOCUMENT 两类条目：
    - **CONTAINER**：对应 Catalog FOLDER 节点，``document_id IS NULL``、
      ``catalog_node_id`` 指向 ``doc_catalog_entries.id``；
    - **DOCUMENT**：对应文档条目，``document_id`` NOT NULL、``catalog_node_id`` NULL。

  CHECK 约束保证两态 payload 互斥；partial unique index 分别保证
  ``(publication_id, document_id)`` 与 ``(publication_id, catalog_node_id)`` 在
  各自类型下的唯一性。

迁移策略（非破坏性）：
  - Phase 1：创建新枚举 ``wiki_entry_kind``；
  - Phase 2：加列（``entry_kind`` 默认 'DOCUMENT'、``catalog_node_id`` NULL）；
  - Phase 3：``document_id`` 改 nullable；
  - Phase 4：拆解旧约束并加分区唯一索引 + 一致性 CHECK。

  存量行（全是 DOCUMENT 类型）默认值正确，零数据修改。

Downgrade 策略：
  - 反向 DROP 索引 / CHECK / 列 / 枚举；
  - 若已写入 CONTAINER 行，downgrade 前会校验失败（需先手工删除 CONTAINER 行）。
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # =========================================================================
    # Phase 1：枚举类型 wiki_entry_kind
    # =========================================================================
    op.execute(
        sa.text("""
            DO $$ BEGIN
                CREATE TYPE negentropy.wiki_entry_kind AS ENUM ('CONTAINER', 'DOCUMENT');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        """)
    )

    # =========================================================================
    # Phase 2：新增列
    #   - entry_kind：默认 'DOCUMENT'，向前兼容存量行
    #   - catalog_node_id：FK to doc_catalog_entries，CONTAINER 模式必填
    # =========================================================================
    op.execute(
        sa.text("""
            ALTER TABLE negentropy.wiki_publication_entries
            ADD COLUMN IF NOT EXISTS entry_kind negentropy.wiki_entry_kind
                NOT NULL DEFAULT 'DOCUMENT'
        """)
    )

    op.execute(
        sa.text("""
            ALTER TABLE negentropy.wiki_publication_entries
            ADD COLUMN IF NOT EXISTS catalog_node_id UUID
                REFERENCES negentropy.doc_catalog_entries(id) ON DELETE SET NULL
        """)
    )

    op.execute(
        sa.text("""
            CREATE INDEX IF NOT EXISTS ix_wiki_entries_catalog_node
            ON negentropy.wiki_publication_entries (catalog_node_id)
            WHERE catalog_node_id IS NOT NULL
        """)
    )

    # =========================================================================
    # Phase 3：document_id 放宽 NOT NULL（CONTAINER 行此列必为 NULL）
    # =========================================================================
    op.execute(
        sa.text("""
            ALTER TABLE negentropy.wiki_publication_entries
            ALTER COLUMN document_id DROP NOT NULL
        """)
    )

    # =========================================================================
    # Phase 4：约束重建
    #   1) 删除旧 unique constraint (publication_id, document_id)
    #   2) 建 partial unique index (publication_id, document_id) WHERE entry_kind='DOCUMENT'
    #   3) 建 partial unique index (publication_id, catalog_node_id) WHERE entry_kind='CONTAINER'
    #   4) 建 CHECK：CONTAINER ↔ catalog_node_id NOT NULL；DOCUMENT ↔ document_id NOT NULL
    # =========================================================================
    op.execute(
        sa.text("ALTER TABLE negentropy.wiki_publication_entries DROP CONSTRAINT IF EXISTS uq_wiki_entry_pub_doc")
    )

    op.execute(
        sa.text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_entry_pub_doc_active
            ON negentropy.wiki_publication_entries (publication_id, document_id)
            WHERE entry_kind = 'DOCUMENT' AND document_id IS NOT NULL
        """)
    )

    op.execute(
        sa.text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_entry_pub_node_active
            ON negentropy.wiki_publication_entries (publication_id, catalog_node_id)
            WHERE entry_kind = 'CONTAINER' AND catalog_node_id IS NOT NULL
        """)
    )

    op.execute(
        sa.text("""
            ALTER TABLE negentropy.wiki_publication_entries
            ADD CONSTRAINT ck_wiki_entry_kind_payload
            CHECK (
                (entry_kind = 'CONTAINER' AND document_id IS NULL AND catalog_node_id IS NOT NULL)
                OR
                (entry_kind = 'DOCUMENT' AND document_id IS NOT NULL)
            )
        """)
    )


def downgrade() -> None:
    # =========================================================================
    # 反向：先 DROP CHECK / 索引，再恢复 NOT NULL（仅在无 CONTAINER 行时安全），
    # 最后 DROP 列与枚举。CONTAINER 行存在时 NOT NULL 恢复会失败——属正常守卫。
    # =========================================================================
    op.execute(
        sa.text("ALTER TABLE negentropy.wiki_publication_entries DROP CONSTRAINT IF EXISTS ck_wiki_entry_kind_payload")
    )

    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.uq_wiki_entry_pub_node_active"))
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.uq_wiki_entry_pub_doc_active"))
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.ix_wiki_entries_catalog_node"))

    # 还原原始唯一约束（仅在无重复 (publication_id, document_id) 时成功）
    op.execute(
        sa.text("""
            ALTER TABLE negentropy.wiki_publication_entries
            ADD CONSTRAINT uq_wiki_entry_pub_doc UNIQUE (publication_id, document_id)
        """)
    )

    # CONTAINER 行存在时此处会抛错——故 downgrade 前应先清空 CONTAINER 行。
    op.execute(
        sa.text("""
            ALTER TABLE negentropy.wiki_publication_entries
            ALTER COLUMN document_id SET NOT NULL
        """)
    )

    op.execute(sa.text("ALTER TABLE negentropy.wiki_publication_entries DROP COLUMN IF EXISTS catalog_node_id"))
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publication_entries DROP COLUMN IF EXISTS entry_kind"))

    op.execute(sa.text("DROP TYPE IF EXISTS negentropy.wiki_entry_kind"))
