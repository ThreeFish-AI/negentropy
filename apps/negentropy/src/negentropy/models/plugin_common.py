"""Plugin 共享枚举与权限模型。"""

import enum
from uuid import UUID

from sqlalchemy import Enum, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin


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
