from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

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
# Vendor Config Admin Endpoints
# =============================================================================


SUPPORTED_VENDOR_CONFIG_VENDORS = {"openai", "anthropic", "gemini"}


class VendorConfigUpsert(BaseModel):
    api_key: Optional[str] = Field(default=None, description="API Key (空字符串或 null 表示保留原值)")
    api_base: Optional[str] = None


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
            configs.append({
                "vendor": vendor,
                "apiKey": None,
                "apiBase": None,
                "configured": False,
            })

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
        )

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
        )

    invalidate_cache(None)
    return {"status": "deleted", "vendor": vendor}


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


class ModelPingRequest(BaseModel):
    """Ping 请求 — 接收表单当前数据（未保存状态亦可测试）。"""

    model_type: str = Field(..., description="llm, embedding, or rerank")
    vendor: str
    model_name: str
    config: Dict[str, Any] = Field(default_factory=dict)
    api_base: Optional[str] = None
    api_key: Optional[str] = None
    model_id: Optional[UUID] = None


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


def _model_config_to_dict(mc) -> dict[str, Any]:
    cfg = dict(mc.config or {})
    if "api_key" in cfg:
        cfg["api_key"] = _mask_api_key(cfg["api_key"])
    return {
        "id": str(mc.id),
        "modelType": mc.model_type.value,
        "displayName": mc.display_name,
        "vendor": mc.vendor,
        "modelName": mc.model_name,
        "isDefault": mc.is_default,
        "enabled": mc.enabled,
        "config": cfg,
        "createdAt": mc.created_at.isoformat() if mc.created_at else None,
        "updatedAt": mc.updated_at.isoformat() if mc.updated_at else None,
    }


@router.get("/admin/models")
async def list_model_configs(current_user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    """List all model configurations, grouped by model_type."""
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")

    from negentropy.models.model_config import ModelConfig

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(ModelConfig).order_by(ModelConfig.model_type, ModelConfig.created_at))
            configs = result.scalars().all()
    except Exception:
        from negentropy.logging import get_logger
        get_logger("negentropy.auth.api").warning("list_model_configs_failed", exc_info=True)
        return {"models": {"llm": [], "embedding": [], "rerank": []}}

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

    try:
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
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Model config already exists: {payload.vendor}/{payload.model_name} ({payload.model_type})",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create model config: {exc}",
        )

    invalidate_cache(payload.model_type)
    return {"model": _model_config_to_dict(mc)}


# --- Ping endpoint (注册在 {model_id} 路由之前，避免 FastAPI 将 "ping" 匹配为路径参数) ---


@router.post("/admin/models/ping")
async def ping_model(
    payload: ModelPingRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """发送轻量级请求验证模型连通性。

    根据 model_type 使用不同的验证策略:
    - LLM: litellm.acompletion (发送 "Ping, give me a pong")
    - Embedding: litellm.aembedding (嵌入测试文本，验证向量维度)
    - Rerank: httpx POST (匹配 APIReranker 运行时路径)
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")

    import asyncio
    import time

    from negentropy.config.model_resolver import build_full_model_name

    full_model_name = build_full_model_name(payload.vendor, payload.model_name)

    # --- 解析 api_key 优先级链: 表单 > DB 模型配置 > DB 供应商配置 > 环境变量 ---
    effective_api_key = payload.api_key
    effective_api_base = payload.api_base or payload.config.get("api_base")

    if effective_api_key is None and payload.model_id:
        from negentropy.models.model_config import ModelConfig

        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(ModelConfig).where(ModelConfig.id == payload.model_id))
                stored = result.scalar_one_or_none()
                if stored and stored.config:
                    effective_api_key = stored.config.get("api_key")
                    if not effective_api_base:
                        effective_api_base = stored.config.get("api_base")
        except Exception:
            from negentropy.logging import get_logger

            get_logger("negentropy.auth.api").warning(
                "ping_db_lookup_failed", model_id=str(payload.model_id), exc_info=True,
            )

    # 回退到供应商级凭证
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
                "ping_vendor_lookup_failed", vendor=payload.vendor, exc_info=True,
            )

    start_time = time.monotonic()

    try:
        if payload.model_type == "llm":
            result = await _ping_llm(full_model_name, effective_api_key, effective_api_base)
        elif payload.model_type == "embedding":
            result = await _ping_embedding(full_model_name, effective_api_key, effective_api_base)
        elif payload.model_type == "rerank":
            result = await _ping_rerank(
                payload.model_name, effective_api_key, effective_api_base,
            )
        else:
            return {"status": "error", "message": f"不支持的模型类型: {payload.model_type}"}

        latency_ms = int((time.monotonic() - start_time) * 1000)
        result["latency_ms"] = latency_ms
        return result

    except Exception as exc:
        latency_ms = int((time.monotonic() - start_time) * 1000)
        error_msg = _sanitize_error(str(exc))
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
    model: str,
    api_key: str | None,
    api_base: str | None,
) -> dict[str, Any]:
    """LLM Ping: 发送 'Ping, give me a pong' 并验证响应。"""
    import asyncio

    import litellm

    kwargs: Dict[str, Any] = {"max_tokens": 20}
    if api_key:
        kwargs["api_key"] = api_key
    if api_base:
        kwargs["api_base"] = api_base

    response = await asyncio.wait_for(
        litellm.acompletion(
            model=model,
            messages=[{"role": "user", "content": "Ping, give me a pong"}],
            **kwargs,
        ),
        timeout=30.0,
    )
    content = response.choices[0].message.content or ""
    return {"status": "ok", "message": f"Pong! {content.strip()[:100]}"}


async def _ping_embedding(
    model: str,
    api_key: str | None,
    api_base: str | None,
) -> dict[str, Any]:
    """Embedding Ping: 嵌入测试文本并验证向量维度。"""
    import asyncio

    import litellm

    kwargs: Dict[str, Any] = {}
    if api_key:
        kwargs["api_key"] = api_key
    if api_base:
        kwargs["api_base"] = api_base

    response = await asyncio.wait_for(
        litellm.aembedding(
            model=model,
            input=["Hello, world!"],
            **kwargs,
        ),
        timeout=30.0,
    )

    # 兼容 dict 和对象属性两种返回格式
    data = getattr(response, "data", None) or response.get("data", [])
    if not data:
        return {"status": "error", "message": "Embedding 响应为空，未返回向量数据。"}

    item = data[0]
    embedding = getattr(item, "embedding", None)
    if embedding is None and isinstance(item, dict):
        embedding = item.get("embedding")
    if not embedding:
        return {"status": "error", "message": "Embedding 响应格式异常，未找到向量数据。"}

    dims = len(embedding)
    return {"status": "ok", "message": f"Pong! Embedding 连通正常，维度: {dims}"}


async def _ping_rerank(
    model_name: str,
    api_key: str | None,
    api_base: str | None,
) -> dict[str, Any]:
    """Rerank Ping: 匹配 APIReranker 运行时路径 (httpx POST)。"""
    import httpx

    base_url = api_base or "https://api.cohere.ai/v1/rerank"

    if not api_key:
        import os

        api_key = os.getenv("COHERE_API_KEY")
    if not api_key:
        return {"status": "error", "message": "缺少 API Key：请配置 Rerank 模型的 API Key。"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-Client-Name": "negentropy-ping",
    }
    payload = {
        "query": "What is artificial intelligence?",
        "documents": [
            "AI is a branch of computer science.",
            "The weather is sunny today.",
        ],
        "top_n": 2,
        "model": model_name,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(base_url, headers=headers, json=payload)
        resp.raise_for_status()
        result = resp.json()

    results = result.get("results", [])
    if not results:
        return {"status": "error", "message": "Rerank 响应为空，未返回排序结果。"}

    top_score = results[0].get("relevance_score", 0)
    return {
        "status": "ok",
        "message": f"Pong! Rerank 连通正常，Top 相关性分数: {top_score:.4f}",
    }


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

    try:
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
            # 服务端防御: 保护 DB 中的 api_key 不被脱敏值覆盖
            if "config" in update_data and mc.config:
                new_config = update_data["config"]
                incoming_key = new_config.get("api_key")
                if incoming_key is not None and incoming_key.startswith("****"):
                    # 客户端回传了脱敏值，保留 DB 中的原始值
                    new_config["api_key"] = mc.config.get("api_key")
                elif "api_key" not in new_config and "api_key" in (mc.config or {}):
                    new_config["api_key"] = mc.config["api_key"]
            for key, value in update_data.items():
                setattr(mc, key, value)

            model_type_val = mc.model_type.value
            await db.commit()
            await db.refresh(mc)
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Update conflicts with existing model config (duplicate vendor/model_name/model_type)",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update model config: {exc}",
        )

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

    try:
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
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete model config: {exc}",
        )

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

    try:
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
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set default model: {exc}",
        )

    invalidate_cache(mc.model_type.value)
    return {"model": _model_config_to_dict(mc)}
