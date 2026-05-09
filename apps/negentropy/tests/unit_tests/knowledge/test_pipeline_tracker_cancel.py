"""PipelineTracker 取消语义单元测试。

覆盖：
- R-6 race A：start() 入口 resume 看到 cancelling/cancelled → raise PipelineCancelled
- R-7 race B：_persist 写入前先读 DB，已 cancelling 则跳过 running 覆盖
- start_stage 入口检查点（in-memory event）→ raise PipelineCancelled
- start_stage 入口检查点（DB 兜底）→ raise PipelineCancelled
- cancel() 写入 cancelled 终态 + 当前 stage 同步标 cancelled + payload.cancellation
- cancel() 幂等：已 cancelled/completed/failed 时 noop
- ensure_finalized 跳过 cancelled 终态
- _fail_pipeline_execution 不把 PipelineCancelled 写成 failed
"""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import pytest

from negentropy.knowledge.cancellation import (
    _CANCEL_EVENTS,
    register_cancellable_run,
    signal_cancel,
    unregister_cancellable_run,
)
from negentropy.knowledge.exceptions import PipelineCancelled
from negentropy.knowledge.service import KnowledgeService, PipelineTracker


class _FakePipelineDao:
    """内存版 PipelineRun DAO，模拟 status / payload / version。"""

    def __init__(self) -> None:
        self.records: dict[tuple[str, str], SimpleNamespace] = {}
        self.persist_calls: list[tuple[str, str, str]] = []  # (app, run, status)

    async def get_pipeline_run(self, app_name: str, run_id: str):
        return self.records.get((app_name, run_id))

    async def upsert_pipeline_run(
        self,
        *,
        app_name: str,
        run_id: str,
        status: str,
        payload: dict[str, Any],
        idempotency_key: str | None,
        expected_version: int | None,
    ):
        _ = (idempotency_key, expected_version)
        self.persist_calls.append((app_name, run_id, status))
        existing = self.records.get((app_name, run_id))
        version = (existing.version + 1) if existing else 1
        record = SimpleNamespace(
            id=f"id-{run_id}",
            run_id=run_id,
            app_name=app_name,
            status=status,
            payload=payload,
            version=version,
            updated_at=datetime.now(UTC),
        )
        self.records[(app_name, run_id)] = record
        return SimpleNamespace(status="updated" if existing else "created", record={})

    def seed(self, *, app_name: str, run_id: str, status: str, payload: dict | None = None):
        self.records[(app_name, run_id)] = SimpleNamespace(
            id=f"id-{run_id}",
            run_id=run_id,
            app_name=app_name,
            status=status,
            payload=payload or {},
            version=1,
            updated_at=datetime.now(UTC),
        )


@pytest.fixture
def dao() -> _FakePipelineDao:
    return _FakePipelineDao()


@pytest.fixture(autouse=True)
def _clean_registry():
    _CANCEL_EVENTS.clear()
    yield
    _CANCEL_EVENTS.clear()


@pytest.mark.asyncio
async def test_start_raises_when_db_already_cancelling(dao: _FakePipelineDao):
    """R-6 race A：cancel API 抢先把 DB 写为 cancelling 后，task 启动时立即 raise。"""
    dao.seed(app_name="negentropy", run_id="run-1", status="cancelling")
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text", run_id="run-1")

    with pytest.raises(PipelineCancelled):
        await tracker.start({"corpus_id": "c1"})

    # 关键：未写入 running 覆盖 cancelling
    assert all(status != "running" for (_a, _r, status) in dao.persist_calls)


@pytest.mark.asyncio
async def test_start_raises_when_db_already_cancelled(dao: _FakePipelineDao):
    dao.seed(app_name="negentropy", run_id="run-1", status="cancelled")
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text", run_id="run-1")
    with pytest.raises(PipelineCancelled):
        await tracker.start({"corpus_id": "c1"})


@pytest.mark.asyncio
async def test_start_writes_running_when_db_pending(dao: _FakePipelineDao):
    """正常路径：DB 未取消时 start() 写 running 状态。"""
    dao.seed(app_name="negentropy", run_id="run-1", status="pending")
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text", run_id="run-1")
    await tracker.start({"corpus_id": "c1"})

    assert dao.records[("negentropy", "run-1")].status == "running"
    assert ("negentropy", "run-1", "running") in dao.persist_calls


@pytest.mark.asyncio
async def test_persist_skips_running_overwrite_when_db_cancelling(dao: _FakePipelineDao):
    """R-7 race B：_persist 写 running 前发现 DB 已 cancelling，跳过覆盖并接管 status。"""
    dao.seed(app_name="negentropy", run_id="run-1", status="pending")
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text", run_id="run-1")
    await tracker.start({"corpus_id": "c1"})  # status → running

    # 模拟并发：cancel API 写 cancelling
    dao.seed(app_name="negentropy", run_id="run-1", status="cancelling")
    persist_count_before = len(dao.persist_calls)

    # tracker._persist 在 complete_stage 等场景被调用
    tracker._status = "running"  # tracker 自身仍在 running 视角
    await tracker._persist()

    # 关键：未把 status 写回 running 覆盖 cancelling
    assert dao.records[("negentropy", "run-1")].status == "cancelling"
    # 跳过本次 upsert（_persist 提前 return）
    assert len(dao.persist_calls) == persist_count_before
    # tracker 接管 DB 状态
    assert tracker._status == "cancelling"


@pytest.mark.asyncio
async def test_persist_allows_terminal_overwrite(dao: _FakePipelineDao):
    """终态写入合法：cancel/complete/fail 允许覆盖 cancelling。"""
    dao.seed(app_name="negentropy", run_id="run-1", status="cancelling")
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text", run_id="run-1")
    await tracker.resume()
    tracker._status = "cancelled"
    await tracker._persist()

    assert dao.records[("negentropy", "run-1")].status == "cancelled"


@pytest.mark.asyncio
async def test_start_stage_checks_in_memory_event(dao: _FakePipelineDao):
    """检查点：in-memory event set 后，下个 start_stage 立即 raise。"""
    dao.seed(app_name="negentropy", run_id="run-1", status="pending")
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text", run_id="run-1")
    await tracker.start({"corpus_id": "c1"})

    # cancel API 在同 worker 调用 signal_cancel
    signal_cancel("run-1")

    with pytest.raises(PipelineCancelled):
        await tracker.start_stage("chunk")


@pytest.mark.asyncio
async def test_start_stage_checks_db_status(dao: _FakePipelineDao):
    """检查点：跨 worker 场景，仅 DB 写 cancelling 也能在下个 stage 边界 raise。"""
    dao.seed(app_name="negentropy", run_id="run-1", status="pending")
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text", run_id="run-1")
    await tracker.start({"corpus_id": "c1"})

    # 跨 worker 场景：本 worker 无 in-memory event，仅 DB 信号
    dao.seed(app_name="negentropy", run_id="run-1", status="cancelling")

    with pytest.raises(PipelineCancelled):
        await tracker.start_stage("chunk")


@pytest.mark.asyncio
async def test_cancel_writes_terminal_state_and_marks_current_stage(dao: _FakePipelineDao):
    """cancel() 写 cancelled 终态 + 当前 stage 同步标 cancelled。"""
    dao.seed(app_name="negentropy", run_id="run-1", status="pending")
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text", run_id="run-1")
    await tracker.start({"corpus_id": "c1"})
    await tracker.start_stage("chunk")

    await tracker.cancel(last_stage="chunk", summary={"chunks_persisted": 42})

    record = dao.records[("negentropy", "run-1")]
    assert record.status == "cancelled"
    assert record.payload["stages"]["chunk"]["status"] == "cancelled"
    assert record.payload["cancellation"]["last_stage"] == "chunk"
    assert record.payload["cancellation"]["chunks_persisted"] == 42
    assert "cancelled_at" in record.payload["cancellation"]


@pytest.mark.asyncio
async def test_cancel_is_idempotent(dao: _FakePipelineDao):
    """已 cancelled 的 tracker 二次 cancel() 不重复写入。"""
    dao.seed(app_name="negentropy", run_id="run-1", status="pending")
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text", run_id="run-1")
    await tracker.start({"corpus_id": "c1"})
    await tracker.cancel()

    persist_count_before = len(dao.persist_calls)
    await tracker.cancel()  # 二次取消
    assert len(dao.persist_calls) == persist_count_before


@pytest.mark.asyncio
async def test_cancel_does_not_overwrite_completed(dao: _FakePipelineDao):
    """已 completed 的 tracker 调 cancel() 不覆盖（防止误终态切换）。"""
    dao.seed(app_name="negentropy", run_id="run-1", status="pending")
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text", run_id="run-1")
    await tracker.start({"corpus_id": "c1"})
    await tracker.complete({"records": 5})
    assert dao.records[("negentropy", "run-1")].status == "completed"

    await tracker.cancel()
    assert dao.records[("negentropy", "run-1")].status == "completed"


@pytest.mark.asyncio
async def test_ensure_finalized_skips_cancelled(dao: _FakePipelineDao):
    """ensure_finalized 在 cancelled 终态下不写 failed。"""
    dao.seed(app_name="negentropy", run_id="run-1", status="pending")
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text", run_id="run-1")
    await tracker.start({"corpus_id": "c1"})
    await tracker.cancel()

    persist_count_before = len(dao.persist_calls)
    await tracker.ensure_finalized()
    assert len(dao.persist_calls) == persist_count_before
    assert dao.records[("negentropy", "run-1")].status == "cancelled"


@pytest.mark.asyncio
async def test_fail_pipeline_execution_skips_pipeline_cancelled(dao: _FakePipelineDao):
    """_fail_pipeline_execution 看到 PipelineCancelled 直接 return，避免误写 failed。"""
    dao.seed(app_name="negentropy", run_id="run-1", status="pending")
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text", run_id="run-1")
    await tracker.start({"corpus_id": "c1"})

    cancel_exc = PipelineCancelled("run-1", last_stage="chunk")
    await KnowledgeService._fail_pipeline_execution(tracker, cancel_exc)

    # 关键：未写 failed
    assert dao.records[("negentropy", "run-1")].status == "running"
    assert all(status != "failed" for (_a, _r, status) in dao.persist_calls)


@pytest.mark.asyncio
async def test_register_unregister_cancellable_run_lifecycle():
    """registry 在 register 与 unregister 后大小匹配，验证防内存泄漏。"""
    register_cancellable_run("r1")
    register_cancellable_run("r2")
    assert "r1" in _CANCEL_EVENTS and "r2" in _CANCEL_EVENTS

    unregister_cancellable_run("r1")
    assert "r1" not in _CANCEL_EVENTS
    assert "r2" in _CANCEL_EVENTS

    # 重复 unregister 幂等
    unregister_cancellable_run("r1")
    assert "r1" not in _CANCEL_EVENTS


@pytest.mark.asyncio
async def test_register_is_idempotent_returns_same_event():
    """register 同一 run_id 多次返回同一 Event 实例（避免覆盖已 set 状态）。"""
    e1 = register_cancellable_run("r1")
    e1.set()
    e2 = register_cancellable_run("r1")
    assert e1 is e2
    assert e2.is_set()


@pytest.mark.asyncio
async def test_signal_cancel_returns_false_when_not_registered():
    assert signal_cancel("not-registered") is False
    register_cancellable_run("r1")
    assert signal_cancel("r1") is True
