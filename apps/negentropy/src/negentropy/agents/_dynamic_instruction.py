"""
动态 InstructionProvider — 运行时按 ``sub_agents.system_prompt`` 解析 LLM 指令。

设计目标（与 ``_dynamic_model.py`` 同构）：
- ADK ``LlmAgent.instruction`` 支持 ``Union[str, InstructionProvider]``；当 Sync 把代码内置
  instruction 写入 DB 后，运行时由本模块在每次构造 LLM 请求前按 agent_name 读 DB；
- DB 不可达 / 未启用 / 字段为空 → 回退到代码硬编码 fallback，保持「永不阻塞请求」语义；
- 60s TTL 缓存与 ``resolve_subagent_model_name`` 共用同一行（``subagent:<name>``），写后调用
  ``invalidate_cache(prefix="subagent:")`` 同时让 model + instruction 失效。
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from google.adk.agents.readonly_context import ReadonlyContext

from negentropy.config.model_resolver import resolve_subagent_instruction
from negentropy.logging import get_logger

_logger = get_logger("negentropy.agents.dynamic_instruction")

InstructionProvider = Callable[[ReadonlyContext], Awaitable[str]]


def make_instruction_provider(agent_name: str, fallback: str) -> InstructionProvider:
    """构造 ADK InstructionProvider：DB 命中即用，未命中 / 失败回退到 ``fallback``。

    Args:
        agent_name: ``sub_agents.name``，用于 DB 查询；与 ADK Agent.name 一致。
        fallback: 代码硬编码 instruction 文本，DB 未命中 / 异常时使用。

    Returns:
        Async callable，签名符合 ADK 的 ``InstructionProvider`` 类型约束。
    """

    async def _provider(_ctx: ReadonlyContext) -> str:
        try:
            text = await resolve_subagent_instruction(agent_name)
        except Exception:
            _logger.warning(
                "dynamic_instruction_load_failed",
                agent_name=agent_name,
                exc_info=True,
            )
            return fallback
        return text or fallback

    return _provider
