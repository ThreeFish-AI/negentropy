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
import contextlib
import contextvars
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import TYPE_CHECKING, Any, TypeVar
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

# read_only 模式下 Faculty 可保留的工具名白名单。经 ``_apply_readonly`` 过滤后，Faculty 仅能调
# 这些工具，**任何副作用工具（save_to_memory / update_knowledge_graph / ingest_paper /
# ingest_to_corpus / write_file / invoke_claude_code / publish_content / send_notification /
# execute_code）一律剥离**。这是收编后台 LLM 到六翼的关键安全增量：桥接层注入
# ``approval_policy=never``（见 ``_drive``），若不剥离副作用工具，Internalization 等翼会在
# 无人在环下静默真写记忆 / KG → 记忆重复 / KG 污染（ADR 040「副作用工具陷阱」）。
# 注：read_only 同时整体剔除 ``BaseToolset``（六翼的可摘工具集经 WS1 以 toolset 承载，副作用工具
# 藏于其内逐请求解析），故 read_only 调用不会触发任何可摘工具——契合「要确定性 JSON、不要工具漫游」。
_READONLY_TOOL_ALLOWLIST: set[str] = {
    "log_activity",
    "load_memory",
    "search_knowledge_base",
    "search_knowledge_graph_global",
    "search_knowledge_graph_with_papers",
    "search_web",
    "search_papers",
    "analyze_context",
    "create_plan",
}

# 单任务 Faculty 调用预算（contextvar）：consolidation 等多条目循环收编时，防止「条目越多、ADK
# Runner 同步驱动次数线性膨胀」的成本 / 延迟失控。``None`` = 不限。调用方用
# ``faculty_bridge_budget(budget)`` 在任务作用域内设置；``run_faculty_json`` 每次调用前自减。
_faculty_budget: contextvars.ContextVar[int | None] = contextvars.ContextVar("negentropy_faculty_budget", default=None)

T = TypeVar("T")


@contextlib.asynccontextmanager
async def faculty_bridge_budget(budget: int) -> AsyncIterator[None]:
    """为一个高层任务（一次 consolidate / extract_on_termination 等）设定 Faculty 调用预算。

    在此作用域内，``run_faculty_json`` 每次 Faculty 调用消耗 1；耗尽后剩余调用直接降级 litellm
    （``used_faculty=False``），防多条目循环下 Runner 开销线性膨胀。未进入本上下文 → 不限。
    """
    token = _faculty_budget.set(budget)
    try:
        yield
    finally:
        _faculty_budget.reset(token)


def _build_faculty_agent(role: str, *, read_only: bool = False) -> BaseAgent | None:
    """按 agent_role 工厂新建 Faculty 实例（不传 mode——Runner root 仅允许 chat）。

    ``read_only=True`` 时剥离副作用工具（仅留白名单），用于后台 LLM 收编（WS2）。
    """
    factory_name = _ROLE_TO_FACULTY_FACTORY.get(role)
    if factory_name is None:
        logger.warning("faculty_bridge_unknown_role", role=role)
        return None
    try:
        from negentropy.agents import faculties

        factory: Callable[..., BaseAgent] = getattr(faculties, factory_name)
        agent = factory()
        if read_only:
            _apply_readonly(agent)
        return agent
    except Exception:  # pragma: no cover - 防御：faculties 导入/构造异常
        logger.warning("faculty_bridge_build_failed", role=role, exc_info=True)
        return None


def _apply_readonly(agent: BaseAgent) -> None:
    """read_only 过滤：整体剔除 ``BaseToolset``（副作用工具藏于其内）+ 只保留白名单工具名。

    在原地改 ``agent.tools``。保留 ``log_activity``（审计）与 ``load_memory``（只读记忆回溯）。
    """
    from google.adk.tools.base_toolset import BaseToolset

    from negentropy.agents.tools.registry import tool_name

    kept: list[Any] = []
    for tool in getattr(agent, "tools", None) or []:
        # BaseToolset 整体剔除：read_only 调用要确定性 JSON，不该触发任何可摘工具（含副作用工具）。
        if isinstance(tool, BaseToolset):
            continue
        if tool_name(tool) in _READONLY_TOOL_ALLOWLIST:
            kept.append(tool)
    try:
        agent.tools = kept  # type: ignore[misc]
    except (AttributeError, TypeError):  # pragma: no cover - frozen / 无 setter
        logger.warning("faculty_bridge_readonly_apply_failed", role=getattr(agent, "name", "?"))


async def run_faculty(
    role: str,
    task_prompt: str,
    *,
    timeout_seconds: float = 90.0,
    user_id: str = "system:routine-faculty",
    read_only: bool = False,
) -> str | None:
    """同步驱动一个 Faculty Agent 处理 ``task_prompt``，返回其最终响应文本。

    Args:
        role: agent_role（perception/action/internalization/contemplation/influence）。
        task_prompt: 投喂给 Faculty 的任务消息（含目标 / 验收 / 待审方案等上下文）。
        timeout_seconds: 单次调用超时；超时即返回 None（调用方降级）。
        user_id: 审计用 user 标识。
        read_only: 剥离副作用工具（用于后台 LLM 收编，WS2）。

    Returns:
        Faculty 的最终响应文本；失败 / 超时 / 空响应 → ``None``（调用方应降级）。
    """
    agent = _build_faculty_agent(role, read_only=read_only)
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


async def run_faculty_json(
    role: str,
    task_prompt: str,
    *,
    parse: Callable[[str], T | None],
    fallback: Callable[[], Awaitable[T]],
    enabled: bool,
    timeout_seconds: float = 90.0,
    read_only: bool = True,
    user_id: str = "system:routine-faculty",
) -> tuple[T, bool]:
    """Faculty 优先 + litellm 兜底，产出结构化结果（WS2 统一收编 helper）。

    Args:
        role: Faculty agent_role。
        task_prompt: 投喂给 Faculty 的任务消息（含 JSON 契约）。
        parse: 把 Faculty 文本解析为目标结构；``None`` 表示解析失败 / 非预期 → 触发降级。
            复用调用点既有解析（多已含 ``loads_lenient`` 剥围栏 + 截平衡子串）。
        fallback: 降级路径（现有 litellm 直调整体包成 async thunk）；返回与 Faculty 命中
            同型结果。``run_faculty_json`` 保证：Faculty 文本为空 / 超时 / 解析返回 None →
            走 ``fallback``，**批任务绝不因 Faculty JSON 破损而失败**（硬闸）。
        enabled: ``settings.routine.faculty_bridge_enabled and settings.routine.<group>_enabled``
            由调用方算好（总开关 AND 组开关）。``False`` → 直接走 ``fallback``。
        timeout_seconds: 单次超时；批处理类建议传 ``faculty_bridge_batch_timeout_seconds``。
        read_only: 默认 True——剥离副作用工具（见 ``_READONLY_TOOL_ALLOWLIST``）。评审 / 判定
            类若确需 Faculty 调用只读工具，可显式传 False（须论证副作用已隔离）。
        user_id: 审计用 user 标识。

    Returns:
        ``(result, used_faculty)``——``used_faculty`` 标识结果是否来自真实 Faculty（供归因 / 可观测）。
    """
    budget = _faculty_budget.get()
    if enabled and (budget is None or budget > 0):
        try:
            text = await run_faculty(
                role,
                task_prompt,
                timeout_seconds=timeout_seconds,
                user_id=user_id,
                read_only=read_only,
            )
        except Exception:  # pragma: no cover - run_faculty 内部已吞，双保险
            text = None
        if text:
            try:
                parsed = parse(text)
            except Exception:
                logger.info("faculty_bridge_json_parse_failed_fallback", role=role)
                parsed = None
            if parsed is not None:
                if budget is not None:
                    _faculty_budget.set(budget - 1)
                return parsed, True
            logger.info("faculty_bridge_empty_or_unparsed_fallback", role=role)
        else:
            logger.info("faculty_bridge_no_text_fallback", role=role)

    result = await fallback()
    return result, False


async def _drive(agent: BaseAgent, task_prompt: str, *, user_id: str) -> str | None:
    """ADK Runner 程序化执行：投喂 user 消息，收集最终响应文本。"""
    from google.genai import types

    from negentropy.engine.factories.runner import get_runner
    from negentropy.engine.factories.session import get_session_service

    runner = get_runner(agent=agent)
    session_id = str(uuid4())  # PostgresSessionService 要求 UUID 字符串
    # 自治 faculty 调用无人在环（ISSUE-156 续）：预创建 session 并注入 approval_policy=never，
    # 避免 InternalizationFaculty 的 ingest_paper / update_knowledge_graph 等高风险工具触发
    # 审批门 → 无人响应 → 超时循环。app_name 取 runner.app_name 与 ADK session 查找对齐。
    try:
        service = get_session_service()
        await service.create_session(
            app_name=getattr(runner, "app_name", None) or "negentropy",
            user_id=user_id,
            session_id=session_id,
            state={"approval_policy": {"mode": "never"}},
        )
    except Exception:
        # 预创建失败（后端不支持 state 入参 / 会话已存在等）→ 降级：runner 自行建会话，
        # 不阻断 faculty 主流程。approval 门退回默认 per_tool（多为只读评估，风险可控）。
        logger.warning("faculty_bridge_precreate_session_failed", exc_info=True)

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


__all__ = [
    "run_faculty",
    "run_faculty_json",
    "run_with_fallback",
    "faculty_bridge_budget",
]
