"""``claude_code`` handler — 通过 Scheduler 周期性调度 Claude Code 执行。

行为约定：
- ``task.payload`` 中应包含 ``prompt``（Claude Code 的任务描述）；
- 可选 ``cwd`` / ``max_turns`` / ``resume`` 字段覆盖全局配置；
- 实际执行复用 ``ClaudeCodeService.invoke`` 保持单一事实源；
- 配置来源于 ``builtin_tools`` 表中 ``tool_type="claude_code"`` 的全局配置。
"""

from __future__ import annotations

import shutil

from negentropy.logging import get_logger

from . import HandlerDescriptor, HandlerResult, PayloadField, register_descriptor, register_handler

logger = get_logger("negentropy.engine.schedulers.handlers.claude_code")

register_descriptor(
    HandlerDescriptor(
        handler_kind="claude_code",
        label="Claude Code",
        description="通过 Scheduler 调度 Claude Code 执行任务",
        supported_trigger_types=("cron", "interval"),
        default_trigger_type="cron",
        payload_fields=(
            PayloadField(
                name="prompt", label="Prompt", type="string", required=True, help_text="Claude Code 的任务描述"
            ),
            PayloadField(name="cwd", label="Working Directory", type="string", help_text="工作目录（覆盖全局配置）"),
            PayloadField(name="max_turns", label="Max Turns", type="integer", help_text="最大迭代轮数（覆盖全局配置）"),
            PayloadField(
                name="resume", label="Resume Session", type="boolean", default=False, help_text="是否续接上次会话"
            ),
        ),
    ),
)


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
            logger.info(
                "claude_code_resume_requested",
                task_id=task.id,
                note="resume not yet implemented, starting fresh session",
            )

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
    from negentropy.engine.claude_code.credentials import resolve_claude_code_credential
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

    # 单一汇聚点：解析注入子进程的真实 Anthropic 凭证（UI credentials > 环境变量 > None）。
    # 此处一改即覆盖 scheduler handler 与 orchestrator._build_config 两条派发路径。
    credential = resolve_claude_code_credential(tool.credentials if tool else None)

    if tool:
        cfg = tool.config or {}
        raw_cli = cfg.get("cli_path", "claude")
        # 将裸名解析为绝对路径，消除子进程对 PATH 的依赖
        resolved_cli = shutil.which(raw_cli) or raw_cli
        return ClaudeCodeConfig(
            cli_path=resolved_cli,
            model=cfg.get("model"),
            system_prompt=cfg.get("system_prompt"),
            allowed_tools=cfg.get("allowed_tools"),
            disallowed_tools=cfg.get("disallowed_tools"),
            cwd=cfg.get("cwd") or cfg.get("default_cwd"),
            max_turns=cfg.get("max_turns", 500),
            timeout_seconds=float(cfg.get("timeout_seconds", 300.0)),
            permission_mode=cfg.get("permission_mode", "auto"),
            mcp_config=cfg.get("mcp_config"),
            credential=credential,
        )
    # 无 DB 配置时，尝试解析默认 "claude" 为绝对路径
    default_cli = shutil.which("claude") or "claude"
    return ClaudeCodeConfig(cli_path=default_cli, credential=credential)
