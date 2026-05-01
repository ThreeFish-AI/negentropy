from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import UUID as SA_UUID
from sqlalchemy import Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import DEFAULT_EMBEDDING_DIM, NEGENTROPY_SCHEMA, TIMESTAMP, Base, TimestampMixin, UUIDMixin, Vector


class Memory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "memories"

    thread_id: Mapped[UUID | None] = mapped_column(ForeignKey(f"{NEGENTROPY_SCHEMA}.threads.id", ondelete="SET NULL"))
    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    memory_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="episodic", server_default="'episodic'"
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(DEFAULT_EMBEDDING_DIM))
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, server_default="{}")
    retention_score: Mapped[float] = mapped_column(Float, nullable=False, default=1.0, server_default="1.0")
    access_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_accessed_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=True)
    # search_vector: Mapped[Any] # tsvector support in SQLAlchemy needs specific handling or TypeDecorator

    # We need to handle search_vector.
    # Usually we don't map tsvector columns to ORM unless we use them explicitly.
    # We can skip mapping it for now as it's mostly for DB-side search.

    # Relationships? Memory usually stands alone or links to thread.
    # The schema references threads(id).


class Fact(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "facts"

    thread_id: Mapped[UUID | None] = mapped_column(ForeignKey(f"{NEGENTROPY_SCHEMA}.threads.id", ondelete="SET NULL"))
    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    fact_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="preference", server_default="'preference'"
    )
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(DEFAULT_EMBEDDING_DIM))
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0, server_default="1.0")
    valid_from: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(TIMESTAMP)

    __table_args__ = (
        UniqueConstraint("user_id", "app_name", "fact_type", "key", name="facts_user_key_unique"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class MemoryAutomationConfig(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "memory_automation_configs"

    app_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    updated_by: Mapped[str | None] = mapped_column(String(255))


class MemoryAuditLog(Base, UUIDMixin, TimestampMixin):
    """
    Memory Audit Log Model

    用于记录用户记忆的审计决策，支持版本控制和幂等性。

    参考文献:
    [1] A. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," 1885.
    """

    __tablename__ = "memory_audit_logs"

    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    memory_id: Mapped[str] = mapped_column(String(255), nullable=False)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    idempotency_key: Mapped[str | None] = mapped_column(String(255))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    __table_args__ = (
        UniqueConstraint(
            "app_name", "user_id", "memory_id", "idempotency_key", name="memory_audit_logs_idempotency_unique"
        ),
        {"schema": NEGENTROPY_SCHEMA},
    )


class MemorySummary(Base, UUIDMixin, TimestampMixin):
    """用户记忆画像摘要缓存

    MemorySummarizer 生成的结构化用户画像摘要，供 ContextAssembler 注入。

    参考文献:
    [1] S. J. Sara, "Reconsolidation and the stability of memory traces,"
        Current Opinion in Neurobiology, vol. 35, pp. 110-115, 2015.
    """

    __tablename__ = "memory_summaries"

    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    summary_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="user_profile", server_default="'user_profile'"
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int | None] = mapped_column(Integer)
    source_memory_count: Mapped[int | None] = mapped_column(Integer)
    source_fact_count: Mapped[int | None] = mapped_column(Integer)
    model_used: Mapped[str | None] = mapped_column(String(255))

    __table_args__ = (
        UniqueConstraint("user_id", "app_name", "summary_type", name="memory_summaries_user_type_unique"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class MemoryRetrievalLog(Base, UUIDMixin):
    """记忆检索效果反馈日志

    追踪"检索了什么→是否被使用→是否有帮助"的反馈闭环。

    参考文献:
    [1] J. J. Rocchio, "Relevance feedback in information retrieval,"
        in The SMART Retrieval System, Prentice-Hall, 1971, pp. 313-323.
    """

    __tablename__ = "memory_retrieval_logs"

    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    thread_id: Mapped[UUID | None] = mapped_column(SA_UUID)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    retrieved_memory_ids: Mapped[list] = mapped_column(ARRAY(SA_UUID), nullable=False)
    retrieved_fact_ids: Mapped[list | None] = mapped_column(ARRAY(SA_UUID))
    was_referenced: Mapped[bool | None] = mapped_column()
    reference_count: Mapped[int | None] = mapped_column(Integer, default=0, server_default="0")
    outcome_feedback: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=False)

    __table_args__ = ({"schema": NEGENTROPY_SCHEMA},)
