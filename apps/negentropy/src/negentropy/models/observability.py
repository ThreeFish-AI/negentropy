from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import BigInteger, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import NEGENTROPY_SCHEMA, TIMESTAMP, Base, UUIDMixin


class Trace(Base, UUIDMixin):
    __tablename__ = "traces"

    run_id: Mapped[Optional[UUID]] = mapped_column()
    trace_id: Mapped[str] = mapped_column(String(32), nullable=False)
    span_id: Mapped[str] = mapped_column(String(16), nullable=False)
    parent_span_id: Mapped[Optional[str]] = mapped_column(String(16))
    operation_name: Mapped[str] = mapped_column(String(255), nullable=False)
    span_kind: Mapped[str] = mapped_column(String(20), nullable=False, default="INTERNAL", server_default="'INTERNAL'")
    attributes: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, server_default="{}")
    events: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, server_default="'[]'")
    start_time: Mapped[datetime] = mapped_column(TIMESTAMP, nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP)
    duration_ns: Mapped[Optional[int]] = mapped_column(BigInteger)
    status_code: Mapped[Optional[str]] = mapped_column(String(10), default="UNSET", server_default="'UNSET'")
    status_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=False)
