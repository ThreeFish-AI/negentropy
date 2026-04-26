from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

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
# Phase 4: Wiki 发布系统
# =============================================================================


class WikiPublication(Base, UUIDMixin, TimestampMixin):
    """Wiki 发布快照

    表示一个 Catalog 的发布视图，Wiki SSG 应用基于此数据构建静态站点。

    字段语义补强（避免历史命名歧义）：

    - ``app_name``：从关联 :class:`DocCatalog` 派生的应用归属，作为 SSG 多租户路由
      的隔离键（同一 SSG 实例内，不同 ``app_name`` 的发布互不串扰）。**冗余但
      不可变**：值在 ``create_publication`` 时由后端从 catalog 拷入，不接受外部
      PATCH，确保每篇 entry 路径定位稳定（详见 ISSUE-016 修复）。
    - ``publish_mode``：发布行为模式。
        - ``LIVE``：SSG 通过 ISR 主动拉取最新 ``entries``，内容随源文档变更滚动；
        - ``SNAPSHOT``：发布时冻结当前 ``entries`` 到 :class:`WikiPublicationSnapshot`，
          后续源文档变更不影响已发布版本（适合外发/合规归档场景）。
    - ``visibility``：访问域控制。
        - ``PRIVATE``：仅 owner / admin；
        - ``INTERNAL``：登录用户；
        - ``PUBLIC``：匿名访问（SSG 公开站点）。
      与 ``publish_mode`` 正交：``visibility`` 控制谁能访问，``publish_mode`` 控制
      访问到的内容是否会随源更新。
    """

    __tablename__ = "wiki_publications"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft", server_default="'draft'"
    )  # draft | published | archived
    theme: Mapped[str] = mapped_column(
        String(20), nullable=False, default="default", server_default="'default'"
    )  # default | book | docs
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Phase 3: Catalog 全局化（NOT NULL，corpus_id 已移除）
    catalog_id: Mapped[UUID] = mapped_column(fk("doc_catalogs", ondelete="RESTRICT"), nullable=False)
    # 应用归属（SSG 多租户路由隔离键，从 catalog 派生且不可变；详见类 docstring）。
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # 发布模式：LIVE = ISR 滚动拉取最新 entries；SNAPSHOT = 发布时冻结 entries 到 snapshots 表。
    publish_mode: Mapped[str] = mapped_column(
        SAEnum(
            "LIVE",
            "SNAPSHOT",
            name="wikipublishmode",
            schema=NEGENTROPY_SCHEMA,
            create_type=False,
        ),
        nullable=False,
        server_default="LIVE",
    )
    # 访问域：PRIVATE / INTERNAL / PUBLIC（与 publish_mode 正交，控制"谁能访问"）。
    visibility: Mapped[str] = mapped_column(
        SAEnum(
            "PRIVATE",
            "INTERNAL",
            "PUBLIC",
            name="wikipublicationvisibility",
            schema=NEGENTROPY_SCHEMA,
            create_type=False,
        ),
        nullable=False,
        server_default="INTERNAL",
    )
    # SNAPSHOT 模式下指向最新冻结快照的 version；LIVE 模式恒为 NULL。
    snapshot_version: Mapped[int | None] = mapped_column(Integer, nullable=True)

    catalog: Mapped["DocCatalog"] = relationship(back_populates="publications")
    entries: Mapped[list["WikiPublicationEntry"]] = relationship(
        back_populates="publication",
        cascade="all, delete-orphan",
    )
    snapshots: Mapped[list["WikiPublicationSnapshot"]] = relationship(
        back_populates="publication",
        cascade="all, delete-orphan",
        order_by="WikiPublicationSnapshot.version.desc()",
    )
    slug_redirects: Mapped[list["WikiSlugRedirect"]] = relationship(
        back_populates="publication",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("catalog_id", "slug", name="uq_wiki_pub_catalog_slug"),
        Index("ix_wiki_publications_status", "status"),
        Index("ix_wiki_publications_catalog_id", "catalog_id"),
        Index("ix_wiki_publications_app_name", "app_name"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class WikiPublicationEntry(Base, UUIDMixin, TimestampMixin):
    """Wiki 发布条目映射（CONTAINER 容器节点 + DOCUMENT 文档节点双轨）

    自 0011 起：
      - **CONTAINER**：对应 Catalog FOLDER 节点，``document_id IS NULL``、
        ``catalog_node_id`` 指向 ``DocCatalogEntry.id``；``entry_title`` 取自
        Catalog 节点的 ``name``，导航树作为不可点击的可展开标题。
      - **DOCUMENT**：对应文档条目，``document_id`` 必填、``catalog_node_id`` 必空；
        导航树作为可链接的叶子。

    数据库 CHECK 约束 ``ck_wiki_entry_kind_payload`` 保证两态 payload 互斥；
    Partial Unique Index 分别在 CONTAINER / DOCUMENT 两态下保证：
      - ``(publication_id, document_id) WHERE entry_kind='DOCUMENT'`` 唯一；
      - ``(publication_id, catalog_node_id) WHERE entry_kind='CONTAINER'`` 唯一。

    其它字段：
      - ``entry_slug`` / ``entry_title``：URL 段与标题（CONTAINER 取 Catalog 节点 name）。
      - ``is_index_page``：标记是否为该 Publication 首页（仅 DOCUMENT 有意义）。
      - ``entry_path``：导航树层级路径（Materialized Path，list[str] JSON 串）。
    """

    __tablename__ = "wiki_publication_entries"

    publication_id: Mapped[UUID] = mapped_column(fk("wiki_publications", ondelete="CASCADE"), nullable=False)
    # CONTAINER 行 document_id 为 NULL；DOCUMENT 行 catalog_node_id 为 NULL；CHECK 约束保证互斥。
    document_id: Mapped[UUID | None] = mapped_column(fk("knowledge_documents", ondelete="CASCADE"), nullable=True)
    # ON DELETE CASCADE：CHECK 约束要求 CONTAINER 行 catalog_node_id 非空，
    # SET NULL 会反向阻止 FOLDER 删除（详见 0011 迁移 docstring「FK 行为」段）。
    catalog_node_id: Mapped[UUID | None] = mapped_column(
        fk("doc_catalog_entries", ondelete="CASCADE"),
        nullable=True,
    )
    entry_kind: Mapped[str] = mapped_column(
        SAEnum(
            "CONTAINER",
            "DOCUMENT",
            name="wiki_entry_kind",
            schema=NEGENTROPY_SCHEMA,
        ),
        nullable=False,
        server_default="DOCUMENT",
    )
    entry_slug: Mapped[str] = mapped_column(String(255), nullable=False)
    entry_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Materialized Path：list[str] 以 JSON 字符串形式存储；历史列名 entry_order。
    entry_path: Mapped[str | None] = mapped_column("entry_path", JSONB)
    is_index_page: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    publication: Mapped["WikiPublication"] = relationship(back_populates="entries")
    document: Mapped["KnowledgeDocument | None"] = relationship()
    catalog_node: Mapped["DocCatalogEntry | None"] = relationship()

    __table_args__ = (
        UniqueConstraint("publication_id", "entry_slug", name="uq_wiki_entry_pub_slug"),
        # uq_wiki_entry_pub_doc_active / uq_wiki_entry_pub_node_active 是 partial
        # unique index（CONTAINER / DOCUMENT 分态唯一），由 0011 显式创建；ORM 不
        # 在此声明，避免 alembic autogenerate 误判。
        # CHECK 约束 ck_wiki_entry_kind_payload 同样由 0011 显式创建。
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


# =============================================================================
# Phase 6: Catalog 全局化（MediaWiki N:M + GitBook 订阅式发布）
# ---
# Phase 3 enforce 已完成（commit 0005）：legacy doc_catalog_nodes / doc_catalog_memberships 已 DROP。
# 以下模型为 SSOT：DocCatalog（全局顶层）→ DocCatalogEntry（N:M 关联）→ WikiPublication（发布订阅）。
# =============================================================================


class DocCatalog(Base, UUIDMixin, TimestampMixin):
    """Catalog 顶层元数据（全局正交于 Corpus）

    - 承载 Wiki/Site 级别的组织视图；不存储文档物理数据（SSOT 在 Corpus.KnowledgeDocument）
    - `app_name` 租户隔离维度，**创建后不可变**（service 层断言 + 约束）
    - 软归档：`is_archived=true` 后仅可读，拒绝新增 entry
    - `version` 字段承担乐观锁
    """

    __tablename__ = "doc_catalogs"

    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    visibility: Mapped[str] = mapped_column(
        SAEnum(
            "PRIVATE",
            "INTERNAL",
            "PUBLIC",
            name="catalogvisibility",
            schema=NEGENTROPY_SCHEMA,
        ),
        nullable=False,
        server_default="INTERNAL",
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")

    entries: Mapped[list["DocCatalogEntry"]] = relationship(
        back_populates="catalog",
        cascade="all, delete-orphan",
        order_by="DocCatalogEntry.position",
    )
    publications: Mapped[list["WikiPublication"]] = relationship(back_populates="catalog")

    __table_args__ = (
        UniqueConstraint("app_name", "slug", name="uq_doc_catalogs_app_slug"),
        Index("ix_doc_catalogs_app_name", "app_name"),
        Index("ix_doc_catalogs_owner_id", "owner_id"),
        Index(
            "ix_doc_catalogs_is_archived",
            "is_archived",
            postgresql_where="is_archived = false",
        ),
        {"schema": NEGENTROPY_SCHEMA},
    )


class DocCatalogEntry(Base, UUIDMixin, TimestampMixin):
    """Catalog 条目：融合「目录节点树」与「文档软引用」的单一实体

    - `parent_entry_id` 同 catalog 内自引用，支持树结构（Adjacency List，CTE 递归）
    - `document_id` 软引用源文档；`ON DELETE SET NULL` + status=ORPHANED 表达失效语义
    - `source_corpus_id` 冗余字段：承担权限快速校验（避免 join knowledge_documents）
    - `slug_override` 允许同一文档在不同 catalog 有独立 slug（Docusaurus sidebar.id 启发）
    """

    __tablename__ = "doc_catalog_entries"

    catalog_id: Mapped[UUID] = mapped_column(fk("doc_catalogs", ondelete="CASCADE"), nullable=False)
    parent_entry_id: Mapped[UUID | None] = mapped_column(fk("doc_catalog_entries", ondelete="CASCADE"), nullable=True)
    document_id: Mapped[UUID | None] = mapped_column(fk("knowledge_documents", ondelete="SET NULL"), nullable=True)
    source_corpus_id: Mapped[UUID | None] = mapped_column(fk("corpus", ondelete="SET NULL"), nullable=True)
    # 节点类型（自 0010 收敛）：
    #   - ``FOLDER``：用户可见的目录容器，合并自历史 CATEGORY + COLLECTION；
    #   - ``DOCUMENT_REF``：系统内部软引用，由 ``CatalogDao.assign_document`` 自动创建。
    #
    # ``CATEGORY`` / ``COLLECTION`` 在 PG ENUM 中作为"死值"保留（无法 DROP VALUE），
    # 应用层禁止写入；新代码统一使用 FOLDER。
    node_type: Mapped[str] = mapped_column(
        SAEnum(
            "CATEGORY",
            "COLLECTION",
            "FOLDER",
            "DOCUMENT_REF",
            name="catalogentrynodetype",
            schema=NEGENTROPY_SCHEMA,
        ),
        nullable=False,
        server_default="FOLDER",
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug_override: Mapped[str | None] = mapped_column(String(255), nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    status: Mapped[str] = mapped_column(
        SAEnum(
            "ACTIVE",
            "ORPHANED",
            "HIDDEN",
            name="catalogentrystatus",
            schema=NEGENTROPY_SCHEMA,
        ),
        nullable=False,
        server_default="ACTIVE",
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")

    catalog: Mapped["DocCatalog"] = relationship(back_populates="entries")
    parent: Mapped["DocCatalogEntry | None"] = relationship(remote_side="DocCatalogEntry.id", back_populates="children")
    children: Mapped[list["DocCatalogEntry"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="DocCatalogEntry.position",
    )
    document: Mapped["KnowledgeDocument | None"] = relationship()
    source_corpus: Mapped["Corpus | None"] = relationship()

    __table_args__ = (
        UniqueConstraint("catalog_id", "parent_entry_id", "name", name="uq_catalog_entry_sibling_name"),
        Index("ix_doc_catalog_entries_catalog_status", "catalog_id", "status"),
        Index("ix_doc_catalog_entries_parent", "parent_entry_id"),
        Index(
            "ix_doc_catalog_entries_document",
            "document_id",
            postgresql_where="document_id IS NOT NULL",
        ),
        Index(
            "ix_doc_catalog_entries_source_corpus",
            "source_corpus_id",
            postgresql_where="source_corpus_id IS NOT NULL",
        ),
        Index(
            "uq_catalog_entry_sibling_slug_override",
            "catalog_id",
            "parent_entry_id",
            "slug_override",
            unique=True,
            postgresql_where="slug_override IS NOT NULL",
        ),
        {"schema": NEGENTROPY_SCHEMA},
    )


class WikiPublicationSnapshot(Base, UUIDMixin):
    """Publication 快照（snapshot 模式）

    冻结 `(catalog_entries, document_versions)` 到不可变 JSONB，供合规/留档场景使用。
    只追加，不更新；重新生成快照 = 新版本行。
    """

    __tablename__ = "wiki_publication_snapshots"

    publication_id: Mapped[UUID] = mapped_column(fk("wiki_publications", ondelete="CASCADE"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    frozen_entries: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default="[]")
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    publication: Mapped["WikiPublication"] = relationship(back_populates="snapshots")

    __table_args__ = (
        UniqueConstraint("publication_id", "version", name="uq_wiki_pub_snapshot_version"),
        Index("ix_wiki_publication_snapshots_publication", "publication_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class WikiSlugRedirect(Base, UUIDMixin):
    """历史 slug → 当前 slug 的 301 重定向映射（GitBook 启发）

    当 catalog 节点 slug_override 变化或 publication slug 变化时，
    同步追加记录以保持链接稳定性。
    """

    __tablename__ = "wiki_slug_redirects"

    publication_id: Mapped[UUID] = mapped_column(fk("wiki_publications", ondelete="CASCADE"), nullable=False)
    old_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    new_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    publication: Mapped["WikiPublication"] = relationship(back_populates="slug_redirects")

    __table_args__ = (
        UniqueConstraint("publication_id", "old_path", name="uq_wiki_slug_redirect_pub_old"),
        Index("ix_wiki_slug_redirects_lookup", "publication_id", "old_path"),
        {"schema": NEGENTROPY_SCHEMA},
    )
