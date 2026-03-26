"""MCP Server 与 Tool 定义模型。"""

from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, Enum, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin, fk
from .plugin_common import PluginVisibility


class McpServer(Base, UUIDMixin, TimestampMixin):
    """MCP 服务器配置"""

    __tablename__ = "mcp_servers"

    # 所有权和可见性
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False)
    visibility: Mapped[PluginVisibility] = mapped_column(
        Enum(PluginVisibility, schema=NEGENTROPY_SCHEMA), nullable=False, default=PluginVisibility.PRIVATE
    )

    # 基本信息
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)

    # 传输配置
    transport_type: Mapped[str] = mapped_column(String(50), nullable=False)  # stdio, sse, http
    command: Mapped[str | None] = mapped_column(Text)  # for stdio transport
    args: Mapped[list[str] | None] = mapped_column(JSONB, server_default="[]")
    env: Mapped[dict[str, str] | None] = mapped_column(JSONB, server_default="{}")
    url: Mapped[str | None] = mapped_column(String(500))  # for sse/http
    headers: Mapped[dict[str, str] | None] = mapped_column(JSONB, server_default="{}")  # for sse/http

    # 状态和配置
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    auto_start: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    config: Mapped[dict[str, Any] | None] = mapped_column(JSONB, server_default="{}")

    __table_args__ = (
        UniqueConstraint("name", name="mcp_servers_name_unique"),
        Index("ix_mcp_servers_owner", "owner_id"),
        Index("ix_mcp_servers_visibility", "visibility"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    # Relationships
    tools: Mapped[list["McpTool"]] = relationship(back_populates="server", cascade="all, delete-orphan")


class McpTool(Base, UUIDMixin, TimestampMixin):
    """MCP 工具（从 McpServer 动态发现）"""

    __tablename__ = "mcp_tools"

    server_id: Mapped[UUID] = mapped_column(fk("mcp_servers", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    input_schema: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    output_schema: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    icons: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default="[]")
    annotations: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    execution: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    call_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    __table_args__ = (
        UniqueConstraint("server_id", "name", name="mcp_tools_server_name_unique"),
        Index("ix_mcp_tools_server_id", "server_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    # Relationships
    server: Mapped["McpServer"] = relationship(back_populates="tools")
