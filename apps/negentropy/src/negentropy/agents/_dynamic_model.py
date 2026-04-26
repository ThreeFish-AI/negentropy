"""
动态 LiteLlm 实现 — 运行时按上下文/SubAgent 名切换模型。

设计目标：
- Root Agent（主 Negentropy Agent）支持按 Thread/Session 粒度切换 LLM：
  Home 端选择的 `vendor/model_name` 经 `forwardedProps.selected_llm_model`
  → `state_delta.selected_llm_model` → ADK session.state → `before_model_callback`
  → `ContextVar` → `DynamicRootLiteLlm.generate_content_async()` 中生效。
- 每个 SubAgent（五大 Faculty）支持按 `sub_agents.name` 读取用户在
  `/interface/subagents` 页 UI 配置的 `model` 字段；命中用其 LLM，未命中回退默认。

架构要点：
- 复用 `LiteLlm` 基座（pydantic BaseModel）；通过 `object.__setattr__` 规避字段校验；
- `asyncio.Lock` 串行化 swap→call→restore，避免单实例并发污染；
- 解析失败/空值 → 直接 super（默认 LLM），永不阻塞请求。
"""

from __future__ import annotations

import asyncio
from contextvars import ContextVar
from typing import Any

from google.adk.models.lite_llm import LiteLlm

from negentropy.config.model_resolver import (
    resolve_llm_config_by_model_name,
    resolve_subagent_model_name,
)
from negentropy.logging import get_logger

_logger = get_logger("negentropy.agents.dynamic_model")

# ContextVar：当前请求链路中 root Agent 期望使用的模型 ID（`vendor/model_name`）。
# 来源：root_agent.before_model_callback 从 callback_context.state 读取并置入。
_selected_root_llm: ContextVar[str | None] = ContextVar("selected_root_llm", default=None)


def set_selected_root_llm(value: str | None) -> None:
    """将 Home 选择的 `vendor/model_name` 置入 ContextVar；None / 空串清空。"""
    _selected_root_llm.set((value or None) if isinstance(value, str) else None)


def get_selected_root_llm() -> str | None:
    """读取当前 ContextVar；主要供调试/单测使用。"""
    return _selected_root_llm.get()


class _DynamicLiteLlm(LiteLlm):
    """动态 LiteLlm 基座：子类实现 `_resolve_override` 提供每轮覆盖配置。

    每次 `generate_content_async` 调用前：
    1. 调用 `_resolve_override()` 拿到 `(vendor/model_name, litellm_kwargs)` 或 `None`；
    2. 命中 → 以 `object.__setattr__` 替换 `self.model` / `self._additional_args`，
       调用父类 `generate_content_async`；`finally` 还原。
    3. 未命中 → 直接调用父类（走构造时的默认配置）。
    """

    async def _resolve_override(self) -> tuple[str, dict[str, Any]] | None:
        """子类实现：返回 `(model_name, kwargs)` 表示本轮覆盖；返回 `None` 表示沿用默认。"""
        return None

    async def generate_content_async(self, llm_request, stream=False):  # type: ignore[override]
        override = None
        try:
            override = await self._resolve_override()
        except Exception:  # pragma: no cover - 防御性兜底
            _logger.warning("dynamic_litellm_resolve_failed", exc_info=True)

        if override is None:
            async for resp in super().generate_content_async(llm_request, stream=stream):
                yield resp
            return

        new_model, new_kwargs = override
        if not new_model:
            async for resp in super().generate_content_async(llm_request, stream=stream):
                yield resp
            return

        lock = self._get_swap_lock()
        orig_model = self.model
        orig_args = self._additional_args

        async with lock:
            try:
                merged_args = dict(orig_args or {})
                merged_args.update(new_kwargs or {})
                object.__setattr__(self, "model", new_model)
                object.__setattr__(self, "_additional_args", merged_args)
                _logger.info(
                    "dynamic_litellm_swap",
                    original_model=orig_model,
                    override_model=new_model,
                )
                async for resp in super().generate_content_async(llm_request, stream=stream):
                    yield resp
            finally:
                object.__setattr__(self, "model", orig_model)
                object.__setattr__(self, "_additional_args", orig_args)

    def _get_swap_lock(self) -> asyncio.Lock:
        """按实例惰性初始化 asyncio.Lock；pydantic private attrs 需用 `object.__setattr__`。"""
        lock = getattr(self, "_swap_lock_instance", None)
        if lock is None:
            lock = asyncio.Lock()
            object.__setattr__(self, "_swap_lock_instance", lock)
        return lock


class DynamicRootLiteLlm(_DynamicLiteLlm):
    """根 Agent 使用的动态 LiteLlm：从 ContextVar 读取 Home 选择的模型 ID。"""

    async def _resolve_override(self) -> tuple[str, dict[str, Any]] | None:
        selected = _selected_root_llm.get()
        if not selected:
            return None
        resolved = await resolve_llm_config_by_model_name(selected)
        if resolved is None:
            _logger.warning(
                "dynamic_root_llm_unknown_model",
                selected_model=selected,
            )
            return None
        return resolved


class DynamicSubagentLiteLlm(_DynamicLiteLlm):
    """SubAgent 使用的动态 LiteLlm：按 agent_name 查 `sub_agents.model`。"""

    def __init__(self, model: str, *, agent_name: str, **kwargs: Any) -> None:
        super().__init__(model, **kwargs)
        # pydantic private attrs 用 object.__setattr__ 绕过字段校验
        object.__setattr__(self, "_agent_name", agent_name)

    async def _resolve_override(self) -> tuple[str, dict[str, Any]] | None:
        agent_name = getattr(self, "_agent_name", None)
        model_id = await resolve_subagent_model_name(agent_name)
        if not model_id:
            return None
        resolved = await resolve_llm_config_by_model_name(model_id)
        if resolved is None:
            _logger.warning(
                "dynamic_subagent_llm_unknown_model",
                agent_name=agent_name,
                requested_model=model_id,
            )
            return None
        return resolved
