"""Claude Code 数据模型。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ClaudeCodeConfig:
    """Claude Code 调用配置。

    来源：BuiltinTool.config（全局默认）+ ADK tool call 参数（单次覆盖）。
    """

    cli_path: str = "claude"
    model: str | None = None
    system_prompt: str | None = None
    allowed_tools: list[str] | None = None
    disallowed_tools: list[str] | None = None
    cwd: str | None = None
    max_turns: int = 20
    timeout_seconds: float = 300.0
    permission_mode: str = "auto"  # auto | ask | plan
    mcp_config: dict[str, Any] | None = None
    resume_session_id: str | None = None

    # 默认允许的工具集
    _DEFAULT_TOOLS: list[str] = field(
        default_factory=lambda: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
        repr=False,
        compare=False,
    )

    def get_effective_allowed_tools(self) -> list[str]:
        return self.allowed_tools or self._DEFAULT_TOOLS


@dataclass
class ClaudeCodeResult:
    """Claude Code 执行结果。"""

    status: str  # "success" | "error" | "timeout"
    summary: str  # 最终文本结果（截断到 2000 字符）
    session_id: str | None = None  # Claude Code 返回的 session_id（可续接）
    cost_usd: float = 0.0
    turn_count: int = 0
    error: str | None = None
