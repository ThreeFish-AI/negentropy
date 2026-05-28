"""ScheduledTaskRegistry 全链路集成测试 — 真实 Postgres。

覆盖范围：
- ``ensure_defaults`` 幂等 upsert
- ``_claim_due_tasks`` 原子认领（interval / cron / oneshot）
- ``dispatch`` 执行记录写入（ok / failed）
- 手动触发与 disabled 状态语义
- ``_compute_next_fire`` 触发推进
- ``ExecutionBus`` 发布/订阅

注意：
- 使用 ``import negentropy.db.session as db_session`` 模式确保拿到 monkeypatch
  后的 test session factory（``from ... import X`` 在 import 时绑定原始值）；
- 任务 key 使用 UUID 后缀隔离，try/finally 清理测试数据。
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, select

import negentropy.db.session as db_session
import negentropy.engine.schedulers.registry as registry_mod
from negentropy.engine.schedulers.handlers import HANDLER_REGISTRY, HandlerResult
from negentropy.engine.schedulers.registry import (
    ExecutionBus,
    ScheduledTaskRegistry,
    _claim_due_tasks,
    _compute_next_fire,
    _upsert_default_task,
)
from negentropy.models.scheduled_task import ScheduledTask, TaskExecution


def _unique_key(prefix: str = "itest") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _task_defaults(**overrides) -> dict:
    defaults = dict(
        key=_unique_key(),
        handler_kind="_test_stub",
        trigger_type="interval",
        interval_seconds=60.0,
        enabled=True,
        payload={},
        max_concurrency=1,
        next_fire_at=datetime.now(UTC),
    )
    defaults.update(overrides)
    return defaults


async def _cleanup_tasks(*task_ids) -> None:
    if not task_ids:
        return
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(TaskExecution).where(TaskExecution.task_id.in_(task_ids)))
        await db.execute(delete(ScheduledTask).where(ScheduledTask.id.in_(task_ids)))
        await db.commit()


# ---------------------------------------------------------------------------
# ensure_defaults
# ---------------------------------------------------------------------------


class TestEnsureDefaults:
    @pytest.mark.asyncio
    async def test_idempotent_upsert(self) -> None:
        """ensure_defaults 两次调用不产生重复行，且不覆盖用户修改的 enabled 状态。"""
        spec = dict(
            key=_unique_key("def"),
            handler_kind="_test_stub",
            trigger_type="interval",
            interval_seconds=120.0,
            role="test",
            scenario="itest",
            category="test",
            display_name="Integration Test Task",
            description="test task",
        )
        try:
            async with db_session.AsyncSessionLocal() as db:
                await _upsert_default_task(db, spec, lease_seconds=120)
                await db.commit()

            # 用户在 UI 上禁用
            async with db_session.AsyncSessionLocal() as db:
                task = (await db.execute(select(ScheduledTask).where(ScheduledTask.key == spec["key"]))).scalar_one()
                task.enabled = False
                await db.commit()

            # 第二次 upsert 不应覆盖 enabled
            async with db_session.AsyncSessionLocal() as db:
                await _upsert_default_task(db, spec, lease_seconds=120)
                await db.commit()

            async with db_session.AsyncSessionLocal() as db:
                task = (await db.execute(select(ScheduledTask).where(ScheduledTask.key == spec["key"]))).scalar_one()
                assert task.enabled is False
                assert task.display_name == "Integration Test Task"
        finally:
            async with db_session.AsyncSessionLocal() as db:
                await db.execute(delete(ScheduledTask).where(ScheduledTask.key == spec["key"]))
                await db.commit()

    @pytest.mark.asyncio
    async def test_payload_merge_does_not_overwrite_existing_keys(self) -> None:
        """payload upsert 仅补缺，不覆盖已有键。"""
        key = _unique_key("payload")
        spec = dict(
            key=key,
            handler_kind="_test_stub",
            trigger_type="interval",
            interval_seconds=60.0,
            payload={"threshold": 0.1, "min_age_days": 7},
        )
        try:
            async with db_session.AsyncSessionLocal() as db:
                await _upsert_default_task(db, spec, lease_seconds=120)
                await db.commit()

            # 用户修改 threshold
            async with db_session.AsyncSessionLocal() as db:
                task = (await db.execute(select(ScheduledTask).where(ScheduledTask.key == key))).scalar_one()
                task.payload = {"threshold": 0.5, "min_age_days": 7}
                await db.commit()

            # 第二次 upsert，payload 有新键 decay_lambda
            spec2 = dict(spec, payload={"threshold": 0.1, "min_age_days": 7, "decay_lambda": 0.1})
            async with db_session.AsyncSessionLocal() as db:
                await _upsert_default_task(db, spec2, lease_seconds=120)
                await db.commit()

            async with db_session.AsyncSessionLocal() as db:
                task = (await db.execute(select(ScheduledTask).where(ScheduledTask.key == key))).scalar_one()
                assert task.payload["threshold"] == 0.5, "existing key should not be overwritten"
                assert task.payload["decay_lambda"] == 0.1, "new key should be merged"
        finally:
            async with db_session.AsyncSessionLocal() as db:
                await db.execute(delete(ScheduledTask).where(ScheduledTask.key == key))
                await db.commit()


# ---------------------------------------------------------------------------
# _claim_due_tasks
# ---------------------------------------------------------------------------


class TestClaimDueTasks:
    @pytest.mark.asyncio
    async def test_interval_task_due(self) -> None:
        """interval 任务 next_fire_at <= now 时被认领，且 next_fire_at 被推到 lease 后。"""
        defaults = _task_defaults(next_fire_at=datetime.now(UTC) - timedelta(seconds=1))
        async with db_session.AsyncSessionLocal() as db:
            task = ScheduledTask(**defaults)
            db.add(task)
            await db.commit()
            await db.refresh(task)
            task_id = task.id
        try:
            async with db_session.AsyncSessionLocal() as db:
                rows = await _claim_due_tasks(db, lease_seconds=120)
                await db.commit()
                # 只验证我们的测试任务在其中（DB 可能有其他 due 任务）
                claimed_ids = [r.id for r in rows]
                assert task_id in claimed_ids

            async with db_session.AsyncSessionLocal() as db:
                refreshed = await db.get(ScheduledTask, task_id)
                assert refreshed.next_fire_at > datetime.now(UTC) + timedelta(seconds=60)
        finally:
            await _cleanup_tasks(task_id)

    @pytest.mark.asyncio
    async def test_disabled_task_not_claimed(self) -> None:
        """enabled=False 的任务不应被认领。"""
        defaults = _task_defaults(enabled=False, next_fire_at=datetime.now(UTC) - timedelta(seconds=1))
        async with db_session.AsyncSessionLocal() as db:
            task = ScheduledTask(**defaults)
            db.add(task)
            await db.commit()
            await db.refresh(task)
            task_id = task.id
        try:
            async with db_session.AsyncSessionLocal() as db:
                rows = await _claim_due_tasks(db, lease_seconds=120)
                await db.commit()
                claimed_ids = [r.id for r in rows]
                assert task_id not in claimed_ids
        finally:
            await _cleanup_tasks(task_id)

    @pytest.mark.asyncio
    async def test_future_task_not_claimed(self) -> None:
        """next_fire_at 在未来的任务不应被认领。"""
        defaults = _task_defaults(next_fire_at=datetime.now(UTC) + timedelta(hours=1))
        async with db_session.AsyncSessionLocal() as db:
            task = ScheduledTask(**defaults)
            db.add(task)
            await db.commit()
            await db.refresh(task)
            task_id = task.id
        try:
            async with db_session.AsyncSessionLocal() as db:
                rows = await _claim_due_tasks(db, lease_seconds=120)
                await db.commit()
                claimed_ids = [r.id for r in rows]
                assert task_id not in claimed_ids
        finally:
            await _cleanup_tasks(task_id)

    @pytest.mark.asyncio
    async def test_oneshot_never_fired_claimed(self) -> None:
        """oneshot 类型任务 last_fire_at IS NULL 时应被认领（首次触发兜底）。"""
        defaults = _task_defaults(
            trigger_type="oneshot",
            interval_seconds=None,
            next_fire_at=None,
        )
        async with db_session.AsyncSessionLocal() as db:
            task = ScheduledTask(**defaults)
            db.add(task)
            await db.commit()
            await db.refresh(task)
            task_id = task.id
        try:
            async with db_session.AsyncSessionLocal() as db:
                rows = await _claim_due_tasks(db, lease_seconds=120)
                await db.commit()
                claimed_ids = [r.id for r in rows]
                assert task_id in claimed_ids
        finally:
            await _cleanup_tasks(task_id)

    @pytest.mark.asyncio
    async def test_backoff_task_not_claimed(self) -> None:
        """backoff_until 在未来的任务不应被认领。"""
        defaults = _task_defaults(
            next_fire_at=datetime.now(UTC) - timedelta(seconds=1),
            backoff_until=datetime.now(UTC) + timedelta(hours=1),
        )
        async with db_session.AsyncSessionLocal() as db:
            task = ScheduledTask(**defaults)
            db.add(task)
            await db.commit()
            await db.refresh(task)
            task_id = task.id
        try:
            async with db_session.AsyncSessionLocal() as db:
                rows = await _claim_due_tasks(db, lease_seconds=120)
                await db.commit()
                claimed_ids = [r.id for r in rows]
                assert task_id not in claimed_ids
        finally:
            await _cleanup_tasks(task_id)


# ---------------------------------------------------------------------------
# dispatch + execution record
# ---------------------------------------------------------------------------


class TestDispatch:
    """dispatch 测试需要 monkeypatch registry 模块内部的 AsyncSessionLocal。

    registry.py 用 ``from negentropy.db.session import AsyncSessionLocal`` 绑定了
    原始 factory；conftest 只 patch ``db_session.AsyncSessionLocal`` 但不会更新
    registry 模块的本地名。通过 autouse fixture 同步 patch 两者。
    """

    @pytest.fixture(autouse=True)
    def _patch_registry_session_factory(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(registry_mod, "AsyncSessionLocal", db_session.AsyncSessionLocal)

    @pytest.mark.asyncio
    async def test_dispatch_ok_writes_execution(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """handler 成功返回 → task_executions 写入 ok 记录，total_runs +1。"""

        async def _ok_handler(t: ScheduledTask) -> HandlerResult:
            return HandlerResult(status="ok", output_summary="itest ok")

        monkeypatch.setitem(HANDLER_REGISTRY, "_test_stub", _ok_handler)

        defaults = _task_defaults(key=_unique_key("dispatch_ok"))
        async with db_session.AsyncSessionLocal() as db:
            task = ScheduledTask(**defaults)
            db.add(task)
            await db.commit()
            await db.refresh(task)
            task_id = task.id

        try:
            registry = ScheduledTaskRegistry(poll_interval=99)
            exec_id = await registry.dispatch(task_id, fire_reason="manual")
            assert exec_id is not None

            async with db_session.AsyncSessionLocal() as db:
                exec_row = await db.get(TaskExecution, exec_id)
                assert exec_row is not None
                assert exec_row.status == "ok"
                assert exec_row.output_summary == "itest ok"
                assert exec_row.fire_reason == "manual"
                assert exec_row.duration_ms is not None
                assert exec_row.duration_ms >= 0

                refreshed = await db.get(ScheduledTask, task_id)
                assert refreshed is not None
                assert refreshed.total_runs == 1
                assert refreshed.last_status == "ok"
                assert refreshed.consecutive_failures == 0
        finally:
            await _cleanup_tasks(task_id)

    @pytest.mark.asyncio
    async def test_dispatch_failed_increments_consecutive_failures(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """handler 抛异常 → consecutive_failures +1，last_error 写入。"""

        async def _fail_handler(t: ScheduledTask) -> HandlerResult:
            return HandlerResult(status="failed", error="simulated failure")

        monkeypatch.setitem(HANDLER_REGISTRY, "_test_stub", _fail_handler)

        defaults = _task_defaults(key=_unique_key("dispatch_fail"), consecutive_failures=2)
        async with db_session.AsyncSessionLocal() as db:
            task = ScheduledTask(**defaults)
            db.add(task)
            await db.commit()
            await db.refresh(task)
            task_id = task.id

        try:
            registry = ScheduledTaskRegistry(poll_interval=99)
            exec_id = await registry.dispatch(task_id, fire_reason="manual")

            async with db_session.AsyncSessionLocal() as db:
                exec_row = await db.get(TaskExecution, exec_id)
                assert exec_row.status == "failed"
                assert exec_row.error == "simulated failure"

                refreshed = await db.get(ScheduledTask, task_id)
                assert refreshed.consecutive_failures == 3
                assert refreshed.last_error == "simulated failure"
        finally:
            await _cleanup_tasks(task_id)

    @pytest.mark.asyncio
    async def test_dispatch_unknown_handler_records_failure(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """未注册 handler_kind → 写入 failed 记录 + error 消息。"""
        monkeypatch.setitem(HANDLER_REGISTRY, "_nonexistent_handler", None)

        defaults = _task_defaults(key=_unique_key("dispatch_missing"), handler_kind="_nonexistent_handler")
        async with db_session.AsyncSessionLocal() as db:
            task = ScheduledTask(**defaults)
            db.add(task)
            await db.commit()
            await db.refresh(task)
            task_id = task.id

        try:
            registry = ScheduledTaskRegistry(poll_interval=99)
            exec_id = await registry.dispatch(task_id, fire_reason="manual")

            async with db_session.AsyncSessionLocal() as db:
                exec_row = await db.get(TaskExecution, exec_id)
                assert exec_row.status == "failed"
                assert "not registered" in (exec_row.error or "")

                refreshed = await db.get(ScheduledTask, task_id)
                assert refreshed.consecutive_failures == 1
        finally:
            await _cleanup_tasks(task_id)

    @pytest.mark.asyncio
    async def test_dispatch_disabled_task_manual_allowed(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """disabled 任务 manual 触发允许执行（tick 路径会被 _claim_due_tasks 过滤）。"""

        async def _ok_handler(t: ScheduledTask) -> HandlerResult:
            return HandlerResult(status="ok", output_summary="manual on disabled")

        monkeypatch.setitem(HANDLER_REGISTRY, "_test_stub", _ok_handler)

        defaults = _task_defaults(key=_unique_key("dispatch_disabled"), enabled=False)
        async with db_session.AsyncSessionLocal() as db:
            task = ScheduledTask(**defaults)
            db.add(task)
            await db.commit()
            await db.refresh(task)
            task_id = task.id

        try:
            registry = ScheduledTaskRegistry(poll_interval=99)
            exec_id = await registry.dispatch(task_id, fire_reason="manual")

            async with db_session.AsyncSessionLocal() as db:
                exec_row = await db.get(TaskExecution, exec_id)
                assert exec_row.status == "ok"
                assert exec_row.output_summary == "manual on disabled"
        finally:
            await _cleanup_tasks(task_id)

    @pytest.mark.asyncio
    async def test_dispatch_nonexistent_task_returns_none(self) -> None:
        """dispatch 不存在的 task_id → 返回 None。"""
        registry = ScheduledTaskRegistry(poll_interval=99)
        result = await registry.dispatch(uuid.uuid4(), fire_reason="manual")
        assert result is None


# ---------------------------------------------------------------------------
# _compute_next_fire (pure function, no DB)
# ---------------------------------------------------------------------------


class TestComputeNextFire:
    @pytest.mark.asyncio
    async def test_interval_advances(self) -> None:
        """interval 类型 → next_fire_at = now + interval_seconds。"""
        defaults = _task_defaults(trigger_type="interval", interval_seconds=300.0)
        async with db_session.AsyncSessionLocal() as db:
            task = ScheduledTask(**defaults)
            db.add(task)
            await db.commit()
            await db.refresh(task)
            task_id = task.id
        try:
            nf = _compute_next_fire(task)
            assert nf is not None
            assert nf > datetime.now(UTC) + timedelta(seconds=200)
            assert nf < datetime.now(UTC) + timedelta(seconds=400)
        finally:
            await _cleanup_tasks(task_id)

    @pytest.mark.asyncio
    async def test_cron_advances(self) -> None:
        """cron 类型 → next_fire_at 由 croniter 计算。"""
        defaults = _task_defaults(trigger_type="cron", interval_seconds=None, cron_expr="0 * * * *")
        async with db_session.AsyncSessionLocal() as db:
            task = ScheduledTask(**defaults)
            db.add(task)
            await db.commit()
            await db.refresh(task)
            task_id = task.id
        try:
            nf = _compute_next_fire(task)
            assert nf is not None
            assert nf > datetime.now(UTC)
        finally:
            await _cleanup_tasks(task_id)

    @pytest.mark.asyncio
    async def test_oneshot_sentinel(self) -> None:
        """oneshot 类型 → 返回远期 sentinel (9999-01-01)。"""
        defaults = _task_defaults(trigger_type="oneshot", interval_seconds=None)
        async with db_session.AsyncSessionLocal() as db:
            task = ScheduledTask(**defaults)
            db.add(task)
            await db.commit()
            await db.refresh(task)
            task_id = task.id
        try:
            nf = _compute_next_fire(task)
            assert nf is not None
            assert nf.year >= 9999
        finally:
            await _cleanup_tasks(task_id)


# ---------------------------------------------------------------------------
# ExecutionBus (in-process, no DB)
# ---------------------------------------------------------------------------


class TestExecutionBus:
    @pytest.mark.asyncio
    async def test_publish_reaches_subscriber(self) -> None:
        """publish 事件 → subscriber queue 收到。"""
        bus = ExecutionBus()
        q = await bus.subscribe()
        event = {"status": "ok", "task_key": "test"}

        await bus.publish(event)

        received = q.get_nowait()
        assert received["status"] == "ok"
        assert received["task_key"] == "test"

        await bus.unsubscribe(q)

    @pytest.mark.asyncio
    async def test_shutdown_sentinel(self) -> None:
        """close_all_subscribers → 投递 __shutdown__ 哨兵。"""
        bus = ExecutionBus()
        q = await bus.subscribe()

        await bus.close_all_subscribers()

        sentinel = q.get_nowait()
        assert sentinel.get("__shutdown__") is True

    @pytest.mark.asyncio
    async def test_multiple_subscribers_fan_out(self) -> None:
        """一条 publish 到达所有 subscriber。"""
        bus = ExecutionBus()
        q1 = await bus.subscribe()
        q2 = await bus.subscribe()

        await bus.publish({"event": "test"})

        assert q1.get_nowait()["event"] == "test"
        assert q2.get_nowait()["event"] == "test"

        await bus.unsubscribe(q1)
        await bus.unsubscribe(q2)
