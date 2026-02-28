from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import Float, ForeignKey, Integer, String, Text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin, Vector


class Corpus(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "corpus"

    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, server_default="{}")

    __table_args__ = (
        UniqueConstraint("app_name", "name", name="corpus_app_name_unique"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    knowledge_items: Mapped[List["Knowledge"]] = relationship(back_populates="corpus", cascade="all, delete-orphan")
    documents: Mapped[List["KnowledgeDocument"]] = relationship(back_populates="corpus", cascade="all, delete-orphan")


class Knowledge(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge"

    corpus_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.corpus.id", ondelete="CASCADE"), nullable=False
    )
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(1536))
    # TSVector type is not directly supported by SQLAlchemy, so we use UserDefinedType or just Any for now
    # However, for Alembic to detect it, we might need a custom type.
    # For now, let's use TSVECTOR from sqlalchemy.dialects.postgresql
    from sqlalchemy.dialects.postgresql import TSVECTOR

    search_vector: Mapped[Optional[Any]] = mapped_column(TSVECTOR)
    source_uri: Mapped[Optional[str]] = mapped_column(Text)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    metadata_: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSONB, server_default="{}")

    # Knowledge Graph entity fields
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    entity_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

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
    content_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)

    # 状态追踪
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", server_default="'active'")

    # 可选元数据
    metadata_: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSONB, server_default="{}")

    __table_args__ = (
        UniqueConstraint("corpus_id", "file_hash", name="uq_knowledge_documents_corpus_hash"),
        Index("ix_knowledge_documents_file_hash", "file_hash"),
        Index("ix_knowledge_documents_app_name", "app_name"),
        Index("ix_knowledge_documents_status", "status"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    corpus: Mapped["Corpus"] = relationship(back_populates="documents")
