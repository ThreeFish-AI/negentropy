"""单元测试：CancelScope 与 bind_cancel_scope 上下文管理器。"""

from __future__ import annotations

import asyncio
import threading
import time

import pytest

from negentropy.perceives.core.cancellation import (
    CancelScope,
    bind_cancel_scope,
    cancel_scope_var,
    current_cancel_scope,
)


# ── CancelScope 基础语义 ──────────────────────────────────────────────────────


class TestCancelScopeBasics:
    def test_fresh_scope_is_not_cancelled(self):
        scope = CancelScope()
        assert scope.cancelled() is False
        assert scope.reason is None

    def test_event_based_cancel(self):
        scope = CancelScope()
        scope.mark_cancelled("client_cancelled")
        assert scope.cancelled() is True
        assert scope.reason == "client_cancelled"
        assert scope.event.is_set() is True

    def test_deadline_based_cancel(self):
        scope = CancelScope(deadline_monotonic=time.monotonic() - 0.01)
        assert scope.deadline_passed() is True
        assert scope.cancelled() is True

    def test_deadline_future_is_not_cancelled(self):
        scope = CancelScope(deadline_monotonic=time.monotonic() + 60.0)
        assert scope.cancelled() is False

    def test_mark_cancelled_is_idempotent_for_reason(self):
        scope = CancelScope()
        scope.mark_cancelled("timeout")
        scope.mark_cancelled("client_cancelled")
        # 首次登记的 reason 不会被后续覆盖
        assert scope.reason == "timeout"

    def test_remaining_returns_none_without_deadline(self):
        scope = CancelScope()
        assert scope.remaining() is None

    def test_remaining_zero_when_passed(self):
        scope = CancelScope(deadline_monotonic=time.monotonic() - 10.0)
        assert scope.remaining() == 0.0

    def test_remaining_positive_before_deadline(self):
        scope = CancelScope(deadline_monotonic=time.monotonic() + 5.0)
        r = scope.remaining()
        assert r is not None
        assert 0.0 < r <= 5.0

    def test_check_raises_on_cancel(self):
        scope = CancelScope()
        scope.mark_cancelled("server_cancelled")
        with pytest.raises(asyncio.CancelledError):
            scope.check()

    def test_check_noop_when_not_cancelled(self):
        scope = CancelScope()
        # 未取消时不应抛出
        scope.check()

    def test_check_sets_timeout_reason_when_deadline_expired(self):
        scope = CancelScope(deadline_monotonic=time.monotonic() - 0.01)
        with pytest.raises(asyncio.CancelledError):
            scope.check()
        assert scope.reason == "timeout"


# ── ContextVar 绑定 ───────────────────────────────────────────────────────────


class TestContextVarBinding:
    def test_default_is_none(self):
        assert cancel_scope_var.get() is None
        assert current_cancel_scope() is None

    @pytest.mark.asyncio
    async def test_bind_sets_contextvar(self):
        async with bind_cancel_scope(timeout=None) as scope:
            assert current_cancel_scope() is scope
        # 退出后还原
        assert current_cancel_scope() is None

    @pytest.mark.asyncio
    async def test_nested_scopes_lifo(self):
        async with bind_cancel_scope(timeout=None) as outer:
            assert current_cancel_scope() is outer
            async with bind_cancel_scope(timeout=None) as inner:
                assert current_cancel_scope() is inner
            assert current_cancel_scope() is outer
        assert current_cancel_scope() is None


# ── bind_cancel_scope 超时与取消 ─────────────────────────────────────────────


class TestBindCancelScopeTimeout:
    @pytest.mark.asyncio
    async def test_timeout_triggers_and_marks_reason(self):
        scope_captured: list[CancelScope] = []
        with pytest.raises(TimeoutError):
            async with bind_cancel_scope(timeout=0.05) as scope:
                scope_captured.append(scope)
                await asyncio.sleep(1.0)
        assert len(scope_captured) == 1
        assert scope_captured[0].reason == "timeout"
        assert scope_captured[0].event.is_set() is True

    @pytest.mark.asyncio
    async def test_no_timeout_when_finished_early(self):
        async with bind_cancel_scope(timeout=1.0) as scope:
            await asyncio.sleep(0.01)
            assert scope.reason is None
            assert scope.cancelled() is False

    @pytest.mark.asyncio
    async def test_external_cancel_marks_client_reason(self):
        """外部 task.cancel() 模拟客户端取消，reason 应为 client_cancelled。"""
        captured: dict[str, CancelScope | None] = {"scope": None}

        async def runner():
            async with bind_cancel_scope(timeout=5.0) as scope:
                captured["scope"] = scope
                await asyncio.sleep(5.0)

        task = asyncio.create_task(runner())
        await asyncio.sleep(0.05)  # 让 runner 进入 scope 后再取消
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        scope = captured["scope"]
        assert scope is not None
        assert scope.reason == "client_cancelled"
        assert scope.event.is_set() is True

    @pytest.mark.asyncio
    async def test_deadline_populated(self):
        async with bind_cancel_scope(timeout=10.0) as scope:
            assert scope.deadline_monotonic is not None
            r = scope.remaining()
            assert r is not None
            assert 0.0 < r <= 10.0

    @pytest.mark.asyncio
    async def test_no_timeout_no_deadline(self):
        async with bind_cancel_scope(timeout=None) as scope:
            assert scope.deadline_monotonic is None
            assert scope.remaining() is None


# ── 跨线程事件轮询 ───────────────────────────────────────────────────────────


class TestThreadingEventInterop:
    @pytest.mark.asyncio
    async def test_thread_observes_cancel_via_event(self):
        """子线程通过 event 能感知到 scope 被取消。"""
        observed: dict[str, bool] = {"seen": False}

        def worker(ev: threading.Event):
            # 在 1s 内若 ev 被 set 则能退出
            if ev.wait(timeout=2.0):
                observed["seen"] = True

        scope = CancelScope()
        t = threading.Thread(target=worker, args=(scope.event,))
        t.start()
        await asyncio.sleep(0.05)
        scope.mark_cancelled("server_cancelled")
        await asyncio.to_thread(t.join, 1.0)
        assert observed["seen"] is True


# ── asyncio.gather 下的 scope 传播 ───────────────────────────────────────────


class TestScopeIsolationInGather:
    @pytest.mark.asyncio
    async def test_parent_scope_propagates_to_children(self):
        captured: list[CancelScope | None] = []

        async def child() -> None:
            captured.append(current_cancel_scope())

        async with bind_cancel_scope(timeout=None) as scope:
            await asyncio.gather(child(), child(), child())
            # 全部子任务都应读到父 scope
            assert all(c is scope for c in captured)
