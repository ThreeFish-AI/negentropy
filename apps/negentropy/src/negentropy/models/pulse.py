from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, Sequence, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import DEFAULT_EMBEDDING_DIM, NEGENTROPY_SCHEMA, TIMESTAMP, Base, TimestampMixin, UUIDMixin, Vector


class Thread(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "threads"

    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    state: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    metadata_: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSONB, server_default="{}")

    # Replaced 'metadata' with 'metadata_' to avoid conflict with Base.metadata (SQLAlchemy reserved)
    # But mapped_column("metadata", ...) ensures it maps to the 'metadata' column in DB.

    __table_args__ = (
        UniqueConstraint("app_name", "user_id", "id", name="threads_app_user_unique"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    events: Mapped[List["Event"]] = relationship(back_populates="thread", cascade="all, delete-orphan")
    runs: Mapped[List["Run"]] = relationship(back_populates="thread", cascade="all, delete-orphan")
    messages: Mapped[List["Message"]] = relationship(back_populates="thread", cascade="all, delete-orphan")
    snapshots: Mapped[List["Snapshot"]] = relationship(back_populates="thread", cascade="all, delete-orphan")
    consolidation_jobs: Mapped[List["ConsolidationJob"]] = relationship(
        back_populates="thread", cascade="all, delete-orphan"
    )


class Event(Base, UUIDMixin):
    __tablename__ = "events"

    thread_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.threads.id", ondelete="CASCADE"), nullable=False
    )
    invocation_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    author: Mapped[str] = mapped_column(String(50), nullable=False)  # 'user', 'agent', 'tool'
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'message', 'tool_call', 'state_update'
    content: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    actions: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=False)
    sequence_num: Mapped[int] = mapped_column(
        Integer,
        Sequence("events_sequence_num_seq", schema=NEGENTROPY_SCHEMA),
        server_default=text("nextval('negentropy.events_sequence_num_seq'::regclass)"),
        nullable=False,
    )
    # Note: Using Integer for BIGSERIAL might need BigInteger, but standard int in Py matches.
    # We might need to handle the explicit sequence definition if we were creating tables, but for mapping it's fine.

    thread: Mapped["Thread"] = relationship(back_populates="events")
    messages: Mapped[List["Message"]] = relationship(back_populates="event")


class Run(Base, UUIDMixin):
    __tablename__ = "runs"

    thread_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.threads.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", server_default="'pending'")
    thinking_steps: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, server_default="'[]'")
    tool_calls: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, server_default="'[]'")
    error: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP)

    thread: Mapped["Thread"] = relationship(back_populates="runs")


class Message(Base, UUIDMixin):
    __tablename__ = "messages"

    thread_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.threads.id", ondelete="CASCADE"), nullable=False
    )
    event_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey(f"{NEGENTROPY_SCHEMA}.events.id", ondelete="SET NULL"))
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user', 'assistant', 'tool', 'system'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(DEFAULT_EMBEDDING_DIM))
    metadata_: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSONB, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=False)

    thread: Mapped["Thread"] = relationship(back_populates="messages")
    event: Mapped["Event"] = relationship(back_populates="messages")


class Snapshot(Base, UUIDMixin):
    __tablename__ = "snapshots"

    thread_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.threads.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    state: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    events_summary: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("thread_id", "version", name="snapshots_thread_version_unique"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    thread: Mapped["Thread"] = relationship(back_populates="snapshots")


# Backward-compatible re-exports (UserState/AppState 已迁移至 state.py)
from .state import AppState, UserState  # noqa: F401
