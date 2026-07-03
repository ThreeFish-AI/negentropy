"""内置工具配置模型。

管理 Google Search 等内置工具的配置与凭证，
替代 config.default.yaml + 环境变量的硬编码模式。

设计决策：
- 表名 builtin_tools，避免与 action.py 中已有的 tools 表（运行时执行追踪）冲突
- credentials 与 config 分离，API 层对 credentials 做脱敏处理
- config_schema JSONB 声明工具的配置字段定义，供 UI 动态渲染表单
- is_system 标识系统内置工具，API 层阻止删除
"""

import json as _json
from typing import Any

from sqlalchemy import Boolean, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin
from .plugin_common import PluginVisibility


def ensure_dict(value: Any) -> dict[str, Any]:
    """将 JSONB 列值安全转为 dict。

    防御 migration 0031 中 json.dumps() + JSONB bindparam 双编码
    导致读取时返回 str 而非 dict 的问题。
    """
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = _json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, TypeError):
            return {}
    return {}


class BuiltinTool(Base, UUIDMixin, TimestampMixin):
    """内置工具配置"""

    __tablename__ = "builtin_tools"

    # 所有权和可见性
    owner_id: Mapped[str] = mapped_column(String(255), nullable=False)
    visibility: Mapped[PluginVisibility] = mapped_column(
        Enum(PluginVisibility, schema=NEGENTROPY_SCHEMA),
        nullable=False,
        default=PluginVisibility.PRIVATE,
    )

    # 基本信息
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    tool_type: Mapped[str] = mapped_column(String(50), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False, server_default="1.0.0")

    # 工具配置（cx_id, max_retries, timeout 等）— JSONB
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}")
    # 凭证（API Key 等敏感信息）— JSONB，API 层脱敏返回
    credentials: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}")
    # 配置 Schema（声明 config/credentials 的字段定义，供 UI 动态渲染表单）
    config_schema: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}")

    # 状态
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    # 排序：前端拖拽排序后的持久化序号，值越小越靠前。
    sort_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    # builtin_tool_config 进化发布指针（迁移 0088）：区分「最新」（version）与「已晋升」（active_version）。
    # 运行时工具读 active_version 指向的 builtin_tool_versions 快照；NULL → 退化 version/当前 config。
    active_version: Mapped[str | None] = mapped_column(String(50), nullable=True)

    __table_args__ = (
        UniqueConstraint("name", name="builtin_tools_name_unique"),
        Index("ix_builtin_tools_owner", "owner_id"),
        Index("ix_builtin_tools_tool_type", "tool_type"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class BuiltinToolVersion(Base, UUIDMixin, TimestampMixin):
    """builtin_tool_config 进化版本快照（迁移 0088，镜像 ``skill_versions`` 范式）。

    snapshot schema：``{"config": {...}, "config_schema": {...}}``（credentials 永不入快照——脱敏边界）。
    每个 tool 至多一行被 ``builtin_tools.active_version`` 指向（promote 翻指针）。
    """

    __tablename__ = "builtin_tool_versions"

    tool_id: Mapped[str] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.builtin_tools.id", ondelete="CASCADE"),
        nullable=False,
    )
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")

    __table_args__ = (
        UniqueConstraint("tool_id", "version", name="uq_builtin_tool_version"),
        Index("ix_builtin_tool_versions_tool_id", "tool_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )
