"""AsyncScheduler.aclose 优雅关停单元测试。

覆盖 plan §测试方案 §1：
- ``aclose(timeout=2)`` 在主心跳 task 与 inflight tasks 内仍在 ``sleep(30)`` 时
  必须 ≤3s 返回；
- ``_run_loop`` task 与 inflight task 退出后均为 ``done()``，且因 CancelledError 终止；
- ``aclose`` 幂等（重复调用不抛错）。

设计要点：
- 用极短 ``poll_interval=0.05s`` 让 tick 频率压到测试可观察窗口；
- ``slow_callback`` 内部 ``await asyncio.sleep(30)`` 模拟卡死的 handler；
- ``asyncio.wait_for(aclose(...), 5)`` 给整体测试一个安全围栏，超时即认定失败。
"""

from __future__ import annotations

import asyncio
import time

import pytest

from negentropy.engine.schedulers.async_scheduler import AsyncScheduler


@pytest.mark.asyncio
async def test_aclose_returns_within_timeout_when_callback_hangs():
    """关停时即便 handler 在长 sleep 中，aclose 也应在 timeout 内返回。"""
    scheduler = AsyncScheduler(poll_interval=0.05)
    sleep_started = asyncio.Event()

    async def slow_callback() -> None:
        sleep_started.set()
        await asyncio.sleep(30)

    scheduler.register(key="slow", callback=slow_callback, interval_seconds=0.05)
    scheduler.start()

    # 等待 slow_callback 真正开始执行（至少跑过一个 tick）
    await asyncio.wait_for(sleep_started.wait(), timeout=1.0)

    t0 = time.monotonic()
    await asyncio.wait_for(scheduler.aclose(timeout=2.0), timeout=5.0)
    elapsed = time.monotonic() - t0

    assert elapsed < 3.0, f"aclose 耗时 {elapsed:.2f}s 超出预期 3s"
    assert not scheduler.is_running
    assert scheduler._task is None  # noqa: SLF001 — 测试内部状态
    assert not scheduler._inflight  # noqa: SLF001


@pytest.mark.asyncio
async def test_aclose_is_idempotent():
    """重复 aclose 不应抛异常。"""
    scheduler = AsyncScheduler(poll_interval=0.05)
    scheduler.register(key="noop", callback=_noop_coro, interval_seconds=60)
    scheduler.start()
    await scheduler.aclose(timeout=1.0)
    # 第二次调用应直接返回，无副作用
    await scheduler.aclose(timeout=1.0)
    assert not scheduler.is_running


@pytest.mark.asyncio
async def test_run_loop_breaks_on_cancellation():
    """_run_loop 应在 CancelledError 时显式 break，而非透传引发 task 异常。"""
    scheduler = AsyncScheduler(poll_interval=0.05)
    scheduler.register(key="noop", callback=_noop_coro, interval_seconds=60)
    scheduler.start()

    # 直接 cancel 主 task，模拟 aclose 中的 Step 1
    main_task = scheduler._task  # noqa: SLF001
    assert main_task is not None
    main_task.cancel()
    # 给事件循环机会切回 _run_loop
    await asyncio.sleep(0.1)
    assert main_task.done()
    # _run_loop 显式 break，task 应 normal 完成（result）或 cancelled，但不应抛非 CancelledError
    if not main_task.cancelled():
        # 正常 break 路径
        assert main_task.exception() is None

    # 收尾
    await scheduler.aclose(timeout=1.0)


@pytest.mark.asyncio
async def test_sync_stop_still_works_as_fallback():
    """同步 stop() 必须保留为兼容入口（测试套件 reset_registry_for_tests 仍调用）。"""
    scheduler = AsyncScheduler(poll_interval=0.05)
    scheduler.register(key="noop", callback=_noop_coro, interval_seconds=60)
    scheduler.start()
    scheduler.stop()  # 不应抛错；不保证已退出，但状态需更新
    assert not scheduler.is_running
    # 让事件循环消化 cancel
    await asyncio.sleep(0.1)


async def _noop_coro() -> None:
    return None
