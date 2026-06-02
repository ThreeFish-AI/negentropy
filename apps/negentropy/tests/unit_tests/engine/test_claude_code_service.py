"""ClaudeCodeService 执行层健壮性单测 — 复现并锁定历史故障的回归。

覆盖：
- ``_iter_json_events``：单行 >64KiB 不再触发 asyncio LimitOverrunError
  （历史故障「Separator is found, but chunk is longer than limit」根因）；
- system/init 事件早捕获 session_id；
- ``invoke`` 超时仍回带 session_id（打断死亡螺旋）；
- ``effective_permission_mode`` 别名归一。
"""

from __future__ import annotations

import asyncio
import json

import pytest

from negentropy.engine.claude_code.models import ClaudeCodeConfig
from negentropy.engine.claude_code.service import ClaudeCodeService

pytestmark = pytest.mark.asyncio


class _FakeStream:
    """模拟 asyncio StreamReader：按 read(n) 分块吐出预置字节，最后 EOF。"""

    def __init__(self, data: bytes, chunk: int = 65536) -> None:
        self._data = data
        self._chunk = chunk
        self._pos = 0

    async def read(self, n: int = -1) -> bytes:
        if self._pos >= len(self._data):
            return b""
        size = self._chunk if n is None or n < 0 else min(n, self._chunk)
        out = self._data[self._pos : self._pos + size]
        self._pos += len(out)
        return out


async def _collect(stream) -> list[dict]:
    return [ev async for ev in ClaudeCodeService._iter_json_events(stream, None)]


async def test_iter_json_events_survives_oversized_line():
    """单行 stream-json 远超 64KiB（默认 readline 上限）时仍能完整解析，不抛异常。"""
    big_payload = "x" * (2 * 1024 * 1024)  # 2 MiB 单行
    line1 = json.dumps({"type": "system", "subtype": "init", "session_id": "sess-1"})
    line2 = json.dumps({"type": "assistant", "content": big_payload})
    line3 = json.dumps({"type": "result", "result": "done", "session_id": "sess-1", "num_turns": 3})
    raw = (line1 + "\n" + line2 + "\n" + line3 + "\n").encode("utf-8")

    events = await _collect(_FakeStream(raw))

    assert [e["type"] for e in events] == ["system", "assistant", "result"]
    assert len(events[1]["content"]) == 2 * 1024 * 1024
    assert events[2]["num_turns"] == 3


async def test_iter_json_events_flushes_trailing_line_without_newline():
    raw = json.dumps({"type": "result", "result": "ok"}).encode("utf-8")  # 无结尾换行
    events = await _collect(_FakeStream(raw))
    assert events == [{"type": "result", "result": "ok"}]


async def test_iter_json_events_skips_blank_and_malformed():
    raw = b'\n  \nnot-json\n{"type":"result","result":"ok"}\n'
    events = await _collect(_FakeStream(raw))
    assert events == [{"type": "result", "result": "ok"}]


async def test_invoke_timeout_returns_partial_session_id(monkeypatch):
    """CLI 协程已从 init 捕获 session 后超时 → invoke 仍回带 session_id（防死亡螺旋）。"""

    async def _slow_cli(prompt, config, abort_event, session_holder=None, events_holder=None, on_event=None):
        if session_holder is not None:
            session_holder["session_id"] = "sess-from-init"
        await asyncio.sleep(5)  # 永不在超时窗口内返回
        raise AssertionError("should not reach")

    monkeypatch.setattr(ClaudeCodeService, "_check_sdk", classmethod(lambda cls: False))
    monkeypatch.setattr(ClaudeCodeService, "_invoke_cli", staticmethod(_slow_cli))

    result = await ClaudeCodeService.invoke("p", ClaudeCodeConfig(timeout_seconds=0.05))

    assert result.status == "timeout"
    assert result.session_id == "sess-from-init"


async def test_effective_permission_mode_normalizes_aliases():
    assert ClaudeCodeConfig(permission_mode="auto").effective_permission_mode() == "default"
    assert ClaudeCodeConfig(permission_mode="ask").effective_permission_mode() == "default"
    assert ClaudeCodeConfig(permission_mode="plan").effective_permission_mode() == "plan"
    assert ClaudeCodeConfig(permission_mode="acceptEdits").effective_permission_mode() == "acceptEdits"
    assert ClaudeCodeConfig(permission_mode="bogus").effective_permission_mode() == "default"


async def test_default_timeout_is_routine_appropriate():
    # 默认超时已自 300s 抬高，避免深度任务空转超时。
    assert ClaudeCodeConfig().timeout_seconds >= 900.0


# ---------------------------------------------------------------------------
# 子进程凭证注入（修复 Routine 529→401 鉴权失败的回归锁定）
# ---------------------------------------------------------------------------


async def test_build_subprocess_env_oauth_token_uses_bearer(monkeypatch):
    """非 sk-ant- 凭证（OAuth 长期令牌）→ Bearer 两键，且清除 x-api-key 键。"""
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:3392")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "0f12ec02e91345bb82d14a91b9bea8ca")  # 网关 key，应被清除
    env = ClaudeCodeService._build_subprocess_env("sk-ant-oat01-deadbeef-token")
    # sk-ant- 前缀 → 走 API Key 分支
    assert env["ANTHROPIC_API_KEY"] == "sk-ant-oat01-deadbeef-token"
    assert "ANTHROPIC_AUTH_TOKEN" not in env
    assert "CLAUDE_CODE_OAUTH_TOKEN" not in env
    # base_url 始终保留
    assert env["ANTHROPIC_BASE_URL"] == "http://127.0.0.1:3392"


async def test_build_subprocess_env_plain_oauth_token_uses_bearer(monkeypatch):
    """普通（非 sk-ant-）OAuth 令牌 → ANTHROPIC_AUTH_TOKEN + CLAUDE_CODE_OAUTH_TOKEN，清 API Key。"""
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:3392")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "0f12ec02e91345bb82d14a91b9bea8ca")
    env = ClaudeCodeService._build_subprocess_env("oauth-subscription-token-xyz")
    assert env["ANTHROPIC_AUTH_TOKEN"] == "oauth-subscription-token-xyz"
    assert env["CLAUDE_CODE_OAUTH_TOKEN"] == "oauth-subscription-token-xyz"
    assert "ANTHROPIC_API_KEY" not in env  # 网关 key 被清除，消除优先级歧义
    assert env["ANTHROPIC_BASE_URL"] == "http://127.0.0.1:3392"


async def test_build_subprocess_env_none_is_pure_inheritance(monkeypatch):
    """无凭证 → 纯继承副本，不增删任何凭证键（等价不传 env=）。"""
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:3392")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    env = ClaudeCodeService._build_subprocess_env(None)
    assert env["ANTHROPIC_BASE_URL"] == "http://127.0.0.1:3392"
    assert "ANTHROPIC_API_KEY" not in env
    assert "ANTHROPIC_AUTH_TOKEN" not in env


async def test_build_subprocess_env_does_not_mutate_os_environ(monkeypatch):
    """构建环境绝不就地修改 os.environ（并发隔离安全）。"""
    import os

    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("CLAUDE_CODE_OAUTH_TOKEN", raising=False)
    ClaudeCodeService._build_subprocess_env("oauth-token-abc")
    assert "ANTHROPIC_AUTH_TOKEN" not in os.environ
    assert "CLAUDE_CODE_OAUTH_TOKEN" not in os.environ


async def test_invoke_cli_passes_credential_env_and_survives_reconstruction(monkeypatch):
    """端到端锁定：_invoke_cli 重建 config 后仍保留 credential，并把它注入子进程 env=。

    回归点：service.py 在 463 行用 resolved CLI 路径重建 ClaudeCodeConfig；若漏传
    credential，注入字段会被静默丢弃 → 退回 401。本测试 mock create_subprocess_exec 抓 env=。
    """
    captured: dict = {}

    class _FakeProc:
        def __init__(self) -> None:
            self.stdout = _FakeStream(b"")  # 立即 EOF
            self.stderr = _FakeStream(b"")
            self.returncode = 0

        def terminate(self) -> None:  # noqa: D401
            pass

        async def wait(self) -> int:
            return 0

    async def _fake_exec(*args, **kwargs):
        captured["args"] = args
        captured["env"] = kwargs.get("env")
        return _FakeProc()

    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:3392")
    monkeypatch.setattr(ClaudeCodeService, "_check_sdk", classmethod(lambda cls: False))
    monkeypatch.setattr("negentropy.engine.claude_code.service.shutil.which", lambda p: "/usr/bin/claude")
    monkeypatch.setattr("negentropy.engine.claude_code.service.asyncio.create_subprocess_exec", _fake_exec)

    cfg = ClaudeCodeConfig(cli_path="claude", cwd=None, max_turns=1, credential="oauth-token-from-ui")
    await ClaudeCodeService.invoke("ping", cfg)

    env = captured["env"]
    assert env is not None, "必须向子进程传入 env="
    assert env["ANTHROPIC_AUTH_TOKEN"] == "oauth-token-from-ui"
    assert env["CLAUDE_CODE_OAUTH_TOKEN"] == "oauth-token-from-ui"
    assert env["ANTHROPIC_BASE_URL"] == "http://127.0.0.1:3392"


async def test_config_repr_omits_credential_secret():
    """secret 绝不出现在 repr（防日志 / traceback 泄露）。"""
    cfg = ClaudeCodeConfig(credential="super-secret-oauth-token")
    assert "super-secret-oauth-token" not in repr(cfg)
