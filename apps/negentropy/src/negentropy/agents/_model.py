"""
LLM 模型工厂 — 单一事实源 (Single Source of Truth)

集中管理 LiteLlm 实例的构造逻辑，基于 DB model_configs 配置。

工厂族：
- ``create_root_model()``：根 Agent 专用，返回支持 ContextVar 切换的
  ``DynamicRootLiteLlm``；由 Home 选择器驱动。
- ``create_subagent_model(agent_name=...)``：SubAgent 专用；传入 ``agent_name``
  时返回 ``DynamicSubagentLiteLlm``，运行时按 ``sub_agents.model`` 切换；
  不传则回退静态 ``LiteLlm`` 以兼容其它调用方。
- ``create_model()``：历史工厂，保留为静态 ``LiteLlm``（向后兼容）。

遵循 AGENTS.md 的「复用驱动」与「单一事实源」原则。
"""

from __future__ import annotations

from typing import Any

from google.adk.models.lite_llm import LiteLlm

from ._dynamic_model import DynamicRootLiteLlm, DynamicSubagentLiteLlm


def _get_default_llm_spec() -> tuple[str, dict[str, Any]]:
    """优先取缓存的 DB 配置，否则回退硬编码默认值。"""
    from negentropy.config.model_resolver import get_cached_llm_config, get_fallback_llm_config

    cached = get_cached_llm_config()
    if cached:
        return cached
    return get_fallback_llm_config()


def create_model() -> LiteLlm:
    """创建静态 LiteLlm 实例（向后兼容）。

    优先使用缓存的 DB 默认配置，回退到硬编码默认值。
    缓存由 engine/bootstrap.py 的 startup 事件预热。
    """
    name, kwargs = _get_default_llm_spec()
    return LiteLlm(name, **kwargs)


def create_root_model() -> DynamicRootLiteLlm:
    """创建根 Agent 专用的动态 LiteLlm。

    默认模型来源于 ``_get_default_llm_spec()``；运行期若
    ``ContextVar selected_root_llm`` 被 ``before_model_callback`` 置位，则以
    该值覆盖单轮 ``self.model`` / ``self._additional_args``。
    """
    name, kwargs = _get_default_llm_spec()
    return DynamicRootLiteLlm(name, **kwargs)


def create_subagent_model(agent_name: str | None = None) -> LiteLlm:
    """创建 SubAgent LiteLlm。

    Args:
        agent_name: 对应 ``sub_agents.name`` 字段值。提供时返回支持运行时
            按 DB ``model`` 字段切换的 ``DynamicSubagentLiteLlm``；否则回退
            静态 ``LiteLlm``。

    运行时：每轮请求先查 ``sub_agents.name == agent_name`` 的 ``model`` 字段；
    命中 → 用其 ``vendor/model_name`` 覆盖当轮；空/未命中 → 走构造时默认。
    """
    name, kwargs = _get_default_llm_spec()
    if agent_name:
        return DynamicSubagentLiteLlm(name, agent_name=agent_name, **kwargs)
    return LiteLlm(name, **kwargs)
