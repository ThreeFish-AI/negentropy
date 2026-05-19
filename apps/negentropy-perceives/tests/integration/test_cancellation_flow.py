"""集成测试：取消信号链路（EngineWorkerPool + CancelScope）。

使用内置的 Fake 引擎验证以下场景：
- A: 超时触发 → 子进程被 SIGTERM/SIGKILL → pool 摘除 worker
- B: 客户端取消（task.cancel）→ 同上
- C: 复原 → kill 之后再发起请求能自动重建 worker
- D: thread 隔离降级 → 取消信号让主协程快速返回（线程仍跑完）

依赖：仅使用 stdlib + EngineWorkerPool，无需真实 PDF 库。
"""

from __future__ import annotations

import asyncio
import os
import sys
import time

import pytest

from negentropy.perceives.core.cancellation import bind_cancel_scope
from negentropy.perceives.infra.engine_worker import EngineWorkerPool


@pytest.fixture
async def process_pool():
    """process 隔离 Pool；测试结束后 shutdown。"""
    pool = EngineWorkerPool(
        isolation="process", max_tasks_per_worker=50, kill_grace=1.0
    )
    try:
        yield pool
    finally:
        await pool.shutdown()


@pytest.fixture
async def thread_pool():
    """thread 隔离 Pool（降级方案）。"""
    pool = EngineWorkerPool(isolation="thread")
    try:
        yield pool
    finally:
        await pool.shutdown()


# ── 场景 A：timeout 触发 kill ────────────────────────────────────────────────


class TestScenarioATimeoutKillsWorker:
    @pytest.mark.asyncio
    async def test_timeout_kills_slow_worker(self, process_pool: EngineWorkerPool):
        """超时触发后 worker 子进程应被杀并从 pool 中摘除。"""

        # 预热：跑一个 fast 请求，让 worker 上线
        await process_pool.run(
            "_fake_fast",
            kwargs={"pdf_path": "dummy.pdf"},
        )
        # 但我们要测 _fake_slow，需要新引擎
        # 先预启动 slow worker（用 fast 预热只是为了确认 pool 可用）
        fast_worker = process_pool.workers.get("_fake_fast")
        assert fast_worker is not None
        assert fast_worker.is_alive()

        # 对 _fake_slow 发起一个 30s 请求，但只给 1s 超时
        start = time.monotonic()
        with pytest.raises((TimeoutError, asyncio.CancelledError)):
            async with bind_cancel_scope(timeout=1.0):
                await process_pool.run(
                    "_fake_slow",
                    kwargs={"pdf_path": "dummy.pdf", "sleep_seconds": 30.0},
                )
        elapsed = time.monotonic() - start

        # 超时应在 ~1s 左右触发（允许 kill_grace 额外余量）
        assert elapsed < 4.0, f"取消路径耗时过久: {elapsed:.2f}s"

        # 等待后台 terminate 完成
        await asyncio.sleep(1.5)

        # 验证 pool 已摘除 _fake_slow worker
        assert "_fake_slow" not in process_pool.workers, (
            f"超时后 worker 未被摘除: {process_pool.workers}"
        )


# ── 场景 B：外部 task.cancel() ───────────────────────────────────────────────


class TestScenarioBClientCancel:
    @pytest.mark.asyncio
    async def test_client_cancel_kills_worker(self, process_pool: EngineWorkerPool):
        """外部 task.cancel() 模拟客户端取消，worker 应被杀。"""

        async def runner() -> None:
            async with bind_cancel_scope(timeout=30.0):
                await process_pool.run(
                    "_fake_slow",
                    kwargs={"pdf_path": "dummy.pdf", "sleep_seconds": 30.0},
                )

        task = asyncio.create_task(runner())
        # 让 runner 进入 worker.call 阻塞在 recv
        await asyncio.sleep(0.5)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        # 等后台 terminate 收尾
        await asyncio.sleep(1.5)
        assert "_fake_slow" not in process_pool.workers


# ── 场景 C：kill 之后能自动复原 ──────────────────────────────────────────────


class TestScenarioCRecovery:
    @pytest.mark.asyncio
    async def test_pool_recovers_after_kill(self, process_pool: EngineWorkerPool):
        """超时后的下一次请求应能自动重建 worker 并成功返回。"""

        # 第一次：触发超时，worker 被杀
        with pytest.raises((TimeoutError, asyncio.CancelledError)):
            async with bind_cancel_scope(timeout=0.5):
                await process_pool.run(
                    "_fake_slow",
                    kwargs={"pdf_path": "dummy.pdf", "sleep_seconds": 10.0},
                )
        await asyncio.sleep(1.5)
        assert "_fake_slow" not in process_pool.workers

        # 第二次：正常请求（用一个能立刻返回的 sleep_seconds）
        result = await process_pool.run(
            "_fake_slow",
            kwargs={"pdf_path": "dummy.pdf", "sleep_seconds": 0.01},
        )
        assert result is not None
        assert "slept" in result.get("markdown", "")
        # 重建成功
        assert "_fake_slow" in process_pool.workers
        assert process_pool.workers["_fake_slow"].is_alive()


# ── 场景 D：thread 隔离降级 ─────────────────────────────────────────────────


class TestScenarioDThreadIsolation:
    @pytest.mark.asyncio
    async def test_thread_cancel_unblocks_event_loop(
        self, thread_pool: EngineWorkerPool
    ):
        """thread 模式下取消能解除事件循环阻塞（线程自然完成）。"""

        start = time.monotonic()
        with pytest.raises((TimeoutError, asyncio.CancelledError)):
            async with bind_cancel_scope(timeout=0.5):
                await thread_pool.run(
                    "_fake_slow",
                    kwargs={"pdf_path": "dummy.pdf", "sleep_seconds": 10.0},
                )
        elapsed = time.monotonic() - start
        # 事件循环应在约 0.5s 内解除阻塞（即使底层线程还在 sleep）
        assert elapsed < 2.0, f"thread 降级取消耗时异常: {elapsed:.2f}s"


# ── 基本协议：启动/关闭 / fast path 等 ──────────────────────────────────────


class TestBasicProtocol:
    @pytest.mark.asyncio
    async def test_fast_engine_roundtrip(self, process_pool: EngineWorkerPool):
        """_fake_fast 单次往返成功。"""
        result = await process_pool.run(
            "_fake_fast",
            kwargs={"pdf_path": "dummy.pdf"},
        )
        assert result["engine_name"] == "_fake_fast"
        assert "fast output" in result["markdown"]

    @pytest.mark.asyncio
    async def test_crash_engine_raises(self, process_pool: EngineWorkerPool):
        """_fake_crash 抛异常应回传为 RuntimeError 并保留 worker 存活。"""
        with pytest.raises(RuntimeError, match="fake crash"):
            await process_pool.run(
                "_fake_crash",
                kwargs={"pdf_path": "dummy.pdf"},
            )
        # 引擎层异常 ≠ 进程死亡；worker 应仍在
        w = process_pool.workers.get("_fake_crash")
        assert w is not None and w.is_alive()

    @pytest.mark.asyncio
    async def test_deadline_precheck_fail_fast(self, process_pool: EngineWorkerPool):
        """deadline_monotonic 已过时子进程立刻返回 TimeoutError。"""
        past = time.monotonic() - 1.0
        with pytest.raises(TimeoutError):
            await process_pool.run(
                "_fake_slow",
                kwargs={"pdf_path": "dummy.pdf", "sleep_seconds": 30.0},
                deadline_monotonic=past,
            )
        # deadline 预检不应杀 worker
        w = process_pool.workers.get("_fake_slow")
        assert w is not None and w.is_alive()

    @pytest.mark.asyncio
    async def test_unknown_engine_fails_start(self, process_pool: EngineWorkerPool):
        """未知引擎名启动时即报错。"""
        with pytest.raises(RuntimeError, match="初始化失败|未知引擎"):
            await process_pool.run(
                "_does_not_exist",
                kwargs={"pdf_path": "x.pdf"},
            )

    @pytest.mark.asyncio
    async def test_shutdown_cleans_all_workers(self, process_pool: EngineWorkerPool):
        """shutdown 后 workers dict 清空。"""
        await process_pool.run("_fake_fast", kwargs={"pdf_path": "a.pdf"})
        assert len(process_pool.workers) >= 1
        await process_pool.shutdown()
        assert len(process_pool.workers) == 0


# ── 子进程确实被杀（PID 级验证） ────────────────────────────────────────────


class TestProcessActuallyKilled:
    @pytest.mark.skipif(
        sys.platform == "win32",
        reason="POSIX-only: 依赖 os.kill(pid,0) liveness 语义与 multiprocessing SIGTERM；Windows 下 TerminateProcess 路径异步取消会死锁",
    )
    @pytest.mark.asyncio
    async def test_pid_no_longer_running_after_cancel(
        self, process_pool: EngineWorkerPool
    ):
        """取消后 worker PID 对应的进程不再存在。"""

        # 启动 slow worker
        async def launch() -> int:
            worker = await process_pool._ensure_worker("_fake_slow")  # noqa: SLF001
            return worker.pid or 0

        # 在 engine_lock 外启动 worker
        lock = await process_pool._get_engine_lock("_fake_slow")  # noqa: SLF001
        async with lock:
            pid = await launch()
        assert pid > 0
        assert _pid_alive(pid), "worker 进程未启动"

        # 发起慢请求并取消
        with pytest.raises((TimeoutError, asyncio.CancelledError)):
            async with bind_cancel_scope(timeout=0.5):
                await process_pool.run(
                    "_fake_slow",
                    kwargs={"pdf_path": "x.pdf", "sleep_seconds": 30.0},
                )

        # 等终止 + grace
        await asyncio.sleep(2.0)
        assert not _pid_alive(pid), f"worker 进程 {pid} 未被杀"


def _pid_alive(pid: int) -> bool:
    """轻量级检测 pid 是否仍然存活。"""
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True
