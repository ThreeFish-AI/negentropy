from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, Sequence, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import NEGENTROPY_SCHEMA, TIMESTAMP, Base, TimestampMixin, UUIDMixin


class Thread(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "threads"

    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    state: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, server_default="{}")

    # Replaced 'metadata' with 'metadata_' to avoid conflict with Base.metadata (SQLAlchemy reserved)
    # But mapped_column("metadata", ...) ensures it maps to the 'metadata' column in DB.

    __table_args__ = (
        UniqueConstraint("app_name", "user_id", "id", name="threads_app_user_unique"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    events: Mapped[list[Event]] = relationship(back_populates="thread", cascade="all, delete-orphan")


class Event(Base, UUIDMixin):
    __tablename__ = "events"

    thread_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.threads.id", ondelete="CASCADE"), nullable=False
    )
    invocation_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    author: Mapped[str] = mapped_column(String(50), nullable=False)  # 'user', 'agent', 'tool'
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'message', 'tool_call', 'state_update'
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    actions: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=False)
    sequence_num: Mapped[int] = mapped_column(
        Integer,
        Sequence("events_sequence_num_seq", schema=NEGENTROPY_SCHEMA),
        server_default=text("nextval('negentropy.events_sequence_num_seq'::regclass)"),
        nullable=False,
    )
    # Note: Using Integer for BIGSERIAL might need BigInteger, but standard int in Py matches.
    # We might need to handle the explicit sequence definition if we were creating tables, but for mapping it's fine.

    thread: Mapped[Thread] = relationship(back_populates="events")


# Backward-compatible re-exports (UserState/AppState 已迁移至 state.py)
from .state import AppState, UserState  # noqa: F401, E402
