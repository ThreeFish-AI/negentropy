"""
Interface Agents API — /interface/agents Agent CRUD/模板同步/排序。

由 api.py 按域机械拆分而来（2026-09 熵减）；行为与路由序保持不变，
契约由 tests/unit_tests/interface/test_route_table_contract.py 锁定。
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError

from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser
from negentropy.config.model_resolver import invalidate_cache as invalidate_model_cache
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.plugin import (
    Agent,
    PluginVisibility,
)

from .permissions import check_plugin_access, check_plugin_ownership, get_visible_plugin_ids

# logger 名沿用拆分前的 "negentropy.interface.api"：日志消费方按名过滤，改名另行评审
logger = get_logger("negentropy.interface.api")
router = APIRouter(prefix="/interface", tags=["interface"])


# =============================================================================
# Agent Models
# =============================================================================


class AgentCreateRequest(BaseModel):
    name: str
    display_name: str | None = None
    description: str | None = None
    agent_type: str
    system_prompt: str | None = None
    model: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    adk_config: dict[str, Any] = Field(default_factory=dict)
    skills: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    is_enabled: bool = True
    visibility: str = "private"


class AgentUpdateRequest(BaseModel):
    name: str | None = None
    display_name: str | None = None
    description: str | None = None
    agent_type: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    config: dict[str, Any] | None = None
    adk_config: dict[str, Any] | None = None
    skills: list[str] | None = None
    tools: list[str] | None = None
    is_enabled: bool | None = None
    visibility: str | None = None
    confirm_builtin_rename: bool | None = False


class AgentReorderItem(BaseModel):
    id: UUID
    sort_order: int


class AgentReorderRequest(BaseModel):
    items: list[AgentReorderItem]


class AgentResponse(BaseModel):
    id: UUID
    owner_id: str
    visibility: str
    name: str
    display_name: str | None = None
    description: str | None = None
    agent_type: str
    system_prompt: str | None = None
    model: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    adk_config: dict[str, Any] = Field(default_factory=dict)
    skills: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    source: str = "user_defined"
    is_builtin: bool = False
    is_enabled: bool
    # `kind` 来源于 ``config.adk_config.kind``：``"root"`` 标记 Negentropy 主 Agent，
    # ``"agent"``（默认）适用于 Faculty 与用户自定义 Agent。前端按此置顶 + Root 徽章。
    kind: str = "agent"
    sort_order: int = 0

    class Config:
        from_attributes = True


class NegentropyAgentTemplateResponse(BaseModel):
    name: str
    display_name: str | None = None
    description: str | None = None
    agent_type: str
    system_prompt: str | None = None
    model: str | None = None
    adk_config: dict[str, Any] = Field(default_factory=dict)
    tools: list[str] = Field(default_factory=list)


class NegentropyAgentSyncResponse(BaseModel):
    created: int
    updated: int
    skipped: int
    agents: list[AgentResponse] = Field(default_factory=list)


# =============================================================================
# Agents Endpoints
# =============================================================================


def _json_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _build_adk_config_from_payload(
    payload: dict[str, Any],
    existing_adk_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """构建 Agent 的 ADK 配置（可回放）。"""
    adk_config: dict[str, Any] = dict(existing_adk_config or {})
    incoming_adk = payload.get("adk_config")
    if isinstance(incoming_adk, dict):
        adk_config.update(incoming_adk)

    # 核心字段始终由结构化列驱动，避免双写漂移
    name = payload.get("name")
    if isinstance(name, str) and name:
        adk_config["name"] = name

    description = payload.get("description")
    if description is None or isinstance(description, str):
        adk_config["description"] = description

    agent_type = payload.get("agent_type")
    if isinstance(agent_type, str) and agent_type:
        adk_config["agent_type"] = agent_type

    system_prompt = payload.get("system_prompt")
    if system_prompt is None or isinstance(system_prompt, str):
        adk_config["instruction"] = system_prompt

    model = payload.get("model")
    if model is None or isinstance(model, str):
        adk_config["model"] = model

    tools = payload.get("tools")
    if isinstance(tools, list):
        adk_config["tools"] = tools

    return adk_config


def _merge_agent_config(
    *,
    current_config: dict[str, Any] | None,
    update_config: dict[str, Any] | None,
    adk_config: dict[str, Any],
    source: str,
) -> dict[str, Any]:
    merged = dict(current_config or {})
    if isinstance(update_config, dict):
        merged.update(update_config)
    merged["adk_config"] = adk_config
    merged["source"] = source
    return merged


def _materialize_agent_payload(
    agent: Agent | None,
    incoming: dict[str, Any],
) -> dict[str, Any]:
    """将数据库对象与变更 payload 合并为完整视图，便于构建 adk_config。"""
    if agent is None:
        base = {
            "name": incoming.get("name"),
            "display_name": incoming.get("display_name"),
            "description": incoming.get("description"),
            "agent_type": incoming.get("agent_type"),
            "system_prompt": incoming.get("system_prompt"),
            "model": incoming.get("model"),
            "config": _json_dict(incoming.get("config")),
            "adk_config": _json_dict(incoming.get("adk_config")),
            "skills": incoming.get("skills") or [],
            "tools": incoming.get("tools") or [],
            "is_enabled": incoming.get("is_enabled", True),
            "visibility": incoming.get("visibility", "private"),
        }
        return base

    config = _json_dict(agent.config)
    base = {
        "name": agent.name,
        "display_name": agent.display_name,
        "description": agent.description,
        "agent_type": agent.agent_type,
        "system_prompt": agent.system_prompt,
        "model": agent.model,
        "config": config,
        "adk_config": _json_dict(config.get("adk_config")),
        "skills": agent.skills or [],
        "tools": agent.tools or [],
        "is_enabled": agent.is_enabled,
        "visibility": agent.visibility.value,
    }
    base.update(incoming)

    if "config" in incoming:
        base["config"] = _json_dict(incoming["config"])
    if "adk_config" in incoming:
        base["adk_config"] = _json_dict(incoming["adk_config"])
    return base


def _resolve_agent_source(config: dict[str, Any]) -> str:
    source = config.get("source")
    if isinstance(source, str) and source:
        return source
    return "user_defined"


def _extract_adk_config(agent: Agent) -> dict[str, Any]:
    config = _json_dict(agent.config)
    adk_config = config.get("adk_config")
    if isinstance(adk_config, dict):
        return adk_config

    # 兼容历史记录：若不存在 adk_config，则由结构化列推导最小可回放配置
    fallback_payload = {
        "name": agent.name,
        "description": agent.description,
        "agent_type": agent.agent_type,
        "system_prompt": agent.system_prompt,
        "model": agent.model,
        "tools": agent.tools or [],
    }
    return _build_adk_config_from_payload(fallback_payload)


@router.get("/agents", response_model=list[AgentResponse])
async def list_agents(user: AuthUser = Depends(get_current_user)) -> list[AgentResponse]:
    """列出用户可见的 Agents"""
    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "agent", user)
        if not visible_ids:
            return []

        stmt = select(Agent).where(Agent.id.in_(visible_ids)).order_by(Agent.sort_order.asc(), Agent.created_at.desc())
        result = await db.execute(stmt)
        agents = result.scalars().all()

    return [_agent_to_response(a) for a in agents]


@router.patch("/agents/reorder", response_model=list[AgentResponse])
async def reorder_agents(
    payload: AgentReorderRequest,
    user: AuthUser = Depends(get_current_user),
) -> list[AgentResponse]:
    """批量更新 Agent 排序序号。前端拖拽后调用，传入所有可见 Agent 的 id + sort_order。"""
    async with AsyncSessionLocal() as db:
        visible_ids = await get_visible_plugin_ids(db, "agent", user)
        if not visible_ids:
            return []

        visible_set = set(visible_ids)
        for item in payload.items:
            if item.id not in visible_set:
                raise HTTPException(status_code=403, detail=f"No edit permission for agent {item.id}")
            agent = await db.get(Agent, item.id)
            if agent:
                agent.sort_order = item.sort_order

        await db.commit()

        # 返回更新后的完整列表
        stmt = select(Agent).where(Agent.id.in_(visible_ids)).order_by(Agent.sort_order.asc(), Agent.created_at.desc())
        result = await db.execute(stmt)
        agents = result.scalars().all()
        return [_agent_to_response(a) for a in agents]


@router.get("/agents/templates/negentropy", response_model=list[NegentropyAgentTemplateResponse])
async def list_negentropy_agent_templates(
    user: AuthUser = Depends(get_current_user),
) -> list[NegentropyAgentTemplateResponse]:
    """返回 Negentropy 内置 5 个 Faculty Agent 模板（来自代码定义）。"""
    _ = user  # 显式依赖鉴权
    from .agent_presets import build_negentropy_agent_payloads

    payloads = build_negentropy_agent_payloads()
    return [
        NegentropyAgentTemplateResponse(
            name=payload["name"],
            display_name=payload.get("display_name"),
            description=payload.get("description"),
            agent_type=payload.get("agent_type", "llm_agent"),
            system_prompt=payload.get("system_prompt"),
            model=payload.get("model"),
            adk_config=payload.get("adk_config", {}),
            tools=payload.get("tools", []),
        )
        for payload in payloads
    ]


@router.post("/agents/sync/negentropy", response_model=NegentropyAgentSyncResponse)
async def sync_negentropy_agents(
    user: AuthUser = Depends(get_current_user),
) -> NegentropyAgentSyncResponse:
    """
    将代码中的 **主 Agent (NegentropyEngine) + 5 个 Faculty Agent** 同步到插件表。

    幂等语义：
    - 已存在且归属当前用户：更新为最新代码定义；
    - 已存在但归属其他用户：跳过；
    - 不存在：创建。

    Sync 完成后批量失效 ``subagent:`` 前缀缓存，使 ``DynamicRootLiteLlm`` /
    ``DynamicSubagentLiteLlm`` 与 ``InstructionProvider`` 立即看到 DB 最新值。
    """
    from .agent_presets import build_negentropy_agent_payloads

    payloads = build_negentropy_agent_payloads()
    created_count = 0
    updated_count = 0
    skipped_count = 0
    touched_agents: list[Agent] = []

    async with AsyncSessionLocal() as db:
        for payload in payloads:
            existing = await db.scalar(select(Agent).where(Agent.name == payload["name"]))
            materialized = _materialize_agent_payload(existing, payload)
            adk_config = _build_adk_config_from_payload(
                materialized,
                existing_adk_config=_json_dict(materialized.get("adk_config")),
            )
            merged_config = _merge_agent_config(
                current_config=_json_dict(existing.config) if existing else None,
                update_config=_json_dict(materialized.get("config")),
                adk_config=adk_config,
                source="negentropy_builtin",
            )

            if existing:
                if existing.owner_id != user.user_id:
                    skipped_count += 1
                    continue

                existing.display_name = materialized.get("display_name")
                existing.description = materialized.get("description")
                existing.agent_type = materialized.get("agent_type")
                existing.system_prompt = materialized.get("system_prompt")
                existing.model = materialized.get("model")
                existing.config = merged_config
                existing.skills = materialized.get("skills") or []
                existing.tools = materialized.get("tools") or []
                existing.is_enabled = bool(materialized.get("is_enabled", True))
                existing.visibility = PluginVisibility(materialized.get("visibility", "private"))
                # 与迁移 0033 的回填语义对齐：经 negentropy 内置同步的 Agent 都是系统内置。
                existing.is_system = True
                updated_count += 1
                touched_agents.append(existing)
                continue

            new_agent = Agent(
                owner_id=user.user_id,
                visibility=PluginVisibility(materialized.get("visibility", "private")),
                name=materialized["name"],
                display_name=materialized.get("display_name"),
                description=materialized.get("description"),
                agent_type=materialized.get("agent_type", "llm_agent"),
                system_prompt=materialized.get("system_prompt"),
                model=materialized.get("model"),
                config=merged_config,
                skills=materialized.get("skills") or [],
                tools=materialized.get("tools") or [],
                is_enabled=bool(materialized.get("is_enabled", True)),
                is_system=True,
            )
            db.add(new_agent)
            created_count += 1
            touched_agents.append(new_agent)

        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(status_code=409, detail=f"Agent sync conflict: {exc}") from exc

        for agent in touched_agents:
            await db.refresh(agent)

    # 批量失效，让运行时 model + instruction 立即看到 Sync 后的 DB 值。
    # NB: ``subagent:`` 是 model_resolver 内部缓存键前缀（运行时 ADK 模型/指令解析层），
    # 与此处失效调用构成跨模块契约；二者须保持一致，故刻意保留旧前缀字面量。
    invalidate_model_cache(prefix="subagent:")

    return NegentropyAgentSyncResponse(
        created=created_count,
        updated=updated_count,
        skipped=skipped_count,
        agents=[_agent_to_response(agent) for agent in touched_agents],
    )


@router.post("/agents", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    payload: AgentCreateRequest,
    user: AuthUser = Depends(get_current_user),
) -> AgentResponse:
    """创建新的 Agent"""
    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(Agent).where(Agent.name == payload.name))
        if existing:
            raise HTTPException(status_code=400, detail="Agent name already exists")

        incoming = payload.model_dump()
        materialized = _materialize_agent_payload(None, incoming)
        adk_config = _build_adk_config_from_payload(
            materialized,
            existing_adk_config=_json_dict(materialized.get("adk_config")),
        )
        source = _resolve_agent_source(_json_dict(materialized.get("config")))
        merged_config = _merge_agent_config(
            current_config=None,
            update_config=_json_dict(materialized.get("config")),
            adk_config=adk_config,
            source=source,
        )

        agent = Agent(
            owner_id=user.user_id,
            visibility=PluginVisibility(payload.visibility),
            name=payload.name,
            display_name=materialized.get("display_name"),
            description=materialized.get("description"),
            agent_type=materialized.get("agent_type", "llm_agent"),
            system_prompt=materialized.get("system_prompt"),
            model=materialized.get("model"),
            config=merged_config,
            skills=materialized.get("skills") or [],
            tools=materialized.get("tools") or [],
            is_enabled=bool(materialized.get("is_enabled", True)),
        )
        db.add(agent)
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(status_code=409, detail=f"Agent create conflict: {exc}") from exc
        await db.refresh(agent)

    return _agent_to_response(agent)


@router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> AgentResponse:
    """获取 Agent 详情"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "agent", agent_id, user, "view")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        agent = await db.get(Agent, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
    return _agent_to_response(agent)


@router.patch("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: UUID,
    payload: AgentUpdateRequest,
    user: AuthUser = Depends(get_current_user),
) -> AgentResponse:
    """更新 Agent"""
    async with AsyncSessionLocal() as db:
        has_access, error = await check_plugin_access(db, "agent", agent_id, user, "edit")
        if not has_access:
            raise HTTPException(status_code=403, detail=error)

        agent = await db.get(Agent, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        original_name = agent.name
        incoming = payload.model_dump(exclude_unset=True)
        confirm_builtin_rename = bool(incoming.pop("confirm_builtin_rename", False))

        if "name" in incoming:
            new_name = str(incoming["name"] or "").strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="Agent name cannot be empty")
            if new_name != agent.name:
                current_source = _resolve_agent_source(_json_dict(agent.config))
                if current_source == "negentropy_builtin" and not confirm_builtin_rename:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Renaming a Negentropy built-in Agent may cause sync to create "
                            "a duplicate. Set confirm_builtin_rename=true to continue."
                        ),
                    )
                existing = await db.scalar(select(Agent).where(and_(Agent.name == new_name, Agent.id != agent_id)))
                if existing:
                    raise HTTPException(status_code=400, detail="Agent name already exists")
            incoming["name"] = new_name

        materialized = _materialize_agent_payload(agent, incoming)
        adk_config = _build_adk_config_from_payload(
            materialized,
            existing_adk_config=_json_dict(materialized.get("adk_config")),
        )
        source = _resolve_agent_source(_json_dict(materialized.get("config")))
        merged_config = _merge_agent_config(
            current_config=_json_dict(agent.config),
            update_config=_json_dict(materialized.get("config")),
            adk_config=adk_config,
            source=source,
        )

        if "name" in incoming:
            agent.name = materialized.get("name", agent.name)
        if "display_name" in incoming:
            agent.display_name = materialized.get("display_name")
        if "description" in incoming:
            agent.description = materialized.get("description")
        if "agent_type" in incoming:
            agent.agent_type = materialized.get("agent_type", agent.agent_type)
        if "system_prompt" in incoming:
            agent.system_prompt = materialized.get("system_prompt")
        if "model" in incoming:
            agent.model = materialized.get("model")
        if "skills" in incoming:
            agent.skills = materialized.get("skills") or []
        if "tools" in incoming:
            agent.tools = materialized.get("tools") or []
        if "is_enabled" in incoming:
            agent.is_enabled = bool(materialized.get("is_enabled"))
        if "visibility" in incoming:
            agent.visibility = PluginVisibility(str(materialized.get("visibility")))
        agent.config = merged_config

        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(status_code=409, detail=f"Agent update conflict: {exc}") from exc
        await db.refresh(agent)

    invalidate_model_cache(prefix=f"subagent:{original_name}")
    if agent.name != original_name:
        invalidate_model_cache(prefix=f"subagent:{agent.name}")
    return _agent_to_response(agent)


@router.delete("/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    user: AuthUser = Depends(get_current_user),
) -> None:
    """删除 Agent（仅 owner 可删除）"""
    async with AsyncSessionLocal() as db:
        is_owner, error = await check_plugin_ownership(db, "agent", agent_id, user)
        if not is_owner:
            raise HTTPException(status_code=403, detail=error)

        agent = await db.get(Agent, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        deleted_name = agent.name
        await db.delete(agent)
        await db.commit()

    invalidate_model_cache(prefix=f"subagent:{deleted_name}")


def _agent_to_response(agent: Agent) -> AgentResponse:
    config = _json_dict(agent.config)
    source = _resolve_agent_source(config)
    adk_config = _extract_adk_config(agent)
    raw_kind = adk_config.get("kind") if isinstance(adk_config, dict) else None
    # 读时归一：root 行保持 "root"；其余（含历史值 "subagent"、新值 "agent" 及缺失）
    # 一律归一为 "agent"，使未跑迁移 0044 的历史行也能安全对外暴露。
    kind = "root" if raw_kind == "root" else "agent"
    # is_builtin OR 合并：显式 ``is_system`` 列（迁移 0033 起）+ 历史 config.source 标记。
    # 迁移 0033 已将 ``config.source == "negentropy_builtin"`` 行回填 is_system=TRUE，
    # 这里保留 OR 兼容仍未跑迁移的部署，下一个 release 周期可下线 config.source 判断。
    is_builtin = bool(getattr(agent, "is_system", False)) or source == "negentropy_builtin"
    return AgentResponse(
        id=agent.id,
        owner_id=agent.owner_id,
        visibility=agent.visibility.value,
        name=agent.name,
        display_name=agent.display_name,
        description=agent.description,
        agent_type=agent.agent_type,
        system_prompt=agent.system_prompt,
        model=agent.model,
        config=config,
        adk_config=adk_config,
        skills=agent.skills or [],
        tools=agent.tools or [],
        source=source,
        is_builtin=is_builtin,
        is_enabled=agent.is_enabled,
        kind=kind,
        sort_order=getattr(agent, "sort_order", 0),
    )
