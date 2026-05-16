"""Task → Model 映射 API。

提供两类端点：
    1. 全局任务映射 (``/interface/task-models/*``):
       - GET  ``/registry``                 — 列出所有 task slot（注册表）
       - GET  ``/settings``                 — 列出当前所有全局映射
       - PUT  ``/settings/{task_key}``      — 设置/更新全局映射
       - DELETE ``/settings/{task_key}``    — 删除（回退默认）

    2. Corpus 级任务映射 (``/knowledge/corpus/{corpus_id}/task-models/*``):
       - GET  ``/``                          — 列出该 Corpus 的任务映射
       - PUT  ``/{task_key}``                — 设置/更新
       - DELETE ``/{task_key}``              — 删除（回退到全局映射 / 默认）

设计要点：
    - 复用 ``models_api._require_admin`` 守卫（全局映射端点）。
    - Corpus 级端点对 Corpus 拥有者开放（未来若引入精细化授权可改）。
    - 写操作后强制 ``invalidate_cache(prefix="task:")``，确保 resolver 60s TTL
      不阻碍即时生效。
    - 严格校验：
        * ``task_key`` 必须在 ``task_registry`` 内
        * ``model_config_id`` 必须存在、enabled=true、且 ``model_type`` 与 task 期望一致
        * Corpus 级映射要求 task slot ``scope == "corpus"``
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, delete, select

from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser
from negentropy.config.task_registry import (
    get_task,
    is_valid_task_key,
    list_all_tasks,
    to_dict,
)
from negentropy.db.session import AsyncSessionLocal
from negentropy.interface.models_api import _require_admin
from negentropy.logging import get_logger

logger = get_logger("negentropy.interface.task_models_api")
router = APIRouter(prefix="/interface/task-models", tags=["interface-task-models"])
corpus_router = APIRouter(
    prefix="/knowledge/corpus/{corpus_id}/task-models",
    tags=["knowledge-corpus-task-models"],
)


# =============================================================================
# Schemas
# =============================================================================


class TaskModelUpsert(BaseModel):
    model_config_id: UUID = Field(..., description="model_configs.id")


def _setting_to_dict(s) -> dict[str, Any]:
    return {
        "scope_corpus_id": str(s.scope_corpus_id) if s.scope_corpus_id else None,
        "task_key": s.task_key,
        "model_config_id": str(s.model_config_id),
        "updated_at": s.updated_at.isoformat() if getattr(s, "updated_at", None) else None,
    }


async def _load_model_config_for_validation(model_config_id: UUID):
    """加载 model_config 行，校验 enabled。"""
    from negentropy.models.model_config import ModelConfig

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ModelConfig).where(ModelConfig.id == model_config_id))
        mc = result.scalar_one_or_none()
    if mc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="model_config not found")
    if not mc.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="model_config is disabled; enable it before binding",
        )
    return mc


def _ensure_task_type_matches(task_key: str, mc) -> None:
    """校验 task.model_type 与 model_configs.model_type 一致。"""
    slot = get_task(task_key)
    if slot is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"unknown task_key: {task_key}",
        )
    mc_type = mc.model_type.value if hasattr(mc.model_type, "value") else str(mc.model_type)
    if mc_type != slot.model_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(f"model_type mismatch: task '{task_key}' expects '{slot.model_type}', got '{mc_type}'"),
        )


async def _ensure_corpus_exists(corpus_id: UUID) -> None:
    """简单校验 Corpus 存在；不深入授权（沿用既有 KG API 风格）。"""
    from negentropy.models.perception import Corpus

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Corpus.id).where(Corpus.id == corpus_id))
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="corpus not found")


# =============================================================================
# Global task model settings
# =============================================================================


@router.get("/registry")
async def get_task_registry(current_user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    """返回所有任务槽位定义。前端用于渲染表单结构（zero hardcoded keys on UI side）。"""
    # 仅需登录用户，非管理员也可读 registry（用于在 Corpus 设置页渲染 corpus 作用域槽）。
    return {"tasks": [to_dict(slot) for slot in list_all_tasks()]}


@router.get("/settings")
async def list_global_task_settings(
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """列出当前生效的全局映射（scope_corpus_id IS NULL）。"""
    current_user = await _require_admin(current_user)
    from negentropy.models.task_model_setting import TaskModelSetting

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(TaskModelSetting).where(TaskModelSetting.scope_corpus_id.is_(None)))
        rows = result.scalars().all()
    return {"settings": [_setting_to_dict(r) for r in rows]}


@router.put("/settings/{task_key}")
async def upsert_global_task_setting(
    task_key: str,
    payload: TaskModelUpsert,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """设置/更新全局任务映射。"""
    current_user = await _require_admin(current_user)
    if not is_valid_task_key(task_key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"unknown task_key: {task_key}")

    mc = await _load_model_config_for_validation(payload.model_config_id)
    _ensure_task_type_matches(task_key, mc)

    from negentropy.config.model_resolver import invalidate_cache
    from negentropy.models.task_model_setting import TaskModelSetting

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TaskModelSetting).where(
                and_(
                    TaskModelSetting.scope_corpus_id.is_(None),
                    TaskModelSetting.task_key == task_key,
                )
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = TaskModelSetting(
                scope_corpus_id=None,
                task_key=task_key,
                model_config_id=payload.model_config_id,
            )
            db.add(row)
        else:
            row.model_config_id = payload.model_config_id
        await db.commit()
        await db.refresh(row)

    invalidate_cache(prefix="task:")
    logger.info(
        "task_model_setting_upserted",
        scope="global",
        task_key=task_key,
        model_config_id=str(payload.model_config_id),
    )
    return {"setting": _setting_to_dict(row)}


@router.delete("/settings/{task_key}")
async def delete_global_task_setting(
    task_key: str,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """删除全局任务映射（回退到默认链路）。"""
    current_user = await _require_admin(current_user)
    if not is_valid_task_key(task_key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"unknown task_key: {task_key}")

    from negentropy.config.model_resolver import invalidate_cache
    from negentropy.models.task_model_setting import TaskModelSetting

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            delete(TaskModelSetting).where(
                and_(
                    TaskModelSetting.scope_corpus_id.is_(None),
                    TaskModelSetting.task_key == task_key,
                )
            )
        )
        await db.commit()
        deleted_count = result.rowcount or 0

    invalidate_cache(prefix="task:")
    logger.info(
        "task_model_setting_deleted",
        scope="global",
        task_key=task_key,
        deleted=deleted_count,
    )
    return {"status": "deleted", "task_key": task_key, "deleted_count": deleted_count}


# =============================================================================
# Corpus-scoped task model settings
# =============================================================================


@corpus_router.get("")
async def list_corpus_task_settings(
    corpus_id: UUID,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """列出某 Corpus 的所有任务映射。"""
    await _ensure_corpus_exists(corpus_id)
    from negentropy.models.task_model_setting import TaskModelSetting

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(TaskModelSetting).where(TaskModelSetting.scope_corpus_id == corpus_id))
        rows = result.scalars().all()
    return {"settings": [_setting_to_dict(r) for r in rows]}


@corpus_router.put("/{task_key}")
async def upsert_corpus_task_setting(
    corpus_id: UUID,
    task_key: str,
    payload: TaskModelUpsert,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """设置/更新某 Corpus 的任务映射。

    校验:
        - task_key 必须是 scope=corpus 的槽位
        - model_type 与 task 期望一致
        - Corpus 存在
    """
    await _ensure_corpus_exists(corpus_id)
    slot = get_task(task_key)
    if slot is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"unknown task_key: {task_key}")
    if slot.scope != "corpus":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"task '{task_key}' is not corpus-scoped; configure it under /interface/task-models",
        )

    mc = await _load_model_config_for_validation(payload.model_config_id)
    _ensure_task_type_matches(task_key, mc)

    from negentropy.config.model_resolver import invalidate_cache
    from negentropy.models.task_model_setting import TaskModelSetting

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TaskModelSetting).where(
                and_(
                    TaskModelSetting.scope_corpus_id == corpus_id,
                    TaskModelSetting.task_key == task_key,
                )
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = TaskModelSetting(
                scope_corpus_id=corpus_id,
                task_key=task_key,
                model_config_id=payload.model_config_id,
            )
            db.add(row)
        else:
            row.model_config_id = payload.model_config_id
        await db.commit()
        await db.refresh(row)

    invalidate_cache(prefix="task:")
    logger.info(
        "task_model_setting_upserted",
        scope="corpus",
        corpus_id=str(corpus_id),
        task_key=task_key,
        model_config_id=str(payload.model_config_id),
    )
    return {"setting": _setting_to_dict(row)}


@corpus_router.delete("/{task_key}")
async def delete_corpus_task_setting(
    corpus_id: UUID,
    task_key: str,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """删除某 Corpus 的任务映射（回退到全局映射 / 默认）。"""
    await _ensure_corpus_exists(corpus_id)
    if not is_valid_task_key(task_key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"unknown task_key: {task_key}")

    from negentropy.config.model_resolver import invalidate_cache
    from negentropy.models.task_model_setting import TaskModelSetting

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            delete(TaskModelSetting).where(
                and_(
                    TaskModelSetting.scope_corpus_id == corpus_id,
                    TaskModelSetting.task_key == task_key,
                )
            )
        )
        await db.commit()
        deleted_count = result.rowcount or 0

    invalidate_cache(prefix="task:")
    logger.info(
        "task_model_setting_deleted",
        scope="corpus",
        corpus_id=str(corpus_id),
        task_key=task_key,
        deleted=deleted_count,
    )
    return {"status": "deleted", "task_key": task_key, "deleted_count": deleted_count}
