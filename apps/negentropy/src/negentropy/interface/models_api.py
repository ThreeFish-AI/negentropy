"""
Interface / Models API 模块。

提供 Vendor 凭证与 ModelConfig 的管理端点，以及 Ping 连通性测试。
路由前缀统一为 `/interface/models/*`；所有端点仍保留 `admin` 角色校验，以保障
API Key 与模型启停面板的最小权限原则。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger

logger = get_logger("negentropy.interface.models_api")
router = APIRouter(prefix="/interface/models", tags=["interface-models"])


SUPPORTED_VENDOR_CONFIG_VENDORS = {"openai", "anthropic", "gemini"}


# =============================================================================
# Shared Utilities
# =============================================================================


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


def _vendor_config_to_dict(vc) -> dict[str, Any]:
    return {
        "vendor": vc.vendor,
        "apiKey": _mask_api_key(vc.api_key),
        "apiBase": vc.api_base,
        "configured": True,
    }


def _model_config_to_dict(mc) -> dict[str, Any]:
    return {
        "id": str(mc.id),
        "model_type": mc.model_type.value if hasattr(mc.model_type, "value") else str(mc.model_type),
        "display_name": mc.display_name,
        "vendor": mc.vendor,
        "model_name": mc.model_name,
        "is_default": mc.is_default,
        "enabled": mc.enabled,
        "config": dict(mc.config or {}),
        "created_at": mc.created_at.isoformat() if getattr(mc, "created_at", None) else None,
        "updated_at": mc.updated_at.isoformat() if getattr(mc, "updated_at", None) else None,
    }


def _validate_model_type(value: str):
    from negentropy.models.model_config import ModelType

    try:
        return ModelType(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported model_type: {value}. Allowed: llm / embedding / rerank",
        ) from exc


def _require_admin(user: AuthUser) -> None:
    if "admin" not in user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")


# =============================================================================
# Vendor Config Endpoints
# =============================================================================


class VendorConfigUpsert(BaseModel):
    api_key: str | None = Field(default=None, description="API Key (空字符串或 null 表示保留原值)")
    api_base: str | None = None


@router.get("/vendor-configs")
async def list_vendor_configs(current_user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    """列出所有支持的供应商配置（始终返回 3 个供应商，未配置的填充 null）。"""
    _require_admin(current_user)

    from negentropy.models.vendor_config import VendorConfig

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(VendorConfig))
            stored = result.scalars().all()
    except Exception:
        logger.warning("list_vendor_configs_failed", exc_info=True)
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


@router.put("/vendor-configs/{vendor}")
async def upsert_vendor_config(
    vendor: str,
    payload: VendorConfigUpsert,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """创建或更新供应商配置（Upsert 语义）。"""
    _require_admin(current_user)
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
                if not payload.api_key or not payload.api_key.strip():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="API Key is required for new vendor configuration",
                    )
                vc = VendorConfig(vendor=vendor, api_key=payload.api_key, api_base=payload.api_base)
                db.add(vc)
            else:
                if not payload.api_key or payload.api_key.startswith("****"):
                    payload.api_key = vc.api_key
                vc.api_key = payload.api_key
                vc.api_base = payload.api_base

            await db.commit()
            await db.refresh(vc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_sanitize_error(f"Failed to upsert vendor config: {exc}"),
        ) from exc

    invalidate_cache(None)
    return {"vendorConfig": _vendor_config_to_dict(vc)}


@router.delete("/vendor-configs/{vendor}")
async def delete_vendor_config(
    vendor: str,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """删除供应商配置。"""
    _require_admin(current_user)
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
# Model Config Endpoints
# =============================================================================


class ModelConfigCreateRequest(BaseModel):
    model_type: str = Field(..., description="模型类型: llm / embedding / rerank")
    display_name: str = Field(..., min_length=1, max_length=255)
    vendor: str = Field(..., min_length=1, max_length=50)
    model_name: str = Field(..., min_length=1, max_length=255)
    is_default: bool = False
    enabled: bool = True
    config: dict[str, Any] = Field(default_factory=dict)


class ModelConfigUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    is_default: bool | None = None
    enabled: bool | None = None
    config: dict[str, Any] | None = None


@router.get("/configs")
async def list_model_configs(
    model_type: str | None = Query(default=None),
    vendor: str | None = Query(default=None),
    enabled: bool | None = Query(default=None),
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """列出 model_configs 表条目。"""
    _require_admin(current_user)

    from negentropy.models.model_config import ModelConfig, ModelType

    stmt = select(ModelConfig)
    if model_type:
        stmt = stmt.where(ModelConfig.model_type == _validate_model_type(model_type))
    if vendor:
        stmt = stmt.where(ModelConfig.vendor == vendor)
    if enabled is not None:
        stmt = stmt.where(ModelConfig.enabled == enabled)
    stmt = stmt.order_by(
        ModelConfig.model_type,
        ModelConfig.is_default.desc(),
        ModelConfig.display_name.asc(),
    )

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(stmt)
            rows = result.scalars().all()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_sanitize_error(f"Failed to list model_configs: {exc}"),
        ) from exc

    items = [_model_config_to_dict(mc) for mc in rows]
    _ = ModelType
    return {"items": items, "count": len(items)}


@router.post("/configs", status_code=status.HTTP_201_CREATED)
async def create_model_config(
    payload: ModelConfigCreateRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """新建 model_configs 条目。"""
    _require_admin(current_user)

    from sqlalchemy import update as sa_update
    from sqlalchemy.exc import IntegrityError

    from negentropy.config.model_resolver import invalidate_cache
    from negentropy.models.model_config import ModelConfig

    mt = _validate_model_type(payload.model_type)

    try:
        async with AsyncSessionLocal() as db:
            if payload.is_default:
                await db.execute(
                    sa_update(ModelConfig)
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
                config=payload.config or {},
            )
            db.add(mc)
            try:
                await db.commit()
            except IntegrityError as exc:
                await db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"model_config conflict: (vendor={payload.vendor}, "
                        f"model_name={payload.model_name}, model_type={payload.model_type}) 已存在"
                    ),
                ) from exc
            await db.refresh(mc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_sanitize_error(f"Failed to create model_config: {exc}"),
        ) from exc

    invalidate_cache(None)
    return {"model_config": _model_config_to_dict(mc)}


@router.patch("/configs/{config_id}")
async def update_model_config(
    config_id: str,
    payload: ModelConfigUpdateRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """更新 model_configs 条目。仅允许更新 display_name / is_default / enabled / config 字段。"""
    _require_admin(current_user)

    from uuid import UUID as _UUID

    from sqlalchemy import update as sa_update

    from negentropy.config.model_resolver import invalidate_cache
    from negentropy.models.model_config import ModelConfig

    try:
        mc_id = _UUID(config_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid config_id") from exc

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(ModelConfig).where(ModelConfig.id == mc_id))
            mc = result.scalar_one_or_none()
            if not mc:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="model_config not found")

            if payload.is_default is True and not mc.is_default:
                await db.execute(
                    sa_update(ModelConfig)
                    .where(
                        ModelConfig.model_type == mc.model_type,
                        ModelConfig.is_default.is_(True),
                        ModelConfig.id != mc.id,
                    )
                    .values(is_default=False)
                )

            if payload.display_name is not None:
                mc.display_name = payload.display_name
            if payload.is_default is not None:
                mc.is_default = payload.is_default
            if payload.enabled is not None:
                mc.enabled = payload.enabled
            if payload.config is not None:
                mc.config = payload.config

            await db.commit()
            await db.refresh(mc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_sanitize_error(f"Failed to update model_config: {exc}"),
        ) from exc

    invalidate_cache(None)
    return {"model_config": _model_config_to_dict(mc)}


@router.delete("/configs/{config_id}")
async def delete_model_config(
    config_id: str,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """删除 model_configs 条目。

    若有 Corpus 仍在引用（`corpus.config->'models'` 的 llm_config_id / embedding_config_id），
    返回 HTTP 409 + 引用计数。
    """
    _require_admin(current_user)

    from uuid import UUID as _UUID

    from sqlalchemy import text as sa_text

    from negentropy.config.model_resolver import invalidate_cache
    from negentropy.models.model_config import ModelConfig

    try:
        mc_id = _UUID(config_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid config_id") from exc

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(ModelConfig).where(ModelConfig.id == mc_id))
            mc = result.scalar_one_or_none()
            if not mc:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="model_config not found")

            ref_stmt = sa_text(
                """
                SELECT COUNT(*) FROM negentropy.corpus
                WHERE (config -> 'models' ->> 'llm_config_id') = :cid
                   OR (config -> 'models' ->> 'embedding_config_id') = :cid
                """
            )
            ref_count = (await db.execute(ref_stmt, {"cid": str(mc_id)})).scalar_one()
            if ref_count and ref_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "message": "model_config 仍被 Corpus 引用，无法删除",
                        "reference_count": int(ref_count),
                    },
                )

            await db.delete(mc)
            await db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_sanitize_error(f"Failed to delete model_config: {exc}"),
        ) from exc

    invalidate_cache(None)
    return {"status": "deleted", "id": str(mc_id)}


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


@router.post("/ping")
async def ping_model(
    payload: ModelPingRequest,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """发送 'Ping, give me a pong' 验证 LLM 模型连通性。

    凭证回退链: 表单 > vendor_configs (DB) > LiteLLM 环境变量。
    """
    _require_admin(current_user)

    import asyncio
    import time

    from negentropy.config.model_resolver import build_full_model_name

    full_model_name = build_full_model_name(payload.vendor, payload.model_name)

    effective_api_key = payload.api_key
    effective_api_base = payload.api_base or payload.config.get("api_base")
    api_key_source = "payload" if payload.api_key else "env"

    if effective_api_key is None:
        from negentropy.models.vendor_config import VendorConfig

        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(VendorConfig).where(VendorConfig.vendor == payload.vendor))
                vc = result.scalar_one_or_none()
                if vc:
                    effective_api_key = vc.api_key
                    api_key_source = "db"
                    if not effective_api_base:
                        effective_api_base = vc.api_base
        except Exception:
            logger.warning(
                "ping_vendor_lookup_failed",
                vendor=payload.vendor,
                exc_info=True,
            )

    logger.info(
        "model_ping_start",
        vendor=payload.vendor,
        model_name=payload.model_name,
        full_model_name=full_model_name,
        api_base=effective_api_base,
        api_key_fingerprint=_mask_api_key(effective_api_key),
        api_key_source=api_key_source,
    )

    start_time = time.monotonic()

    try:
        result = await _ping_llm(full_model_name, effective_api_key, effective_api_base)
        latency_ms = int((time.monotonic() - start_time) * 1000)
        result["latency_ms"] = latency_ms
        logger.info(
            "model_ping_ok",
            vendor=payload.vendor,
            model_name=payload.model_name,
            latency_ms=latency_ms,
        )
        return result

    except Exception as exc:
        latency_ms = int((time.monotonic() - start_time) * 1000)
        error_msg = _sanitize_error(str(exc))
        logger.warning(
            "model_ping_failed",
            vendor=payload.vendor,
            model_name=payload.model_name,
            latency_ms=latency_ms,
            exc_type=type(exc).__name__,
            exc_status=getattr(exc, "status_code", None),
            exc_message=_sanitize_error(str(exc), max_len=500),
            exc_info=True,
        )
        if "AuthenticationError" in error_msg or "401" in error_msg:
            message = f"认证失败：API Key 无效或已过期。\n{error_msg}"
        elif "404" in error_msg or "NotFoundError" in error_msg:
            message = f"模型未找到：请检查 vendor/model_name 是否正确。\n{error_msg}"
        elif "RateLimitError" in error_msg or "429" in error_msg:
            message = f"请求过于频繁（429）：供应商已限流，请稍后重试。\n{error_msg}"
        elif "timeout" in error_msg.lower() or isinstance(exc, asyncio.TimeoutError):
            message = "连接超时 (5 min)，请检查网络或 API Base URL 配置。"
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

    from negentropy.config.model_resolver import normalize_api_base_for_litellm

    kwargs: dict[str, Any] = {
        "max_tokens": 20,
        "drop_params": True,
        "num_retries": 0,
        "max_retries": 0,
    }
    if api_key:
        kwargs["api_key"] = api_key
    normalized_api_base = normalize_api_base_for_litellm(model, api_base)
    if normalized_api_base:
        kwargs["api_base"] = normalized_api_base

    response = await asyncio.wait_for(
        litellm.acompletion(
            model=model,
            messages=[{"role": "user", "content": "Ping, give me a pong"}],
            **kwargs,
        ),
        timeout=300.0,
    )
    content = response.choices[0].message.content or ""
    return {"status": "ok", "message": f"Pong! {content.strip()[:100]}"}
