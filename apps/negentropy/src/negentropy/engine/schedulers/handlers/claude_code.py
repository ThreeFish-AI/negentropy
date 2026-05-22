"""``claude_code`` handler — 通过 Scheduler 周期性调度 Claude Code 执行。

行为约定：
- ``task.payload`` 中应包含 ``prompt``（Claude Code 的任务描述）；
- 可选 ``cwd`` / ``max_turns`` / ``resume`` 字段覆盖全局配置；
- 实际执行复用 ``ClaudeCodeService.invoke`` 保持单一事实源；
- 配置来源于 ``builtin_tools`` 表中 ``tool_type="claude_code"`` 的全局配置。
"""

from __future__ import annotations

from negentropy.logging import get_logger

from . import HandlerResult, register_handler

logger = get_logger("negentropy.engine.schedulers.handlers.claude_code")


@register_handler("claude_code")
async def claude_code_handler(task) -> HandlerResult:
    """Scheduler 调度 Claude Code 执行。

    task.payload:
    - prompt: str — 任务描述（必填）
    - cwd: str | None — 工作目录（覆盖全局配置）
    - max_turns: int | None — 最大迭代轮数（覆盖全局配置）
    - resume: bool — 是否续接上次会话（默认 False）
    """
    payload = task.payload or {}
    prompt = payload.get("prompt", "")
    if not prompt:
        return HandlerResult(status="failed", error="missing payload.prompt")

    try:
        from negentropy.engine.claude_code.service import ClaudeCodeService

        # 加载全局配置
        config = await _load_claude_code_defaults()
        if payload.get("cwd"):
            config.cwd = payload["cwd"]
        if payload.get("max_turns"):
            config.max_turns = int(payload["max_turns"])

        # 会话续接（从 task execution 历史中找最近 session_id）
        if payload.get("resume"):
            last_session_id = await _find_last_session_id(task.id)
            if last_session_id:
                config.resume_session_id = last_session_id

        result = await ClaudeCodeService.invoke(prompt, config)

        return HandlerResult(
            status="ok" if result.status == "success" else "failed",
            output_summary=result.summary,
            error=result.error,
            metrics={
                "cost_usd": result.cost_usd,
                "session_id": result.session_id,
                "turn_count": result.turn_count,
            },
        )
    except Exception as exc:
        logger.warning("claude_code_handler_failed", error=str(exc))
        return HandlerResult(status="failed", error=str(exc))


async def _load_claude_code_defaults():
    """从 builtin_tools 表读取 claude_code 全局配置。"""
    from sqlalchemy import select

    from negentropy.db.session import AsyncSessionLocal
    from negentropy.engine.claude_code.models import ClaudeCodeConfig
    from negentropy.models.builtin_tool import BuiltinTool

    async with AsyncSessionLocal() as db:
        stmt = (
            select(BuiltinTool)
            .where(
                BuiltinTool.tool_type == "claude_code",
                BuiltinTool.is_enabled.is_(True),
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        tool = result.scalar_one_or_none()

    if tool:
        cfg = tool.config or {}
        return ClaudeCodeConfig(
            cli_path=cfg.get("cli_path", "claude"),
            model=cfg.get("model"),
            system_prompt=cfg.get("system_prompt"),
            allowed_tools=cfg.get("allowed_tools"),
            cwd=cfg.get("cwd") or cfg.get("default_cwd"),
            max_turns=cfg.get("max_turns", 20),
            timeout_seconds=float(cfg.get("timeout_seconds", 300.0)),
            permission_mode=cfg.get("permission_mode", "auto"),
            mcp_config=cfg.get("mcp_config"),
        )
    return ClaudeCodeConfig()


async def _find_last_session_id(task_id) -> str | None:
    """从最近一次 task_execution 的 metrics 中提取 session_id。"""

    from sqlalchemy import select

    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.scheduled_task import TaskExecution

    async with AsyncSessionLocal() as db:
        stmt = (
            select(TaskExecution)
            .where(
                TaskExecution.task_id == task_id,
                TaskExecution.status == "ok",
            )
            .order_by(TaskExecution.started_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        execution = result.scalar_one_or_none()

    if execution and execution.output_summary:
        # session_id 存储在 output_summary 或 metrics 中
        # 暂时返回 None，待 Phase 3 完善会话续接模型后启用
        return None
    return None
