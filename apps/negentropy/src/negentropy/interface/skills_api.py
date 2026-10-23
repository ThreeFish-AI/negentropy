"""
Interface Skills API — /interface/skills Skill CRUD/模板/版本/调度/调用。

由 api.py 按域机械拆分而来（2026-09 熵减）；行为与路由序保持不变，
契约由 tests/unit_tests/interface/test_route_table_contract.py 锁定。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, select

from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser
from negentropy.config import parse_env_bool
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.plugin import (
    PluginVisibility,
    Skill,
    SkillSchedule,
    SkillVersion,
)

from .permissions import check_plugin_access, check_plugin_ownership, get_visible_plugin_ids

# logger 名沿用拆分前的 "negentropy.interface.api"：日志消费方按名过滤，改名另行评审
logger = get_logger("negentropy.interface.api")
router = APIRouter(prefix="/interface", tags=["interface"])


# =============================================================================
# Skill Models
# =============================================================================


class SkillCreateRequest(BaseModel):
    name: str
    display_name: str | None = None
    description: str | None = None
    category: str = "general"
    version: str = "1.0.0"
    prompt_template: str | None = None
    config_schema: dict[str, Any] = Field(default_factory=dict)
    default_config: dict[str, Any] = Field(default_factory=dict)
    required_tools: list[str] = Field(default_factory=list)
    is_enabled: bool = True
    priority: int = 0
    visibility: str = "private"
    enforcement_mode: str = "warning"
    resources: list[dict[str, Any]] = Field(default_factory=list)
    # 全局技能：TRUE 时自动注入全系统所有 Agent 的 Progressive Disclosure（见 skills_injector）。
    is_global: bool = False


class SkillUpdateRequest(BaseModel):
    name: str | None = None
    display_name: str | None = None
    description: str | None = None
    category: str | None = None
    version: str | None = None
    prompt_template: str | None = None
    config_schema: dict[str, Any] | None = None
    default_config: dict[str, Any] | None = None
    required_tools: list[str] | None = None
    is_enabled: bool | None = None
    priority: int | None = None
    visibility: str | None = None
    enforcement_mode: str | None = None
    resources: list[dict[str, Any]] | None = None
    is_global: bool | None = None


class SkillResponse(BaseModel):
    id: UUID
    owner_id: str
    visibility: str
    name: str
    display_name: str | None = None
    description: str | None = None
    category: str
    version: str
    prompt_template: str | None = None
    config_schema: dict[str, Any] = Field(default_factory=dict)
    default_config: dict[str, Any] = Field(default_factory=dict)
    required_tools: list[str] = Field(default_factory=list)
    is_enabled: bool
    priority: int
    enforcement_mode: str = "warning"
    resources: list[dict[str, Any]] = Field(default_factory=list)
    # 「系统内置」统一对外字段，与 MCP/Agent/Tool 字段保持一致。
    is_builtin: bool = False
    # 「全局技能」：TRUE 时自动注入全系统所有 Agent；前端据此渲染 Global 徽章。
    is_global: bool = False
    sort_order: int = 0

    class Config:
        from_attributes = True


class SkillInvokeRequest(BaseModel):
    """``POST /interface/skills/{id}:invoke`` 请求体：渲染 prompt_template 并附带资源。"""

    variables: dict[str, Any] = Field(default_factory=dict)


class SkillInvokeResponse(BaseModel):
    """``POST /interface/skills/{id}:invoke`` 响应体。"""

    skill_id: UUID
    name: str
    rendered_prompt: str
    resources: list[dict[str, Any]] = Field(default_factory=list)
    missing_tools: list[str] = Field(default_factory=list)


class SkillTemplateSummary(BaseModel):
    """``GET /interface/skills/templates`` 单项响应。"""

    template_id: str
    name: str
    display_name: str | None = None
    description: str | None = None
    category: str
    version: str


class SkillFromTemplateRequest(BaseModel):
    """``POST /interface/skills/from-template`` 请求体。"""

    template_id: str
    name_override: str | None = None
    visibility: str | None = None


# Phase 3 — Skill 版本历史 / 调度
class SkillVersionResponse(BaseModel):
    id: UUID
    skill_id: UUID
    version: str
    snapshot: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None


class SkillSnapshotRequest(BaseModel):
    """``POST /interface/skills/{id}/versions`` 请求体；默认 freeze 当前字段。"""

    version: str | None = None  # 不传时使用 Skill.version


class SkillScheduleRequest(BaseModel):
    cron_expr: str
    enabled: bool = True
    vars: dict[str, Any] = Field(default_factory=dict)


class SkillScheduleResponse(BaseModel):
    id: UUID
    skill_id: UUID
    owner_id: str
    cron_expr: str
    enabled: bool
    vars: dict[str, Any] = Field(default_factory=dict)
    last_run_at: datetime | None = None
    next_run_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime | None = None


# =============================================================================
# Skills Endpoints
# =============================================================================


@router.get("/skills", response_model=list[SkillResponse])
async def list_skills(
    category: str | None = Query(default=None),
    user: AuthUser = Depends(get_current_user),
) -> list[SkillResponse]:
    """列出用户可见的 Skills"""
    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "skill", user)
        if not visible_ids:
            return []

        stmt = select(Skill).where(Skill.id.in_(visible_ids))
        if category:
            stmt = stmt.where(Skill.category == category)
        stmt = stmt.order_by(Skill.sort_order.asc(), Skill.priority.desc(), Skill.created_at.desc())
        result = await db.execute(stmt)
        skills = result.scalars().all()

    return [_skill_to_response(s) for s in skills]


@router.post("/skills", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    payload: SkillCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> SkillResponse:
    """创建新的 Skill"""
    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(Skill).where(Skill.name == payload.name))
        if existing:
            raise HTTPException(status_code=400, detail="Skill name already exists")

        skill = Skill(
            owner_id=user.user_id,
            visibility=PluginVisibility(payload.visibility),
            name=payload.name,
            display_name=payload.display_name,
            description=payload.description,
            category=payload.category,
            version=payload.version,
            prompt_template=payload.prompt_template,
            config_schema=payload.config_schema,
            default_config=payload.default_config,
            required_tools=payload.required_tools,
            is_enabled=payload.is_enabled,
            priority=payload.priority,
            enforcement_mode=payload.enforcement_mode
            if payload.enforcement_mode in ("warning", "strict")
            else "warning",
            resources=payload.resources or [],
            is_global=bool(payload.is_global),
        )
        db.add(skill)
        await db.commit()
        await db.refresh(skill)
        # Phase 3：新建时同步写入初始版本快照，让 Agent 引用 name@version 立即可用。
        try:
            db.add(_build_initial_version(skill))
            await db.commit()
        except Exception as exc:
            logger.warning("skill_initial_version_failed", skill_id=str(skill.id), error=str(exc))

    if skill.is_global:
        _invalidate_global_skill_caches()
    return _skill_to_response(skill)


def _build_initial_version(skill: Skill) -> SkillVersion:
    """构造一条 SkillVersion 行，用于 ``create_skill`` / ``from-template`` 之后立即落库。"""
    return SkillVersion(
        skill_id=skill.id,
        version=skill.version or "1.0.0",
        snapshot={
            "name": skill.name,
            "display_name": skill.display_name,
            "description": skill.description,
            "category": skill.category,
            "prompt_template": skill.prompt_template,
            "config_schema": skill.config_schema,
            "default_config": skill.default_config,
            "required_tools": skill.required_tools,
            "priority": skill.priority,
            "enforcement_mode": getattr(skill, "enforcement_mode", "warning"),
            "resources": skill.resources,
            "is_global": bool(getattr(skill, "is_global", False)),
        },
    )


@router.get("/skills/templates", response_model=list[SkillTemplateSummary])
async def list_skill_templates(
    user: AuthUser = Depends(get_current_user),
) -> list[SkillTemplateSummary]:
    """列出内置 Skill 模板（必须在 ``/skills/{skill_id}`` 之前声明，避免被动态路径吞噬）。"""
    from negentropy.agents.skill_templates import load_all

    templates = await load_all()
    return [
        SkillTemplateSummary(
            template_id=t.template_id,
            name=t.name,
            display_name=t.display_name,
            description=t.description,
            category=t.category,
            version=t.version,
        )
        for t in templates
    ]


@router.post(
    "/skills/from-template",
    response_model=SkillResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_skill_from_template(
    payload: SkillFromTemplateRequest,
    user: AuthUser = Depends(get_current_user),
) -> SkillResponse:
    """根据内置模板一键创建 Skill。

    - ``name`` 冲突时自动追加 ``-{owner_short}`` 后缀（不抛 400，避免重试摩擦）；
    - ``visibility`` 默认随模板（多为 ``shared``），调用方可覆盖。
    - 路由必须在 ``/skills/{skill_id}`` 之前声明。
    """
    from negentropy.agents.skill_templates import load_all

    templates = {t.template_id: t for t in await load_all()}
    tpl = templates.get(payload.template_id)
    if tpl is None:
        raise HTTPException(status_code=404, detail=f"Template '{payload.template_id}' not found")

    target_name = (payload.name_override or tpl.name).strip()
    if not target_name:
        raise HTTPException(status_code=400, detail="Skill name cannot be empty")

    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(Skill).where(Skill.name == target_name))
        if existing:
            short = (user.user_id or "u").split(":")[-1][:8]
            target_name = f"{target_name}-{short}"
            existing2 = await db.scalar(select(Skill).where(Skill.name == target_name))
            if existing2:
                import secrets

                target_name = f"{target_name}-{secrets.token_hex(3)}"

        visibility_value = payload.visibility or tpl.visibility
        skill = Skill(
            owner_id=user.user_id,
            visibility=PluginVisibility(visibility_value),
            name=target_name,
            display_name=tpl.display_name,
            description=tpl.description,
            category=tpl.category,
            version=tpl.version,
            prompt_template=tpl.prompt_template,
            config_schema=tpl.config_schema,
            default_config=tpl.default_config,
            required_tools=tpl.required_tools,
            is_enabled=True,
            priority=tpl.priority,
            enforcement_mode=tpl.enforcement_mode,
            resources=tpl.resources,
            is_global=bool(getattr(tpl, "is_global", False)),
        )
        db.add(skill)
        await db.commit()
        await db.refresh(skill)
        # Phase 3：模板安装后立刻写入初始版本快照。
        try:
            db.add(_build_initial_version(skill))
            await db.commit()
        except Exception as exc:
            logger.warning("skill_initial_version_failed", skill_id=str(skill.id), error=str(exc))

    if skill.is_global:
        _invalidate_global_skill_caches()
    return _skill_to_response(skill)


# ── Skill Reorder ──
# /reorder 字面量路由必须注册在任何同方法 {id} 参数路由之前（防遮蔽，见 MCP 域注释）。


class SkillReorderItem(BaseModel):
    id: UUID
    sort_order: int


class SkillReorderRequest(BaseModel):
    items: list[SkillReorderItem]


@router.patch("/skills/reorder", response_model=list[SkillResponse])
async def reorder_skills(
    payload: SkillReorderRequest,
    user: AuthUser = Depends(get_current_user),
) -> list[SkillResponse]:
    """批量更新 Skill 排序序号。"""
    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "skill", user)
        if not visible_ids:
            return []

        visible_set = set(visible_ids)
        for item in payload.items:
            if item.id not in visible_set:
                raise HTTPException(status_code=403, detail=f"No edit permission for skill {item.id}")

        # 批量查询所有目标 skill，避免 N+1
        target_ids = [item.id for item in payload.items]
        result = await db.execute(select(Skill).where(Skill.id.in_(target_ids)))
        skill_map = {s.id: s for s in result.scalars().all()}
        for item in payload.items:
            skill = skill_map.get(item.id)
            if skill:
                skill.sort_order = item.sort_order

        await db.commit()

        stmt = (
            select(Skill)
            .where(Skill.id.in_(visible_ids))
            .order_by(Skill.sort_order.asc(), Skill.priority.desc(), Skill.created_at.desc())
        )
        result = await db.execute(stmt)
        skills = result.scalars().all()
        return [_skill_to_response(s) for s in skills]


@router.get("/skills/{skill_id}", response_model=SkillResponse)
async def get_skill(
    skill_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> SkillResponse:
    """获取 Skill 详情"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "skill", skill_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        skill = await db.get(Skill, skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")
    return _skill_to_response(skill)


@router.patch("/skills/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: UUID,
    payload: SkillUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> SkillResponse:
    """更新 Skill"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "skill", skill_id, user, "edit")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        skill = await db.get(Skill, skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")

        update_data = payload.model_dump(exclude_unset=True)
        if "name" in update_data:
            new_name = str(update_data["name"] or "").strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="Skill name cannot be empty")
            if new_name != skill.name:
                existing = await db.scalar(select(Skill).where(and_(Skill.name == new_name, Skill.id != skill_id)))
                if existing:
                    raise HTTPException(status_code=400, detail="Skill name already exists")
            update_data["name"] = new_name
        if "visibility" in update_data:
            update_data["visibility"] = PluginVisibility(update_data["visibility"])
        if "enforcement_mode" in update_data:
            mode = update_data.get("enforcement_mode")
            if mode not in ("warning", "strict"):
                raise HTTPException(status_code=400, detail="enforcement_mode must be 'warning' or 'strict'")
        if "resources" in update_data:
            res_value = update_data.get("resources") or []
            if not isinstance(res_value, list):
                raise HTTPException(status_code=400, detail="resources must be a list")
            update_data["resources"] = res_value

        # Phase 3：检测 version 字段变更，自动 snapshot 到 skill_versions。
        old_version = skill.version
        new_version = update_data.get("version")
        version_changed = bool(new_version) and new_version != old_version

        for key, value in update_data.items():
            setattr(skill, key, value)

        if version_changed:
            try:
                snapshot_payload = {
                    "name": skill.name,
                    "display_name": skill.display_name,
                    "description": skill.description,
                    "category": skill.category,
                    "prompt_template": skill.prompt_template,
                    "config_schema": skill.config_schema,
                    "default_config": skill.default_config,
                    "required_tools": skill.required_tools,
                    "priority": skill.priority,
                    "enforcement_mode": getattr(skill, "enforcement_mode", "warning"),
                    "resources": skill.resources,
                    "is_global": bool(getattr(skill, "is_global", False)),
                }
                existing = await db.scalar(
                    select(SkillVersion).where(
                        SkillVersion.skill_id == skill.id,
                        SkillVersion.version == new_version,
                    )
                )
                if existing is None:
                    db.add(
                        SkillVersion(
                            skill_id=skill.id,
                            version=new_version,
                            snapshot=snapshot_payload,
                        )
                    )
            except Exception as exc:
                logger.warning(
                    "skill_version_snapshot_failed",
                    skill_id=str(skill.id),
                    error=str(exc),
                )

        await db.commit()
        await db.refresh(skill)

    # 全局技能字段或当前为全局技能 → 失效缓存（含关闭 is_global 的情形）。
    if skill.is_global or "is_global" in update_data:
        _invalidate_global_skill_caches()
    return _skill_to_response(skill)


# =============================================================================
# Skills Phase 3 — versions / schedules endpoints
# =============================================================================


@router.get("/skills/{skill_id}/versions", response_model=list[SkillVersionResponse])
async def list_skill_versions(
    skill_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> list[SkillVersionResponse]:
    """列出指定 Skill 的全部历史版本（最新在前）。"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "skill", skill_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)
        rows = (
            (
                await db.execute(
                    select(SkillVersion)
                    .where(SkillVersion.skill_id == skill_id)
                    .order_by(SkillVersion.created_at.desc())
                )
            )
            .scalars()
            .all()
        )
    return [
        SkillVersionResponse(
            id=r.id,
            skill_id=r.skill_id,
            version=r.version,
            snapshot=dict(r.snapshot or {}),
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post(
    "/skills/{skill_id}/versions",
    response_model=SkillVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_skill_version(
    skill_id: UUID,
    payload: SkillSnapshotRequest,
    user: AuthUser = Depends(get_current_user),
) -> SkillVersionResponse:
    """手动 freeze 当前 Skill 字段为一个新版本快照。

    若 ``payload.version`` 不传，使用 Skill 当前 ``version`` 字段；
    同 (skill_id, version) 已存在时返回 409。
    """
    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "skill", skill_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)
        skill = await db.get(Skill, skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")

        version = (payload.version or skill.version or "").strip()
        if not version:
            raise HTTPException(status_code=400, detail="version is required")
        existing = await db.scalar(
            select(SkillVersion).where(SkillVersion.skill_id == skill_id, SkillVersion.version == version)
        )
        if existing is not None:
            raise HTTPException(status_code=409, detail=f"Version '{version}' already exists for this skill")

        snapshot_payload = {
            "name": skill.name,
            "display_name": skill.display_name,
            "description": skill.description,
            "category": skill.category,
            "prompt_template": skill.prompt_template,
            "config_schema": skill.config_schema,
            "default_config": skill.default_config,
            "required_tools": skill.required_tools,
            "priority": skill.priority,
            "enforcement_mode": getattr(skill, "enforcement_mode", "warning"),
            "resources": skill.resources,
        }
        row = SkillVersion(skill_id=skill_id, version=version, snapshot=snapshot_payload)
        db.add(row)
        await db.commit()
        await db.refresh(row)

    return SkillVersionResponse(
        id=row.id,
        skill_id=row.skill_id,
        version=row.version,
        snapshot=dict(row.snapshot or {}),
        created_at=row.created_at,
    )


@router.get("/skills/{skill_id}/schedules", response_model=list[SkillScheduleResponse])
async def list_skill_schedules(
    skill_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> list[SkillScheduleResponse]:
    """列出指定 Skill 关联的全部定时调度。"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "skill", skill_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)
        rows = (
            (
                await db.execute(
                    select(SkillSchedule)
                    .where(SkillSchedule.skill_id == skill_id)
                    .order_by(SkillSchedule.created_at.desc())
                )
            )
            .scalars()
            .all()
        )
    return [_schedule_to_response(s) for s in rows]


@router.post(
    "/skills/{skill_id}/schedules",
    response_model=SkillScheduleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_skill_schedule(
    skill_id: UUID,
    payload: SkillScheduleRequest,
    user: AuthUser = Depends(get_current_user),
) -> SkillScheduleResponse:
    """新增一条定时调度：cron 表达式 + 透传变量。"""
    from croniter import CroniterBadCronError, croniter

    from negentropy.agents.skill_scheduler import ensure_scheduler_running

    cron_expr = (payload.cron_expr or "").strip()
    if not cron_expr:
        raise HTTPException(status_code=400, detail="cron_expr is required")
    try:
        # 与 ``skill_scheduler`` 保持一致：tz-aware UTC，避免 naive
        # datetime 写入 ``next_run_at`` (TIMESTAMP WITH TIME ZONE) 时被驱动按本地
        # 时区错误解释。
        cron = croniter(cron_expr, datetime.now(UTC))
        next_run = cron.get_next(datetime)
    except (CroniterBadCronError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"invalid cron_expr: {exc}") from exc

    # 幂等懒启动 SkillScheduler tick（ADK 嵌入场景下 FastAPI startup hook 不触发）。
    await ensure_scheduler_running()

    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "skill", skill_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)
        skill = await db.get(Skill, skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")

        sched = SkillSchedule(
            skill_id=skill_id,
            owner_id=user.user_id,
            cron_expr=cron_expr,
            enabled=payload.enabled,
            vars=payload.vars or {},
            next_run_at=next_run,
        )
        db.add(sched)
        await db.commit()
        await db.refresh(sched)

    return _schedule_to_response(sched)


@router.delete(
    "/skills/{skill_id}/schedules/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_skill_schedule(
    skill_id: UUID,
    schedule_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> None:
    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "skill", skill_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)
        sched = await db.get(SkillSchedule, schedule_id)
        if not sched or sched.skill_id != skill_id:
            raise HTTPException(status_code=404, detail="Schedule not found")
        await db.delete(sched)
        await db.commit()


@router.post(
    "/skills/{skill_id}/schedules/{schedule_id}/run",
    response_model=SkillScheduleResponse,
)
async def run_skill_schedule(
    skill_id: UUID,
    schedule_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> SkillScheduleResponse:
    """手动触发一次调度（不等 cron tick）。"""
    from negentropy.agents.skill_scheduler import execute_schedule_once

    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "skill", skill_id, user, "edit")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)
        sched = await db.get(SkillSchedule, schedule_id)
        if not sched or sched.skill_id != skill_id:
            raise HTTPException(status_code=404, detail="Schedule not found")

    await execute_schedule_once(schedule_id)

    async with AsyncSessionLocal() as db:
        sched_after = await db.get(SkillSchedule, schedule_id)
        if sched_after is None:
            raise HTTPException(status_code=404, detail="Schedule disappeared after run")
        return _schedule_to_response(sched_after)


def _schedule_to_response(s: SkillSchedule) -> SkillScheduleResponse:
    return SkillScheduleResponse(
        id=s.id,
        skill_id=s.skill_id,
        owner_id=s.owner_id,
        cron_expr=s.cron_expr,
        enabled=s.enabled,
        vars=dict(s.vars or {}),
        last_run_at=s.last_run_at,
        next_run_at=s.next_run_at,
        last_error=s.last_error,
        created_at=s.created_at,
    )


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    skill_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> None:
    """删除 Skill（仅 owner 可删除）"""
    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "skill", skill_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        skill = await db.get(Skill, skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")
        was_global = bool(getattr(skill, "is_global", False))
        await db.delete(skill)
        await db.commit()

    if was_global:
        _invalidate_global_skill_caches()


def _skill_to_response(skill: Skill) -> SkillResponse:
    return SkillResponse(
        id=skill.id,
        owner_id=skill.owner_id,
        visibility=skill.visibility.value,
        name=skill.name,
        display_name=skill.display_name,
        description=skill.description,
        category=skill.category,
        version=skill.version,
        prompt_template=skill.prompt_template,
        config_schema=skill.config_schema or {},
        default_config=skill.default_config or {},
        required_tools=skill.required_tools or [],
        is_enabled=skill.is_enabled,
        priority=skill.priority,
        enforcement_mode=getattr(skill, "enforcement_mode", "warning") or "warning",
        resources=list(skill.resources or []) if hasattr(skill, "resources") else [],
        is_builtin=bool(getattr(skill, "is_system", False)) or (skill.owner_id or "").startswith("system"),
        is_global=bool(getattr(skill, "is_global", False)),
        sort_order=getattr(skill, "sort_order", 0),
    )


def _invalidate_global_skill_caches() -> None:
    """全局技能写操作后清缓存，实现强一致（否则最长 60s TTL 后才生效）。

    清两处：``skills_injector`` 的全局块缓存（fallback 路径）+ ``model_resolver``
    的 ``subagent:`` 指令缓存（DB 路径已把全局块嵌入指令文本）。fail-soft。
    """
    try:
        from negentropy.agents.skills_injector import invalidate_global_skills_cache
        from negentropy.config.model_resolver import invalidate_cache

        invalidate_global_skills_cache()
        invalidate_cache(prefix="subagent:")
    except Exception as exc:  # pragma: no cover - 缓存失效兜底
        logger.warning("invalidate_global_skill_caches_failed", error=str(exc))


# =============================================================================
# Skills Phase 2 — invoke / templates endpoints
# =============================================================================


@router.post("/skills/{skill_id}/invoke", response_model=SkillInvokeResponse)
async def invoke_skill(
    skill_id: UUID,
    payload: SkillInvokeRequest,
    user: AuthUser = Depends(get_current_user),
) -> SkillInvokeResponse:
    """渲染 Skill 的 prompt_template（Layer 2 按需展开）+ 资源摘要 + 工具差异。

    服务端用 Jinja2 沙箱渲染 ``prompt_template``，**不**真正调用 LLM —— 调用方
    （UI Preview 按钮 / ``expand_skill`` ADK tool / 外部系统）拿到渲染结果后自行
    决定如何使用。``required_tools`` 与 ``vars`` 校验在此一次完成。
    """
    from negentropy.agents.skills_injector import (
        ResolvedSkill,
        format_skill_invocation,
        format_skill_resources,
        validate_required_tools,
    )

    if not parse_env_bool("NEGENTROPY_SKILLS_LAYER2_ENABLED", True):
        raise HTTPException(status_code=503, detail="Skills Layer 2 is disabled by feature flag")

    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "skill", skill_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        skill = await db.get(Skill, skill_id)
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")
        if not skill.is_enabled:
            raise HTTPException(status_code=409, detail="Skill is disabled")

        resolved = ResolvedSkill(
            id=str(skill.id),
            name=skill.name,
            display_name=skill.display_name,
            description=skill.description,
            prompt_template=skill.prompt_template,
            required_tools=tuple(skill.required_tools or []),
            is_enabled=skill.is_enabled,
            enforcement_mode=getattr(skill, "enforcement_mode", "warning") or "warning",
            resources=tuple(skill.resources or ()) if hasattr(skill, "resources") else (),
        )

    rendered = format_skill_invocation(resolved, variables=payload.variables) or ""
    if not rendered and resolved.resources:
        rendered = format_skill_resources(resolved, eager=True)
    return SkillInvokeResponse(
        skill_id=skill.id,
        name=skill.name,
        rendered_prompt=rendered,
        resources=list(resolved.resources),
        missing_tools=validate_required_tools(resolved, agent_tools=None) if resolved.required_tools else [],
    )
