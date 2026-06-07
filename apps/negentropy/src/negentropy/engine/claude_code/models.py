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
    max_events_per_iter: int | None = None  # None = 从 settings.routine.max_events_per_iter 读取
    timeout_seconds: float = 900.0
    permission_mode: str = "auto"  # auto | ask | plan | acceptEdits | bypassPermissions
    mcp_config: dict[str, Any] | None = None
    resume_session_id: str | None = None

    # 额外授予的「只读源目录」绝对路径列表。映射 SDK ClaudeAgentOptions.add_dirs 与
    # CLI 重复 ``--add-dir <path>``（逐目录，非逗号合并）。注意：``--add-dir`` 同时授予
    # 读+写，只读性由 ``settings`` 的 permissions.deny(Edit(//<dir>/**)) 物理保证
    # （deny 优先级最高，acceptEdits/bypassPermissions 不可越权）。
    add_dirs: list[str] | None = None
    # CC settings.json 内容（JSON 字符串）或文件路径。映射 SDK options.settings /
    # CLI ``--settings``。本仓库用其注入 permissions.deny 把 add_dirs 锁为只读。
    settings: str | None = None

    # 双向交互模式：启用 stdin PIPE + stream-json 输入，允许 Engine 自动应答
    # Claude Code 的 AskUserQuestion 等交互式工具调用（Routine 执行场景）。
    interactive: bool = False
    # 自动应答上下文：Routine 的 goal / acceptance_criteria / prompt，
    # 供 LLM 生成与任务目标一致的确定性回答。
    auto_answer_context: dict[str, Any] | None = None

    # 单迭代两段式（Plan Review 统一闭环）：当 ``plan_stage_config`` 非空时，Runner 在同一
    # Iteration 内先以本段配置（permission_mode="plan" + Plan Review 钩子）跑「方案制定+评审」段，
    # 捕获 session 后再以本对象（acceptEdits + resume）跑「实施」段。``plan_stage_prompt`` 为该段
    # 使用的 plan prompt。repr/compare=False：嵌套 config 不入 repr、不参与相等比较，避免递归噪声。
    plan_stage_prompt: str | None = None
    plan_stage_config: ClaudeCodeConfig | None = field(default=None, repr=False, compare=False)

    # 上下文压缩：注入 CLAUDE_AUTOCOMPACT_PCT_OVERRIDE 环境变量，控制 CC auto-compact 触发阈值。
    # None = 使用 CLI 默认值（~83%）；整数（如 70）= context 达该百分比时触发压缩。
    compact_threshold_pct: int | None = None

    # 注入子进程的真实 Anthropic 凭证（sk-ant-oat… 订阅 OAuth 令牌 / sk-ant-api… Console API Key）。
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
    # 可恢复错误分类标签（机制层判定，供策略层正交消费）。None 表示无可识别的特定错误类型；
    # 当前唯一取值 "context_exhausted"（CC 会话上下文窗口耗尽，可经"重置 session 冷启动"自愈）。
    # 仅承载"是什么错"，不含"如何处置"——处置策略由 Routine Runner / decision 层据此决定。
    error_kind: str | None = None
    # 「全过程」动作级审计事件（归一化后的 stream-json 动作；含 seq，按到达顺序定格）。
    # 由 ClaudeCodeService 捕获，超时/取消/出错路径亦回带已捕获的部分事件。
    events: list[dict] = field(default_factory=list)
