"""
Plugins 权限检查模块。

提供插件访问权限的检查和管理功能。
"""

from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.auth.service import AuthUser
from negentropy.models.plugin import (
    BuiltinTool,
    McpServer,
    PluginPermission,
    PluginPermissionType,
    PluginVisibility,
    Skill,
    SubAgent,
)

# 「系统内置」单一事实源：5 类 plugin 表统一通过显式 ``is_system`` 列识别。
# 历史种子（mcp_servers seed=0002、builtin_tools seed=0031）的 ``owner_id``
# 使用 ``"system"`` / ``"system:..."`` 前缀仅作来源溯源，权限判断不再依赖该字符
# 串约定 —— 字符串前缀缺索引、缺 NOT NULL 约束、易被 SSO ``sub`` 等业务字段误中。
PLUGIN_TYPE_MODEL_MAP = {
    "mcp_server": McpServer,
    "skill": Skill,
    "sub_agent": SubAgent,
    "builtin_tool": BuiltinTool,
}


def _is_plugin_builtin(plugin) -> bool:
    """统一识别「系统内置」插件。

    优先读取显式 ``is_system`` 列（与 BuiltinTool / 迁移 0033 对齐）；
    若该插件类型尚未引入该列（向后兼容期），回退到 ``owner_id`` 前缀 ``"system"``。
    """
    is_system = getattr(plugin, "is_system", None)
    if is_system is not None:
        return bool(is_system)
    owner_id = getattr(plugin, "owner_id", None) or ""
    return owner_id.startswith("system")


async def check_plugin_access(
    db: AsyncSession,
    plugin_type: str,
    plugin_id: UUID,
    user: AuthUser,
    required_permission: str,  # "view" or "edit"
) -> tuple[bool, str | None]:
    """
    检查用户是否有权限访问指定插件。

    Args:
        db: 数据库会话
        plugin_type: 插件类型 ("mcp_server", "skill", "sub_agent", "builtin_tool")
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

    # 4. 系统内置：所有用户 view 均通过；edit 仅 admin（已在步骤 1 命中）。
    #    与「系统内置全员可见、不可被普通用户改写」语义对齐。
    if _is_plugin_builtin(plugin):
        if required_permission == "view":
            return True, None
        return False, "System built-in plugin cannot be edited by non-admin users"

    # 5. 检查 visibility
    if plugin.visibility == PluginVisibility.PUBLIC and required_permission == "view":
        return True, None

    # 6. 检查授权记录
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
) -> tuple[bool, str | None]:
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

    # 系统内置插件：仅 admin 可视作 owner（避免误删 / 误授权 seed 行）。
    if _is_plugin_builtin(plugin):
        return False, "System built-in plugin can only be managed by admin users"

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
    # 根据插件类型选择模型（含 builtin_tool —— 修复 ISSUE: stats.tools 永远 0/0
    # 与 list_builtin_tools 永远空的 bug，原 model_map 漏掉了 builtin_tool 键。）
    model = PLUGIN_TYPE_MODEL_MAP.get(plugin_type)
    if not model:
        return []

    # admin 可以看到所有
    if "admin" in user.roles:
        result = await db.scalars(select(model.id))
        return list(result.all())

    # 普通用户可见的并集：
    #   1. owner_id == user_id（自有）
    #   2. visibility == PUBLIC（公开分享）
    #   3. 在 PluginPermission 中有授权记录（私享）
    #   4. is_system == TRUE（系统内置 —— 对全员可见，与 BuiltinTool 模式对齐）
    owned_query = select(model.id).where(model.owner_id == user.user_id)
    public_query = select(model.id).where(model.visibility == PluginVisibility.PUBLIC)

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

    queries = [owned_query, public_query, shared_query]

    # 仅当该模型显式带 ``is_system`` 列时启用系统内置可见性扩展，避免对未迁移
    # 表执行 SELECT 时产生 UndefinedColumn 错误（向后兼容旧 schema）。
    if hasattr(model, "is_system"):
        builtin_query = select(model.id).where(model.is_system.is_(True))
        queries.append(builtin_query)

    from sqlalchemy import union

    combined = union(*queries)
    result = await db.execute(combined)
    return [row[0] for row in result.fetchall()]


async def _get_plugin_by_type_and_id(
    db: AsyncSession,
    plugin_type: str,
    plugin_id: UUID,
):
    """根据类型和 ID 获取插件记录。"""
    model = PLUGIN_TYPE_MODEL_MAP.get(plugin_type)
    if not model:
        return None
    return await db.get(model, plugin_id)
