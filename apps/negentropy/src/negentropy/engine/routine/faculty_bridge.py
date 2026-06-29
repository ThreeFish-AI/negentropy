"""FacultyBridge — 在 Routine 编排器内同步调用真实 ADK Faculty Agent。

Routine 的「人机交互」中「人」侧动作（审 Plan / 答问 / 门控 / 评估）应由一核五翼 6 个
**真实 Faculty Agent** 产出并归因（详见 ADR ``docs/concepts/040-routine-multi-agent-faculty.md``）。
本模块把「在 Routine 编排上下文中程序化驱动一个 ADK Faculty 并取回最终文本」封装为一个薄桥接层：

- 复用 ``engine/factories/runner.get_runner`` + ``runner.run_async``（与
  ``knowledge/translation/service._run_influence`` 同构的已验证范式）；
- 工厂新建 Faculty 实例（**不用单例**——单例已挂在 root_agent 下，二次挂 parent 会抛错）；
- 超时 / 异常即返回 ``None``，由调用方降级到现有 litellm 直调（PlanReviewer / Evaluator），
  保证 Routine 不因 Faculty 不可用而中断。

⚠️ ADK ``run_async`` 是协程；务必在 async 上下文中 ``await``，**切勿**在单 worker 事件循环里
同步阻塞（参考既往「后端单 worker 阻塞冻结全站」教训）。
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING
from uuid import uuid4

from negentropy.logging import get_logger

if TYPE_CHECKING:
    from google.adk.agents.base_agent import BaseAgent

logger = get_logger("negentropy.engine.routine.faculty_bridge")

# agent_role（与前端 features/routine/agent-role.ts 的 AgentRole 对齐）→ Faculty 工厂函数名。
# 仅映射「人」侧会经 FacultyBridge 调用的角色；engine/claude_code 不在此（前者是编排方、后者是机器）。
_ROLE_TO_FACULTY_FACTORY: dict[str, str] = {
    "perception": "create_perception_agent",  # 慧眼
    "action": "create_action_agent",  # 妙手
    "internalization": "create_internalization_agent",  # 本心
    "contemplation": "create_contemplation_agent",  # 元神
    "influence": "create_influence_agent",  # 喉舌
}


def _build_faculty_agent(role: str) -> BaseAgent | None:
    """按 agent_role 工厂新建 Faculty 实例（不传 mode——Runner root 仅允许 chat）。"""
    factory_name = _ROLE_TO_FACULTY_FACTORY.get(role)
    if factory_name is None:
        logger.warning("faculty_bridge_unknown_role", role=role)
        return None
    try:
        from negentropy.agents import faculties

        factory: Callable[..., BaseAgent] = getattr(faculties, factory_name)
        return factory()
    except Exception:  # pragma: no cover - 防御：faculties 导入/构造异常
        logger.warning("faculty_bridge_build_failed", role=role, exc_info=True)
        return None


async def run_faculty(
    role: str,
    task_prompt: str,
    *,
    timeout_seconds: float = 90.0,
    user_id: str = "system:routine-faculty",
) -> str | None:
    """同步驱动一个 Faculty Agent 处理 ``task_prompt``，返回其最终响应文本。

    Args:
        role: agent_role（perception/action/internalization/contemplation/influence）。
        task_prompt: 投喂给 Faculty 的任务消息（含目标 / 验收 / 待审方案等上下文）。
        timeout_seconds: 单次调用超时；超时即返回 None（调用方降级）。
        user_id: 审计用 user 标识。

    Returns:
        Faculty 的最终响应文本；失败 / 超时 / 空响应 → ``None``（调用方应降级）。
    """
    agent = _build_faculty_agent(role)
    if agent is None:
        return None

    try:
        return await asyncio.wait_for(
            _drive(agent, task_prompt, user_id=user_id),
            timeout=timeout_seconds,
        )
    except TimeoutError:
        logger.warning("faculty_bridge_timeout", role=role, timeout_s=timeout_seconds)
        return None
    except Exception:
        logger.warning("faculty_bridge_run_failed", role=role, exc_info=True)
        return None


async def _drive(agent: BaseAgent, task_prompt: str, *, user_id: str) -> str | None:
    """ADK Runner 程序化执行：投喂 user 消息，收集最终响应文本。"""
    from google.genai import types

    from negentropy.engine.factories.runner import get_runner

    runner = get_runner(agent=agent)
    session_id = str(uuid4())  # PostgresSessionService 要求 UUID 字符串
    content = types.Content(role="user", parts=[types.Part(text=task_prompt)])

    final_text = ""
    async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=content):
        if event.is_final_response() and event.content and event.content.parts:
            final_text = "".join(part.text or "" for part in event.content.parts if getattr(part, "text", None))
    return final_text or None


async def run_with_fallback(
    role: str,
    task_prompt: str,
    fallback: Callable[[], Awaitable[str | None]],
    *,
    timeout_seconds: float = 90.0,
) -> tuple[str | None, bool]:
    """先试 FacultyBridge，失败则降级到 ``fallback``。

    Returns:
        ``(text, used_faculty)``——``used_faculty`` 标识结果是否来自真实 Faculty
        （供调用方决定 agent_role 是否标真实归因 vs 回退）。
    """
    text = await run_faculty(role, task_prompt, timeout_seconds=timeout_seconds)
    if text is not None:
        return text, True
    return await fallback(), False


__all__ = ["run_faculty", "run_with_fallback"]
