"""
SubAgent 预设与 ADK 配置序列化。

遵循 AGENTS.md「单一事实源」原则：
- Negentropy 内置主 Agent (NegentropyEngine) 与 5 个 Faculty SubAgent 的定义直接来源于代码中的 Agent 实例；
- Plugins/SubAgents 页面通过该模块读取可序列化配置，避免手工复制导致漂移；
- 主 / 子区分通过 ``adk_config["kind"]`` (``"root"`` / ``"subagent"``) 写入 JSONB，避免 schema 迁移。
"""

from __future__ import annotations

from typing import Any

from google.adk.agents import BaseAgent, LlmAgent, LoopAgent, ParallelAgent, SequentialAgent

from negentropy.agents.agent import root_agent
from negentropy.agents.faculties import (
    action_agent,
    contemplation_agent,
    influence_agent,
    internalization_agent,
    perception_agent,
)
from negentropy.model_names import canonicalize_model_name
from negentropy.serialization import to_json_compatible

# 主 Agent 单例：仅一个。
NEGENTROPY_ROOT_AGENT = root_agent

# 子 Agent 顺序（不含 root）。
NEGENTROPY_SUBAGENT_ORDER = [
    perception_agent,
    internalization_agent,
    contemplation_agent,
    action_agent,
    influence_agent,
]

# 主 + 子 Agent 名字列表，供路由/缓存按 name 索引使用。
NEGENTROPY_SUBAGENT_NAMES = [
    NEGENTROPY_ROOT_AGENT.name,
    *[agent.name for agent in NEGENTROPY_SUBAGENT_ORDER],
]

# `config.adk_config.kind` 取值：root | subagent
KIND_ROOT = "root"
KIND_SUBAGENT = "subagent"


def _callable_name(callback: Any) -> str | None:
    if callback is None:
        return None
    if isinstance(callback, str):
        return callback
    name = getattr(callback, "__name__", None)
    if isinstance(name, str) and name:
        return name
    attr_name = getattr(callback, "name", None)
    if isinstance(attr_name, str) and attr_name:
        return attr_name
    return callback.__class__.__name__


def _tool_name(tool: Any) -> str:
    name = getattr(tool, "name", None)
    if isinstance(name, str) and name:
        return name
    func_name = getattr(tool, "__name__", None)
    if isinstance(func_name, str) and func_name:
        return func_name
    return tool.__class__.__name__


def _model_name(model: Any) -> str | None:
    if model is None:
        return None
    model_name = getattr(model, "model", None)
    if isinstance(model_name, str) and model_name:
        return canonicalize_model_name(model_name)
    as_text = str(model)
    return canonicalize_model_name(as_text) or None


def _agent_type(agent: BaseAgent) -> str:
    if isinstance(agent, LlmAgent):
        return "llm_agent"
    if isinstance(agent, SequentialAgent):
        return "sequential_agent"
    if isinstance(agent, ParallelAgent):
        return "parallel_agent"
    if isinstance(agent, LoopAgent):
        return "loop_agent"
    return "custom_agent"


def serialize_adk_config(agent: BaseAgent) -> dict[str, Any]:
    """将 ADK Agent 实例序列化为可存储的配置对象。"""
    base: dict[str, Any] = {
        "agent_type": _agent_type(agent),
        "agent_class": agent.__class__.__name__,
        "name": agent.name,
        "description": agent.description,
        "before_agent_callback": _callable_name(getattr(agent, "before_agent_callback", None)),
        "after_agent_callback": _callable_name(getattr(agent, "after_agent_callback", None)),
        "sub_agents": [sub.name for sub in (getattr(agent, "sub_agents", None) or [])],
    }

    if isinstance(agent, LlmAgent):
        base.update(
            {
                "instruction": agent.instruction,
                "model": _model_name(agent.model),
                "tools": [_tool_name(tool) for tool in (agent.tools or [])],
                "output_key": agent.output_key,
                "include_contents": to_json_compatible(agent.include_contents),
                "disallow_transfer_to_parent": agent.disallow_transfer_to_parent,
                "disallow_transfer_to_peers": agent.disallow_transfer_to_peers,
                "input_schema": to_json_compatible(agent.input_schema),
                "output_schema": to_json_compatible(agent.output_schema),
                "generate_content_config": to_json_compatible(agent.generate_content_config),
                "planner": to_json_compatible(getattr(agent, "planner", None)),
                "before_model_callback": _callable_name(getattr(agent, "before_model_callback", None)),
                "after_model_callback": _callable_name(getattr(agent, "after_model_callback", None)),
                "before_tool_callback": _callable_name(getattr(agent, "before_tool_callback", None)),
                "after_tool_callback": _callable_name(getattr(agent, "after_tool_callback", None)),
                "on_model_error_callback": _callable_name(getattr(agent, "on_model_error_callback", None)),
                "on_tool_error_callback": _callable_name(getattr(agent, "on_tool_error_callback", None)),
            }
        )
    elif isinstance(agent, LoopAgent):
        base["max_iterations"] = agent.max_iterations

    return base


def _build_payload(agent: BaseAgent, *, kind: str) -> dict[str, Any]:
    """统一的 Agent 序列化路径：写入 ``adk_config.kind`` 区分 root / subagent。

    ``instruction`` 字段在 ADK 中可为 ``str`` 或 ``InstructionProvider``（见
    ``LlmAgent.instruction``）。当 Agent 接入 InstructionProvider 时，``adk_config["instruction"]``
    会是 callable 对象 — 其值不可直接落库；此处统一从 ``_INSTRUCTION_FALLBACKS`` 取
    硬编码 fallback 文本作为 ``system_prompt`` 的初始值，确保 Sync 出的 DB 行始终带有可读
    instruction（用户在 UI 编辑后即生效，由运行时 ``InstructionProvider`` 读 DB）。
    """
    adk_config = serialize_adk_config(agent)
    adk_config["kind"] = kind

    instruction_value = adk_config.get("instruction")
    if isinstance(instruction_value, str):
        system_prompt = instruction_value
    else:
        # P2.2 起 instruction 可能是 InstructionProvider；用模块级 fallback 文本兜底。
        system_prompt = _INSTRUCTION_FALLBACKS.get(agent.name)
        # adk_config 里的 callable 对 JSONB 不友好，写回为 fallback 文本以保持可观测性。
        adk_config["instruction"] = system_prompt

    return {
        "name": agent.name,
        "display_name": agent.name,
        "description": agent.description,
        "agent_type": adk_config["agent_type"],
        "system_prompt": system_prompt,
        "model": adk_config.get("model"),
        "skills": [],
        "tools": adk_config.get("tools", []),
        "is_enabled": True,
        "visibility": "private",
        "adk_config": adk_config,
    }


def build_negentropy_root_agent_payload() -> dict[str, Any]:
    """构建 Negentropy 主 Agent (``NegentropyEngine``) 的标准 payload。

    `adk_config.kind="root"`；其余字段与子 Agent 同构，便于复用 SubAgent CRUD/UI。
    """
    return _build_payload(NEGENTROPY_ROOT_AGENT, kind=KIND_ROOT)


def build_negentropy_subagent_payloads() -> list[dict[str, Any]]:
    """构建 Negentropy 内置 **主 Agent + 5 个 Faculty SubAgent** 的标准 payload 列表。

    顺序：root 在首项，便于 UI 列表保持「Root 置顶」语义。
    """
    payloads: list[dict[str, Any]] = [build_negentropy_root_agent_payload()]
    for agent in NEGENTROPY_SUBAGENT_ORDER:
        payloads.append(_build_payload(agent, kind=KIND_SUBAGENT))
    return payloads


# Instruction 文本 fallback：当 Agent.instruction 为 InstructionProvider 时使用。
# 通过延迟 import 在模块加载尾部填充，避免 ADK Agent 实例对模块级常量的导入顺序耦合。
_INSTRUCTION_FALLBACKS: dict[str, str] = {}


def _populate_instruction_fallbacks() -> None:
    """填充 _INSTRUCTION_FALLBACKS — 模块尾部调用一次。

    主 Agent / 子 Agent 的 instruction 在 P2.2 起会通过 InstructionProvider 暴露；
    本模块需要 instructionplaintext 写入 DB，故从 ``agents/`` 模块的私有常量回取。
    """
    from negentropy.agents.agent import _ROOT_INSTRUCTION
    from negentropy.agents.faculties.action import _INSTRUCTION as _ACTION_INSTRUCTION
    from negentropy.agents.faculties.contemplation import (
        _INSTRUCTION as _CONTEMPLATION_INSTRUCTION,
    )
    from negentropy.agents.faculties.influence import _INSTRUCTION as _INFLUENCE_INSTRUCTION
    from negentropy.agents.faculties.internalization import (
        _INSTRUCTION as _INTERNALIZATION_INSTRUCTION,
    )
    from negentropy.agents.faculties.perception import (
        _INSTRUCTION as _PERCEPTION_INSTRUCTION,
    )

    _INSTRUCTION_FALLBACKS.update(
        {
            NEGENTROPY_ROOT_AGENT.name: _ROOT_INSTRUCTION,
            perception_agent.name: _PERCEPTION_INSTRUCTION,
            internalization_agent.name: _INTERNALIZATION_INSTRUCTION,
            contemplation_agent.name: _CONTEMPLATION_INSTRUCTION,
            action_agent.name: _ACTION_INSTRUCTION,
            influence_agent.name: _INFLUENCE_INSTRUCTION,
        }
    )


_populate_instruction_fallbacks()
