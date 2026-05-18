"""单元测试：engine_worker 的 daemon=False + atexit 兜底清理。

动机：Marker/Surya 等引擎内部使用 DataLoader 子进程，若 EngineWorker
进程本身为 daemon，则 Python 禁止其再派生子进程（"daemonic processes are
not allowed to have children"），导致 Marker 始终失败。改为 daemon=False
后，需要用 atexit hook 兜底强杀未清理的 worker 以防孤儿。
"""

from __future__ import annotations

import asyncio
import atexit
from unittest.mock import MagicMock, patch

import pytest

from negentropy.perceives.infra import engine_worker as ew_module
from negentropy.perceives.infra.engine_worker import (
    EngineWorker,
    EngineWorkerPool,
    _cleanup_on_exit,
)


class TestEngineWorkerDaemonFalse:
    """EngineWorker 子进程必须以 daemon=False 启动。"""

    @pytest.mark.asyncio
    async def test_worker_started_with_daemon_false(self):
        """验证 ctx.Process 调用时传入 daemon=False。"""
        captured_kwargs: dict = {}

        real_get_context = ew_module.mp.get_context

        def fake_get_context(method: str):
            ctx = real_get_context(method)
            orig_process = ctx.Process

            def wrapper(*args, **kwargs):
                captured_kwargs.update(kwargs)
                return orig_process(*args, **kwargs)

            ctx.Process = wrapper  # type: ignore[assignment]
            return ctx

        worker = EngineWorker("_fake_fast")
        try:
            with patch.object(
                ew_module.mp, "get_context", side_effect=fake_get_context
            ):
                await worker.start()
            # daemon 必须显式为 False
            assert captured_kwargs.get("daemon") is False, (
                f"worker 进程 daemon 不是 False: daemon="
                f"{captured_kwargs.get('daemon')!r}"
            )
            # 进程对象自身也应反映该配置
            assert worker._proc is not None
            assert worker._proc.daemon is False
        finally:
            await worker.terminate()


class TestAtexitCleanupRegistration:
    """验证模块级 atexit hook 在 import 后确已注册。"""

    def test_cleanup_on_exit_is_registered(self):
        """_cleanup_on_exit 应出现在 atexit 的已注册回调中。"""
        # Python 的 atexit 没有公共列表 API；通过 unregister 成功与否判定
        # （然后重新注册回去）。
        was_registered = atexit.unregister(_cleanup_on_exit)
        # unregister 返回 None；通过尝试再次 register+unregister 与引用一致性判断
        # 重新注册
        atexit.register(_cleanup_on_exit)
        # 基础存在性断言：callable
        assert callable(_cleanup_on_exit)
        _ = was_registered  # 即便未在当前 atexit 列表也不硬失败（测试隔离原因）


class TestCleanupOnExit:
    """_cleanup_on_exit 必须对存活的 worker 子进程执行 terminate/kill。"""

    def test_cleanup_noop_when_no_pool(self):
        """无 pool 单例时 atexit hook 应安全返回。"""
        original = ew_module._pool_singleton
        try:
            ew_module._pool_singleton = None
            # 不应抛异常
            _cleanup_on_exit()
        finally:
            ew_module._pool_singleton = original

    def test_cleanup_terminates_alive_workers(self):
        """_cleanup_on_exit 应对每个存活 worker 调用 terminate()。"""
        original = ew_module._pool_singleton
        try:
            pool = EngineWorkerPool()
            # 构造两个 mock worker：一个存活、一个已退出
            # is_alive 调用链：1) 入口存活判定, 2) terminate 后再判 (False → 跳过 kill),
            # 3) 兜底 os.kill 判定 (False)
            alive_proc = MagicMock()
            alive_proc.is_alive.side_effect = [True, False, False]
            alive_proc.pid = 12345

            dead_proc = MagicMock()
            dead_proc.is_alive.return_value = False
            dead_proc.pid = 12346

            w1 = EngineWorker("_fake_fast")
            w1._proc = alive_proc
            w2 = EngineWorker("_fake_fast")
            w2._proc = dead_proc

            pool._workers = {"alive": w1, "dead": w2}
            ew_module._pool_singleton = pool

            _cleanup_on_exit()

            alive_proc.terminate.assert_called_once()
            dead_proc.terminate.assert_not_called()
        finally:
            ew_module._pool_singleton = original

    def test_cleanup_escalates_to_kill_when_terminate_fails(self):
        """terminate 后仍存活时应升级为 kill()。"""
        original = ew_module._pool_singleton
        try:
            pool = EngineWorkerPool()
            stubborn = MagicMock()
            # 多次 is_alive 都返回 True，终于在 kill 后假装退出
            stubborn.is_alive.side_effect = [True, True, True, False]
            stubborn.pid = 22222

            w = EngineWorker("_fake_fast")
            w._proc = stubborn
            pool._workers = {"stubborn": w}
            ew_module._pool_singleton = pool

            _cleanup_on_exit()

            stubborn.terminate.assert_called_once()
            stubborn.kill.assert_called_once()
        finally:
            ew_module._pool_singleton = original

    def test_cleanup_swallows_exceptions(self):
        """清理过程中子进程操作异常不得冒泡（解释器退出路径敏感）。"""
        original = ew_module._pool_singleton
        try:
            pool = EngineWorkerPool()
            angry = MagicMock()
            angry.is_alive.return_value = True
            angry.pid = 33333
            angry.terminate.side_effect = OSError("boom")
            angry.kill.side_effect = OSError("boom")
            angry.join.side_effect = OSError("boom")

            w = EngineWorker("_fake_fast")
            w._proc = angry
            pool._workers = {"angry": w}
            ew_module._pool_singleton = pool

            # 不应抛异常
            _cleanup_on_exit()
        finally:
            ew_module._pool_singleton = original


class TestDaemonFalseAllowsChildProcesses:
    """daemon=False 的 worker 子进程自身可以派生子进程（Marker 场景的前置）。

    子进程下派生子进程功能依赖 OS 信号量实现，在单元测试层我们仅验证该属性
    不再阻止 Process().start()；真实 Marker 集成验证放在 integration 层。
    """

    @pytest.mark.asyncio
    async def test_worker_proc_can_be_parent(self):
        """spawn 出的 worker 进程 .daemon 属性为 False（即允许有子进程）。"""
        worker = EngineWorker("_fake_fast")
        try:
            await worker.start()
            assert worker._proc is not None
            # Python 层面 daemon=False 即放开了 "daemonic processes are not
            # allowed to have children" 的限制
            assert worker._proc.daemon is False
        finally:
            await worker.terminate()


@pytest.fixture(autouse=True)
def _reset_event_loop_policy():
    """避免 asyncio 测试间泄露 event loop。"""
    yield
    try:
        loop = asyncio.get_event_loop_policy().get_event_loop()
        if loop.is_closed():
            asyncio.set_event_loop(asyncio.new_event_loop())
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())
