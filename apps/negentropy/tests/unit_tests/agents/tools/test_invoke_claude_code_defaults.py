"""invoke_claude_code 全局默认回退单测（6 Agents MCP 缺口修复）。

覆盖点：
- session state 未注入 ``claude_code_config`` 时，回退 ``_load_claude_code_defaults()``
  （单一事实源），使 ADK Agent 的 invoke_claude_code 获得默认 ``mcp_config``
  （系统内置 playwright 浏览器 MCP）与 ``allowed_tools``；
- 回退路径复用已解析凭证；
- session state 已注入时，沿用 state 配置（不触发回退）。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from negentropy.engine.claude_code.models import ClaudeCodeConfig, ClaudeCodeResult


class _FakeState:
    def __init__(self, data: dict[str, Any] | None = None) -> None:
        self.data: dict[str, Any] = dict(data or {})

    def get(self, key: str, default: Any = None) -> Any:
        return self.data.get(key, default)

    def __setitem__(self, key: str, value: Any) -> None:
        self.data[key] = value

    def __getitem__(self, key: str) -> Any:
        return self.data[key]

    def __contains__(self, key: str) -> bool:
        return key in self.data


class _FakeToolContext:
    def __init__(self, state: dict[str, Any] | None = None) -> None:
        self.state = _FakeState(state)


def _ok_result() -> ClaudeCodeResult:
    return ClaudeCodeResult(status="success", summary="ok", session_id=None)


@pytest.mark.asyncio
async def test_invoke_claude_code_falls_back_to_global_defaults_when_state_empty() -> None:
    """state 为空 → 回退全局默认，携带 playwright mcp_config 与 mcp__playwright allowed_tools。"""
    from negentropy.agents.tools.claude_code import invoke_claude_code

    defaults = ClaudeCodeConfig(
        cli_path="claude",
        mcp_config={"playwright": {"command": "npx", "args": ["@playwright/mcp@0.0.75", "--headless"]}},
        allowed_tools=["Bash", "Read", "mcp__playwright"],
        credential="sk-ant-test",
    )

    captured: dict[str, ClaudeCodeConfig] = {}

    async def _fake_invoke(task: str, config: ClaudeCodeConfig) -> ClaudeCodeResult:
        captured["config"] = config
        return _ok_result()

    ctx = _FakeToolContext()  # 空 state → 触发回退
    with (
        patch(
            "negentropy.engine.schedulers.handlers.claude_code._load_claude_code_defaults",
            new=AsyncMock(return_value=defaults),
        ),
        patch(
            "negentropy.agents.tools.claude_code.ClaudeCodeService.invoke",
            new=AsyncMock(side_effect=_fake_invoke),
        ),
    ):
        out = await invoke_claude_code(task="t", tool_context=ctx)

    cfg = captured["config"]
    assert cfg.mcp_config == {"playwright": {"command": "npx", "args": ["@playwright/mcp@0.0.75", "--headless"]}}
    assert "mcp__playwright" in (cfg.allowed_tools or [])
    assert cfg.credential == "sk-ant-test"  # 复用已解析凭证（不二次解析）
    assert out["status"] == "success"


@pytest.mark.asyncio
async def test_invoke_claude_code_prefers_session_state_when_present() -> None:
    """state 已注入 → 沿用 state 配置，不触发全局默认回退。"""
    from negentropy.agents.tools.claude_code import invoke_claude_code

    ctx = _FakeToolContext(
        {
            "claude_code_config": {
                "cli_path": "claude",
                "mcp_config": {"custom": {"command": "echo"}},
                "allowed_tools": ["Bash"],
            }
        }
    )

    captured: dict[str, ClaudeCodeConfig] = {}

    async def _fake_invoke(task: str, config: ClaudeCodeConfig) -> ClaudeCodeResult:
        captured["config"] = config
        return _ok_result()

    fallback = AsyncMock()
    with (
        patch("negentropy.engine.schedulers.handlers.claude_code._load_claude_code_defaults", new=fallback),
        patch(
            "negentropy.agents.tools.claude_code.ClaudeCodeService.invoke",
            new=AsyncMock(side_effect=_fake_invoke),
        ),
    ):
        await invoke_claude_code(task="t", tool_context=ctx)

    fallback.assert_not_awaited()  # 未触发回退
    assert captured["config"].mcp_config == {"custom": {"command": "echo"}}
    assert captured["config"].allowed_tools == ["Bash"]
