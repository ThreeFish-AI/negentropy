"""engine.lifecycle 单元测试。

覆盖：disposer 注册 / dispose_all 失败隔离 / track_task 收敛 / 重复调用幂等。
"""

from __future__ import annotations

import asyncio

import pytest

from negentropy.engine import lifecycle


@pytest.fixture(autouse=True)
def _reset_state():
    """每个测试隔离 lifecycle 注册表。"""
    yield
    lifecycle.reset_for_tests()


@pytest.mark.asyncio
async def test_register_and_run_async_disposer():
    called = asyncio.Event()

    async def disposer():
        called.set()

    lifecycle.register_disposer("test", disposer)
    assert "test" in lifecycle.registered_disposers()

    await lifecycle.dispose_all(timeout=1.0)
    assert called.is_set()
    assert "test" not in lifecycle.registered_disposers()


@pytest.mark.asyncio
async def test_sync_disposer_supported():
    """同步无返回的 disposer（如 OTel TracerProvider.shutdown）应被接受。"""
    counter = {"n": 0}

    def disposer():
        counter["n"] += 1

    lifecycle.register_disposer("sync", disposer)
    await lifecycle.dispose_all(timeout=1.0)
    assert counter["n"] == 1


@pytest.mark.asyncio
async def test_failure_isolated_between_disposers():
    """单个 disposer 抛错不应阻塞其它 disposer。"""
    called_b = asyncio.Event()

    async def a():
        raise RuntimeError("boom")

    async def b():
        called_b.set()

    lifecycle.register_disposer("a", a)
    lifecycle.register_disposer("b", b)
    await lifecycle.dispose_all(timeout=1.0)
    assert called_b.is_set()


@pytest.mark.asyncio
async def test_track_task_cancelled_on_dispose():
    """纳管 task 在 dispose_all 时被 cancel + gather。"""

    async def long_running():
        await asyncio.sleep(10)

    task = asyncio.create_task(long_running())
    lifecycle.track_task(task)
    assert lifecycle.tracked_task_count() == 1

    await lifecycle.dispose_all(timeout=1.0)
    assert task.done()
    assert lifecycle.tracked_task_count() == 0


@pytest.mark.asyncio
async def test_dispose_all_idempotent():
    """重复 dispose_all 不抛错且 idempotent。"""
    await lifecycle.dispose_all(timeout=0.1)
    await lifecycle.dispose_all(timeout=0.1)
