"""Seed: Playwright Browser 预置 MCP Server + 全系统注入

Revision ID: 0062
Revises: 0061
Create Date: 2026-06-06 00:00:00.000000+00:00

为全系统内置 Playwright 浏览器操作 MCP（``@playwright/mcp``，stdio/headless/isolated），
作为浏览器实机回归验证的默认能力。本迁移按正交分解承载两件事：

B1. 目录卡片（纯 DML，幂等 upsert ``mcp_servers``）：
    在 Interface/MCP 页以「Built-In」徽章展示，并被 Routine 迭代详情 ``McpServersPanel``
    实时拉取展示。``is_system=TRUE`` 必须显式设置——0033 的 backfill 仅覆盖历史行，
    本行系 0033 之后新增，列默认 FALSE。

B2. 全系统注入（幂等合并 ``builtin_tools(claude_code).config``）：
    全系统所有 Claude Code 调用（Routine ``orchestrator._build_config`` /
    Scheduler ``claude_code`` handler / 6 Agents 经 ``invoke_claude_code``）都从
    ``builtin_tools(name='claude_code').config.mcp_config`` 读取全局默认 MCP，并据
    ``config.allowed_tools`` 决定可调用工具。此处把 ``playwright`` 注入 ``mcp_config``，
    并把通配 ``mcp__playwright`` 纳入 ``allowed_tools``（相位权限 acceptEdits 不自动放行
    MCP 调用，必须显式 allow）。

传输规格（``PLAYWRIGHT_*``）单一定义，同时供 B1 目录种子与 B2 全局注入复用，
从根源消除 Split-Brain 漂移（Single Source of Truth）。版本钉死以保障自治运行的确定性。
"""

# ruff: noqa: E501

import json as _json
from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "0062"
down_revision: str | None = "0061"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
SERVER_NAME = "playwright"
# Claude Code allowed-tools 中「放行某 MCP Server 全部工具」的通配写法。
MCP_TOOL_WILDCARD = "mcp__playwright"

# ---------------------------------------------------------------------------
# 传输规格 —— 单一事实源（钉死版本 → 自治运行确定性，ISSUE-114/116 一脉相承）。
# ---------------------------------------------------------------------------
PLAYWRIGHT_COMMAND = "npx"
PLAYWRIGHT_ARGS: list[str] = [
    "@playwright/mcp@0.0.75",
    "--headless",  # 无头：适配自治后台 Routine 运行（无显示环境）
    "--isolated",  # 净室：每会话全新 profile，回归无状态污染（鉴权回归经 storageState 注入）
    "--browser",
    "chromium",
    "--no-sandbox",  # 容器/root 环境运行 headless chromium 必需；仅用于受控的内部/已知 URL 回归
]
# Claude Code ``--mcp-config`` / SDK ``options.mcp_servers`` 的 server 条目形态
# （外层 {"mcpServers": {name: ...}} 由 engine/claude_code/service 层封装）。
PLAYWRIGHT_MCP_ENTRY: dict[str, Any] = {"command": PLAYWRIGHT_COMMAND, "args": PLAYWRIGHT_ARGS}

PLAYWRIGHT_DESCRIPTION = (
    "系统内置的 Playwright 浏览器操作 MCP（@playwright/mcp，stdio · headless · isolated）。"
    "为 Routine 任务与 Agent 的 Claude Code 调用提供页面导航、可访问性快照、表单交互与断言等浏览器工具，"
    "用于运行时浏览器实机回归验证。默认净室（--isolated）；鉴权回归可经 storageState 注入登录态。"
)


def _coerce_config(value: Any) -> dict[str, Any]:
    """安全地把 JSONB 列值转为 dict（防御历史双编码：str/None/dict 皆可）。"""
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str):
        try:
            parsed = _json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, TypeError):
            return {}
    return {}


def upgrade() -> None:
    # --- B1：目录卡片（幂等 upsert；显式 is_system=TRUE）---
    op.execute(
        sa.text(
            f"""
        INSERT INTO {SCHEMA}.mcp_servers (
            owner_id, visibility, name, display_name, description,
            transport_type, command, args, env, url, headers,
            is_enabled, auto_start, is_system, config
        )
        VALUES (
            'system:playwright-browser-preset',
            'PUBLIC'::{SCHEMA}.pluginvisibility,
            :name, 'Playwright Browser', :description,
            'stdio', :command, :args, '{{}}'::jsonb, NULL, '{{}}'::jsonb,
            TRUE, TRUE, TRUE, '{{}}'::jsonb
        )
        ON CONFLICT (name) DO UPDATE SET
            owner_id = EXCLUDED.owner_id,
            visibility = EXCLUDED.visibility,
            display_name = EXCLUDED.display_name,
            description = EXCLUDED.description,
            transport_type = EXCLUDED.transport_type,
            command = EXCLUDED.command,
            args = EXCLUDED.args,
            env = EXCLUDED.env,
            url = EXCLUDED.url,
            headers = EXCLUDED.headers,
            is_enabled = EXCLUDED.is_enabled,
            auto_start = EXCLUDED.auto_start,
            is_system = EXCLUDED.is_system,
            updated_at = now()
        """
        ).bindparams(
            sa.bindparam("name", value=SERVER_NAME, type_=sa.Text),
            sa.bindparam("description", value=PLAYWRIGHT_DESCRIPTION, type_=sa.Text),
            sa.bindparam("command", value=PLAYWRIGHT_COMMAND, type_=sa.Text),
            sa.bindparam("args", value=PLAYWRIGHT_ARGS, type_=JSONB),
        )
    )

    # --- B2：全系统注入（幂等合并 builtin_tools(claude_code).config）---
    conn = op.get_bind()
    row = conn.execute(
        sa.text(f"SELECT config FROM {SCHEMA}.builtin_tools WHERE name = 'claude_code' AND owner_id = 'system'")
    ).first()
    if row is not None:
        config = _coerce_config(row[0])
        mcp_config = dict(config.get("mcp_config") or {})
        mcp_config[SERVER_NAME] = PLAYWRIGHT_MCP_ENTRY
        config["mcp_config"] = mcp_config

        allowed = list(config.get("allowed_tools") or [])
        if MCP_TOOL_WILDCARD not in allowed:
            allowed.append(MCP_TOOL_WILDCARD)
        config["allowed_tools"] = allowed

        conn.execute(
            sa.text(
                f"UPDATE {SCHEMA}.builtin_tools SET config = :config, updated_at = now() "
                f"WHERE name = 'claude_code' AND owner_id = 'system'"
            ).bindparams(sa.bindparam("config", value=config, type_=JSONB))
        )


def downgrade() -> None:
    # 回收目录种子（仅 seed，不触碰 schema）
    op.execute(
        sa.text(f"DELETE FROM {SCHEMA}.mcp_servers WHERE name = :name").bindparams(
            sa.bindparam("name", value=SERVER_NAME, type_=sa.Text)
        )
    )

    # 回收全系统注入：移除 mcp_config.playwright 与 allowed_tools 中的 mcp__playwright
    conn = op.get_bind()
    row = conn.execute(
        sa.text(f"SELECT config FROM {SCHEMA}.builtin_tools WHERE name = 'claude_code' AND owner_id = 'system'")
    ).first()
    if row is not None:
        config = _coerce_config(row[0])
        mcp_config = dict(config.get("mcp_config") or {})
        mcp_config.pop(SERVER_NAME, None)
        if mcp_config:
            config["mcp_config"] = mcp_config
        else:
            config.pop("mcp_config", None)
        config["allowed_tools"] = [t for t in (config.get("allowed_tools") or []) if t != MCP_TOOL_WILDCARD]

        conn.execute(
            sa.text(
                f"UPDATE {SCHEMA}.builtin_tools SET config = :config, updated_at = now() "
                f"WHERE name = 'claude_code' AND owner_id = 'system'"
            ).bindparams(sa.bindparam("config", value=config, type_=JSONB))
        )
