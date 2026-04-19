from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse, RedirectResponse
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
# Vendor Config Admin Endpoints
# =============================================================================


SUPPORTED_VENDOR_CONFIG_VENDORS = {"openai", "anthropic", "gemini"}


class VendorConfigUpsert(BaseModel):
    api_key: str | None = Field(default=None, description="API Key (空字符串或 null 表示保留原值)")
    api_base: str | None = None


def _vendor_config_to_dict(vc) -> dict[str, Any]:
    return {
        "vendor": vc.vendor,
        "apiKey": _mask_api_key(vc.api_key),
        "apiBase": vc.api_base,
        "configured": True,
    }


@router.get("/admin/vendor-configs")
async def list_vendor_configs(current_user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    """列出所有支持的供应商配置（始终返回 3 个供应商，未配置的填充 null）。"""
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")

    from negentropy.models.vendor_config import VendorConfig

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(VendorConfig))
            stored = result.scalars().all()
    except Exception:
        from negentropy.logging import get_logger

        get_logger("negentropy.auth.api").warning("list_vendor_configs_failed", exc_info=True)
        stored = []

    stored_map = {vc.vendor: vc for vc in stored}
    configs = []
    for vendor in sorted(SUPPORTED_VENDOR_CONFIG_VENDORS):
        vc = stored_map.get(vendor)
        if vc:
            configs.append(_vendor_config_to_dict(vc))
        else:
            configs.append(
                {
                    "vendor": vendor,
                    "apiKey": None,
                    "apiBase": None,
                    "configured": False,
                }
            )

    return {"vendorConfigs": configs}


@router.put("/admin/vendor-configs/{vendor}")
async def upsert_vendor_config(
    vendor: str,
    payload: VendorConfigUpsert,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """创建或更新供应商配置（Upsert 语义）。"""
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")
    if vendor not in SUPPORTED_VENDOR_CONFIG_VENDORS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported vendor: {vendor}. Supported: {', '.join(sorted(SUPPORTED_VENDOR_CONFIG_VENDORS))}",
        )

    from negentropy.config.model_resolver import invalidate_cache
    from negentropy.models.vendor_config import VendorConfig

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(VendorConfig).where(VendorConfig.vendor == vendor))
            vc = result.scalar_one_or_none()

            if vc is None:
                # 创建新配置：api_key 必须提供
                if not payload.api_key or not payload.api_key.strip():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="API Key is required for new vendor configuration",
                    )
                vc = VendorConfig(vendor=vendor, api_key=payload.api_key, api_base=payload.api_base)
                db.add(vc)
            else:
                # 更新：空 key 表示保留原值；脱敏值也保留原值
                if not payload.api_key or payload.api_key.startswith("****"):
                    payload.api_key = vc.api_key
                vc.api_key = payload.api_key
                vc.api_base = payload.api_base

            await db.commit()
            await db.refresh(vc)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_sanitize_error(f"Failed to upsert vendor config: {exc}"),
        ) from exc

    # 供应商凭证变更影响所有模型类型，清除全部缓存
    invalidate_cache(None)
    return {"vendorConfig": _vendor_config_to_dict(vc)}


@router.delete("/admin/vendor-configs/{vendor}")
async def delete_vendor_config(
    vendor: str,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """删除供应商配置。"""
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")
    if vendor not in SUPPORTED_VENDOR_CONFIG_VENDORS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported vendor: {vendor}. Supported: {', '.join(sorted(SUPPORTED_VENDOR_CONFIG_VENDORS))}",
        )

    from negentropy.config.model_resolver import invalidate_cache
    from negentropy.models.vendor_config import VendorConfig

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(VendorConfig).where(VendorConfig.vendor == vendor))
            vc = result.scalar_one_or_none()
            if not vc:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vendor config not found")
            await db.delete(vc)
            await db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_sanitize_error(f"Failed to delete vendor config: {exc}"),
        ) from exc

    invalidate_cache(None)
    return {"status": "deleted", "vendor": vendor}


# =============================================================================
# Model Ping Endpoint
# =============================================================================


class ModelPingRequest(BaseModel):
    """Ping 请求 — 验证供应商凭证 + 模型连通性。"""

    vendor: str
    model_name: str
    config: dict[str, Any] = Field(default_factory=dict)
    api_base: str | None = None
    api_key: str | None = None


def _mask_api_key(key: str | None) -> str | None:
    """将 api_key 脱敏为 ****xxxx 格式，仅保留末 4 位。"""
    if not key:
        return None
    if len(key) <= 4:
        return "****"
    return "****" + key[-4:]


def _sanitize_error(msg: str, max_len: int = 300) -> str:
    """从错误信息中移除可能的 API Key / Token，防止泄露。"""
    import re

    sanitized = re.sub(r"(sk-|key-|Bearer\s+)\S+", r"\1****", msg)
    return sanitized[:max_len]


@router.post("/admin/models/ping")
async def ping_model(
    payload: ModelPingRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """发送 'Ping, give me a pong' 验证 LLM 模型连通性。

    凭证回退链: 表单 > vendor_configs (DB) > LiteLLM 环境变量。

    kwargs 构造复用业务主链路的 `build_ping_llm_kwargs`（含 drop_params=True
    与 vendor 专属适配），确保 Ping 与生产路径的参数语义一致。
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")

    import asyncio
    import time

    effective_api_key = payload.api_key
    effective_api_base = payload.api_base or payload.config.get("api_base")

    if effective_api_key is None:
        from negentropy.models.vendor_config import VendorConfig

        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(VendorConfig).where(VendorConfig.vendor == payload.vendor))
                vc = result.scalar_one_or_none()
                if vc:
                    effective_api_key = vc.api_key
                    if not effective_api_base:
                        effective_api_base = vc.api_base
        except Exception:
            from negentropy.logging import get_logger

            get_logger("negentropy.auth.api").warning(
                "ping_vendor_lookup_failed",
                vendor=payload.vendor,
                exc_info=True,
            )

    start_time = time.monotonic()

    try:
        result = await _ping_llm(
            vendor=payload.vendor,
            model_name=payload.model_name,
            api_key=effective_api_key,
            api_base=effective_api_base,
        )
        latency_ms = int((time.monotonic() - start_time) * 1000)
        result["latency_ms"] = latency_ms
        return result

    except Exception as exc:
        latency_ms = int((time.monotonic() - start_time) * 1000)
        error_msg = _sanitize_error(str(exc))

        from negentropy.config.model_resolver import build_full_model_name, normalize_api_base
        from negentropy.logging import get_logger

        get_logger("negentropy.auth.api").warning(
            "ping_llm_failed",
            vendor=payload.vendor,
            model=build_full_model_name(payload.vendor, payload.model_name),
            api_base=normalize_api_base(effective_api_base),
            latency_ms=latency_ms,
            error=error_msg,
        )

        if "AuthenticationError" in error_msg or "401" in error_msg:
            message = f"认证失败：API Key 无效或已过期。\n{error_msg}"
        elif "404" in error_msg or "NotFoundError" in error_msg:
            message = f"模型未找到：请检查 vendor/model_name 是否正确。\n{error_msg}"
        elif "timeout" in error_msg.lower() or isinstance(exc, asyncio.TimeoutError):
            message = "连接超时 (30s)，请检查网络或 API Base URL 配置。"
        else:
            message = f"Ping 失败：{error_msg}"
        return {"status": "error", "message": message, "latency_ms": latency_ms}


async def _ping_llm(
    *,
    vendor: str,
    model_name: str,
    api_key: str | None,
    api_base: str | None,
) -> dict[str, Any]:
    """LLM Ping: 发送 'Ping, give me a pong' 并验证响应。

    复用 `build_ping_llm_kwargs` 构造 kwargs（含 drop_params 与 vendor 适配），
    与业务主链路保持单一事实源。
    """
    import asyncio

    import litellm

    from negentropy.config.model_resolver import build_full_model_name, build_ping_llm_kwargs

    full_model_name = build_full_model_name(vendor, model_name)
    kwargs = build_ping_llm_kwargs(
        vendor,
        model_name,
        api_key_override=api_key,
        api_base_override=api_base,
    )

    response = await asyncio.wait_for(
        litellm.acompletion(
            model=full_model_name,
            messages=[{"role": "user", "content": "Ping, give me a pong"}],
            **kwargs,
        ),
        timeout=30.0,
    )
    content = response.choices[0].message.content or ""
    return {"status": "ok", "message": f"Pong! {content.strip()[:100]}"}
