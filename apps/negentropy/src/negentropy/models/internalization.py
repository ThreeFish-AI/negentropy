from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import DEFAULT_EMBEDDING_DIM, NEGENTROPY_SCHEMA, TIMESTAMP, Base, TimestampMixin, UUIDMixin, Vector

if TYPE_CHECKING:
    from .pulse import Thread


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


class ConsolidationJob(Base, UUIDMixin):
    __tablename__ = "consolidation_jobs"

    thread_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.threads.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", server_default="'pending'")
    job_type: Mapped[str] = mapped_column(String(50), nullable=False)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")
    error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
    completed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=False)

    thread: Mapped[Thread] = relationship("Thread", back_populates="consolidation_jobs")


class Instruction(Base, UUIDMixin):
    __tablename__ = "instructions"

    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    instruction_key: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("app_name", "instruction_key", "version", name="instructions_app_key_version_unique"),
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
