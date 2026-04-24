"""Catalog 全局化 Phase 3：施加约束 + DROP legacy 表

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-23 12:00:00.000000+00:00

按三阶段迁移策略（add → backfill → enforce）的收尾阶段：
  - 收尾 Phase 1 新增的 nullable 列：catalog_id / app_name / publish_mode / visibility → NOT NULL
  - 约束切换：UNIQUE(corpus_id, slug) → UNIQUE(catalog_id, slug)
  - DROP 临时映射列 doc_catalogs.legacy_corpus_id
  - DROP wiki_publications.corpus_id（及其 FK / 约束 / 索引）
  - DROP legacy 表 doc_catalog_nodes + doc_catalog_memberships（FK CASCADE 自动清理）

**原子性约束**：本 migration 必须与 ORM 模型更新（perception.py）在同一 commit，
否则 WikiPublication.corpus_id NOT NULL 与 DROP 后的数据库真相冲突，
test_migrations_stairway roundtrip 必然失败。

Downgrade 策略：
  - 防御守卫：若存在跨 corpus catalog（单 catalog 的 entries 涉及 2+ distinct source_corpus_id），
    拒绝降级并抛 RuntimeError（降级会丢失跨 corpus 引用语义）。
  - 通过守卫后：重建 legacy 表骨架、复活 corpus_id 列、反向回填 catalog_nodes/memberships、
    复位 catalog_id/app_name/publish_mode/visibility → nullable。
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # =========================================================================
    # 0) 收尾 Phase 1 新增的 nullable 列 → NOT NULL
    #    Phase 2 backfill 已确保所有行有非 NULL 值。
    # =========================================================================
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications ALTER COLUMN catalog_id SET NOT NULL"))
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications ALTER COLUMN app_name SET NOT NULL"))
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications ALTER COLUMN publish_mode SET NOT NULL"))
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications ALTER COLUMN visibility SET NOT NULL"))

    # =========================================================================
    # 1) 约束切换：UNIQUE(corpus_id, slug) → UNIQUE(catalog_id, slug)
    #    同时清理旧 corpus_id 相关索引。
    # =========================================================================
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications DROP CONSTRAINT uq_wiki_pub_corpus_slug"))
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.ix_wiki_publications_corpus_id"))
    op.execute(
        sa.text(
            "ALTER TABLE negentropy.wiki_publications ADD CONSTRAINT uq_wiki_pub_catalog_slug UNIQUE (catalog_id, slug)"
        )
    )

    # 重建 catalog_id / app_name 全量索引（移除 WHERE IS NOT NULL 条件）
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.ix_wiki_publications_catalog_id"))
    op.execute(sa.text("CREATE INDEX ix_wiki_publications_catalog_id ON negentropy.wiki_publications (catalog_id)"))
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.ix_wiki_publications_app_name"))
    op.execute(sa.text("CREATE INDEX ix_wiki_publications_app_name ON negentropy.wiki_publications (app_name)"))

    # =========================================================================
    # 2) DROP 临时映射列 + corpus_id FK
    # =========================================================================
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications DROP COLUMN corpus_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.uq_doc_catalogs_legacy_corpus_id"))
    op.execute(sa.text("ALTER TABLE negentropy.doc_catalogs DROP COLUMN IF EXISTS legacy_corpus_id"))

    # =========================================================================
    # 3) DROP legacy 表
    #    doc_catalog_memberships FK → doc_catalog_nodes (CASCADE)
    #    doc_catalog_nodes FK → corpus (CASCADE)
    #    wiki_publication_entries FK → wiki_publications (保留，不受影响)
    #    先 DROP memberships（依赖 nodes），再 DROP nodes。
    # =========================================================================
    op.execute(sa.text("DROP TABLE IF EXISTS negentropy.doc_catalog_memberships"))
    op.execute(sa.text("DROP TABLE IF EXISTS negentropy.doc_catalog_nodes"))


def downgrade() -> None:
    # =========================================================================
    # 防御守卫：检测跨 corpus catalog
    #    若任一 catalog 的 entries 涉及 2+ distinct source_corpus_id，
    #    降级会丢失跨 corpus 引用语义，拒绝执行。
    # =========================================================================
    conn = op.get_bind()
    cross = conn.execute(
        sa.text("""
        SELECT catalog_id FROM negentropy.doc_catalog_entries
        WHERE source_corpus_id IS NOT NULL
        GROUP BY catalog_id HAVING COUNT(DISTINCT source_corpus_id) > 1
    """)
    ).fetchall()
    if cross:
        raise RuntimeError(
            f"拒绝降级：{len(cross)} 个 catalog 包含跨 corpus 文档，"
            "降级会丢失跨 corpus 引用。请先手动梳理这些 catalog。"
        )

    # =========================================================================
    # 1) 重建 legacy 表骨架（DDL 镜像 0001_init_schema.py L452-477 / L687-706）
    # =========================================================================
    op.execute(
        sa.text("""
        CREATE TABLE negentropy.doc_catalog_nodes (
            corpus_id     UUID NOT NULL REFERENCES negentropy.corpus(id) ON DELETE CASCADE,
            parent_id     UUID REFERENCES negentropy.doc_catalog_nodes(id) ON DELETE SET NULL,
            name          VARCHAR(255) NOT NULL,
            slug          VARCHAR(255) NOT NULL,
            node_type     VARCHAR(20) NOT NULL DEFAULT 'category',
            description   TEXT,
            sort_order    INTEGER NOT NULL DEFAULT 0,
            config        JSONB DEFAULT '{}',
            id            UUID NOT NULL DEFAULT gen_random_uuid(),
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id)
        )
    """)
    )
    op.execute(sa.text("ALTER TABLE negentropy.doc_catalog_nodes SET SCHEMA negentropy"))
    op.execute(
        sa.text("""
        CREATE UNIQUE INDEX uq_catalog_sibling_name
        ON negentropy.doc_catalog_nodes (corpus_id, parent_id, name)
    """)
    )
    op.execute(
        sa.text("""
        CREATE UNIQUE INDEX uq_catalog_corpus_slug
        ON negentropy.doc_catalog_nodes (corpus_id, slug)
    """)
    )
    op.execute(
        sa.text("""
        CREATE INDEX ix_doc_catalog_nodes_corpus_id
        ON negentropy.doc_catalog_nodes (corpus_id)
    """)
    )
    op.execute(
        sa.text("""
        CREATE INDEX ix_doc_catalog_nodes_parent_id
        ON negentropy.doc_catalog_nodes (parent_id)
    """)
    )

    op.execute(
        sa.text("""
        CREATE TABLE negentropy.doc_catalog_memberships (
            catalog_node_id UUID NOT NULL REFERENCES negentropy.doc_catalog_nodes(id) ON DELETE CASCADE,
            document_id     UUID NOT NULL REFERENCES negentropy.knowledge_documents(id) ON DELETE CASCADE,
            id              UUID NOT NULL DEFAULT gen_random_uuid(),
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id)
        )
    """)
    )
    op.execute(sa.text("ALTER TABLE negentropy.doc_catalog_memberships SET SCHEMA negentropy"))
    op.execute(
        sa.text("""
        CREATE UNIQUE INDEX uq_catalog_membership_unique
        ON negentropy.doc_catalog_memberships (catalog_node_id, document_id)
    """)
    )
    op.execute(
        sa.text("""
        CREATE INDEX ix_catalog_memberships_document_id
        ON negentropy.doc_catalog_memberships (document_id)
    """)
    )

    # =========================================================================
    # 2) 复活 wiki_publications.corpus_id + 重建临时映射列
    # =========================================================================
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications ADD COLUMN corpus_id UUID"))
    op.execute(sa.text("ALTER TABLE negentropy.doc_catalogs ADD COLUMN legacy_corpus_id UUID"))

    # =========================================================================
    # 3) 反向回填：doc_catalog_entries → doc_catalog_nodes + doc_catalog_memberships
    #    镜像 Phase 2 回填逻辑（方向取反）。
    #    - CATEGORY/COLLECTION entries → doc_catalog_nodes（保留 id = node.id）
    #    - DOCUMENT_REF entries → doc_catalog_memberships
    #    - legacy_corpus_id 映射从 source_corpus_id 推导
    # =========================================================================

    # 3a) 从 entries 推导 legacy_corpus_id 映射
    #     每个 catalog 取其 entries 中的 source_corpus_id（Phase 2 是 1:1，此处同）
    op.execute(
        sa.text("""
        UPDATE negentropy.doc_catalogs dc
        SET legacy_corpus_id = sub.source_corpus_id
        FROM (
            SELECT DISTINCT catalog_id, source_corpus_id
            FROM negentropy.doc_catalog_entries
            WHERE source_corpus_id IS NOT NULL
            GROUP BY catalog_id, source_corpus_id
            -- 单 corpus catalog 取第一条（1:1 场景）
        ) sub
        WHERE dc.id = sub.catalog_id
          AND dc.legacy_corpus_id IS NULL
    """)
    )

    # 3b) 回填 doc_catalog_nodes（仅非 DOCUMENT_REF 的 entry）
    op.execute(
        sa.text("""
        INSERT INTO negentropy.doc_catalog_nodes (
            id, corpus_id, parent_id, name, slug, node_type,
            description, sort_order, config, created_at, updated_at
        )
        SELECT
            e.id,
            e.source_corpus_id,
            e.parent_entry_id,
            e.name,
            COALESCE(e.slug_override, LOWER(e.name)),
            LOWER(e.node_type::text),
            e.description,
            e.position,
            COALESCE(e.config, '{}'::jsonb),
            e.created_at,
            e.updated_at
        FROM negentropy.doc_catalog_entries e
        WHERE e.node_type IN ('CATEGORY', 'COLLECTION')
          AND NOT EXISTS (
              SELECT 1 FROM negentropy.doc_catalog_nodes n WHERE n.id = e.id
          )
    """)
    )

    # 3c) 回填 doc_catalog_memberships（DOCUMENT_REF entries）
    #     通过 JOIN doc_catalog_nodes 保证 parent_entry_id 已落回 legacy 节点表；
    #     这与 Phase 2 upgrade（0004 L172-174）中 "membership → node → catalog" 的
    #     JOIN 链路严格对称。若 DOCUMENT_REF 的 parent_entry_id 指向另一个 DOCUMENT_REF
    #     （legacy schema 无法表达的文档嵌套），则被过滤并跳过 —— 与跨 corpus 守卫
    #     同样属于"legacy 无法表达的前向语义"，不可表达即不可回填。
    op.execute(
        sa.text("""
        INSERT INTO negentropy.doc_catalog_memberships (
            catalog_node_id, document_id, id, created_at, updated_at
        )
        SELECT
            e.parent_entry_id,
            e.document_id,
            gen_random_uuid(),
            e.created_at,
            e.updated_at
        FROM negentropy.doc_catalog_entries e
        JOIN negentropy.doc_catalog_nodes n ON n.id = e.parent_entry_id
        WHERE e.node_type = 'DOCUMENT_REF'
          AND e.document_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM negentropy.doc_catalog_memberships m
              WHERE m.catalog_node_id = e.parent_entry_id
                AND m.document_id = e.document_id
          )
    """)
    )

    # 3d) 回填 wiki_publications.corpus_id
    op.execute(
        sa.text("""
        UPDATE negentropy.wiki_publications wp
        SET corpus_id = dc.legacy_corpus_id
        FROM negentropy.doc_catalogs dc
        WHERE wp.catalog_id = dc.id
          AND dc.legacy_corpus_id IS NOT NULL
          AND wp.corpus_id IS NULL
    """)
    )

    # =========================================================================
    # 4) 约束复位
    #    DROP UNIQUE(catalog_id, slug) → RESTORE UNIQUE(corpus_id, slug)
    #    catalog_id/app_name/publish_mode/visibility → nullable
    #    索引恢复为部分索引
    # =========================================================================
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications DROP CONSTRAINT uq_wiki_pub_catalog_slug"))
    op.execute(
        sa.text(
            "ALTER TABLE negentropy.wiki_publications ADD CONSTRAINT uq_wiki_pub_corpus_slug UNIQUE (corpus_id, slug)"
        )
    )
    op.execute(sa.text("CREATE INDEX ix_wiki_publications_corpus_id ON negentropy.wiki_publications (corpus_id)"))
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.ix_wiki_publications_catalog_id"))
    op.execute(
        sa.text("""
        CREATE INDEX ix_wiki_publications_catalog_id
        ON negentropy.wiki_publications (catalog_id)
        WHERE catalog_id IS NOT NULL
    """)
    )
    op.execute(sa.text("DROP INDEX IF EXISTS negentropy.ix_wiki_publications_app_name"))
    op.execute(
        sa.text("""
        CREATE INDEX ix_wiki_publications_app_name
        ON negentropy.wiki_publications (app_name)
        WHERE app_name IS NOT NULL
    """)
    )
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications ALTER COLUMN catalog_id DROP NOT NULL"))
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications ALTER COLUMN app_name DROP NOT NULL"))
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications ALTER COLUMN publish_mode DROP NOT NULL"))
    op.execute(sa.text("ALTER TABLE negentropy.wiki_publications ALTER COLUMN visibility DROP NOT NULL"))
