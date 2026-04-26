"""Catalog 全局化 Phase 1：纯加法式骨架（新表 + 可空列）

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-23 00:00:00.000000+00:00

按正交分解原则，将 Catalog 从 Corpus 解耦为全局顶层实体。
本 Phase 1 仅施加**纯加法式变更**（新增表、新增可空列），不触碰既有数据与约束，
以此为 Phase 2 (backfill) 与 Phase 3 (enforce + drop) 提供基础骨架。

新增表：
  - doc_catalogs               Catalog 顶层元数据（app_name 不可变、乐观锁、软归档）
  - doc_catalog_entries        Catalog N:M 关联（融合目录节点树 + 文档软引用）
  - wiki_publication_snapshots Publication 快照（snapshot 模式留档）
  - wiki_slug_redirects        Slug 历史映射（301 重定向）

新增列（wiki_publications，全部可空，为 Phase 2 backfill 预留）：
  - catalog_id、app_name、publish_mode、visibility、snapshot_version

设计溯源：
  - MediaWiki Category N:M 多归属 [1]
  - GitBook Site→Space 订阅式发布 [2]
  - Docusaurus sidebar.id 正交组织 [3]
  - Confluence Include Page 权限以源为准 [4]
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # =========================================================================
    # 1) doc_catalogs：Catalog 顶层元数据
    # =========================================================================
    op.create_table(
        "doc_catalogs",
        sa.Column("app_name", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("owner_id", sa.String(length=255), nullable=True),
        sa.Column(
            "visibility",
            sa.Enum("PRIVATE", "INTERNAL", "PUBLIC", name="catalogvisibility", schema="negentropy"),
            server_default="INTERNAL",
            nullable=False,
        ),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("app_name", "slug", name="uq_doc_catalogs_app_slug"),
        schema="negentropy",
    )
    op.create_index("ix_doc_catalogs_app_name", "doc_catalogs", ["app_name"], unique=False, schema="negentropy")
    op.create_index("ix_doc_catalogs_owner_id", "doc_catalogs", ["owner_id"], unique=False, schema="negentropy")
    op.create_index(
        "ix_doc_catalogs_is_archived",
        "doc_catalogs",
        ["is_archived"],
        unique=False,
        schema="negentropy",
        postgresql_where=sa.text("is_archived = false"),
    )

    # =========================================================================
    # 2) doc_catalog_entries：Catalog 节点 + 文档引用（N:M 关联）
    #    - parent_entry_id 同 catalog 内自引用，支持树结构
    #    - document_id 软引用源文档（ON DELETE SET NULL → status=orphaned）
    #    - source_corpus_id 冗余字段，用于权限快速校验，避免 join knowledge_documents
    # =========================================================================
    op.create_table(
        "doc_catalog_entries",
        sa.Column("catalog_id", sa.UUID(), nullable=False),
        sa.Column("parent_entry_id", sa.UUID(), nullable=True),
        sa.Column("document_id", sa.UUID(), nullable=True),
        sa.Column("source_corpus_id", sa.UUID(), nullable=True),
        sa.Column(
            "node_type",
            sa.Enum(
                "CATEGORY",
                "COLLECTION",
                "DOCUMENT_REF",
                name="catalogentrynodetype",
                schema="negentropy",
            ),
            server_default="CATEGORY",
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug_override", sa.String(length=255), nullable=True),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "ACTIVE",
                "ORPHANED",
                "HIDDEN",
                name="catalogentrystatus",
                schema="negentropy",
            ),
            server_default="ACTIVE",
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["catalog_id"],
            ["negentropy.doc_catalogs.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["parent_entry_id"],
            ["negentropy.doc_catalog_entries.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["negentropy.knowledge_documents.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["source_corpus_id"],
            ["negentropy.corpus.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        # 同 catalog 内父子节点名唯一
        sa.UniqueConstraint(
            "catalog_id",
            "parent_entry_id",
            "name",
            name="uq_catalog_entry_sibling_name",
        ),
        schema="negentropy",
    )
    op.create_index(
        "ix_doc_catalog_entries_catalog_status",
        "doc_catalog_entries",
        ["catalog_id", "status"],
        unique=False,
        schema="negentropy",
    )
    op.create_index(
        "ix_doc_catalog_entries_parent",
        "doc_catalog_entries",
        ["parent_entry_id"],
        unique=False,
        schema="negentropy",
    )
    # Backlink 反查：该文档被哪些 catalog_entry 引用（Outline 模式）
    op.create_index(
        "ix_doc_catalog_entries_document",
        "doc_catalog_entries",
        ["document_id"],
        unique=False,
        schema="negentropy",
        postgresql_where=sa.text("document_id IS NOT NULL"),
    )
    op.create_index(
        "ix_doc_catalog_entries_source_corpus",
        "doc_catalog_entries",
        ["source_corpus_id"],
        unique=False,
        schema="negentropy",
        postgresql_where=sa.text("source_corpus_id IS NOT NULL"),
    )
    # slug_override 唯一（仅 NOT NULL 部分索引）：允许多个 NULL 共存
    op.create_index(
        "uq_catalog_entry_sibling_slug_override",
        "doc_catalog_entries",
        ["catalog_id", "parent_entry_id", "slug_override"],
        unique=True,
        schema="negentropy",
        postgresql_where=sa.text("slug_override IS NOT NULL"),
    )

    # =========================================================================
    # 3) wiki_publication_snapshots：Publication snapshot 模式冻结快照
    # =========================================================================
    op.create_table(
        "wiki_publication_snapshots",
        sa.Column("publication_id", sa.UUID(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("frozen_entries", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["publication_id"],
            ["negentropy.wiki_publications.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("publication_id", "version", name="uq_wiki_pub_snapshot_version"),
        schema="negentropy",
    )
    op.create_index(
        "ix_wiki_publication_snapshots_publication",
        "wiki_publication_snapshots",
        ["publication_id"],
        unique=False,
        schema="negentropy",
    )

    # =========================================================================
    # 4) wiki_slug_redirects：历史 slug → 当前 slug 映射（GitBook 启发）
    # =========================================================================
    op.create_table(
        "wiki_slug_redirects",
        sa.Column("publication_id", sa.UUID(), nullable=False),
        sa.Column("old_path", sa.String(length=1024), nullable=False),
        sa.Column("new_path", sa.String(length=1024), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["publication_id"],
            ["negentropy.wiki_publications.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("publication_id", "old_path", name="uq_wiki_slug_redirect_pub_old"),
        schema="negentropy",
    )
    op.create_index(
        "ix_wiki_slug_redirects_lookup",
        "wiki_slug_redirects",
        ["publication_id", "old_path"],
        unique=False,
        schema="negentropy",
    )

    # =========================================================================
    # 5) 扩展 wiki_publications：全部可空列，为 Phase 2 backfill 预留
    #    注意：此处不施加 NOT NULL 与 FK 的强约束，避免迁移锁。
    # =========================================================================
    # 枚举类型需显式创建（在 ADD COLUMN 之前，避免 alembic 自动推断失败）
    op.execute(sa.text("CREATE TYPE negentropy.wikipublishmode AS ENUM ('LIVE', 'SNAPSHOT')"))
    op.execute(sa.text("CREATE TYPE negentropy.wikipublicationvisibility AS ENUM ('PRIVATE', 'INTERNAL', 'PUBLIC')"))

    with op.batch_alter_table("wiki_publications", schema="negentropy") as batch_op:
        batch_op.add_column(sa.Column("catalog_id", sa.UUID(), nullable=True))
        batch_op.add_column(sa.Column("app_name", sa.String(length=255), nullable=True))
        batch_op.add_column(
            sa.Column(
                "publish_mode",
                postgresql.ENUM(
                    "LIVE",
                    "SNAPSHOT",
                    name="wikipublishmode",
                    schema="negentropy",
                    create_type=False,
                ),
                server_default="LIVE",
                nullable=True,
            )
        )
        batch_op.add_column(
            sa.Column(
                "visibility",
                postgresql.ENUM(
                    "PRIVATE",
                    "INTERNAL",
                    "PUBLIC",
                    name="wikipublicationvisibility",
                    schema="negentropy",
                    create_type=False,
                ),
                server_default="INTERNAL",
                nullable=True,
            )
        )
        batch_op.add_column(sa.Column("snapshot_version", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_wiki_publications_catalog_id",
            "doc_catalogs",
            ["catalog_id"],
            ["id"],
            ondelete="RESTRICT",
            referent_schema="negentropy",
        )

    op.create_index(
        "ix_wiki_publications_catalog_id",
        "wiki_publications",
        ["catalog_id"],
        unique=False,
        schema="negentropy",
        postgresql_where=sa.text("catalog_id IS NOT NULL"),
    )
    op.create_index(
        "ix_wiki_publications_app_name",
        "wiki_publications",
        ["app_name"],
        unique=False,
        schema="negentropy",
        postgresql_where=sa.text("app_name IS NOT NULL"),
    )


def downgrade() -> None:
    # =========================================================================
    # 严格按 upgrade 逆序回滚；纯加法式变更 → 回滚不涉数据丢失风险。
    # =========================================================================

    # 5) 还原 wiki_publications 扩展
    op.drop_index(
        "ix_wiki_publications_app_name",
        table_name="wiki_publications",
        schema="negentropy",
    )
    op.drop_index(
        "ix_wiki_publications_catalog_id",
        table_name="wiki_publications",
        schema="negentropy",
    )
    with op.batch_alter_table("wiki_publications", schema="negentropy") as batch_op:
        batch_op.drop_constraint("fk_wiki_publications_catalog_id", type_="foreignkey")
        batch_op.drop_column("snapshot_version")
        batch_op.drop_column("visibility")
        batch_op.drop_column("publish_mode")
        batch_op.drop_column("app_name")
        batch_op.drop_column("catalog_id")

    op.execute(sa.text("DROP TYPE IF EXISTS negentropy.wikipublicationvisibility"))
    op.execute(sa.text("DROP TYPE IF EXISTS negentropy.wikipublishmode"))

    # 4) 删除 wiki_slug_redirects
    op.drop_index(
        "ix_wiki_slug_redirects_lookup",
        table_name="wiki_slug_redirects",
        schema="negentropy",
    )
    op.drop_table("wiki_slug_redirects", schema="negentropy")

    # 3) 删除 wiki_publication_snapshots
    op.drop_index(
        "ix_wiki_publication_snapshots_publication",
        table_name="wiki_publication_snapshots",
        schema="negentropy",
    )
    op.drop_table("wiki_publication_snapshots", schema="negentropy")

    # 2) 删除 doc_catalog_entries
    op.drop_index(
        "uq_catalog_entry_sibling_slug_override",
        table_name="doc_catalog_entries",
        schema="negentropy",
    )
    op.drop_index(
        "ix_doc_catalog_entries_source_corpus",
        table_name="doc_catalog_entries",
        schema="negentropy",
    )
    op.drop_index(
        "ix_doc_catalog_entries_document",
        table_name="doc_catalog_entries",
        schema="negentropy",
    )
    op.drop_index(
        "ix_doc_catalog_entries_parent",
        table_name="doc_catalog_entries",
        schema="negentropy",
    )
    op.drop_index(
        "ix_doc_catalog_entries_catalog_status",
        table_name="doc_catalog_entries",
        schema="negentropy",
    )
    op.drop_table("doc_catalog_entries", schema="negentropy")
    op.execute(sa.text("DROP TYPE IF EXISTS negentropy.catalogentrystatus"))
    op.execute(sa.text("DROP TYPE IF EXISTS negentropy.catalogentrynodetype"))

    # 1) 删除 doc_catalogs
    op.drop_index(
        "ix_doc_catalogs_is_archived",
        table_name="doc_catalogs",
        schema="negentropy",
    )
    op.drop_index(
        "ix_doc_catalogs_owner_id",
        table_name="doc_catalogs",
        schema="negentropy",
    )
    op.drop_index(
        "ix_doc_catalogs_app_name",
        table_name="doc_catalogs",
        schema="negentropy",
    )
    op.drop_table("doc_catalogs", schema="negentropy")
    op.execute(sa.text("DROP TYPE IF EXISTS negentropy.catalogvisibility"))
