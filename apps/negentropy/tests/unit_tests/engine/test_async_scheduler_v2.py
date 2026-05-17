"""AsyncScheduler Phase 4 升级单元测试

覆盖：
- 5s 心跳默认值
- interval / cron / oneshot 三种 trigger_type 的 _is_due 判定
- 失败回退（interval 回退 last_run_at；cron 推进 next_fire_at 避免抖动）
- oneshot 仅首次触发
"""

from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from negentropy.engine.schedulers.async_scheduler import (
    _DEFAULT_POLL_INTERVAL,
    AsyncScheduler,
    ScheduledJob,
)


class TestDefaultHeartbeat:
    def test_default_poll_interval_is_5_seconds(self):
        scheduler = AsyncScheduler()
        # 与 Plan 第 4 节确认的 5s 心跳一致（容许 env override 但默认为 5）
        assert scheduler.poll_interval == _DEFAULT_POLL_INTERVAL == 5.0

    def test_explicit_poll_interval_overrides_default(self):
        scheduler = AsyncScheduler(poll_interval=10.0)
        assert scheduler.poll_interval == 10.0


class TestTriggerTypes:
    """三种触发类型的 _is_due 单一函数判定。"""

    @pytest.fixture
    def scheduler(self):
        return AsyncScheduler(poll_interval=0.05)

    def test_interval_due_when_elapsed(self, scheduler):
        scheduler.register(key="int_job", callback=AsyncMock(), interval_seconds=1.0)
        job = scheduler._jobs["int_job"]
        # 模拟刚跑过 → 未到 due
        job.last_run_at = time.monotonic()
        assert scheduler._is_due(job, time.monotonic(), datetime.now(UTC)) is False
        # 把 last_run_at 推到 2 秒前 → 已经 due
        job.last_run_at = time.monotonic() - 2.0
        assert scheduler._is_due(job, time.monotonic(), datetime.now(UTC)) is True

    def test_cron_due_when_next_fire_at_passed(self, scheduler):
        scheduler.register_cron(key="cron_job", callback=AsyncMock(), cron_expr="* * * * *")
        job = scheduler._jobs["cron_job"]
        # next_fire_at 已被 register_cron 计算（下一分钟），未到当前
        if job.next_fire_at is not None:
            assert scheduler._is_due(job, time.monotonic(), datetime.now(UTC)) is False
        # 把 next_fire_at 倒推 → 已 due
        job.next_fire_at = datetime.now(UTC).replace(year=2000)
        assert scheduler._is_due(job, time.monotonic(), datetime.now(UTC)) is True

    def test_cron_with_missing_next_fire_is_not_due(self, scheduler):
        # 模拟 cron_expr 无效导致 next_fire_at=None
        job = ScheduledJob(
            key="bad_cron",
            callback=AsyncMock(),
            trigger_type="cron",
            cron_expr="invalid",
            next_fire_at=None,
        )
        scheduler._jobs[job.key] = job
        assert scheduler._is_due(job, time.monotonic(), datetime.now(UTC)) is False

    def test_oneshot_due_first_time_only(self, scheduler):
        scheduler.register_oneshot(key="once", callback=AsyncMock())
        job = scheduler._jobs["once"]
        # 首次：last_run_at == 0.0 → 应触发
        assert scheduler._is_due(job, time.monotonic(), datetime.now(UTC)) is True
        # 模拟已经跑过
        job.last_run_at = time.monotonic()
        assert scheduler._is_due(job, time.monotonic(), datetime.now(UTC)) is False


class TestExecutionFlow:
    @pytest.mark.asyncio
    async def test_oneshot_runs_exactly_once(self):
        scheduler = AsyncScheduler(poll_interval=0.05)
        mock = AsyncMock()
        scheduler.register_oneshot(key="once_only", callback=mock)
        scheduler.start()
        # 等若干 tick
        await asyncio.sleep(0.25)
        scheduler.stop()
        # oneshot 应只被调用 1 次
        assert mock.call_count == 1

    @pytest.mark.asyncio
    async def test_interval_runs_multiple_times(self):
        scheduler = AsyncScheduler(poll_interval=0.05)
        mock = AsyncMock()
        scheduler.register(key="rep", callback=mock, interval_seconds=0.0)
        scheduler.start()
        await asyncio.sleep(0.3)
        scheduler.stop()
        assert mock.call_count >= 3

    @pytest.mark.asyncio
    async def test_interval_failure_retries_quickly(self):
        scheduler = AsyncScheduler(poll_interval=0.05)
        calls = {"n": 0}

        async def failing_cb():
            calls["n"] += 1
            raise RuntimeError("boom")

        scheduler.register(key="boom", callback=failing_cb, interval_seconds=0.0)
        scheduler.start()
        await asyncio.sleep(0.3)
        scheduler.stop()
        # 失败应回退 last_run_at，每个 tick 都重试
        assert calls["n"] >= 2


class TestRegisterAPISurfaces:
    def test_register_cron_creates_cron_job(self):
        scheduler = AsyncScheduler()
        scheduler.register_cron(key="cj", callback=AsyncMock(), cron_expr="*/5 * * * *")
        assert scheduler._jobs["cj"].trigger_type == "cron"
        assert scheduler._jobs["cj"].cron_expr == "*/5 * * * *"

    def test_register_interval_creates_interval_job(self):
        scheduler = AsyncScheduler()
        scheduler.register(key="ij", callback=AsyncMock(), interval_seconds=30.0)
        assert scheduler._jobs["ij"].trigger_type == "interval"
        assert scheduler._jobs["ij"].interval_seconds == 30.0

    def test_register_oneshot_creates_oneshot_job(self):
        scheduler = AsyncScheduler()
        scheduler.register_oneshot(key="oj", callback=AsyncMock())
        assert scheduler._jobs["oj"].trigger_type == "oneshot"
