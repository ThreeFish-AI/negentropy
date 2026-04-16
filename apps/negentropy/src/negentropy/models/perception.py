from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import DEFAULT_EMBEDDING_DIM, NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin, Vector, fk


# =============================================================================
# 文档生命周期管理模型（Phase 1-4）
# =============================================================================


class Corpus(Base, UUIDMixin, TimestampMixin):
    """语料库 — 文档容器与组织单元"""

    __tablename__ = "corpus"

    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")

    # 扩展字段（Phase 3 / Phase 5）
    quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    corpus_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # technical/research/web/general
    tags: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")
    parent_corpus_id: Mapped[UUID | None] = mapped_column(fk("corpus", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("app_name", "name", name="corpus_app_name_unique"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    knowledge_items: Mapped[list["Knowledge"]] = relationship(back_populates="corpus", cascade="all, delete-orphan")
    documents: Mapped[list["KnowledgeDocument"]] = relationship(back_populates="corpus", cascade="all, delete-orphan")

    # Phase 3: 目录节点
    catalog_nodes: Mapped[list["DocCatalogNode"]] = relationship(
        back_populates="corpus",
        cascade="all, delete-orphan",
        order_by="DocCatalogNode.sort_order",
    )
    # Phase 4: Wiki 发布
    wiki_publications: Mapped[list["WikiPublication"]] = relationship(
        back_populates="corpus",
        cascade="all, delete-orphan",
    )
    # Phase 5: 版本快照
    versions: Mapped[list["CorpusVersion"]] = relationship(
        back_populates="corpus",
        cascade="all, delete-orphan",
        order_by="CorpusVersion.version_number.desc()",
    )


class Knowledge(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge"

    corpus_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.corpus.id", ondelete="CASCADE"), nullable=False
    )
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(DEFAULT_EMBEDDING_DIM))
    # TSVECTOR 用于全文搜索
    search_vector: Mapped[Any | None] = mapped_column(TSVECTOR)
    source_uri: Mapped[str | None] = mapped_column(Text)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    character_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    retrieval_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, server_default="{}")

    # Knowledge Graph entity fields
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    corpus: Mapped["Corpus"] = relationship(back_populates="knowledge_items")


class KnowledgeDocument(Base, UUIDMixin, TimestampMixin):
    """文档元信息表 - 存储上传到 GCS 的原始文件信息"""

    __tablename__ = "knowledge_documents"

    corpus_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.corpus.id", ondelete="CASCADE"),
        nullable=False,
    )
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # 文件标识
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    # 存储信息
    gcs_uri: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)

    # 状态追踪
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", server_default="'active'")

    # 上传者信息
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # 预处理后的 Markdown 内容与状态
    markdown_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    markdown_gcs_uri: Mapped[str | None] = mapped_column(Text, nullable=True)
    markdown_extract_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        server_default="'pending'",
    )
    markdown_extract_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    markdown_extracted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # 可选元数据
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, server_default="{}")

    # Phase 2: 来源追踪外键
    source_id: Mapped[UUID | None] = mapped_column(fk("doc_sources", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("corpus_id", "file_hash", name="uq_knowledge_documents_corpus_hash"),
        Index("ix_knowledge_documents_file_hash", "file_hash"),
        Index("ix_knowledge_documents_app_name", "app_name"),
        Index("ix_knowledge_documents_status", "status"),
        Index("ix_knowledge_documents_markdown_extract_status", "markdown_extract_status"),
        Index("ix_knowledge_documents_source_id", "source_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    corpus: Mapped["Corpus"] = relationship(back_populates="documents")
    # Phase 2: 来源记录（反向关联）
    source: Mapped["DocSource | None"] = relationship(foreign_keys=[source_id])


# =============================================================================
# Phase 2: 文档来源追踪
# =============================================================================


class DocSource(Base, UUIDMixin, TimestampMixin):
    """文档来源追踪表

    记录文档的原始形态（Web Page、PDF、文件等）及其提取元数据，
    支持完整的溯源（provenance）能力。
    """

    __tablename__ = "doc_sources"

    document_id: Mapped[UUID] = mapped_column(fk("knowledge_documents", ondelete="CASCADE"), nullable=False)
    # 来源类型，与 extraction.py 的 SourceKind 对齐
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)  # url | file_pdf | file_generic | text_input
    # URL 信息：source_url 为最终实际 URL，original_url 为重定向前的原始 URL
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 来源元数据
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extracted_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extracted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # MCP 工具调用链路审计
    extractor_tool_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    extractor_server_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 原始元数据快照
    raw_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")

    document: Mapped["KnowledgeDocument"] = relationship(foreign_keys=[document_id])

    __table_args__ = (
        Index("ix_doc_sources_document_id", "document_id"),
        Index("ix_doc_sources_source_type", "source_type"),
        {"schema": NEGENTROPY_SCHEMA},
    )


# =============================================================================
# Phase 3: 目录编目系统
# =============================================================================


class DocCatalogNode(Base, UUIDMixin, TimestampMixin):
    """目录节点 — 层级目录树

    采用 Adjacency List 模式（parent_id 自引用）实现层级结构。
    通过 PostgreSQL WITH RECURSIVE CTE 支持高效树查询。

    node_type:
      - category: 纯分类容器
      - collection: 有序集合（自定义排序语义）
      - document_ref: 直接指向某篇文档的叶子节点
    """

    __tablename__ = "doc_catalog_nodes"

    corpus_id: Mapped[UUID] = mapped_column(fk("corpus", ondelete="CASCADE"), nullable=False)
    parent_id: Mapped[UUID | None] = mapped_column(fk("doc_catalog_nodes", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)  # URL-friendly 标识
    node_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="category"
    )  # category | collection | document_ref
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")

    parent: Mapped["DocCatalogNode | None"] = relationship(remote_side="DocCatalogNode.id", back_populates="children")
    children: Mapped[list["DocCatalogNode"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="DocCatalogNode.sort_order",
    )
    corpus: Mapped["Corpus"] = relationship(back_populates="catalog_nodes")

    __table_args__ = (
        UniqueConstraint("corpus_id", "parent_id", "name", name="uq_catalog_sibling_name"),
        UniqueConstraint("corpus_id", "slug", name="uq_catalog_corpus_slug"),
        Index("ix_doc_catalog_nodes_corpus_id", "corpus_id"),
        Index("ix_doc_catalog_nodes_parent_id", "parent_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class DocCatalogMembership(Base, UUIDMixin, TimestampMixin):
    """目录-文档多对多关联表

    一个文档可属于多个目录节点（如同时出现在分类和日期集合中）。
    使用独立关联表而非 JSONB 数组以支持查询效率与级联删除。
    """

    __tablename__ = "doc_catalog_memberships"

    catalog_node_id: Mapped[UUID] = mapped_column(fk("doc_catalog_nodes", ondelete="CASCADE"), nullable=False)
    document_id: Mapped[UUID] = mapped_column(fk("knowledge_documents", ondelete="CASCADE"), nullable=False)

    catalog_node: Mapped["DocCatalogNode"] = relationship()
    document: Mapped["KnowledgeDocument"] = relationship()

    __table_args__ = (
        UniqueConstraint("catalog_node_id", "document_id", name="uq_catalog_membership_unique"),
        Index("ix_catalog_memberships_document_id", "document_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )


# =============================================================================
# Phase 4: Wiki 发布系统
# =============================================================================


class WikiPublication(Base, UUIDMixin, TimestampMixin):
    """Wiki 发布快照

    表示一个 Corpus 的发布视图。每次 publish 创建/更新一个版本化快照，
    Wiki SSG 应用基于此数据构建静态站点。
    """

    __tablename__ = "wiki_publications"

    corpus_id: Mapped[UUID] = mapped_column(fk("corpus", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft", server_default="'draft'"
    )  # draft | published | archived
    theme: Mapped[str] = mapped_column(
        String(20), nullable=False, default="default", server_default="'default'"
    )  # default | book | docs
    navigation_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")
    custom_css: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom_js: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    corpus: Mapped["Corpus"] = relationship(back_populates="wiki_publications")
    entries: Mapped[list["WikiPublicationEntry"]] = relationship(
        back_populates="publication",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("corpus_id", "slug", name="uq_wiki_pub_corpus_slug"),
        Index("ix_wiki_publications_corpus_id", "corpus_id"),
        Index("ix_wiki_publications_status", "status"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class WikiPublicationEntry(Base, UUIDMixin, TimestampMixin):
    """Wiki 发布条目映射

    轻量映射表，记录每篇文档在 Wiki 中的展示元数据：
    - entry_slug / entry_title: 可覆盖原始文档的标识和标题
    - is_index_page: 标记是否为该 Publication 的首页
    - entry_order: 在导航树中的位置路径 (JSON path)
    """

    __tablename__ = "wiki_publication_entries"

    publication_id: Mapped[UUID] = mapped_column(fk("wiki_publications", ondelete="CASCADE"), nullable=False)
    document_id: Mapped[UUID] = mapped_column(fk("knowledge_documents", ondelete="CASCADE"), nullable=False)
    entry_slug: Mapped[str] = mapped_column(String(255), nullable=False)
    entry_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    entry_order: Mapped[str | None] = mapped_column(JSONB)  # JSON path in nav tree
    is_index_page: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    publication: Mapped["WikiPublication"] = relationship(back_populates="entries")
    document: Mapped["KnowledgeDocument"] = relationship()

    __table_args__ = (
        UniqueConstraint("publication_id", "entry_slug", name="uq_wiki_entry_pub_slug"),
        UniqueConstraint("publication_id", "document_id", name="uq_wiki_entry_pub_doc"),
        {"schema": NEGENTROPY_SCHEMA},
    )


# =============================================================================
# Phase 5: 知识图谱增强（一等公民实体/关系）
# =============================================================================


class KgEntity(Base, UUIDMixin, TimestampMixin):
    """知识图谱实体（一等公民）

    将原本散落在 knowledge.metadata_ JSONB 中的实体信息提升为一等数据库对象，
    支持独立索引、向量搜索、时序追踪和质量评估。
    """

    __tablename__ = "kg_entities"

    corpus_id: Mapped[UUID] = mapped_column(fk("corpus", ondelete="CASCADE"), nullable=False)
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # 核心身份
    name: Mapped[str] = mapped_column(Text, nullable=False)  # 原始显示名
    canonical_name: Mapped[str | None] = mapped_column(String(500), nullable=True)  # 规范化名称
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # person/org/concept/...
    aliases: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    # 向量嵌入（支持实体级语义搜索）
    embedding: Mapped[list[float] | None] = mapped_column(Vector(DEFAULT_EMBEDDING_DIM))

    # 质量信号
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    mention_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # 描述（LLM 生成或手动编辑）
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 扩展属性
    properties: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")

    # 时序追踪
    first_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    corpus: Mapped["Corpus"] = relationship()
    outgoing_relations: Mapped[list["KgRelation"]] = relationship(
        back_populates="source_entity", foreign_keys="KgRelation.source_id"
    )
    incoming_relations: Mapped[list["KgRelation"]] = relationship(
        back_populates="target_entity", foreign_keys="KgRelation.target_id"
    )
    mentions: Mapped[list["KgEntityMention"]] = relationship(back_populates="entity", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("corpus_id", "canonical_name", name="uq_kg_entity_corpus_name"),
        Index("ix_kg_entities_corpus_type", "corpus_id", "entity_type"),
        Index(
            "ix_kg_entities_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
            postgresql_with={"m": 16, "ef_construction": 64},
        ),
        Index("ix_kg_entities_confidence", "confidence"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class KgRelation(Base, UUIDMixin, TimestampMixin):
    """知识图谱关系（一等公民）

    记录两个实体间的语义关系，包含置信度、证据支持和时序信息。
    """

    __tablename__ = "kg_relations"

    source_id: Mapped[UUID] = mapped_column(fk("kg_entities", ondelete="CASCADE"), nullable=False)
    target_id: Mapped[UUID] = mapped_column(fk("kg_entities", ondelete="CASCADE"), nullable=False)
    corpus_id: Mapped[UUID] = mapped_column(fk("corpus", ondelete="CASCADE"), nullable=False)
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)

    relation_type: Mapped[str] = mapped_column(String(50), nullable=False)  # WORKS_FOR, RELATED_TO, ...
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    # 证据支持
    evidence_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_chunk_ids: Mapped[list[str] | None] = mapped_column(JSONB)  # UUID[] of supporting chunks

    # 时序
    first_observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    observation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, server_default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    source_entity: Mapped["KgEntity"] = relationship(foreign_keys=[source_id], back_populates="outgoing_relations")
    target_entity: Mapped["KgEntity"] = relationship(foreign_keys=[target_id], back_populates="incoming_relations")

    __table_args__ = (
        UniqueConstraint("source_id", "target_id", "relation_type", name="uq_kg_relation_src_tgt_type"),
        Index("ix_kg_relations_source", "source_id"),
        Index("ix_kg_relations_target", "target_id"),
        Index("ix_kg_relations_corpus", "corpus_id"),
        Index("ix_kg_relations_type", "relation_type"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class KgEntityMention(Base, UUIDMixin, TimestampMixin):
    """实体提及时序记录

    追踪每个实体在何时、何处的知识块中被提及，
    用于构建时间线、累积置信度和溯源分析。
    """

    __tablename__ = "kg_entity_mentions"

    entity_id: Mapped[UUID] = mapped_column(fk("kg_entities", ondelete="CASCADE"), nullable=False)
    corpus_id: Mapped[UUID] = mapped_column(fk("corpus", ondelete="CASCADE"), nullable=False)
    # 提及位置（可为空，如非 chunk 来源）
    knowledge_chunk_id: Mapped[UUID | None] = mapped_column(fk("knowledge", ondelete="SET NULL"), nullable=True)
    document_id: Mapped[UUID | None] = mapped_column(fk("knowledge_documents", ondelete="SET NULL"), nullable=True)
    # 上下文
    context_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    char_offset: Mapped[int | None] = mapped_column(Integer, nullable=True)
    char_length: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 提取元数据
    extraction_method: Mapped[str] = mapped_column(
        String(50),
        default="llm",  # llm | regex | cooccurrence
    )
    extraction_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    extractor_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    build_run_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    entity: Mapped["KgEntity"] = relationship(back_populates="mentions")

    __table_args__ = (
        Index("ix_kg_mentions_entity", "entity_id"),
        Index("ix_kg_mentions_chunk", "knowledge_chunk_id"),
        Index("ix_kg_mentions_document", "document_id"),
        Index("ix_kg_mentions_corpus", "corpus_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )


# =============================================================================
# Phase 5: 语料版本与检索反馈
# =============================================================================


class CorpusVersion(Base, UUIDMixin, TimestampMixin):
    """语料库版本快照

    记录 Corpus 在某个时间点的状态快照，用于版本管理、diff 追踪和回滚。
    """

    __tablename__ = "corpus_versions"

    corpus_id: Mapped[UUID] = mapped_column(fk("corpus", ondelete="CASCADE"), nullable=False)
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # 快照元数据
    document_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0-1
    config_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    # 构建触发信息
    trigger_type: Mapped[str] = mapped_column(
        String(50), default="manual", server_default="'manual'"
    )  # manual | scheduled | pipeline
    build_run_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # 与上一版本的 diff
    diff_summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    # e.g., {"added_docs": 3, "removed_docs": 0, "modified_docs": 1}

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="'active'"
    )  # active | superseded | rolled_back

    corpus: Mapped["Corpus"] = relationship(back_populates="versions")

    __table_args__ = (
        UniqueConstraint("corpus_id", "version_number", name="uq_corpus_ver"),
        Index("ix_corpus_versions_corpus_id", "corpus_id"),
        Index("ix_corpus_versions_status", "status"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class KnowledgeFeedback(Base, UUIDMixin, TimestampMixin):
    """检索反馈闭环

    记录 Agent/User 对检索结果的使用反馈，用于：
    - 学习排序（Learning to Rank）训练数据
    - 热门/趋势知识条目统计
    - 质量评估输入
    """

    __tablename__ = "knowledge_feedback"

    knowledge_id: Mapped[UUID] = mapped_column(fk("knowledge", ondelete="CASCADE"), nullable=False)
    corpus_id: Mapped[UUID] = mapped_column(fk("corpus", ondelete="CASCADE"), nullable=False)
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # 会话上下文
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    agent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # 查询上下文
    query_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    query_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)  # semantic/hybrid/rrf

    # 反馈类型
    feedback_type: Mapped[str] = mapped_column(String(20), nullable=False)  # click/useful/not_useful/impression
    score: Mapped[float | None] = mapped_column(Float, nullable=True)  # 显式评分 1-5

    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        Index("ix_kb_feedback_knowledge", "knowledge_id"),
        Index("ix_kb_feedback_corpus", "corpus_id"),
        Index("ix_kb_feedback_session", "session_id"),
        Index("ix_kb_feedback_type", "feedback_type"),
        Index("ix_kb_feedback_created", "created_at"),
        {"schema": NEGENTROPY_SCHEMA},
    )
