"""/interface/repositories/* —— Repository 资源 CRUD + 分支枚举。

定位：
    把「引擎主机上已 clone 的本地仓库根路径 + GitHub 地址 + 基线分支」注册为可复用资源，
    供 Routine 下拉选择（见 routine_api 的 ``repository_id``）。Repository 是与
    mcp/skill/agent/builtin_tool 并列的第 5 类 plugin 资源，复用 permissions 的可见性体系
    （owner_id + visibility + is_system + check_plugin_*）。

端点风格对齐 interface/api.py 的 McpServer：AsyncSessionLocal + Depends(get_current_user)
+ permissions.check_plugin_* + _repository_to_response。注册时调用 workspace.validate_repo
对本地仓库根 + 基线分支做即时校验（非法转 422），并提供 /inspect 枚举分支供前端基线下拉。
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError

import negentropy.db.session as db_session
from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser
from negentropy.config import settings
from negentropy.engine.routine import workspace
from negentropy.logging import get_logger
from negentropy.models.plugin import PluginVisibility, Repository

from .permissions import check_plugin_access, check_plugin_ownership, get_visible_plugin_ids

logger = get_logger("negentropy.interface.repository_api")

router = APIRouter(prefix="/interface/repositories", tags=["interface"])


# ---------------------------------------------------------------------------
# Pydantic Request / Response
# ---------------------------------------------------------------------------


class RepositoryCreateRequest(BaseModel):
    name: str
    display_name: str | None = None
    description: str | None = None
    github_url: str
    local_path: str
    baseline_branch: str
    default_remote: str = "origin"
    is_enabled: bool = True
    config: dict[str, Any] = Field(default_factory=dict)
    visibility: str = "private"


class RepositoryUpdateRequest(BaseModel):
    name: str | None = None
    display_name: str | None = None
    description: str | None = None
    github_url: str | None = None
    local_path: str | None = None
    baseline_branch: str | None = None
    default_remote: str | None = None
    is_enabled: bool | None = None
    config: dict[str, Any] | None = None
    visibility: str | None = None


class RepositoryResponse(BaseModel):
    id: UUID
    owner_id: str
    visibility: str
    name: str
    display_name: str | None = None
    description: str | None = None
    github_url: str
    local_path: str
    baseline_branch: str
    default_remote: str = "origin"
    is_enabled: bool = True
    is_builtin: bool = False
    config: dict[str, Any] = Field(default_factory=dict)
    sort_order: int = 0

    class Config:
        from_attributes = True


class BranchInspectRequest(BaseModel):
    local_path: str
    fetch: bool | None = None  # None=随 settings.git_fetch_before_worktree


class BranchInspectResponse(BaseModel):
    local: list[str] = Field(default_factory=list)
    remote: list[str] = Field(default_factory=list)
    default_remote: str = "origin"


def _repository_to_response(repo: Repository) -> RepositoryResponse:
    return RepositoryResponse(
        id=repo.id,
        owner_id=repo.owner_id,
        visibility=repo.visibility.value,
        name=repo.name,
        display_name=repo.display_name,
        description=repo.description,
        github_url=repo.github_url,
        local_path=repo.local_path,
        baseline_branch=repo.baseline_branch,
        default_remote=repo.default_remote,
        is_enabled=repo.is_enabled,
        is_builtin=bool(repo.is_system),
        config=repo.config or {},
        sort_order=repo.sort_order,
    )


async def _validate_local_repo(local_path: str, baseline_branch: str) -> None:
    """复用 workspace.validate_repo：校验 local_path 是 git 工作树 + baseline 可解析；非法转 422。"""
    try:
        await workspace.validate_repo(local_path, baseline_branch, settings.routine)
    except workspace.WorkspaceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# 分支枚举（供前端注册时基线下拉）
# ---------------------------------------------------------------------------


@router.post("/inspect", response_model=BranchInspectResponse)
async def inspect_repository_branches(
    payload: BranchInspectRequest,
    user: AuthUser = Depends(get_current_user),
) -> BranchInspectResponse:
    """读取 local_path 的本地 + 远端跟踪分支（best-effort fetch 后），供注册时基线下拉。

    用 local_path 而非 repository_id —— 注册流程在 Repo 保存前即需枚举分支。
    """
    try:
        result = await workspace.list_branches(payload.local_path, settings.routine, fetch=payload.fetch)
    except workspace.WorkspaceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return BranchInspectResponse(
        local=list(result.get("local", [])),
        remote=list(result.get("remote", [])),
        default_remote=str(result.get("default_remote", "origin")),
    )


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.get("", response_model=list[RepositoryResponse])
async def list_repositories(user: AuthUser = Depends(get_current_user)) -> list[RepositoryResponse]:
    """列出当前用户可见的 Repository（owner / public / shared / system）。"""
    async with db_session.AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "repository", user)
        if not visible_ids:
            return []
        stmt = (
            select(Repository)
            .where(Repository.id.in_(visible_ids))
            .order_by(Repository.sort_order.asc(), Repository.created_at.desc())
        )
        repos = (await db.execute(stmt)).scalars().all()
        return [_repository_to_response(r) for r in repos]


@router.post("", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
async def create_repository(
    payload: RepositoryCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> RepositoryResponse:
    """注册新 Repository：先校验本地仓库根 + 基线分支，再落库。"""
    await _validate_local_repo(payload.local_path, payload.baseline_branch)
    async with db_session.AsyncSessionLocal() as db:
        existing = await db.scalar(select(Repository).where(Repository.name == payload.name))
        if existing:
            raise HTTPException(status_code=400, detail="Repository name already exists")
        repo = Repository(
            owner_id=user.user_id,
            visibility=PluginVisibility(payload.visibility),
            name=payload.name,
            display_name=payload.display_name,
            description=payload.description,
            github_url=payload.github_url,
            local_path=payload.local_path,
            baseline_branch=payload.baseline_branch,
            default_remote=payload.default_remote,
            is_enabled=payload.is_enabled,
            config=payload.config,
        )
        db.add(repo)
        try:
            await db.commit()
        except IntegrityError as exc:
            # 唯一约束兜底并发竞态（查重后落库前的窗口）。
            await db.rollback()
            raise HTTPException(status_code=409, detail="Repository name already exists") from exc
        await db.refresh(repo)
    return _repository_to_response(repo)


@router.get("/{repository_id}", response_model=RepositoryResponse)
async def get_repository(
    repository_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> RepositoryResponse:
    async with db_session.AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "repository", repository_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)
        repo = await db.get(Repository, repository_id)
        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found")
    return _repository_to_response(repo)


@router.patch("/{repository_id}", response_model=RepositoryResponse)
async def update_repository(
    repository_id: UUID,
    payload: RepositoryUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> RepositoryResponse:
    async with db_session.AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "repository", repository_id, user, "edit")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)
        repo = await db.get(Repository, repository_id)
        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found")

        update_data = payload.model_dump(exclude_unset=True)
        if "name" in update_data:
            new_name = str(update_data["name"] or "").strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="Repository name cannot be empty")
            if new_name != repo.name:
                dup = await db.scalar(
                    select(Repository).where(and_(Repository.name == new_name, Repository.id != repository_id))
                )
                if dup:
                    raise HTTPException(status_code=400, detail="Repository name already exists")
            update_data["name"] = new_name
        if "visibility" in update_data:
            update_data["visibility"] = PluginVisibility(update_data["visibility"])

        # local_path / baseline_branch 任一变更 → 以合并后的有效值重新校验。
        if ("local_path" in update_data) or ("baseline_branch" in update_data):
            eff_path = update_data.get("local_path", repo.local_path)
            eff_base = update_data.get("baseline_branch", repo.baseline_branch)
            await _validate_local_repo(eff_path, eff_base)

        for key, value in update_data.items():
            setattr(repo, key, value)
        await db.commit()
        await db.refresh(repo)
    return _repository_to_response(repo)


@router.delete("/{repository_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_repository(
    repository_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> None:
    """删除 Repository（仅 owner）。引用它的 Routine 经 FK SET NULL 自动解除关联、回退手填配置。"""
    async with db_session.AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "repository", repository_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)
        repo = await db.get(Repository, repository_id)
        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found")
        await db.delete(repo)
        await db.commit()
