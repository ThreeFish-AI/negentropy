"""
SubAgent 预设与 ADK 配置序列化。

遵循 AGENTS.md「单一事实源」原则：
- Negentropy 内置 5 个 Faculty SubAgent 的定义直接来源于代码中的 Agent 实例；
- Plugins/SubAgents 页面通过该模块读取可序列化配置，避免手工复制导致漂移。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from google.adk.agents import BaseAgent, LlmAgent, LoopAgent, ParallelAgent, SequentialAgent

from negentropy.agents.faculties import (
    action_agent,
    contemplation_agent,
    influence_agent,
    internalization_agent,
    perception_agent,
)


NEGENTROPY_SUBAGENT_ORDER = [
    perception_agent,
    internalization_agent,
    contemplation_agent,
    action_agent,
    influence_agent,
]

NEGENTROPY_SUBAGENT_NAMES = [agent.name for agent in NEGENTROPY_SUBAGENT_ORDER]


def _callable_name(callback: Any) -> Optional[str]:
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


def _model_name(model: Any) -> Optional[str]:
    if model is None:
        return None
    model_name = getattr(model, "model", None)
    if isinstance(model_name, str) and model_name:
        return model_name
    as_text = str(model)
    return as_text or None


def _to_json_compatible(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _to_json_compatible(v) for k, v in value.items()}
    if isinstance(value, list | tuple | set):
        return [_to_json_compatible(v) for v in value]
    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return _to_json_compatible(model_dump())
    to_dict = getattr(value, "dict", None)
    if callable(to_dict):
        return _to_json_compatible(to_dict())
    return str(value)


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


def serialize_adk_config(agent: BaseAgent) -> Dict[str, Any]:
    """将 ADK Agent 实例序列化为可存储的配置对象。"""
    base: Dict[str, Any] = {
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
                "include_contents": _to_json_compatible(agent.include_contents),
                "disallow_transfer_to_parent": agent.disallow_transfer_to_parent,
                "disallow_transfer_to_peers": agent.disallow_transfer_to_peers,
                "input_schema": _to_json_compatible(agent.input_schema),
                "output_schema": _to_json_compatible(agent.output_schema),
                "generate_content_config": _to_json_compatible(agent.generate_content_config),
                "planner": _to_json_compatible(getattr(agent, "planner", None)),
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


def build_negentropy_subagent_payloads() -> List[Dict[str, Any]]:
    """构建 Negentropy 内置 5 个 Faculty SubAgent 的标准 payload。"""
    payloads: List[Dict[str, Any]] = []
    for agent in NEGENTROPY_SUBAGENT_ORDER:
        adk_config = serialize_adk_config(agent)
        payloads.append(
            {
                "name": agent.name,
                "display_name": agent.name,
                "description": agent.description,
                "agent_type": adk_config["agent_type"],
                "system_prompt": adk_config.get("instruction"),
                "model": adk_config.get("model"),
                "skills": [],
                "tools": adk_config.get("tools", []),
                "is_enabled": True,
                "visibility": "private",
                "adk_config": adk_config,
            }
        )
    return payloads
