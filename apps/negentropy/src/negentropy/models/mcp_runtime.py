"""MCP Tool 执行记录与试用资产模型。"""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import NEGENTROPY_SCHEMA, TIMESTAMP, Base, TimestampMixin, UUIDMixin, fk


class McpToolRun(Base, UUIDMixin):
    """MCP Tool 执行记录。"""

    __tablename__ = "mcp_tool_runs"

    server_id: Mapped[UUID] = mapped_column(fk("mcp_servers", ondelete="CASCADE"), nullable=False)
    tool_id: Mapped[UUID | None] = mapped_column(fk("mcp_tools", ondelete="SET NULL"))
    tool_name: Mapped[str] = mapped_column(String(255), nullable=False)
    origin: Mapped[str] = mapped_column(String(50), nullable=False, server_default="trial_ui")
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="running")
    created_by: Mapped[str | None] = mapped_column(String(255))
    request_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    normalized_request_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    result_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    error_summary: Mapped[str | None] = mapped_column(Text)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    started_at: Mapped[datetime] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(TIMESTAMP)

    __table_args__ = (
        Index("ix_mcp_tool_runs_server_tool_started", "server_id", "tool_name", "started_at"),
        Index("ix_mcp_tool_runs_origin_started", "origin", "started_at"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class McpToolRunEvent(Base, UUIDMixin):
    """MCP Tool 执行阶段事件。"""

    __tablename__ = "mcp_tool_run_events"

    run_id: Mapped[UUID] = mapped_column(fk("mcp_tool_runs", ondelete="CASCADE"), nullable=False)
    sequence_num: Mapped[int] = mapped_column(Integer, nullable=False)
    stage: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="info")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    timestamp: Mapped[datetime] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("run_id", "sequence_num", name="mcp_tool_run_events_run_seq_unique"),
        Index("ix_mcp_tool_run_events_run_timestamp", "run_id", "timestamp"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class McpTrialAsset(Base, UUIDMixin, TimestampMixin):
    """MCP 试用上传资产。"""

    __tablename__ = "mcp_trial_assets"

    server_id: Mapped[UUID] = mapped_column(fk("mcp_servers", ondelete="CASCADE"), nullable=False)
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False)
    source_kind: Mapped[str] = mapped_column(String(50), nullable=False, server_default="upload")
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(255))
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    gcs_uri: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")

    __table_args__ = (
        Index("ix_mcp_trial_assets_server_created", "server_id", "created_at"),
        Index("ix_mcp_trial_assets_owner_created", "owner_id", "created_at"),
        {"schema": NEGENTROPY_SCHEMA},
    )
