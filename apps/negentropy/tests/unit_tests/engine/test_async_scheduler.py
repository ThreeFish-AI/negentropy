"""AsyncScheduler 单元测试"""

import asyncio
from unittest.mock import AsyncMock

import pytest

from negentropy.engine.schedulers.async_scheduler import AsyncScheduler


@pytest.fixture
def scheduler():
    return AsyncScheduler(poll_interval=0.1)


class TestRegistration:
    def test_register_job(self, scheduler):
        scheduler.register(
            key="test_job",
            callback=AsyncMock(),
            interval_seconds=60,
        )
        assert "test_job" in scheduler.registered_jobs

    def test_unregister_job(self, scheduler):
        scheduler.register(
            key="test_job",
            callback=AsyncMock(),
            interval_seconds=60,
        )
        scheduler.unregister("test_job")
        assert "test_job" not in scheduler.registered_jobs

    def test_unregister_nonexistent(self, scheduler):
        # 不应抛出异常
        scheduler.unregister("nonexistent")

    def test_multiple_jobs(self, scheduler):
        for i in range(3):
            scheduler.register(
                key=f"job_{i}",
                callback=AsyncMock(),
                interval_seconds=60,
            )
        assert len(scheduler.registered_jobs) == 3


class TestStartStop:
    @pytest.mark.asyncio
    async def test_start(self, scheduler):
        scheduler.register(
            key="test_job",
            callback=AsyncMock(),
            interval_seconds=60,
        )
        scheduler.start()
        assert scheduler.is_running
        scheduler.stop()

    @pytest.mark.asyncio
    async def test_stop(self, scheduler):
        scheduler.register(
            key="test_job",
            callback=AsyncMock(),
            interval_seconds=60,
        )
        scheduler.start()
        scheduler.stop()
        assert not scheduler.is_running

    @pytest.mark.asyncio
    async def test_start_idempotent(self, scheduler):
        scheduler.register(
            key="test_job",
            callback=AsyncMock(),
            interval_seconds=60,
        )
        scheduler.start()
        scheduler.start()  # 不应创建第二个任务
        assert scheduler.is_running
        scheduler.stop()

    @pytest.mark.asyncio
    async def test_no_jobs_start_noop(self, scheduler):
        scheduler.start()
        # 无任务，调度器启动但无事可做
        assert scheduler.is_running
        scheduler.stop()


class TestExecution:
    @pytest.mark.asyncio
    async def test_job_executes(self, scheduler):
        mock_callback = AsyncMock()
        scheduler.register(
            key="test_job",
            callback=mock_callback,
            interval_seconds=0.0,  # 立即执行
        )
        scheduler.start()
        await asyncio.sleep(0.3)  # 等待一个 poll 周期
        scheduler.stop()
        assert mock_callback.call_count >= 1

    @pytest.mark.asyncio
    async def test_job_failure_doesnt_crash_scheduler(self, scheduler):
        async def failing_callback():
            raise RuntimeError("test error")

        scheduler.register(
            key="failing_job",
            callback=failing_callback,
            interval_seconds=0.0,
        )
        scheduler.start()
        await asyncio.sleep(0.3)
        # 调度器仍应运行
        assert scheduler.is_running
        scheduler.stop()
