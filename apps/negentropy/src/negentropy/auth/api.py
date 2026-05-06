from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select

from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.models.pulse import UserState

from .deps import (
    get_current_user,
    get_optional_user,
    require_admin,
    resolve_user_with_db_roles,
)
from .service import AuthService, AuthUser

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthUserResponse(BaseModel):
    user_id: str = Field(..., alias="userId")
    email: str | None = Field(default=None)
    name: str | None = Field(default=None)
    picture: str | None = Field(default=None)
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
async def google_login(redirect: str | None = Query(default=None)) -> RedirectResponse:
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
    """返回当前用户身份；roles 以 DB ``user_states`` 为权威覆盖 JWT 中的快照。

    与 admin 端点共享 ``resolve_user_with_db_roles``，避免“前端通过 /me 看到 admin、
    后端 admin 端点用 JWT 旧 roles 仍 403”的视图割裂（ISSUE-049）。
    """
    resolved_user = await resolve_user_with_db_roles(user)
    return AuthMeResponse(
        user=_to_user_response(resolved_user),
        permissions={"is_admin": "admin" in resolved_user.roles},
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
    current_user: AuthUser = Depends(require_admin),
) -> AuthMeResponse:
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
async def get_user(user_id: str, current_user: AuthUser = Depends(require_admin)) -> dict[str, Any]:
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
async def status_check(user: AuthUser | None = Depends(get_optional_user)) -> dict[str, Any]:
    return {
        "enabled": settings.auth.enabled,
        "mode": settings.auth.mode,
        "authenticated": user is not None,
    }


# =============================================================================
# Admin API Endpoints
# =============================================================================


@router.get("/admin/users")
async def list_users(current_user: AuthUser = Depends(require_admin)) -> dict[str, Any]:
    """List all users. Requires admin role (resolved from DB user_states)."""
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
