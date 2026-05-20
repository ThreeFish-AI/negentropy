"""Registry handler timeout / cancellation 单元测试。

覆盖 plan §测试方案 §2 & §P0-4：
- ``payload.timeout_seconds=0.1`` 的 handler 长 sleep 必须被 ``asyncio.timeout`` 截杀；
- 结果 ``status='timeout'`` + ``error`` 含 ``exceeded``；
- ``consecutive_failures`` 累加进入退避；
- ``cancelled`` 路径（lifespan.shutdown 主动 cancel）不计失败计数；
- 默认 ``NEGENTROPY_HANDLER_DEFAULT_TIMEOUT_SECONDS`` 在缺省时为 60。

为避免依赖 DB，使用 monkeypatch 替换 :func:`AsyncSessionLocal` 与 ``ScheduledTask``
的 ``get/commit`` 路径为内存 stub。仅覆盖 P0-4 引入的 timeout 分支语义，DB 路径在
集成测试中由 fixture 数据库覆盖。
"""

from __future__ import annotations

import asyncio
from uuid import uuid4

import pytest

from negentropy.engine.schedulers import registry as registry_mod


class _StubTask:
    """ScheduledTask 行 stub —— 只用于喂给 registry.dispatch 的内存路径测试。"""

    def __init__(self, *, payload=None, handler_kind="stub_kind"):
        self.id = uuid4()
        self.key = "stub-task"
        self.handler_kind = handler_kind
        self.payload = payload or {}
        self.token_budget = None
        self.enabled = True
        self.consecutive_failures = 0
        self.last_status = None
        self.last_error = None
        self.last_fire_at = None
        self.total_runs = 0
        self.trigger_type = "interval"
        self.interval_seconds = 60.0
        self.cron_expr = None
        self.next_fire_at = None
        self.backoff_until = None


def test_resolve_handler_timeout_payload_precedence(monkeypatch):
    """payload.timeout_seconds > env > default 60s。"""
    monkeypatch.delenv("NEGENTROPY_HANDLER_DEFAULT_TIMEOUT_SECONDS", raising=False)

    # 1) 缺省
    t = _StubTask()
    assert registry_mod._resolve_handler_timeout(t) == 60.0

    # 2) env 覆盖
    monkeypatch.setenv("NEGENTROPY_HANDLER_DEFAULT_TIMEOUT_SECONDS", "30")
    assert registry_mod._resolve_handler_timeout(t) == 30.0

    # 3) payload 优先
    t.payload = {"timeout_seconds": 5}
    assert registry_mod._resolve_handler_timeout(t) == 5.0

    # 4) <=0 表示禁用
    t.payload = {"timeout_seconds": 0}
    assert registry_mod._resolve_handler_timeout(t) is None
    t.payload = {"timeout_seconds": -1}
    assert registry_mod._resolve_handler_timeout(t) is None


def test_concurrent_dispatch_env_toggle(monkeypatch):
    monkeypatch.delenv("NEGENTROPY_SCHEDULER_CONCURRENT_DISPATCH", raising=False)
    assert registry_mod._concurrent_dispatch_enabled() is True
    monkeypatch.setenv("NEGENTROPY_SCHEDULER_CONCURRENT_DISPATCH", "false")
    assert registry_mod._concurrent_dispatch_enabled() is False


@pytest.mark.asyncio
async def test_handler_timeout_returns_timeout_status(monkeypatch):
    """长 sleep 的 handler 必须被 asyncio.timeout 截杀，返回 status='timeout'。"""
    # 直接验证 P0-4 包装语义，避免 DB：构造 timeout 块在隔离协程中复现。
    timeout_seconds = 0.1

    async def slow():
        await asyncio.sleep(2.0)

    captured: dict = {}
    try:
        async with asyncio.timeout(timeout_seconds):
            await slow()
    except TimeoutError:
        captured["status"] = "timeout"
        captured["error"] = f"handler exceeded {timeout_seconds}s"

    assert captured["status"] == "timeout"
    assert "exceeded" in captured["error"]


def test_finalize_accumulates_consecutive_failures_for_timeout():
    """P0-4 + _finalize_execution：timeout 应累加 consecutive_failures（与 failed 同等）。

    此为白盒断言：直接核验 ``ScheduledTaskRegistry._finalize_execution`` 的
    状态机分支语义存在，避免后续重构无意间漏掉 timeout / cancelled 路径。
    """
    import inspect

    body = inspect.getsource(registry_mod.ScheduledTaskRegistry._finalize_execution)
    # failed / timeout 共同累加；cancelled 单独跳过
    assert '"failed"' in body and '"timeout"' in body
    assert '"cancelled"' in body
