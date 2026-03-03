"""
Plugin 模块数据模型。

包含 MCP Server、Skill、SubAgent 以及权限管理相关的模型定义。
"""

import enum
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import NEGENTROPY_SCHEMA, TIMESTAMP, Base, TimestampMixin, UUIDMixin, fk


class PluginVisibility(str, enum.Enum):
    """插件可见性枚举"""

    PRIVATE = "private"  # 仅创建者可见
    SHARED = "shared"  # 指定用户可见（通过 PluginPermission）
    PUBLIC = "public"  # 所有人可见


class PluginPermissionType(str, enum.Enum):
    """插件权限类型枚举"""

    VIEW = "view"  # 查看权限
    EDIT = "edit"  # 编辑权限


class PluginPermission(Base, UUIDMixin, TimestampMixin):
    """插件权限授权记录"""

    __tablename__ = "plugin_permissions"

    plugin_type: Mapped[str] = mapped_column(String(50), nullable=False)  # mcp_server, skill, sub_agent
    plugin_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    permission: Mapped[PluginPermissionType] = mapped_column(
        Enum(PluginPermissionType, schema=NEGENTROPY_SCHEMA), nullable=False, default=PluginPermissionType.VIEW
    )

    __table_args__ = (
        UniqueConstraint("plugin_type", "plugin_id", "user_id", name="plugin_permissions_unique"),
        Index("ix_plugin_permissions_plugin", "plugin_type", "plugin_id"),
        Index("ix_plugin_permissions_user", "user_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )


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
    display_name: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)

    # 传输配置
    transport_type: Mapped[str] = mapped_column(String(50), nullable=False)  # stdio, sse, http
    command: Mapped[Optional[str]] = mapped_column(Text)  # for stdio transport
    args: Mapped[Optional[List[str]]] = mapped_column(JSONB, server_default="[]")
    env: Mapped[Optional[Dict[str, str]]] = mapped_column(JSONB, server_default="{}")
    url: Mapped[Optional[str]] = mapped_column(String(500))  # for sse/http
    headers: Mapped[Optional[Dict[str, str]]] = mapped_column(JSONB, server_default="{}")  # for sse/http

    # 状态和配置
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    auto_start: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, server_default="{}")

    __table_args__ = (
        UniqueConstraint("name", name="mcp_servers_name_unique"),
        Index("ix_mcp_servers_owner", "owner_id"),
        Index("ix_mcp_servers_visibility", "visibility"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    # Relationships
    tools: Mapped[List["McpTool"]] = relationship(back_populates="server", cascade="all, delete-orphan")


class McpTool(Base, UUIDMixin, TimestampMixin):
    """MCP 工具（从 McpServer 动态发现）"""

    __tablename__ = "mcp_tools"

    server_id: Mapped[UUID] = mapped_column(fk("mcp_servers", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    input_schema: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    call_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    __table_args__ = (
        UniqueConstraint("server_id", "name", name="mcp_tools_server_name_unique"),
        Index("ix_mcp_tools_server_id", "server_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    # Relationships
    server: Mapped["McpServer"] = relationship(back_populates="tools")


class Skill(Base, UUIDMixin, TimestampMixin):
    """技能模块定义"""

    __tablename__ = "skills"

    # 所有权和可见性
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False)
    visibility: Mapped[PluginVisibility] = mapped_column(
        Enum(PluginVisibility, schema=NEGENTROPY_SCHEMA), nullable=False, default=PluginVisibility.PRIVATE
    )

    # 基本信息
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(100), nullable=False, server_default="general")
    version: Mapped[str] = mapped_column(String(50), nullable=False, server_default="1.0.0")

    # 技能定义
    prompt_template: Mapped[Optional[str]] = mapped_column(Text)
    config_schema: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, server_default="{}")
    default_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, server_default="{}")
    required_tools: Mapped[Optional[List[str]]] = mapped_column(JSONB, server_default="[]")

    # 状态
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    __table_args__ = (
        UniqueConstraint("name", name="skills_name_unique"),
        Index("ix_skills_owner", "owner_id"),
        Index("ix_skills_category", "category"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class SubAgent(Base, UUIDMixin, TimestampMixin):
    """子智能体配置"""

    __tablename__ = "sub_agents"

    # 所有权和可见性
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False)
    visibility: Mapped[PluginVisibility] = mapped_column(
        Enum(PluginVisibility, schema=NEGENTROPY_SCHEMA), nullable=False, default=PluginVisibility.PRIVATE
    )

    # 基本信息
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    agent_type: Mapped[str] = mapped_column(String(100), nullable=False)  # llm_agent, workflow, etc.

    # Agent 配置
    system_prompt: Mapped[Optional[str]] = mapped_column(Text)
    model: Mapped[Optional[str]] = mapped_column(String(100))
    config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, server_default="{}")
    skills: Mapped[Optional[List[str]]] = mapped_column(JSONB, server_default="[]")
    tools: Mapped[Optional[List[str]]] = mapped_column(JSONB, server_default="[]")

    # 状态
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        UniqueConstraint("name", name="sub_agents_name_unique"),
        Index("ix_sub_agents_owner", "owner_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )
