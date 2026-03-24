from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, update

from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.models.pulse import UserState

from .deps import get_current_user, get_optional_user
from .service import AuthService, AuthUser

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthUserResponse(BaseModel):
    user_id: str = Field(..., alias="userId")
    email: Optional[str] = Field(default=None)
    name: Optional[str] = Field(default=None)
    picture: Optional[str] = Field(default=None)
    roles: list[str] = Field(default_factory=list)
    provider: str = Field(default="google")


class AuthMeResponse(BaseModel):
    user: AuthUserResponse
    permissions: dict[str, Any] = Field(default_factory=dict)


class RoleUpdateRequest(BaseModel):
    roles: list[str] = Field(default_factory=list)


def _to_user_response(user: AuthUser) -> AuthUserResponse:
    return AuthUserResponse(
        userId=user.user_id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        roles=user.roles,
        provider=user.provider,
    )


@router.get("/google/login")
async def google_login(redirect: Optional[str] = Query(default=None)) -> RedirectResponse:
    service = AuthService()
    login_url = service.build_login_url(redirect=redirect)
    return RedirectResponse(login_url)


@router.get("/google/callback")
async def google_callback(code: str, state: str):
    service = AuthService()
    try:
        result = await service.handle_callback(code=code, state=state)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    response = RedirectResponse(result.redirect)
    response.set_cookie(
        settings.auth.cookie_name,
        result.token,
        httponly=True,
        secure=settings.auth.cookie_secure,
        samesite=settings.auth.cookie_same_site,
        domain=settings.auth.cookie_domain,
        max_age=settings.auth.session_ttl_seconds,
        path="/",
    )
    return response


@router.get("/me", response_model=AuthMeResponse)
async def me(user: AuthUser = Depends(get_current_user)) -> AuthMeResponse:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UserState).where(
                UserState.user_id == user.user_id,
                UserState.app_name == settings.app_name,
            )
        )
        user_state = result.scalar_one_or_none()

    roles = user.roles
    if user_state and isinstance(user_state.state, dict):
        state_roles = user_state.state.get("roles")
        if isinstance(state_roles, list):
            roles = [str(role) for role in state_roles]

    resolved_user = AuthUser(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        roles=roles,
        provider=user.provider,
        subject=user.subject,
        domain=user.domain,
    )

    return AuthMeResponse(
        user=_to_user_response(resolved_user),
        permissions={"is_admin": "admin" in roles},
    )


@router.post("/logout")
async def logout() -> JSONResponse:
    response = JSONResponse({"status": "ok"})
    response.delete_cookie(settings.auth.cookie_name, path="/", domain=settings.auth.cookie_domain)
    return response


@router.patch("/users/{user_id}/roles", response_model=AuthMeResponse)
async def update_roles(
    user_id: str,
    payload: RoleUpdateRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> AuthMeResponse:
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UserState).where(
                UserState.user_id == user_id,
                UserState.app_name == settings.app_name,
            )
        )
        user_state = result.scalar_one_or_none()
        if not user_state:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")

        next_state = {**(user_state.state or {}), "roles": payload.roles}
        user_state.state = next_state
        await db.commit()

    updated = AuthUser(
        user_id=user_id,
        email=None,
        name=None,
        picture=None,
        roles=payload.roles,
        provider="google",
        subject=user_id,
        domain=None,
    )
    return AuthMeResponse(user=_to_user_response(updated), permissions={"is_admin": "admin" in payload.roles})


@router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UserState).where(
                UserState.user_id == user_id,
                UserState.app_name == settings.app_name,
            )
        )
        user_state = result.scalar_one_or_none()
        if not user_state:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")

    return {"user_id": user_state.user_id, "state": user_state.state or {}}


@router.get("/status")
async def status_check(user: Optional[AuthUser] = Depends(get_optional_user)) -> dict[str, Any]:
    return {
        "enabled": settings.auth.enabled,
        "mode": settings.auth.mode,
        "authenticated": user is not None,
    }


# =============================================================================
# Admin API Endpoints
# =============================================================================


@router.get("/admin/users")
async def list_users(current_user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    """List all users. Requires admin role."""
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(UserState).where(UserState.app_name == settings.app_name))
        user_states = result.scalars().all()

    users = []
    for us in user_states:
        state = us.state or {}
        profile = state.get("profile", {})
        auth_info = state.get("auth", {})
        users.append(
            {
                "userId": us.user_id,
                "email": profile.get("email"),
                "name": profile.get("name"),
                "picture": profile.get("picture"),
                "roles": state.get("roles", ["user"]),
                "lastLoginAt": auth_info.get("last_login_at"),
            }
        )

    return {"users": users}


@router.get("/admin/roles")
async def list_roles() -> dict[str, Any]:
    """List all available roles and their permissions."""
    from .rbac import get_all_roles

    return {"roles": get_all_roles()}


@router.get("/admin/permissions")
async def list_permissions() -> dict[str, Any]:
    """List all available permissions."""
    from .rbac import get_all_permissions

    return {"permissions": get_all_permissions()}


# =============================================================================
# Model Config Admin Endpoints
# =============================================================================


class ModelConfigCreate(BaseModel):
    model_type: str = Field(..., description="llm, embedding, or rerank")
    display_name: str
    vendor: str
    model_name: str
    is_default: bool = False
    enabled: bool = True
    config: Dict[str, Any] = Field(default_factory=dict)


class ModelConfigUpdate(BaseModel):
    display_name: Optional[str] = None
    vendor: Optional[str] = None
    model_name: Optional[str] = None
    is_default: Optional[bool] = None
    enabled: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None


def _model_config_to_dict(mc) -> dict[str, Any]:
    return {
        "id": str(mc.id),
        "modelType": mc.model_type.value,
        "displayName": mc.display_name,
        "vendor": mc.vendor,
        "modelName": mc.model_name,
        "isDefault": mc.is_default,
        "enabled": mc.enabled,
        "config": mc.config or {},
        "createdAt": mc.created_at.isoformat() if mc.created_at else None,
        "updatedAt": mc.updated_at.isoformat() if mc.updated_at else None,
    }


@router.get("/admin/models")
async def list_model_configs(current_user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    """List all model configurations, grouped by model_type."""
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")

    from negentropy.models.model_config import ModelConfig

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ModelConfig).order_by(ModelConfig.model_type, ModelConfig.created_at))
        configs = result.scalars().all()

    grouped: dict[str, list] = {"llm": [], "embedding": [], "rerank": []}
    for mc in configs:
        key = mc.model_type.value
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(_model_config_to_dict(mc))

    return {"models": grouped}


@router.post("/admin/models", status_code=status.HTTP_201_CREATED)
async def create_model_config(
    payload: ModelConfigCreate,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a new model configuration."""
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")

    from negentropy.config.model_resolver import invalidate_cache
    from negentropy.models.model_config import ModelConfig, ModelType

    try:
        mt = ModelType(payload.model_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid model_type: {payload.model_type}. Must be one of: llm, embedding, rerank",
        )

    async with AsyncSessionLocal() as db:
        # 如果 is_default=True，先取消同类型的其他默认
        if payload.is_default:
            await db.execute(
                update(ModelConfig)
                .where(ModelConfig.model_type == mt, ModelConfig.is_default.is_(True))
                .values(is_default=False)
            )

        mc = ModelConfig(
            model_type=mt,
            display_name=payload.display_name,
            vendor=payload.vendor,
            model_name=payload.model_name,
            is_default=payload.is_default,
            enabled=payload.enabled,
            config=payload.config,
        )
        db.add(mc)
        await db.commit()
        await db.refresh(mc)

    invalidate_cache(payload.model_type)
    return {"model": _model_config_to_dict(mc)}


@router.patch("/admin/models/{model_id}")
async def update_model_config(
    model_id: UUID,
    payload: ModelConfigUpdate,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Update a model configuration."""
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")

    from negentropy.config.model_resolver import invalidate_cache
    from negentropy.models.model_config import ModelConfig

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ModelConfig).where(ModelConfig.id == model_id))
        mc = result.scalar_one_or_none()
        if not mc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="model config not found")

        # 如果设为默认，先取消同类型的其他默认
        if payload.is_default is True and not mc.is_default:
            await db.execute(
                update(ModelConfig)
                .where(ModelConfig.model_type == mc.model_type, ModelConfig.is_default.is_(True))
                .values(is_default=False)
            )

        update_data = payload.model_dump(exclude_none=True)
        for key, value in update_data.items():
            setattr(mc, key, value)

        model_type_val = mc.model_type.value
        await db.commit()
        await db.refresh(mc)

    invalidate_cache(model_type_val)
    return {"model": _model_config_to_dict(mc)}


@router.delete("/admin/models/{model_id}")
async def delete_model_config(
    model_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete a model configuration. Cannot delete the sole default of a type."""
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")

    from negentropy.config.model_resolver import invalidate_cache
    from negentropy.models.model_config import ModelConfig

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ModelConfig).where(ModelConfig.id == model_id))
        mc = result.scalar_one_or_none()
        if not mc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="model config not found")

        if mc.is_default:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the default model. Set another model as default first.",
            )

        model_type_val = mc.model_type.value
        await db.delete(mc)
        await db.commit()

    invalidate_cache(model_type_val)
    return {"status": "deleted"}


@router.post("/admin/models/{model_id}/set-default")
async def set_default_model(
    model_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Set a model configuration as the default for its type."""
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")

    from negentropy.config.model_resolver import invalidate_cache
    from negentropy.models.model_config import ModelConfig

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ModelConfig).where(ModelConfig.id == model_id))
        mc = result.scalar_one_or_none()
        if not mc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="model config not found")

        if not mc.enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot set a disabled model as default.",
            )

        # 事务: 取消同类型旧默认，设置新默认
        await db.execute(
            update(ModelConfig)
            .where(ModelConfig.model_type == mc.model_type, ModelConfig.is_default.is_(True))
            .values(is_default=False)
        )
        mc.is_default = True
        await db.commit()
        await db.refresh(mc)

    invalidate_cache(mc.model_type.value)
    return {"model": _model_config_to_dict(mc)}
