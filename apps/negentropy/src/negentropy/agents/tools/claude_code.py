"""invoke_claude_code — 让 ADK Agent 调用 Claude Code 的 FunctionTool。

Claude Code 拥有完整的文件读写、Bash 执行、代码搜索能力，
可以自主完成多文件编辑、测试运行、Git 操作等复杂任务链。
是 ADK Agent 工具箱中的"超级工具"。
"""

from __future__ import annotations

from typing import Any

from google.adk.tools import ToolContext

from negentropy.engine.claude_code.credentials import resolve_claude_code_credential
from negentropy.engine.claude_code.models import ClaudeCodeConfig
from negentropy.engine.claude_code.service import ClaudeCodeService


async def invoke_claude_code(
    task: str,
    tool_context: ToolContext,
    working_directory: str | None = None,
    allowed_tools: str | None = None,
    max_turns: int = 500,
    system_prompt: str | None = None,
) -> dict[str, Any]:
    """调用 Claude Code 执行复杂的代码分析与修改任务。

    Claude Code 拥有完整的文件读写、Bash 执行、代码搜索能力，
    可以自主完成多文件编辑、测试运行、Git 操作等复杂任务链。
    适用于需要跨文件理解、多步骤修改、测试验证的复杂代码任务。

    Args:
        task: 描述 Claude Code 需要完成的任务
        tool_context: ADK 注入的上下文
        working_directory: 目标项目的工作目录（默认使用系统配置）
        allowed_tools: 允许使用的工具，逗号分隔
            （默认: "Bash,Read,Write,Edit,Glob,Grep"）
        max_turns: 最大自主迭代轮数（默认 500）
        system_prompt: 自定义系统指令
    """
    # 1. 从 session state 读取全局配置（由 BuiltinTool 系统注入）。
    #    缺口修复：当前引擎并不向 session state 写入 ``claude_code_config`` 键，缺省时
    #    回退到与 Routine（orchestrator._build_config）/ Scheduler（claude_code handler）
    #    相同的单一事实源——``builtin_tools(claude_code)`` 全局默认，使 ADK Agent 的
    #    invoke_claude_code 同样获得默认 ``mcp_config``（如系统内置 playwright 浏览器 MCP）
    #    与 ``allowed_tools``，三入口语义统一（SSOT）。
    cc_defaults: dict = tool_context.state.get("claude_code_config") or {}
    fallback_credential: str | None = None
    if not cc_defaults:
        from negentropy.engine.schedulers.handlers.claude_code import _load_claude_code_defaults

        defaults = await _load_claude_code_defaults()
        cc_defaults = {
            "cli_path": defaults.cli_path,
            "model": defaults.model,
            "system_prompt": defaults.system_prompt,
            "cwd": defaults.cwd,
            "max_turns": defaults.max_turns,
            "timeout_seconds": defaults.timeout_seconds,
            "permission_mode": defaults.permission_mode,
            "allowed_tools": defaults.allowed_tools,
            "mcp_config": defaults.mcp_config,
        }
        # _load_claude_code_defaults 已解析真实凭证（UI credentials > 环境变量）；
        # 回退路径无原始 credentials dict，直接复用其已解析结果。
        fallback_credential = defaults.credential

    # 2. tool call 参数覆盖默认值
    config = ClaudeCodeConfig(
        cli_path=cc_defaults.get("cli_path", "claude"),
        model=cc_defaults.get("model"),
        cwd=working_directory or cc_defaults.get("cwd") or cc_defaults.get("default_cwd"),
        max_turns=max_turns,
        system_prompt=system_prompt or cc_defaults.get("system_prompt"),
        permission_mode=cc_defaults.get("permission_mode", "auto"),
        timeout_seconds=float(cc_defaults.get("timeout_seconds", 300.0)),
        mcp_config=cc_defaults.get("mcp_config"),
        # 注入真实 Anthropic 凭证：回退路径用已解析结果；state 路径解析其 credentials dict
        # （state 中的 credentials > 环境变量），与 Routine 路径一致。
        credential=fallback_credential or resolve_claude_code_credential(cc_defaults.get("credentials")),
    )

    # 3. 解析 allowed_tools
    if allowed_tools:
        config.allowed_tools = [t.strip() for t in allowed_tools.split(",")]
    elif cc_defaults.get("allowed_tools"):
        raw = cc_defaults["allowed_tools"]
        config.allowed_tools = raw if isinstance(raw, list) else [t.strip() for t in raw.split(",")]

    # 4. 会话续接（从 state 取上次 session_id）
    last_session: str | None = tool_context.state.get("claude_code_session_id")
    if last_session:
        config.resume_session_id = last_session

    # 5. 执行
    result = await ClaudeCodeService.invoke(task, config)

    # 6. 存储新 session_id 供后续续接
    if result.session_id:
        tool_context.state["claude_code_session_id"] = result.session_id

    return {
        "status": result.status,
        "summary": result.summary,
        "session_id": result.session_id,
        "cost_usd": result.cost_usd,
        "turn_count": result.turn_count,
        "error": result.error,
    }
