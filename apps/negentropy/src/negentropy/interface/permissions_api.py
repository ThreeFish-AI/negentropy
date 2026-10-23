"""
Interface Permissions API — /interface/{plugin_type}/{plugin_id}/permissions 授权管理。

通配路由，必须最后注册（聚合器中置于末位）。

由 api.py 按域机械拆分而来（2026-09 熵减）；行为与路由序保持不变，
契约由 tests/unit_tests/interface/test_route_table_contract.py 锁定。
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, select

from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.plugin import (
    PluginPermission,
    PluginPermissionType,
)

from .permissions import check_plugin_ownership

# logger 名沿用拆分前的 "negentropy.interface.api"：日志消费方按名过滤，改名另行评审
logger = get_logger("negentropy.interface.api")
router = APIRouter(prefix="/interface", tags=["interface"])


class PermissionGrantRequest(BaseModel):
    """授权请求"""

    user_id: str
    permission: str  # "view" or "edit"


class PermissionResponse(BaseModel):
    """授权记录响应"""

    id: UUID
    user_id: str
    permission: str

    class Config:
        from_attributes = True


# =============================================================================
# Permission Management Endpoints
# =============================================================================


@router.get("/{plugin_type}/{plugin_id}/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    plugin_type: str,
    plugin_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> list[PermissionResponse]:
    """获取插件的授权列表（仅 owner 可查看）"""
    if plugin_type not in ["mcp_server", "skill", "agent"]:
        raise HTTPException(status_code=400, detail="Invalid plugin type")

    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, plugin_type, plugin_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        result = await db.execute(
            select(PluginPermission).where(
                and_(
                    PluginPermission.plugin_type == plugin_type,
                    PluginPermission.plugin_id == plugin_id,
                )
            )
        )
        permissions = result.scalars().all()

    return [PermissionResponse(id=p.id, user_id=p.user_id, permission=p.permission.value) for p in permissions]


@router.post(
    "/{plugin_type}/{plugin_id}/permissions", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED
)
async def grant_permission(
    plugin_type: str,
    plugin_id: UUID,
    payload: PermissionGrantRequest,
    user: AuthUser = Depends(get_current_user),
) -> PermissionResponse:
    """授权给指定用户（仅 owner 可操作）"""
    if plugin_type not in ["mcp_server", "skill", "agent"]:
        raise HTTPException(status_code=400, detail="Invalid plugin type")

    if payload.permission not in ["view", "edit"]:
        raise HTTPException(status_code=400, detail="Invalid permission type")

    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, plugin_type, plugin_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        # Check if permission already exists
        existing = await db.scalar(
            select(PluginPermission).where(
                and_(
                    PluginPermission.plugin_type == plugin_type,
                    PluginPermission.plugin_id == plugin_id,
                    PluginPermission.user_id == payload.user_id,
                )
            )
        )
        if existing:
            # Update existing permission
            existing.permission = PluginPermissionType(payload.permission)
            await db.commit()
            await db.refresh(existing)
            return PermissionResponse(id=existing.id, user_id=existing.user_id, permission=existing.permission.value)

        # Create new permission
        permission = PluginPermission(
            plugin_type=plugin_type,
            plugin_id=plugin_id,
            user_id=payload.user_id,
            permission=PluginPermissionType(payload.permission),
        )
        db.add(permission)
        await db.commit()
        await db.refresh(permission)

    return PermissionResponse(id=permission.id, user_id=permission.user_id, permission=permission.permission.value)


@router.delete("/{plugin_type}/{plugin_id}/permissions/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_permission(
    plugin_type: str,
    plugin_id: UUID,
    user_id: str,
    user: AuthUser = Depends(get_current_user),
) -> None:
    """撤销用户授权（仅 owner 可操作）"""
    if plugin_type not in ["mcp_server", "skill", "agent"]:
        raise HTTPException(status_code=400, detail="Invalid plugin type")

    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, plugin_type, plugin_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        permission = await db.scalar(
            select(PluginPermission).where(
                and_(
                    PluginPermission.plugin_type == plugin_type,
                    PluginPermission.plugin_id == plugin_id,
                    PluginPermission.user_id == user_id,
                )
            )
        )
        if permission:
            await db.delete(permission)
            await db.commit()
