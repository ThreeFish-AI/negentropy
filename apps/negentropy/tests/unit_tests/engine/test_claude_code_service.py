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

    async def _slow_cli(prompt, config, abort_event, session_holder=None):
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
