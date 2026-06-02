"""Claude Code 数据模型。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# 内部 permission_mode 别名 → claude CLI 合法取值的映射。
# claude CLI v2.x 合法值：default | acceptEdits | bypassPermissions | plan。
# 历史 schema（迁移 0039）沿用 auto/ask 语义别名，需归一，否则 `--permission-mode auto`
# 在严格版本的 CLI 上会直接报错。归一规则：auto/ask → default（语义等价「默认放行/逐项询问」）。
_PERMISSION_MODE_MAP = {
    "auto": "default",
    "ask": "default",
    "default": "default",
    "acceptEdits": "acceptEdits",
    "acceptedits": "acceptEdits",
    "accept_edits": "acceptEdits",
    "plan": "plan",
    "bypassPermissions": "bypassPermissions",
    "bypasspermissions": "bypassPermissions",
    "bypass_permissions": "bypassPermissions",
    "dontAsk": "dontAsk",
    "dontask": "dontAsk",
}


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
    max_turns: int = 500
    timeout_seconds: float = 900.0
    permission_mode: str = "auto"  # auto | ask | plan | acceptEdits | bypassPermissions
    mcp_config: dict[str, Any] | None = None
    resume_session_id: str | None = None

    # 双向交互模式：启用 stdin PIPE + stream-json 输入，允许 Engine 自动应答
    # Claude Code 的 AskUserQuestion 等交互式工具调用（Routine 执行场景）。
    interactive: bool = False
    # 自动应答上下文：Routine 的 goal / acceptance_criteria / prompt，
    # 供 LLM 生成与任务目标一致的确定性回答。
    auto_answer_context: dict[str, Any] | None = None

    # 注入子进程的真实 Anthropic 凭证（OAuth 长期令牌 / sk-ant- API Key）。
    # 由 credentials.resolve_claude_code_credential 解析，ClaudeCodeService 据此构建子进程 env。
    # repr=False / compare=False：secret 绝不入 repr（防日志、traceback 泄露），亦不参与相等比较。
    credential: str | None = field(default=None, repr=False, compare=False)

    # 默认允许的工具集
    _DEFAULT_TOOLS: list[str] = field(
        default_factory=lambda: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
        repr=False,
        compare=False,
    )

    def get_effective_allowed_tools(self) -> list[str]:
        return self.allowed_tools or self._DEFAULT_TOOLS

    def effective_permission_mode(self) -> str:
        """归一为 claude CLI/SDK 合法的 permission_mode（未知值兜底 default）。"""
        key = (self.permission_mode or "").strip()
        return _PERMISSION_MODE_MAP.get(key, _PERMISSION_MODE_MAP.get(key.lower(), "default"))


@dataclass
class ClaudeCodeResult:
    """Claude Code 执行结果。"""

    status: str  # "success" | "error" | "timeout"
    summary: str  # 最终文本结果（截断到 2000 字符）
    session_id: str | None = None  # Claude Code 返回的 session_id（可续接）
    cost_usd: float = 0.0
    turn_count: int = 0
    error: str | None = None
    # 「全过程」动作级审计事件（归一化后的 stream-json 动作；含 seq，按到达顺序定格）。
    # 由 ClaudeCodeService 捕获，超时/取消/出错路径亦回带已捕获的部分事件。
    events: list[dict] = field(default_factory=list)
