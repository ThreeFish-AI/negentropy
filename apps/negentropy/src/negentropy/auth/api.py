from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select

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
