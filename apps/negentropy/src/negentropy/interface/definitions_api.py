"""
Interface / Definitions API 模块。

对 ``negentropy.definitions`` 表（所有「定义源」的 SSOT）提供统一 CRUD：
Skill 模板 / Routine 预设 / Harness 技能 SKILL.md / 代码内置 Agent 规格，均以
「整段源文本 + 代码编辑器表单」的形态在此维护。

权限：读（list/get）对登录用户开放；写（create/update/delete）限 ``admin``——
定义源属系统级配置，最小权限原则与 ``models_api`` 一致。写入前统一经
``registry.parse_definition`` 做服务端校验，非法源返回 422 且不落库。
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from negentropy.agents.definitions import DefinitionParseError, compute_checksum, parse_definition
from negentropy.agents.definitions.harness_materializer import maybe_materialize_now
from negentropy.auth.deps import get_current_user, resolve_user_with_db_roles
from negentropy.auth.service import AuthUser
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.definition import DEFINITION_FORMATS, DEFINITION_KINDS, Definition

logger = get_logger("negentropy.interface.definitions_api")
router = APIRouter(prefix="/interface/definitions", tags=["interface-definitions"])


# =============================================================================
# Shared Utilities
# =============================================================================


async def _require_admin(user: AuthUser) -> AuthUser:
    """以 DB ``user_states`` 持久化 roles 为权威校验 admin（与 models_api 对齐）。"""
    resolved = await resolve_user_with_db_roles(user)
    if "admin" not in resolved.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")
    return resolved


def _definition_to_dict(d: Definition) -> dict[str, Any]:
    return {
        "id": str(d.id),
        "kind": d.kind,
        "key": d.key,
        "format": d.format,
        "source": d.source,
        "meta": dict(d.meta or {}),
        "version": d.version,
        "checksum": d.checksum,
        "owner_id": d.owner_id,
        "is_system": d.is_system,
        "is_enabled": d.is_enabled,
        "sort_order": d.sort_order,
        "created_at": d.created_at.isoformat() if getattr(d, "created_at", None) else None,
        "updated_at": d.updated_at.isoformat() if getattr(d, "updated_at", None) else None,
    }


def _validate_kind(kind: str) -> None:
    if kind not in DEFINITION_KINDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported kind: {kind}. Allowed: {', '.join(sorted(DEFINITION_KINDS))}",
        )


def _validate_format(fmt: str) -> None:
    if fmt not in DEFINITION_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format: {fmt}. Allowed: {', '.join(sorted(DEFINITION_FORMATS))}",
        )


def _parse_or_422(kind: str, fmt: str, source: str) -> dict[str, Any]:
    """服务端校验；非法源返回 422（不落库）。"""
    try:
        return parse_definition(kind, fmt, source)
    except DefinitionParseError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


def _post_save_side_effects(kind: str) -> None:
    """定义写入后的 fire-and-forget 副作用（fail-soft，绝不阻断响应）。

    - ``harness_skill`` → 渲染回盘 ``.agent/skills/*/SKILL.md``；
    - ``agent`` → 重建 DB root 覆盖 + 失效 runner 缓存（``NE_AGENTS_FROM_DB`` 开启才生效）。
    """
    if kind == "harness_skill":
        maybe_materialize_now()
    elif kind == "agent":
        try:
            import asyncio

            from negentropy.agents.definitions.agent_factory import refresh_root_override

            asyncio.create_task(refresh_root_override())  # noqa: RUF006 — fire-and-forget
        except RuntimeError:
            pass  # 无运行中事件循环（同步上下文）：跳过，下次重启/请求自然拾取
        except Exception:  # pragma: no cover — fail-soft
            logger.warning("agent_refresh_root_override_failed", exc_info=True)


# =============================================================================
# Schemas
# =============================================================================


class DefinitionCreateRequest(BaseModel):
    kind: str = Field(..., description="定义族: skill_template / routine_preset / harness_skill / agent")
    key: str = Field(..., min_length=1, max_length=255, description="定义族内唯一键")
    source: str = Field(..., description="整段源文本（YAML / Markdown）")
    format: str = Field(default="yaml", description="源文本格式: yaml / markdown")
    is_enabled: bool = True
    is_system: bool = False
    sort_order: int = 0


class DefinitionUpdateRequest(BaseModel):
    source: str | None = Field(default=None, description="整段源文本（YAML / Markdown）")
    key: str | None = Field(default=None, min_length=1, max_length=255)
    format: str | None = None
    is_enabled: bool | None = None
    sort_order: int | None = None


# =============================================================================
# Endpoints
# =============================================================================


@router.get("")
async def list_definitions(
    kind: str | None = Query(default=None, description="按 kind 过滤"),
    is_enabled: bool | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """列出定义源（按 kind / is_enabled 过滤 + 分页）。"""
    if kind is not None:
        _validate_kind(kind)

    stmt = select(Definition)
    count_stmt = select(func.count()).select_from(Definition)
    if kind is not None:
        stmt = stmt.where(Definition.kind == kind)
        count_stmt = count_stmt.where(Definition.kind == kind)
    if is_enabled is not None:
        stmt = stmt.where(Definition.is_enabled == is_enabled)
        count_stmt = count_stmt.where(Definition.is_enabled == is_enabled)
    stmt = stmt.order_by(Definition.kind, Definition.sort_order, Definition.key).limit(limit).offset(offset)

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(stmt)).scalars().all()
        total = await db.scalar(count_stmt)

    return {
        "items": [_definition_to_dict(d) for d in rows],
        "count": len(rows),
        "total": int(total or 0),
        "offset": offset,
        "limit": limit,
    }


@router.get("/{def_id}")
async def get_definition(
    def_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """获取单条定义源详情。"""
    async with AsyncSessionLocal() as db:
        d = await db.get(Definition, def_id)
        if d is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="definition not found")
    return _definition_to_dict(d)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_definition(
    payload: DefinitionCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """新建定义源（admin）。写入前经 registry 服务端校验。"""
    admin = await _require_admin(user)
    _validate_kind(payload.kind)
    _validate_format(payload.format)

    meta = _parse_or_422(payload.kind, payload.format, payload.source)

    from sqlalchemy.exc import IntegrityError

    async with AsyncSessionLocal() as db:
        d = Definition(
            kind=payload.kind,
            key=payload.key.strip(),
            format=payload.format,
            source=payload.source,
            meta=meta,
            version=str(meta.get("version")) if meta.get("version") is not None else None,
            checksum=compute_checksum(payload.source),
            owner_id=("system" if payload.is_system else (admin.user_id or "system")),
            is_system=payload.is_system,
            is_enabled=payload.is_enabled,
            sort_order=payload.sort_order,
        )
        db.add(d)
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"definition conflict: (kind={payload.kind}, key={payload.key}) 已存在",
            ) from exc
        await db.refresh(d)

    _post_save_side_effects(payload.kind)
    return _definition_to_dict(d)


@router.put("/{def_id}")
async def update_definition(
    def_id: UUID,
    payload: DefinitionUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """更新定义源（admin）。改动 source/format 时经 registry 服务端校验。"""
    await _require_admin(user)

    async with AsyncSessionLocal() as db:
        d = await db.get(Definition, def_id)
        if d is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="definition not found")

        new_format = payload.format if payload.format is not None else d.format
        if payload.format is not None:
            _validate_format(payload.format)
        new_source = payload.source if payload.source is not None else d.source

        # 只要 source 或 format 变化就重新校验并回填派生列。
        if payload.source is not None or payload.format is not None:
            meta = _parse_or_422(d.kind, new_format, new_source)
            d.format = new_format
            d.source = new_source
            d.meta = meta
            d.version = str(meta.get("version")) if meta.get("version") is not None else None
            d.checksum = compute_checksum(new_source)

        if payload.key is not None:
            d.key = payload.key.strip()
        if payload.is_enabled is not None:
            d.is_enabled = payload.is_enabled
        if payload.sort_order is not None:
            d.sort_order = payload.sort_order

        try:
            await db.commit()
        except Exception as exc:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"definition update failed: {exc}",
            ) from exc
        await db.refresh(d)

    _post_save_side_effects(d.kind)
    return _definition_to_dict(d)


@router.delete("/{def_id}")
async def delete_definition(
    def_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """删除定义源（admin）。系统内置定义（is_system）受保护，禁删（可改用 is_enabled=false 停用）。"""
    await _require_admin(user)

    async with AsyncSessionLocal() as db:
        d = await db.get(Definition, def_id)
        if d is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="definition not found")
        if d.is_system:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="系统内置定义受保护，禁止删除；如需停用请置 is_enabled=false",
            )
        await db.delete(d)
        await db.commit()

    return {"status": "deleted", "id": str(def_id)}
