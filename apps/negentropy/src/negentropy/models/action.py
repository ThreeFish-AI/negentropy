from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import TIMESTAMP, Base, TimestampMixin, UUIDMixin


class Tool(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tools"

    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    openapi_schema: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    permissions: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, server_default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    call_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    avg_latency_ms: Mapped[float] = mapped_column(Float, default=0, server_default="0")

    __table_args__ = (UniqueConstraint("app_name", "name", name="tools_app_name_unique"),)

    executions: Mapped[List["ToolExecution"]] = relationship(back_populates="tool", cascade="all, delete-orphan")


class ToolExecution(Base, UUIDMixin):
    __tablename__ = "tool_executions"

    tool_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("tools.id"))
    run_id: Mapped[Optional[UUID]] = mapped_column()  # Loose coupling
    input_params: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    output_result: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    status: Mapped[Optional[str]] = mapped_column(String(50))
    latency_ms: Mapped[Optional[float]] = mapped_column(Float)
    error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=False)

    tool: Mapped["Tool"] = relationship(back_populates="executions")


class SandboxExecution(Base, UUIDMixin):
    __tablename__ = "sandbox_executions"

    run_id: Mapped[Optional[UUID]] = mapped_column()
    sandbox_type: Mapped[Optional[str]] = mapped_column(String(50))
    code: Mapped[Optional[str]] = mapped_column(Text)
    environment: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    stdout: Mapped[Optional[str]] = mapped_column(Text)
    stderr: Mapped[Optional[str]] = mapped_column(Text)
    exit_code: Mapped[Optional[int]] = mapped_column(Integer)
    execution_time_ms: Mapped[Optional[float]] = mapped_column(Float)
    resource_usage: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=False)
