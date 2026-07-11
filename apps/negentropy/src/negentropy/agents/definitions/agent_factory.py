"""Agent 工厂 —— 从 DB 声明式规格（kind=agent）构造 ADK agent 图。

背景（Phase 4）：
- 内置 Agent 的**活定义**本就在 ``agents`` 表（adk_config + AgentFormDrawer + agents:sync +
  model/instruction 运行时 DB 驱动）。本模块是「graph-from-DB」机制：读 ``definitions(kind=agent)``
  的声明式规格（agent_type / sub_agents[] / kind 等），用**现有 ``create_*`` 工厂**构造各节点
  （节点内部 tools/callbacks/model/instruction 仍由代码布线，避免重写），按 DB 的 sub_agents
  拓扑组装 agent 图。

开关（default-on，完整启用）：
- ``NE_AGENTS_FROM_DB`` **默认开启**（未设 / 空值即视为开启）；仅显式设为
  ``0`` / ``false`` / ``no`` / ``off`` 才关闭（逃生开关，回退代码 ``root_agent``）。
- live 引擎 bootstrap 已接线本工厂（``_negentropy_lifespan`` 启动时构造 DB root 并安装
  进程级覆盖）；DB 构造 root 与代码 root 经 ``test_agent_factory`` 断言**逐节点行为等价**。
- 任何异常（DB 不可达、规格缺失、工厂未注册）→ 返回 None（代码兜底，永不阻断）。

同时向 Definition Registry 注册 ``agent`` 的校验器/元信息提取器（表单保存时校验：必须含 name
与 agent_type）。
"""

from __future__ import annotations

import os
from typing import Any

from google.adk.agents import BaseAgent, LlmAgent

from negentropy.agents.definitions import (
    DefinitionParseError,
    register_meta_extractor,
    register_validator,
)
from negentropy.logging import get_logger

_logger = get_logger("negentropy.agents.definitions.agent_factory")

_KIND = "agent"

_FALSY = {"0", "false", "no", "off"}


def _agents_from_db_enabled() -> bool:
    """default-on：未设 / 空值即开启；仅显式 falsy 值（0/false/no/off）关闭（逃生开关）。"""
    return os.environ.get("NE_AGENTS_FROM_DB", "").strip().lower() not in _FALSY


# ── Definition Registry 适配器 ────────────────────────────────────────


def _validate(raw: Any, source: str) -> None:
    """声明式规格必须含 ``name`` 与 ``agent_type``（llm_agent / sequential_agent / ...）。"""
    if not isinstance(raw, dict):
        raise DefinitionParseError("Agent 规格源顶层必须是 mapping")
    if not str(raw.get("name") or "").strip():
        raise DefinitionParseError("Agent 规格缺少必填字段: name")
    if not str(raw.get("agent_type") or "").strip():
        raise DefinitionParseError("Agent 规格缺少必填字段: agent_type")


def _meta(raw: Any, body: str) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    return {k: raw[k] for k in ("name", "agent_type", "kind", "model") if k in raw}


register_validator(_KIND, _validate)
register_meta_extractor(_KIND, _meta)


# ── 节点工厂注册表 ──────────────────────────────────────────────────
# name → 零参工厂（每次返回新实例）。节点内部（tools/callbacks/model/instruction）由代码布线，
# 本工厂仅按 DB 拓扑组装。延迟填充以避免 import 期触发完整 agent 栈构造。
_AGENT_FACTORIES: dict[str, Any] = {}


def _ensure_factories_loaded() -> None:
    if _AGENT_FACTORIES:
        return
    from negentropy.agents.faculties.action import create_action_agent
    from negentropy.agents.faculties.contemplation import create_contemplation_agent
    from negentropy.agents.faculties.influence import create_influence_agent
    from negentropy.agents.faculties.internalization import create_internalization_agent
    from negentropy.agents.faculties.perception import create_perception_agent
    from negentropy.agents.pipelines.standard import (
        create_knowledge_acquisition_pipeline,
        create_problem_solving_pipeline,
        create_value_delivery_pipeline,
    )

    _AGENT_FACTORIES.update(
        {
            "PerceptionFaculty": create_perception_agent,
            "InternalizationFaculty": create_internalization_agent,
            "ContemplationFaculty": create_contemplation_agent,
            "ActionFaculty": create_action_agent,
            "InfluenceFaculty": create_influence_agent,
            "KnowledgeAcquisitionPipeline": create_knowledge_acquisition_pipeline,
            "ProblemSolvingPipeline": create_problem_solving_pipeline,
            "ValueDeliveryPipeline": create_value_delivery_pipeline,
        }
    )


async def _fetch_agent_specs() -> list[dict[str, Any]]:
    """读 DB 中启用的 agent 定义源，返回 YAML 解析后的规格列表。"""
    import yaml
    from sqlalchemy import select

    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.definition import Definition

    out: list[dict[str, Any]] = []
    async with AsyncSessionLocal() as db:
        rows = (
            (
                await db.execute(
                    select(Definition)
                    .where(Definition.kind == _KIND, Definition.is_enabled.is_(True))
                    .order_by(Definition.sort_order, Definition.key)
                )
            )
            .scalars()
            .all()
        )
    for row in rows:
        try:
            spec = yaml.safe_load(row.source)
        except yaml.YAMLError as exc:
            _logger.warning("agent_spec_yaml_error", key=row.key, error=str(exc))
            continue
        if isinstance(spec, dict) and spec.get("name"):
            out.append(spec)
    return out


def _build_node(spec: dict[str, Any]) -> BaseAgent | None:
    """按规格 name 查工厂构造节点；未注册 → None（调用方降级）。

    透传 DB 规格里工厂支持的构造参数（``mode`` / ``output_key``），确保 DB 构造的
    顶层 faculty 与代码单例**行为等价**（代码单例以 ``mode="single_turn"`` 构造，若丢弃
    该参数会静默降级为 ADK 默认 ``chat``，改变调度语义）。参数经 ``inspect`` 与工厂签名
    取交集后按 kwargs 传入，故零参工厂（pipelines）不受影响。
    """
    import inspect

    _ensure_factories_loaded()
    name = str(spec.get("name") or "").strip()
    factory = _AGENT_FACTORIES.get(name)
    if factory is None:
        _logger.warning("agent_factory_not_registered", name=name)
        return None

    try:
        accepted = set(inspect.signature(factory).parameters)
    except (TypeError, ValueError):  # pragma: no cover — 内建/不可 introspect
        accepted = set()
    kwargs: dict[str, Any] = {}
    for param in ("mode", "output_key"):
        if param in accepted and spec.get(param) is not None:
            kwargs[param] = spec[param]
    return factory(**kwargs)


async def build_nodes_from_db() -> dict[str, BaseAgent] | None:
    """从 DB 规格构造所有 faculty/pipeline 节点。flag-off 或任何失败 → None（代码兜底）。"""
    if not _agents_from_db_enabled():
        return None
    try:
        specs = await _fetch_agent_specs()
        if not specs:
            return None
        _ensure_factories_loaded()
        nodes: dict[str, BaseAgent] = {}
        for spec in specs:
            if spec.get("kind") == "root":
                continue  # root 由 _assemble_root 单独处理
            node = _build_node(spec)
            if node is not None:
                nodes[str(spec["name"])] = node
        return nodes or None
    except Exception:
        _logger.warning("build_nodes_from_db_failed", exc_info=True)
        return None


async def build_root_agent_from_db() -> BaseAgent | None:
    """从 DB 规格组装 root agent（节点经代码工厂构造，sub_agents 拓扑来自 DB）。

    flag-off / DB 缺失 / root 规格缺失 / 任何异常 → 返回 None，调用方回退到代码 ``root_agent``。

    .. note::
       live 引擎 bootstrap（``_negentropy_lifespan``）已接线本函数：default-on 时启动构造
       DB root 并安装进程级覆盖。DB root 与代码 root 经 ``test_agent_factory`` 断言逐节点
       行为等价，故完整启用零行为漂移；异常路径代码兜底，永不阻断。
    """
    if not _agents_from_db_enabled():
        return None
    try:
        nodes = await build_nodes_from_db()
        if not nodes:
            return None
        specs = await _fetch_agent_specs()
        root_spec = next((s for s in specs if s.get("kind") == "root"), None)
        if root_spec is None:
            _logger.warning("agent_root_spec_missing_in_db")
            return None
        return _assemble_root(root_spec, nodes)
    except Exception:
        _logger.warning("build_root_agent_from_db_failed", exc_info=True)
        return None


async def refresh_root_override() -> bool:
    """agent 定义变更后重建 DB root 覆盖 + 失效 runner 缓存（flag-on 才生效）。

    供 ``definitions_api`` 在 create/update/delete ``kind=agent`` 后 fire-and-forget 调用，
    使 UI 编辑即时生效，无需重启。flag-off / 构造失败 → 清除覆盖回退代码 root（fail-soft）。

    Returns: True 表示成功安装了新的 DB 覆盖；False 表示已回退代码 root。
    """
    from negentropy.agents._root_override import clear_root_override, set_root_override

    if not _agents_from_db_enabled():
        return False
    try:
        db_root = await build_root_agent_from_db()
    except Exception:  # pragma: no cover — fail-soft
        _logger.warning("refresh_root_override_build_failed", exc_info=True)
        db_root = None

    # 失效 runner 单例缓存，使下次 get_runner() 拾取新覆盖 / 回退。
    try:
        from negentropy.engine.factories.runner import reset_runner

        reset_runner()
    except Exception:  # pragma: no cover — best-effort
        _logger.warning("refresh_root_override_reset_runner_failed", exc_info=True)

    if db_root is not None:
        set_root_override(db_root)
        return True
    clear_root_override()
    return False


def _assemble_root(root_spec: dict[str, Any], nodes: dict[str, BaseAgent]) -> BaseAgent:
    """用代码 ``root_agent`` 的内部布线 + DB ``sub_agents`` 拓扑构造新 root。

    复用代码 root 的 model/instruction/tools/callbacks（保证节点内部一致），仅 sub_agents
    按 DB 规格解析为已构造节点；不修改代码 ``root_agent`` 单例。

    tools 去重不变量：ADK 在 ``LlmAgent.__init__`` 会把 ``sub_agents`` 自动派生为
    ``transfer_to_agent`` 工具追加进 ``.tools``，故 ``_code_root.tools`` 已含 5 个 faculty
    transfer 工具。此处必须**剔除这些 sub-agent 同名工具**、只保留原始工具（log_activity /
    preload_memory），否则连同新 sub_agents 二次派生会导致 faculty 工具重复（曾致 root.tools
    出现 12 项、每 faculty 两遍）。以「工具名 ∈ 全部 sub-agent 名集合」为判据过滤。
    """
    from negentropy.agents.agent import root_agent as _code_root

    sub_names = root_spec.get("sub_agents") or []
    sub_agents = [nodes[n] for n in sub_names if n in nodes]

    # 全部可能的 sub-agent 名（含 DB 拓扑 + 代码 root 现有 sub_agents），用于剔除 transfer 工具。
    transfer_names = set(sub_names) | {s.name for s in (_code_root.sub_agents or [])}
    raw_tools = [
        t for t in (_code_root.tools or []) if getattr(t, "name", getattr(t, "__name__", "")) not in transfer_names
    ]

    return LlmAgent(
        name=_code_root.name,
        model=_code_root.model,
        instruction=_code_root.instruction,
        description=_code_root.description,
        tools=raw_tools,  # 仅原始工具；faculty transfer 由 ADK 从 sub_agents 自动派生
        before_model_callback=_code_root.before_model_callback,
        before_tool_callback=_code_root.before_tool_callback,
        after_tool_callback=_code_root.after_tool_callback,
        sub_agents=sub_agents,
    )
