# Claude Code 集成设计：作为 BuiltinTool 接入 ADK Agent

> 将本地 Claude Code CLI 作为 **BuiltinTool** 接入 Negentropy 系统，使 ADK Agent（一核五翼）获得调用 Claude Code 的能力。
>
> - 架构总览：[Framework](./framework.md)
> - Agent 工具体系：[Framework §5](./framework.md#5-设计模式目录)
> - Interface / Tools 页：[Framework §9](./framework.md#9-前端应用架构-negentropy-ui)

---

## 1. 设计动机

ADK Agent 拥有 `execute_code` / `read_file` / `write_file` 等基础工具，但缺乏 Claude Code CLI 的完整能力——多文件上下文理解、自主迭代修复、跨文件重构等。

**Claude Code** 是 Anthropic 官方的 agentic coding 工具，具备完整的文件读写、Bash 执行、代码搜索、MCP 扩展能力。将其作为 ADK Agent 的一个 **FunctionTool**，可使 Agent 在需要时自主委托复杂代码任务。

**核心原则**：Claude Code 永远作为 Tool 被调用，入口始终是 ADK Agent。

## 2. 架构设计

### 2.1 调用路径

```
用户请求 → ADK Agent（Root / Faculty）
           → tool call: invoke_claude_code(task, cwd, max_turns)
             → ClaudeCodeService
               → claude-code-sdk Python 包（优先）
               → CLI 子进程（降级）
             → 返回结果给 ADK Agent
           → ADK Agent 拿到结果，继续流程或回复用户
```

### 2.2 组件关系

```
┌───────────────────────────────────────────────────────┐
│  ADK Agent 层 (一核五翼)                               │
│                                                       │
│  ActionFaculty ── tool_call ──┐                       │
│  ContemplationFaculty         │                       │
│  ...                          ↓                       │
│  ┌──────── Tool Layer ────────────────────────┐      │
│  │ ADK 内置 │ MCP Tools │ invoke_claude_code ✨│      │
│  └────────────────────────────────────────────┘       │
│           │                                            │
│           ↓                                            │
│  ┌──── ClaudeCodeService ─────────────────────┐      │
│  │  claude-code-sdk / CLI subprocess          │      │
│  │  invoke(prompt, config) → ClaudeCodeResult │      │
│  └────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────┘
```

### 2.3 配置体系

Claude Code 配置存储在 **BuiltinTool** 表中（`tool_type = "claude_code"`），由 Alembic 迁移 `0039_seed_claude_code_builtin_tool.py` 以 `owner_id='system'` / `visibility='PUBLIC'` / `is_system=true` 种子化，登录用户在 Interface / Tools 页即可看到"Claude Code"卡片并直接调参；ANTHROPIC_API_KEY 由 VendorConfig 注入子进程环境，不在 builtin_tools 表中保存明文凭据。

| 配置项 | 说明 | 默认值 |
|-------|------|--------|
| `cli_path` | Claude Code CLI 路径 | `claude` |
| `model` | 覆盖模型（留空用默认） | `null` |
| `default_cwd` | 默认工作目录 | `null` |
| `max_turns` | 最大自主迭代轮数 | `20` |
| `timeout_seconds` | 超时时间（秒） | `300` |
| `permission_mode` | 权限模式 | `auto` |
| `allowed_tools` | 允许的工具列表 | `Bash,Read,Write,Edit,Glob,Grep` |

ADK Tool call 参数（`working_directory`, `max_turns` 等）可覆盖全局配置。

### 2.4 Studio @claude-code 提示

在 Studio 对话框 @mention 候选列表中注入 `Claude Code` 条目。当用户选择 @claude-code 时，消息中包含 `@Claude Code` 提示文本，发送给 ADK Agent。Agent 自主决定是否调用 `invoke_claude_code` tool。

不引入新的 MentionKind——`claude_code` 作为一种特殊的 agent mention 存在。

### 2.5 Scheduler 周期性调度

通过 `claude_code` handler 实现 Scheduler 周期性调用：

```
Cron 触发 → claude_code handler
  → 从 BuiltinTool 读取全局配置
  → 调用 ClaudeCodeService.invoke(prompt, config)
  → 返回 HandlerResult（含 cost_usd, session_id）
```

未来可扩展 `resume` 参数实现跨调度会话续接。

## 3. 文件结构

```
apps/negentropy/src/negentropy/
├── agents/tools/
│   └── claude_code.py              # invoke_claude_code ADK FunctionTool
├── agents/faculties/
│   └── action.py                   # 注册 invoke_claude_code 到 tools 列表
├── engine/claude_code/
│   ├── __init__.py                 # 包导出
│   ├── models.py                   # ClaudeCodeConfig, ClaudeCodeResult
│   └── service.py                  # ClaudeCodeService（SDK + CLI）
├── engine/schedulers/handlers/
│   └── claude_code.py              # claude_code scheduler handler
├── db/migrations/versions/
│   └── 0039_seed_claude_code_builtin_tool.py  # 系统级 BuiltinTool seed
└── interface/api.py                # test_builtin_tool 扩展

apps/negentropy-ui/
├── app/home-body.tsx               # @claude-code mention candidate 注入
```

## 4. 关键接口

### 4.1 ClaudeCodeService

```python
class ClaudeCodeService:
    @staticmethod
    async def invoke(prompt, config, abort_event=None) -> ClaudeCodeResult
    @staticmethod
    async def test_connection(config) -> dict
```

### 4.2 invoke_claude_code（ADK FunctionTool）

```python
async def invoke_claude_code(
    task: str,                      # 任务描述
    working_directory: str | None,  # 工作目录
    allowed_tools: str | None,      # 允许的工具（逗号分隔）
    max_turns: int,                 # 最大迭代轮数
    system_prompt: str | None,      # 自定义系统指令
    tool_context: ToolContext,       # ADK 注入的上下文
) -> dict[str, Any]                 # {status, summary, session_id, cost_usd, ...}
```

### 4.3 ClaudeCodeResult

```python
@dataclass
class ClaudeCodeResult:
    status: str                    # "success" | "error" | "timeout"
    summary: str                   # 最终文本（≤2000字符）
    session_id: str | None         # 会话 ID（可续接）
    cost_usd: float = 0.0
    turn_count: int = 0
    error: str | None = None
```

## 5. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Claude Code 长时间执行阻塞 ADK Agent | `timeout_seconds` 默认 300s，超时返回 error |
| API Key 安全 | 从 VendorConfig 读取，注入 subprocess 环境 |
| 进程泄漏 | `try/finally` 确保 `terminate` + `wait` |
| SDK 不可用 | 自动降级为 CLI 子进程 |
| 并发冲突 | 同一 cwd 串行执行 |

## 6. 参考文献

- [1] Anthropic, "Claude Code SDK," https://docs.anthropic.com/en/docs/claude-code/sdk, 2025.
- [2] Anthropic, "Claude Code CLI Usage," https://docs.anthropic.com/en/docs/claude-code/cli-usage, 2025.
- [3] Google, "ADK Custom Tools," https://adk.dev/tools-custom/, 2025.
- [4] E. Gamma et al., *Design Patterns: Elements of Reusable Object-Oriented Software*, Addison-Wesley, 1994 — Adapter Pattern.
