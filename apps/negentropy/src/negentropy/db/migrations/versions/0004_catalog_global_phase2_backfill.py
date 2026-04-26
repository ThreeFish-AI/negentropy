"""Catalog 全局化 Phase 2：回填存量数据（legacy → 新骨架）

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-23 00:05:00.000000+00:00

按三阶段迁移策略（add → backfill → enforce）的中间阶段：
  - 本阶段仅做**数据回填**（DML），不修改表结构（除临时映射列）。
  - 采用 1:1 映射：每个**被引用的** corpus 产生一个 doc_catalogs 记录；
    其下所有 doc_catalog_nodes → doc_catalog_entries（保留 id，parent 关系自然延续）；
    doc_catalog_memberships → 派生 DOCUMENT_REF 叶节点。
  - wiki_publications 的 catalog_id / app_name / publish_mode / visibility 同步回填。

临时映射字段：
  - doc_catalogs.legacy_corpus_id UUID UNIQUE（仅存在于 Phase 2 ~ Phase 3 之间）
    作用：避免 INSERT RETURNING + 临时表的复杂性，给跨表 JOIN 提供稳定的映射键。
    Phase 3 upgrade 起始将 DROP 此列。

幂等性：
  - 本阶段使用 `ON CONFLICT DO NOTHING` 与 `WHERE NOT EXISTS` 双保险，
    允许被打断后重新执行。

Downgrade 策略：
  - 反向删除回填数据（所有 doc_catalog_entries / doc_catalogs），
    wiki_publications 的回填列 NULL 化，DROP 临时映射列。
  - 由于 Phase 2 的映射是 1:1（一 corpus 对应一 catalog），
    降级不会丢失业务语义，只会回到"未回填"的空白状态。

设计溯源：
  - MediaWiki Category 成员平移 [1]
  - PG "ALTER TABLE ... ADD COLUMN" online 添加可空列零锁 [2]
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # =========================================================================
    # 0) 临时映射列：doc_catalogs.legacy_corpus_id
    #    - 用于 Phase 2 & Phase 3 跨表 JOIN 的稳定键；
    #    - Phase 3 upgrade 起始会 DROP 此列。
    # =========================================================================
    op.execute(
        sa.text("""
            ALTER TABLE negentropy.doc_catalogs
            ADD COLUMN IF NOT EXISTS legacy_corpus_id UUID
        """)
    )
    op.execute(
        sa.text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_catalogs_legacy_corpus_id
            ON negentropy.doc_catalogs (legacy_corpus_id)
            WHERE legacy_corpus_id IS NOT NULL
        """)
    )

    # =========================================================================
    # 1) 为每个被引用的 corpus 创建 1 个 doc_catalogs 记录
    #    - 被引用 = 拥有 doc_catalog_nodes 或 wiki_publications；
    #    - 规避冲突：`ON CONFLICT (legacy_corpus_id) DO NOTHING` 使本步幂等。
    # =========================================================================
    op.execute(
        sa.text("""
            INSERT INTO negentropy.doc_catalogs (
                id, app_name, name, slug, owner_id, visibility,
                is_archived, version, description, config,
                legacy_corpus_id, created_at, updated_at
            )
            SELECT
                gen_random_uuid(),
                c.app_name,
                c.name,
                'corpus-' || substr(c.id::text, 1, 8),
                NULL,
                'INTERNAL'::negentropy.catalogvisibility,
                false,
                1,
                c.description,
                COALESCE(c.config, '{}'::jsonb),
                c.id,
                c.created_at,
                c.updated_at
            FROM negentropy.corpus c
            WHERE c.id IN (
                SELECT DISTINCT corpus_id FROM negentropy.doc_catalog_nodes
                UNION
                SELECT DISTINCT corpus_id FROM negentropy.wiki_publications
            )
            ON CONFLICT DO NOTHING
        """)
    )

    # =========================================================================
    # 2) 回填 doc_catalog_entries（来自 doc_catalog_nodes）
    #    - **关键设计**：保留 legacy node.id → 新 entry.id，
    #      这样 parent_entry_id 直接等于 legacy parent_id，无需额外映射；
    #    - node_type 从 lowercase 字符串升级为 UPPERCASE 枚举；
    #    - slug 迁入 slug_override（保持 URL 稳定）；
    #    - source_corpus_id 冗余写入（= n.corpus_id），用于权限快速校验。
    # =========================================================================
    op.execute(
        sa.text("""
            INSERT INTO negentropy.doc_catalog_entries (
                id, catalog_id, parent_entry_id, document_id, source_corpus_id,
                node_type, name, slug_override, position, status,
                description, config, created_at, updated_at
            )
            SELECT
                n.id,
                dc.id AS catalog_id,
                n.parent_id AS parent_entry_id,
                NULL::UUID,
                n.corpus_id AS source_corpus_id,
                UPPER(n.node_type)::negentropy.catalogentrynodetype,
                n.name,
                n.slug AS slug_override,
                n.sort_order,
                'ACTIVE'::negentropy.catalogentrystatus,
                n.description,
                COALESCE(n.config, '{}'::jsonb),
                n.created_at,
                n.updated_at
            FROM negentropy.doc_catalog_nodes n
            JOIN negentropy.doc_catalogs dc ON dc.legacy_corpus_id = n.corpus_id
            WHERE NOT EXISTS (
                SELECT 1 FROM negentropy.doc_catalog_entries e WHERE e.id = n.id
            )
        """)
    )

    # =========================================================================
    # 3) 回填 DOCUMENT_REF 叶节点（来自 doc_catalog_memberships）
    #    - 每条 membership → 一个新的 entry (父为对应 catalog_node_id)；
    #    - 名称合成：original_filename + '#id前缀'（防止同父下重名），
    #      源 document 缺失时回退为 'doc-{id前缀}'；
    #    - 幂等：用 (parent_entry_id, document_id) 反查去重。
    # =========================================================================
    op.execute(
        sa.text("""
            INSERT INTO negentropy.doc_catalog_entries (
                id, catalog_id, parent_entry_id, document_id, source_corpus_id,
                node_type, name, slug_override, position, status,
                description, config, created_at, updated_at
            )
            SELECT
                gen_random_uuid(),
                dc.id,
                m.catalog_node_id,
                m.document_id,
                n.corpus_id,
                'DOCUMENT_REF'::negentropy.catalogentrynodetype,
                COALESCE(NULLIF(TRIM(d.original_filename), ''), 'doc-' || substr(m.document_id::text, 1, 8))
                    || ' #' || substr(m.document_id::text, 1, 8),
                NULL,
                0,
                'ACTIVE'::negentropy.catalogentrystatus,
                NULL,
                '{}'::jsonb,
                m.created_at,
                m.updated_at
            FROM negentropy.doc_catalog_memberships m
            JOIN negentropy.doc_catalog_nodes n ON n.id = m.catalog_node_id
            JOIN negentropy.doc_catalogs dc ON dc.legacy_corpus_id = n.corpus_id
            LEFT JOIN negentropy.knowledge_documents d ON d.id = m.document_id
            WHERE NOT EXISTS (
                SELECT 1 FROM negentropy.doc_catalog_entries e
                WHERE e.parent_entry_id = m.catalog_node_id
                  AND e.document_id = m.document_id
                  AND e.node_type = 'DOCUMENT_REF'::negentropy.catalogentrynodetype
            )
        """)
    )

    # =========================================================================
    # 4) 回填 wiki_publications 的可空列
    #    - catalog_id：经由 legacy_corpus_id 映射；
    #    - app_name：直接从 corpus.app_name 拷贝；
    #    - publish_mode = 'LIVE'（默认，未来可显式切 snapshot）；
    #    - visibility = 'INTERNAL'（默认，与 Phase 1 server_default 对齐）。
    # =========================================================================
    op.execute(
        sa.text("""
            UPDATE negentropy.wiki_publications wp
            SET
                catalog_id = dc.id,
                app_name = c.app_name,
                publish_mode = COALESCE(wp.publish_mode, 'LIVE'::negentropy.wikipublishmode),
                visibility = COALESCE(wp.visibility, 'INTERNAL'::negentropy.wikipublicationvisibility)
            FROM negentropy.doc_catalogs dc
            JOIN negentropy.corpus c ON c.id = dc.legacy_corpus_id
            WHERE dc.legacy_corpus_id = wp.corpus_id
              AND wp.catalog_id IS NULL
        """)
    )


def downgrade() -> None:
    # =========================================================================
    # 严格按 upgrade 逆序回滚。Phase 2 纯数据操作，无结构变更。
    # =========================================================================

    # 4) 回滚 wiki_publications 的回填字段
    op.execute(
        sa.text("""
            UPDATE negentropy.wiki_publications
            SET
                catalog_id = NULL,
                app_name = NULL,
                publish_mode = NULL,
                visibility = NULL,
                snapshot_version = NULL
            WHERE catalog_id IS NOT NULL
               OR app_name IS NOT NULL
               OR publish_mode IS NOT NULL
               OR visibility IS NOT NULL
               OR snapshot_version IS NOT NULL
        """)
    )

    # 3) + 2) 清空 doc_catalog_entries（先叶节点再普通节点，避免 FK 级联歧义）
    #     由于 parent_entry_id 自引用 ON DELETE CASCADE，直接全量 DELETE 即可。
    op.execute(sa.text("DELETE FROM negentropy.doc_catalog_entries"))

    # 1) 清空 doc_catalogs
    op.execute(sa.text("DELETE FROM negentropy.doc_catalogs"))

    # 0) 撤销临时映射列
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.uq_doc_catalogs_legacy_corpus_id"))
    op.execute(
        sa.text("""
            ALTER TABLE negentropy.doc_catalogs
            DROP COLUMN IF EXISTS legacy_corpus_id
        """)
    )
