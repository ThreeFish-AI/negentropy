"""
动态 InstructionProvider — 运行时按 ``agents.system_prompt`` 解析 LLM 指令。

设计目标（与 ``_dynamic_model.py`` 同构）：
- ADK ``LlmAgent.instruction`` 支持 ``Union[str, InstructionProvider]``；当 Sync 把代码内置
  instruction 写入 DB 后，运行时由本模块在每次构造 LLM 请求前按 agent_name 读 DB；
- DB 不可达 / 未启用 / 字段为空 → 回退到代码硬编码 fallback，保持「永不阻塞请求」语义；
- 60s TTL 缓存与 ``resolve_subagent_model_name`` 共用同一行（``subagent:<name>``），写后调用
  ``invalidate_cache(prefix="subagent:")`` 同时让 model + instruction 失效。
"""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable

from google.adk.agents.readonly_context import ReadonlyContext

from negentropy.config.model_resolver import resolve_subagent_instruction
from negentropy.logging import get_logger

_logger = get_logger("negentropy.agents.dynamic_instruction")

InstructionProvider = Callable[[ReadonlyContext], Awaitable[str]]


# 用户 @Agent 偏好的 session.state 键。前端自此版本起统一发送 ``preferred_agent``；
# ``preferred_subagent`` 为历史键名，仅用于向后兼容【迁移前已存在的持久化会话】，
# 读取时新键优先、旧键回退，使现存会话零迁移、零丢失（详见迁移 0044 说明）。
_PREFERENCE_KEY = "preferred_agent"
_LEGACY_PREFERENCE_KEY = "preferred_subagent"
_PREFERENCE_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_\-]{0,127}$")


_PREFERENCE_PREFIX_TEMPLATE = """## 用户偏好 (User Preference - 本轮 turn)
用户在本轮明确指定希望由 `{name}` 处理本次请求。
在意图允许的前提下，**优先**使用 `transfer_to_agent(agent_name="{name}", ...)` 委派。
若你判断该 Agent 不适合处理本请求（如能力不匹配），仍可按「调度之道」自主选择，
但需在最终回答中向用户**简述偏离原因**。

"""


def _render_preference_prefix(preferred: str) -> str:
    """渲染「用户偏好」prefix；与正文之间留一个空行分隔。

    用户在 Home Composer 通过 ``@Agent`` 选中某 Agent 后，前端将其 ``name`` 经
    ``forwardedProps.preferred_agent`` → BFF ``state_delta`` → ADK session.state
    透传到根 Agent 的 ReadonlyContext。本 prefix 仅是「软偏好」—— 若 root 判断不
    匹配仍可自主选择，但需向用户简述偏离原因，避免静默忽略用户意图。
    """
    return _PREFERENCE_PREFIX_TEMPLATE.format(name=preferred)


def make_instruction_provider(
    agent_name: str,
    fallback: str,
    *,
    is_root: bool = False,
) -> InstructionProvider:
    """构造 ADK InstructionProvider：DB 命中即用，未命中 / 失败回退到 ``fallback``。

    扩展：当 ``is_root=True`` 且 ``ctx.state`` 含 ``preferred_agent``（用户
    @ Agent 偏好）时，在 instruction 头部 prepend 「用户偏好」段落（仅本 turn
    生效，state 由 ADK 按 turn 派发）。Agent 名仅做轻量正则校验，避免脏数据
    破坏 prompt。

    Args:
        agent_name: ``agents.name``，用于 DB 查询；与 ADK Agent.name 一致。
        fallback: 代码硬编码 instruction 文本，DB 未命中 / 异常时使用。
        is_root: 是否为根 Agent（``NegentropyEngine``）。仅根 Agent 消费
            ``preferred_agent`` —— 它负责调度 Agent；其它 faculty 即使读到
            同一 ``session.state`` 也不应被自指令（``transfer_to_agent(self)``）
            或跨派系委派提示污染。

    Returns:
        Async callable，签名符合 ADK 的 ``InstructionProvider`` 类型约束。
    """

    async def _provider(ctx: ReadonlyContext) -> str:
        try:
            text = await resolve_subagent_instruction(agent_name)
        except Exception:
            _logger.warning(
                "dynamic_instruction_load_failed",
                agent_name=agent_name,
                exc_info=True,
            )
            text = None
        base = text or fallback

        # DB 未命中（text is None）：指令来自代码 fallback，未经 ``_load_subagent_row``
        # 的全局技能注入；在此补注入全局技能，使尚未 Sync 入库的 Agent 同样获得。
        # 与 DB 路径互斥（text 非 None 时不进入），避免重复 ``<available_skills>`` 块。
        if text is None:
            try:
                from negentropy.agents.skills_injector import append_global_skills_block

                base = await append_global_skills_block(base)
            except Exception:
                _logger.warning(
                    "dynamic_instruction_global_skills_failed",
                    agent_name=agent_name,
                    exc_info=True,
                )

        # 非 root 一律走原路径——避免 faculty 共用 provider 时被偏好 prefix 污染。
        if not is_root:
            return base

        # 防御性校验：非法 / 空 / 异常类型一律忽略，永不阻塞主流程。
        try:
            state = getattr(ctx, "state", None)
            if state is not None:
                # 新键优先，旧键回退：兼容迁移前已写入 ``preferred_subagent`` 的会话。
                preferred = state.get(_PREFERENCE_KEY)
                if preferred is None:
                    preferred = state.get(_LEGACY_PREFERENCE_KEY)
            else:
                preferred = None
        except Exception:
            preferred = None
        if isinstance(preferred, str) and _PREFERENCE_NAME_RE.match(preferred):
            return _render_preference_prefix(preferred) + base
        return base

    return _provider
