"""ADK 工具调用遥测采集器单测 — _make_digest / _resolve_tool_kind / callback 工厂 / _schedule_write。

monkeypatch settings + ADK tool_context；不连真实 DB（fire-and-forget 写库用 patch 拦截）。
"""

from __future__ import annotations

import time
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from negentropy.engine.observability import tool_telemetry as tt

# ---------------------------------------------------------------------------
# _make_digest
# ---------------------------------------------------------------------------


def test_make_digest_short_returns_original():
    assert tt._make_digest("abc") == "abc"


def test_make_digest_none_returns_none():
    assert tt._make_digest(None) is None


def test_make_digest_over_cap_truncates_with_hash():
    big = "x" * (tt._DIGEST_CAP + 100)
    out = tt._make_digest(big)
    assert out is not None
    assert len(out) <= tt._DIGEST_CAP
    assert "truncated 100 chars" in out
    assert "sha256=" in out
    assert len(out.split("sha256=")[1].rstrip("]")) == 12


# ---------------------------------------------------------------------------
# _resolve_tool_kind
# ---------------------------------------------------------------------------


def test_resolve_tool_kind_skill():
    assert tt._resolve_tool_kind("expand_skill") == tt.TOOL_KIND_SKILL
    assert tt._resolve_tool_kind("list_available_skills") == tt.TOOL_KIND_SKILL


def test_resolve_tool_kind_builtin():
    assert tt._resolve_tool_kind("transfer_to_agent") == tt.TOOL_KIND_BUILTIN


def test_resolve_tool_kind_mcp_prefix():
    assert tt._resolve_tool_kind("mcp__knowledge__kb_search") == tt.TOOL_KIND_MCP


def test_resolve_tool_kind_default_adk_function():
    assert tt._resolve_tool_kind("log_activity") == tt.TOOL_KIND_ADK_FUNCTION
    assert tt._resolve_tool_kind("unknown_tool") == tt.TOOL_KIND_ADK_FUNCTION


# ---------------------------------------------------------------------------
# callback 工厂（灰度关 → None）
# ---------------------------------------------------------------------------


def test_callback_factory_disabled_returns_none(monkeypatch):
    from negentropy.config.observability import ObservabilitySettings

    monkeypatch.setattr(tt.settings, "observability", ObservabilitySettings(tool_telemetry_enabled=False))
    assert tt.make_before_tool_callback() is None
    assert tt.make_after_tool_callback() is None


def test_callback_factory_enabled_returns_callable(monkeypatch):
    from negentropy.config.observability import ObservabilitySettings

    monkeypatch.setattr(tt.settings, "observability", ObservabilitySettings(tool_telemetry_enabled=True))
    cb = tt.make_after_tool_callback()
    assert cb is not None and callable(cb)


# ---------------------------------------------------------------------------
# _emit_tool_invocation（构造行 + fire-and-forget）
# ---------------------------------------------------------------------------


def _make_tool_context(*, fc_id="fc-1", start=None, caller_kind=None, agent_name="TestAgent"):
    state = {}
    if start is not None:
        state[f"{tt._START_KEY_PREFIX}{fc_id}"] = start
    if caller_kind is not None:
        state["__caller_kind"] = caller_kind
    inv_ctx = SimpleNamespace(agent_name=agent_name)
    session = SimpleNamespace(id="thread-uuid-1")
    return SimpleNamespace(
        function_call_id=fc_id,
        state=state,
        _invocation_context=inv_ctx,
        session=session,
    )


def test_emit_tool_invocation_constructs_success_row(monkeypatch):
    """after callback → 构造 ToolInvocation 行（caller_kind=adk_agent, status=success, latency 为正）。"""
    captured: list = []
    monkeypatch.setattr(tt, "_schedule_write", lambda row: captured.append(row))

    tool = SimpleNamespace(name="log_activity")
    ctx = _make_tool_context(start=time.monotonic() - 0.01)  # 10ms 前
    tt._emit_tool_invocation(tool, {"query": "test"}, ctx, {"result": "ok"})

    assert len(captured) == 1
    row = captured[0]
    assert row.caller_kind == "adk_agent"
    assert row.tool_ref == "log_activity"
    assert row.tool_kind == tt.TOOL_KIND_ADK_FUNCTION
    assert row.status == tt.STATUS_SUCCESS
    assert row.latency_ms is not None and row.latency_ms >= 0
    assert row.agent_name == "TestAgent"
    assert row.thread_id == "thread-uuid-1"
    assert row.outcome_source == tt.OUTCOME_SOURCE_NONE


def test_emit_tool_invocation_error_status(monkeypatch):
    """tool_response 含 error 键 → status=error, error_class 非 None。"""
    captured: list = []
    monkeypatch.setattr(tt, "_schedule_write", lambda row: captured.append(row))
    tool = SimpleNamespace(name="execute_code")
    ctx = _make_tool_context(start=time.monotonic())
    tt._emit_tool_invocation(tool, {}, ctx, {"error": "SyntaxError"})

    assert captured[0].status == tt.STATUS_ERROR
    assert captured[0].error_class == "SyntaxError"


def test_emit_tool_invocation_state_caller_kind_override(monkeypatch):
    """state['__caller_kind'] 覆盖默认 adk_agent（后续 routine 切片注入 hook）。"""
    captured: list = []
    monkeypatch.setattr(tt, "_schedule_write", lambda row: captured.append(row))
    tool = SimpleNamespace(name="bash")
    ctx = _make_tool_context(start=time.monotonic(), caller_kind="routine")
    tt._emit_tool_invocation(tool, {}, ctx, {})
    assert captured[0].caller_kind == "routine"


# ---------------------------------------------------------------------------
# _schedule_write（fire-and-forget ceiling + 吞异常）
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_schedule_write_ceiling_drops(monkeypatch):
    """inflight 达 ceiling → 丢弃 + 记 warning。"""
    fake_tasks = {object() for _ in range(256)}  # object() 可 hash，占位 pending
    monkeypatch.setattr(tt, "_pending_tool_telemetry", fake_tasks)
    monkeypatch.setattr(tt.asyncio, "get_running_loop", lambda: SimpleNamespace(create_task=AsyncMock()))

    tt._schedule_write(SimpleNamespace())  # 应丢弃（不调 create_task）
    assert len(fake_tasks) == 256  # 未新增


@pytest.mark.asyncio
async def test_persist_row_swallows_exception(monkeypatch):
    """DB 写失败 → 不 re-raise（遥测故障不影响主链路）。"""

    class _BoomDb:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        def add(self, *a):
            pass

        async def commit(self):
            raise RuntimeError("db down")

    monkeypatch.setattr(tt.db_session, "AsyncSessionLocal", lambda: _BoomDb())
    await tt._persist_row(SimpleNamespace())  # 不抛即通过


def test_safe_json_handles_non_serializable():
    assert tt._safe_json({"x": object()}) is not None  # default=str 不抛
    assert tt._safe_json(None) is None


def test_safe_get_agent_name_missing_invocation_context():
    """tool_context 无 _invocation_context → 返回 None（不抛）。"""
    ctx = SimpleNamespace(spec=[])  # 无任何属性
    assert tt._safe_get_agent_name(ctx) is None
    assert tt._safe_get_thread_id(ctx) is None
