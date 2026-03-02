"""
Plugins 权限检查模块。

提供插件访问权限的检查和管理功能。
"""

from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.auth.rbac import has_permission
from negentropy.auth.service import AuthUser
from negentropy.models.plugin import (
    McpServer,
    PluginPermission,
    PluginPermissionType,
    PluginVisibility,
    Skill,
    SubAgent,
)


async def check_plugin_access(
    db: AsyncSession,
    plugin_type: str,
    plugin_id: UUID,
    user: AuthUser,
    required_permission: str,  # "view" or "edit"
) -> Tuple[bool, Optional[str]]:
    """
    检查用户是否有权限访问指定插件。

    Args:
        db: 数据库会话
        plugin_type: 插件类型 ("mcp_server", "skill", "sub_agent")
        plugin_id: 插件 UUID
        user: 当前用户
        required_permission: 需要的权限 ("view" or "edit")

    Returns:
        Tuple[bool, Optional[str]]: (是否有权限, 错误消息)
    """
    # 1. admin 角色拥有所有权限
    if "admin" in user.roles:
        return True, None

    # 2. 获取插件记录检查 owner 和 visibility
    plugin = await _get_plugin_by_type_and_id(db, plugin_type, plugin_id)
    if not plugin:
        return False, "Plugin not found"

    # 3. owner 拥有所有权限
    if plugin.owner_id == user.user_id:
        return True, None

    # 4. 检查 visibility
    if plugin.visibility == PluginVisibility.PUBLIC and required_permission == "view":
        return True, None

    # 5. 检查授权记录
    if plugin.visibility in (PluginVisibility.SHARED, PluginVisibility.PUBLIC):
        permission_record = await db.scalar(
            select(PluginPermission).where(
                and_(
                    PluginPermission.plugin_type == plugin_type,
                    PluginPermission.plugin_id == plugin_id,
                    PluginPermission.user_id == user.user_id,
                )
            )
        )
        if permission_record:
            if required_permission == "view":
                return True, None
            if required_permission == "edit" and permission_record.permission == PluginPermissionType.EDIT:
                return True, None

    return False, "Permission denied"


async def check_plugin_ownership(
    db: AsyncSession,
    plugin_type: str,
    plugin_id: UUID,
    user: AuthUser,
) -> Tuple[bool, Optional[str]]:
    """
    检查用户是否是插件的所有者。

    只有 owner 可以删除插件和管理授权。

    Args:
        db: 数据库会话
        plugin_type: 插件类型
        plugin_id: 插件 UUID
        user: 当前用户

    Returns:
        Tuple[bool, Optional[str]]: (是否是所有者, 错误消息)
    """
    # admin 可以执行所有操作
    if "admin" in user.roles:
        return True, None

    plugin = await _get_plugin_by_type_and_id(db, plugin_type, plugin_id)
    if not plugin:
        return False, "Plugin not found"

    if plugin.owner_id == user.user_id:
        return True, None

    return False, "Only the owner can perform this action"


async def get_visible_plugin_ids(
    db: AsyncSession,
    plugin_type: str,
    user: AuthUser,
) -> list[UUID]:
    """
    获取用户可见的所有插件 ID 列表。

    包括：
    1. 用户拥有的插件 (owner_id == user_id)
    2. 公开的插件 (visibility == PUBLIC)
    3. 被授权的插件 (在 plugin_permissions 中有记录)

    Args:
        db: 数据库会话
        plugin_type: 插件类型
        user: 当前用户

    Returns:
        list[UUID]: 可见的插件 ID 列表
    """
    # 根据插件类型选择模型
    model_map = {
        "mcp_server": McpServer,
        "skill": Skill,
        "sub_agent": SubAgent,
    }
    model = model_map.get(plugin_type)
    if not model:
        return []

    # admin 可以看到所有
    if "admin" in user.roles:
        result = await db.scalars(select(model.id))
        return list(result.all())

    # 复杂查询：owner_id == user_id OR visibility == PUBLIC OR 有授权记录
    # 使用 union 来组合这些条件
    owned_query = select(model.id).where(model.owner_id == user.user_id)
    public_query = select(model.id).where(model.visibility == PluginVisibility.PUBLIC)

    # 获取有授权记录的插件 ID
    shared_query = (
        select(PluginPermission.plugin_id)
        .where(
            and_(
                PluginPermission.plugin_type == plugin_type,
                PluginPermission.user_id == user.user_id,
            )
        )
        .distinct()
    )

    # 组合查询
    from sqlalchemy import union

    combined = union(owned_query, public_query, shared_query)
    result = await db.execute(combined)
    return [row[0] for row in result.fetchall()]


async def _get_plugin_by_type_and_id(
    db: AsyncSession,
    plugin_type: str,
    plugin_id: UUID,
):
    """根据类型和 ID 获取插件记录。"""
    model_map = {
        "mcp_server": McpServer,
        "skill": Skill,
        "sub_agent": SubAgent,
    }
    model = model_map.get(plugin_type)
    if not model:
        return None
    return await db.get(model, plugin_id)
