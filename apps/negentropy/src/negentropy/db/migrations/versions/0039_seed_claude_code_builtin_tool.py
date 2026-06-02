"""种子化 claude_code 内置工具（系统级、全员可见可用）

Revision ID: 0039
Revises: 0038
Create Date: 2026-05-22 00:00:00.000000+00:00

设计动机：
    `038-claude-code-integration` 设计文档将 Claude Code CLI 作为 ADK Agent 的
    BuiltinTool 接入。前端 Interface / Tools 页通过 ``BuiltinTool`` 行渲染卡片，
    后端 ADK FunctionTool ``invoke_claude_code`` 与 Scheduler handler ``claude_code``
    都在运行时从 ``builtin_tools`` 表读取全局默认配置（cli_path / max_turns /
    timeout_seconds / permission_mode / allowed_tools 等）。

    因此需要一条幂等 seed 迁移，将 ``claude_code`` 行写入 ``builtin_tools`` 表，
    属性约束：
      - ``owner_id = 'system'`` —— 与 0031 的 ``google_search`` 同源，进入
        ``permissions.get_visible_plugin_ids`` 的 system-union 路径
      - ``visibility = 'PUBLIC'`` —— 0036 将列类型从 VARCHAR 升级为
        ``negentropy.pluginvisibility`` 枚举（成员名大写）
      - ``is_system = TRUE`` —— ToolCard 渲染 "Built-In" 徽章并阻止删除
      - ``is_enabled = TRUE`` —— 默认开启，ADK Agent / Scheduler handler 立即可用
      - 不写入 ``credentials`` —— ANTHROPIC_API_KEY 由 VendorConfig 注入子进程
        环境变量，不在此处持久化明文凭据

JSONB 编码：
    沿用 0031 的写法（``sa.bindparam(..., type_=JSONB)`` + Python dict），
    经 0038 验证读取侧正确；不再走 ``json.dumps()`` 字符串预序列化以避免
    双编码问题。

幂等性：
    ``ON CONFLICT (name) DO NOTHING`` 保证重复执行不覆盖运维已调整的配置；
    若需变更默认值，应单独走 data-fix 脚本而非反复 seed。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0039"
down_revision: str | None = "0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"

# Claude Code 默认允许的 ADK Tool 子集（沿用 038 文档约定）。
# Bash / Read / Write / Edit / Glob / Grep 覆盖典型 agentic coding 场景；
# WebFetch / WebSearch / Task 等高权限工具默认禁用，避免长时间脱缰。
_DEFAULT_ALLOWED_TOOLS = ["Bash", "Read", "Write", "Edit", "Glob", "Grep"]

# UI ToolFormDialog 根据 config_schema 动态渲染表单字段。
# 与 ``ClaudeCodeConfig`` 字段保持一一对应（参见
# ``engine/claude_code/models.py``），便于运维直接在 Interface / Tools 页调参。
CLAUDE_CODE_CONFIG_SCHEMA = {
    "config": {
        "cli_path": {
            "type": "string",
            "title": "CLI Path",
            "description": "Claude Code CLI 可执行文件路径（默认沿用系统 PATH 中的 `claude`）",
            "default": "claude",
        },
        "model": {
            "type": "string",
            "title": "Model Override",
            "description": "覆盖 Claude Code 默认模型（留空则使用 SDK / CLI 自身的默认值）",
        },
        "system_prompt": {
            "type": "string",
            "title": "System Prompt",
            "description": "自定义系统指令，会拼接到 Claude Code 默认 system prompt 之后",
        },
        "default_cwd": {
            "type": "string",
            "title": "Default Working Directory",
            "description": "未在 tool call 中显式指定 working_directory 时使用的默认工作目录",
        },
        "max_turns": {
            "type": "integer",
            "title": "Max Turns",
            "description": "Claude Code 在单次调用中允许的最大自主迭代轮数",
            "default": 500,
            "minimum": 1,
            "maximum": 1000,
        },
        "timeout_seconds": {
            "type": "number",
            "title": "Timeout (seconds)",
            "description": "单次 Claude Code 调用的超时上限，超时返回 status=timeout",
            "default": 300.0,
            "minimum": 10.0,
            "maximum": 3600.0,
        },
        "permission_mode": {
            "type": "string",
            "title": "Permission Mode",
            "description": "Claude Code 工具权限模式：auto 默认放行 / ask 逐项询问 / plan 仅规划不执行",
            "enum": ["auto", "ask", "plan"],
            "default": "auto",
        },
        "allowed_tools": {
            "type": "array",
            "title": "Allowed Tools",
            "description": (
                "Claude Code 内置工具白名单"
                "（Bash / Read / Write / Edit / Glob / Grep / WebFetch / WebSearch / Task ...）"
            ),
            "items": {"type": "string"},
            "default": _DEFAULT_ALLOWED_TOOLS,
        },
    },
    "credentials": {
        # Claude Code 子进程出示给 coding-proxy 的「真实 Anthropic 凭证」。
        # 留空则回退环境变量（CLAUDE_CODE_OAUTH_TOKEN / sk-ant- ANTHROPIC_API_KEY）/ 交互式登录态。
        # 注意：这与 VendorConfig(anthropic) 的网关 key 是不同凭证命名空间——后者对根
        # /v1/messages failover anthropic tier 无效（详见迁移 0058 与 engine/claude_code/credentials.py）。
        "oauth_token": {
            "type": "password",
            "title": "Claude Code OAuth Token",
            "description": (
                "claude.ai 订阅长期令牌（`claude setup-token` 生成，注入为 Bearer）；"
                "亦可填真实 `sk-ant-` API Key（注入为 x-api-key）。留空则回退环境变量 / 交互式登录态。"
            ),
        },
    },
}

CLAUDE_CODE_CONFIG_DEFAULT = {
    "cli_path": "claude",
    "model": None,
    "system_prompt": None,
    "default_cwd": None,
    "max_turns": 500,
    "timeout_seconds": 300.0,
    "permission_mode": "auto",
    "allowed_tools": _DEFAULT_ALLOWED_TOOLS,
}

CLAUDE_CODE_DESCRIPTION = (
    "调用本地 Claude Code CLI 完成多文件代码分析、跨文件重构、自主测试修复等复杂 agentic coding 任务。"
    "ADK Agent 通过 invoke_claude_code FunctionTool 触发；Scheduler 可周期性调度 claude_code handler。"
)


def upgrade() -> None:
    op.execute(
        sa.text(
            f"""
            INSERT INTO {SCHEMA}.builtin_tools
                (owner_id, visibility, name, display_name, description,
                 tool_type, version, config, credentials, config_schema,
                 is_enabled, is_system)
            VALUES (
                'system', 'PUBLIC', 'claude_code', 'Claude Code',
                :description,
                'claude_code', '1.0.0',
                :config, :credentials, :config_schema,
                TRUE, TRUE
            )
            ON CONFLICT (name) DO NOTHING
            """
        ).bindparams(
            sa.bindparam("description", value=CLAUDE_CODE_DESCRIPTION, type_=sa.Text),
            sa.bindparam("config", value=CLAUDE_CODE_CONFIG_DEFAULT, type_=sa.dialects.postgresql.JSONB),
            sa.bindparam("credentials", value={}, type_=sa.dialects.postgresql.JSONB),
            sa.bindparam("config_schema", value=CLAUDE_CODE_CONFIG_SCHEMA, type_=sa.dialects.postgresql.JSONB),
        )
    )


def downgrade() -> None:
    op.execute(sa.text(f"DELETE FROM {SCHEMA}.builtin_tools WHERE name = 'claude_code' AND owner_id = 'system'"))
