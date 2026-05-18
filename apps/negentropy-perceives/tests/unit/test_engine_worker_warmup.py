"""单元测试：``EngineWorkerPool.warmup`` 预热语义。

覆盖：

1. inline / thread 模式下 warmup 直接 no-op 返回 True；
2. process 模式下 warmup 触发 ``_ensure_worker``，但不递增 task_count；
3. 重复调用幂等：仅启动一次子进程；
4. 启动失败时返回 False，不抛异常、不破坏 pool。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from negentropy.perceives.infra.engine_worker import EngineWorkerPool


@pytest.mark.asyncio
class TestWarmupModeBypass:
    async def test_inline_mode_returns_true_without_subprocess(self) -> None:
        pool = EngineWorkerPool(isolation="inline")
        ok = await pool.warmup("docling")
        assert ok is True
        assert pool.workers == {}

    async def test_thread_mode_returns_true_without_subprocess(self) -> None:
        pool = EngineWorkerPool(isolation="thread")
        ok = await pool.warmup("mineru")
        assert ok is True
        assert pool.workers == {}


@pytest.mark.asyncio
class TestProcessModeWarmup:
    async def test_warmup_invokes_ensure_worker(self) -> None:
        """process 模式下 warmup 应调用 _ensure_worker 拉起子进程。"""
        pool = EngineWorkerPool(isolation="process")

        # 替换 _ensure_worker 为一个伪 worker 工厂
        fake_worker = MagicMock()
        fake_worker.pid = 99999
        fake_worker.is_alive = MagicMock(return_value=True)
        ensure_mock = AsyncMock(return_value=fake_worker)
        pool._ensure_worker = ensure_mock  # type: ignore[method-assign]

        ok = await pool.warmup("docling")
        assert ok is True
        ensure_mock.assert_awaited_once_with("docling")

    async def test_warmup_failure_returns_false_no_raise(self) -> None:
        """子进程启动失败时返回 False，不抛异常。"""
        pool = EngineWorkerPool(isolation="process")

        async def _fail(_engine: str) -> Any:
            raise RuntimeError("spawn 失败：fork 受限")

        pool._ensure_worker = _fail  # type: ignore[method-assign,assignment]

        ok = await pool.warmup("marker")
        assert ok is False

    async def test_warmup_idempotent_via_ensure_worker_alive_check(self) -> None:
        """同一引擎重复 warmup 应复用现有 worker（_ensure_worker 内部判 is_alive）。"""
        pool = EngineWorkerPool(isolation="process")

        existing = MagicMock()
        existing.pid = 12345
        existing.is_alive = MagicMock(return_value=True)
        # 注入到 pool._workers 模拟首次 warmup 已完成
        pool._workers["docling"] = existing  # type: ignore[index]

        # _ensure_worker 检测到 alive 应直接返回，不创建新 worker
        # 这里直接调用真实方法，验证返回值
        worker = await pool._ensure_worker("docling")
        assert worker is existing

        ok = await pool.warmup("docling")
        assert ok is True

    async def test_warmup_after_close_returns_false(self) -> None:
        """pool 已关闭后 warmup 直接返回 False。"""
        pool = EngineWorkerPool(isolation="process")
        await pool.shutdown()
        ok = await pool.warmup("docling")
        assert ok is False


def test_warmup_does_not_increment_task_count() -> None:
    """文档级断言：warmup 路径不调用 worker.call，因此 _task_count 不增。

    实现细节：``warmup`` 内部仅 ``_ensure_worker`` → ``_proc.start()`` →
    ``ready handshake``，跳过 ``call()`` 中的 ``self._task_count += 1``。
    """
    import inspect

    from negentropy.perceives.infra.engine_worker import EngineWorkerPool

    source = inspect.getsource(EngineWorkerPool.warmup)
    assert "call(" not in source, (
        "warmup 不应调用 worker.call，否则会污染 max_tasks 计数"
    )
    assert "_ensure_worker" in source
