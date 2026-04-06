"""add lifecycle management and knowledge graph enhancement tables

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2026-04-06 00:00:00.000000+00:00

新增表:
  - doc_sources (文档来源追踪)
  - doc_catalog_nodes (目录节点)
  - doc_catalog_memberships (目录-文档关联)
  - wiki_publications (Wiki 发布快照)
  - wiki_publication_entries (Wiki 条目映射)
  - kg_entities (一等知识图谱实体)
  - kg_relations (一等知识图谱关系)
  - kg_entity_mentions (实体提及时序)
  - corpus_versions (语料版本快照)
  - knowledge_feedback (检索反馈闭环)

扩展列:
  - knowledge_documents.source_id → FK → doc_sources
  - corpus.quality_score, corpus_type, tags, parent_corpus_id
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

import negentropy.models.base

# revision identifiers, used by Alembic.
revision: str = "h2i3j4k5l6m7"
down_revision: Union[str, None] = "g1h2i3j4k5l6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

schema = negentropy.models.base.NEGENTROPY_SCHEMA


def upgrade() -> None:
    # =========================================================================
    # 1. 扩展现有表
    # =========================================================================

    # 1a. knowledge_documents 新增 source_id 外键
    op.add_column(
        "knowledge_documents",
        sa.Column(
            "source_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(f"{schema}.doc_sources.id", ondelete="SET NULL"),
            nullable=True,
        ),
        schema=schema,
    )
    op.create_index(
        "ix_knowledge_documents_source_id",
        "knowledge_documents",
        ["source_id"],
        schema=schema,
    )

    # 1b. corpus 新增字段
    op.add_column("corpus", sa.Column("quality_score", sa.Float(), nullable=True), schema=schema)
    op.add_column("corpus", sa.Column("corpus_type", sa.String(length=50), nullable=True), schema=schema)
    op.add_column(
        "corpus",
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), server_default="{}"),
        schema=schema,
    )
    op.add_column(
        "corpus",
        sa.Column(
            "parent_corpus_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(f"{schema}.corpus.id", ondelete="SET NULL"),
            nullable=True,
        ),
        schema=schema,
    )

    # =========================================================================
    # 2. Phase 2: 文档来源追踪
    # =========================================================================

    op.create_table(
        "doc_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.knowledge_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_type", sa.String(length=20), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("original_url", sa.Text(), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("author", sa.String(length=255), nullable=True),
        sa.Column("extracted_summary", sa.Text(), nullable=True),
        sa.Column("extraction_duration_ms", sa.Integer(), nullable=True),
        sa.Column("extracted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("extractor_tool_name", sa.String(length=100), nullable=True),
        sa.Column("extractor_server_id", sa.String(length=100), nullable=True),
        sa.Column("raw_metadata", postgresql.JSONB(astext_type=sa.Text()), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=schema,
    )
    op.create_index("ix_doc_sources_document_id", "doc_sources", ["document_id"], schema=schema)
    op.create_index("ix_doc_sources_source_type", "doc_sources", ["source_type"], schema=schema)

    # =========================================================================
    # 3. Phase 3: 目录编目系统
    # =========================================================================

    op.create_table(
        "doc_catalog_nodes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("corpus_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.corpus.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.doc_catalog_nodes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("node_type", sa.String(length=20), nullable=False, server_default="'category'"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("corpus_id", "parent_id", "name", name="uq_catalog_sibling_name"),
        sa.UniqueConstraint("corpus_id", "slug", name="uq_catalog_corpus_slug"),
        schema=schema,
    )
    op.create_index("ix_doc_catalog_nodes_corpus_id", "doc_catalog_nodes", ["corpus_id"], schema=schema)
    op.create_index("ix_doc_catalog_nodes_parent_id", "doc_catalog_nodes", ["parent_id"], schema=schema)

    op.create_table(
        "doc_catalog_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("catalog_node_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.doc_catalog_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.knowledge_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("catalog_node_id", "document_id", name="uq_catalog_membership_unique"),
        schema=schema,
    )
    op.create_index("ix_catalog_memberships_document_id", "doc_catalog_memberships", ["document_id"], schema=schema)

    # =========================================================================
    # 4. Phase 4: Wiki 发布系统
    # =========================================================================

    op.create_table(
        "wiki_publications",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("corpus_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.corpus.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="'draft'"),
        sa.Column("theme", sa.String(length=20), nullable=False, server_default="'default'"),
        sa.Column("navigation_config", postgresql.JSONB(astext_type=sa.Text()), server_default="{}"),
        sa.Column("custom_css", sa.Text(), nullable=True),
        sa.Column("custom_js", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("corpus_id", "slug", name="uq_wiki_pub_corpus_slug"),
        schema=schema,
    )
    op.create_index("ix_wiki_publications_corpus_id", "wiki_publications", ["corpus_id"], schema=schema)
    op.create_index("ix_wiki_publications_status", "wiki_publications", ["status"], schema=schema)

    op.create_table(
        "wiki_publication_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("publication_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.wiki_publications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.knowledge_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entry_slug", sa.String(length=255), nullable=False),
        sa.Column("entry_title", sa.String(length=500), nullable=True),
        sa.Column("entry_order", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_index_page", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("publication_id", "entry_slug", name="uq_wiki_entry_pub_slug"),
        sa.UniqueConstraint("publication_id", "document_id", name="uq_wiki_entry_pub_doc"),
        schema=schema,
    )

    # =========================================================================
    # 5. Phase 5: 知识图谱增强（一等公民）
    # =========================================================================

    op.create_table(
        "kg_entities",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("corpus_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.corpus.id", ondelete="CASCADE"), nullable=False),
        sa.Column("app_name", sa.String(length=255), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("canonical_name", sa.String(length=500), nullable=True),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("aliases", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("embedding", postgresql.Vector(1536), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("mention_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("properties", postgresql.JSONB(astext_type=sa.Text()), server_default="{}"),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("corpus_id", "canonical_name", name="uq_kg_entity_corpus_name"),
        schema=schema,
    )
    op.create_index("ix_kg_entities_corpus_type", "kg_entities", ["corpus_id", "entity_type"], schema=schema)
    # HNSW 索引用用于向量搜索（需要 pgvector 扩展）
    op.execute(f"""
        CREATE INDEX IF NOT EXISTS ix_kg_entities_embedding
        ON {schema}.kg_entities USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    """)
    op.create_index("ix_kg_entities_confidence", "kg_entities", ["confidence"], schema=schema)

    op.create_table(
        "kg_relations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.kg_entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.kg_entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("corpus_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.corpus.id", ondelete="CASCADE"), nullable=False),
        sa.Column("app_name", sa.String(length=255), nullable=False),
        sa.Column("relation_type", sa.String(length=50), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("evidence_text", sa.Text(), nullable=True),
        sa.Column("evidence_chunk_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("first_observed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_observed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("observation_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_id", "target_id", "relation_type", name="uq_kg_relation_src_tgt_type"),
        schema=schema,
    )
    op.create_index("ix_kg_relations_source", "kg_relations", ["source_id"], schema=schema)
    op.create_index("ix_kg_relations_target", "kg_relations", ["target_id"], schema=schema)
    op.create_index("ix_kg_relations_corpus", "kg_relations", ["corpus_id"], schema=schema)
    op.create_index("ix_kg_relations_type", "kg_relations", ["relation_type"], schema=schema)

    op.create_table(
        "kg_entity_mentions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.kg_entities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("corpus_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.corpus.id", ondelete="CASCADE"), nullable=False),
        sa.Column("knowledge_chunk_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.knowledge.id", ondelete="SET NULL"), nullable=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.knowledge_documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("context_snippet", sa.Text(), nullable=True),
        sa.Column("char_offset", sa.Integer(), nullable=True),
        sa.Column("char_length", sa.Integer(), nullable=True),
        sa.Column("extraction_method", sa.String(length=50), server_default="llm"),
        sa.Column("extraction_confidence", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("extractor_model", sa.String(length=255), nullable=True),
        sa.Column("build_run_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=schema,
    )
    op.create_index("ix_kg_mentions_entity", "kg_entity_mentions", ["entity_id"], schema=schema)
    op.create_index("ix_kg_mentions_chunk", "kg_entity_mentions", ["knowledge_chunk_id"], schema=schema)
    op.create_index("ix_kg_mentions_document", "kg_entity_mentions", ["document_id"], schema=schema)
    op.create_index("ix_kg_mentions_corpus", "kg_entity_mentions", ["corpus_id"], schema=schema)

    # =========================================================================
    # 6. Phase 5: 语料版本与检索反馈
    # =========================================================================

    op.create_table(
        "corpus_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("corpus_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.corpus.id", ondelete="CASCADE"), nullable=False),
        sa.Column("app_name", sa.String(length=255), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("document_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quality_score", sa.Float(), nullable=True),
        sa.Column("config_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("trigger_type", sa.String(length=50), server_default="'manual'"),
        sa.Column("build_run_id", sa.String(length=255), nullable=True),
        sa.Column("diff_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="'active'"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("corpus_id", "version_number", name="uq_corpus_ver"),
        schema=schema,
    )
    op.create_index("ix_corpus_versions_corpus_id", "corpus_versions", ["corpus_id"], schema=schema)
    op.create_index("ix_corpus_versions_status", "corpus_versions", ["status"], schema=schema)

    op.create_table(
        "knowledge_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("knowledge_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.knowledge.id", ondelete="CASCADE"), nullable=False),
        sa.Column("corpus_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{schema}.corpus.id", ondelete="CASCADE"), nullable=False),
        sa.Column("app_name", sa.String(length=255), nullable=False),
        sa.Column("session_id", sa.String(length=255), nullable=True),
        sa.Column("agent_id", sa.String(length=255), nullable=True),
        sa.Column("user_id", sa.String(length=255), nullable=True),
        sa.Column("query_text", sa.Text(), nullable=True),
        sa.Column("query_mode", sa.String(length=20), nullable=True),
        sa.Column("feedback_type", sa.String(length=20), nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=schema,
    )
    op.create_index("ix_kb_feedback_knowledge", "knowledge_feedback", ["knowledge_id"], schema=schema)
    op.create_index("ix_kb_feedback_corpus", "knowledge_feedback", ["corpus_id"], schema=schema)
    op.create_index("ix_kb_feedback_session", "knowledge_feedback", ["session_id"], schema=schema)
    op.create_index("ix_kb_feedback_type", "knowledge_feedback", ["feedback_type"], schema=schema)
    op.create_index("ix_kb_feedback_created", "knowledge_feedback", ["created_at"], schema=schema)


def downgrade() -> None:
    # 按依赖逆序删除（先删子表/外键表，再删主表）

    # 6. 反馈与版本
    op.drop_table("knowledge_feedback", schema=schema)
    op.drop_table("corpus_versions", schema=schema)

    # 5. 图谱增强
    op.drop_table("kg_entity_mentions", schema=schema)
    op.drop_table("kg_relations", schema=schema)
    op.drop_index("ix_kg_entities_embedding", table_name="kg_entities", schema=schema)
    op.drop_index("ix_kg_entities_confidence", table_name="kg_entities", schema=schema)
    op.drop_index("ix_kg_entities_corpus_type", table_name="kg_entities", schema=schema)
    op.drop_table("kg_entities", schema=schema)

    # 4. Wiki 发布
    op.drop_table("wiki_publication_entries", schema=schema)
    op.drop_index("ix_wiki_publications_status", table_name="wiki_publications", schema=schema)
    op.drop_index("ix_wiki_publications_corpus_id", table_name="wiki_publications", schema=schema)
    op.drop_table("wiki_publications", schema=schema)

    # 3. 目录编目
    op.drop_index("ix_catalog_memberships_document_id", table_name="doc_catalog_memberships", schema=schema)
    op.drop_table("doc_catalog_memberships", schema=schema)
    op.drop_index("ix_doc_catalog_nodes_parent_id", table_name="doc_catalog_nodes", schema=schema)
    op.drop_index("ix_doc_catalog_nodes_corpus_id", table_name="doc_catalog_nodes", schema=schema)
    op.drop_table("doc_catalog_nodes", schema=schema)

    # 2. 来源追踪
    op.drop_index("ix_doc_sources_source_type", table_name="doc_sources", schema=schema)
    op.drop_index("ix_doc_sources_document_id", table_name="doc_sources", schema=schema)
    op.drop_table("doc_sources", schema=schema)

    # 1. 扩展列回滚
    op.drop_column("corpus", "parent_corpus_id", schema=schema)
    op.drop_column("corpus", "tags", schema=schema)
    op.drop_column("corpus", "corpus_type", schema=schema)
    op.drop_column("corpus", "quality_score", schema=schema)
    op.drop_index("ix_knowledge_documents_source_id", table_name="knowledge_documents", schema=schema)
    op.drop_column("knowledge_documents", "source_id", schema=schema)
