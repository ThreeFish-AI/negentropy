"""Pipeline Run Cancel API 单元测试。

覆盖：
- pending → cancelled（直接转终态）
- running → cancelling（信号已发，task 在检查点退出）
- 已 terminal → 409
- 不存在的 run → 404
- 已 cancelling → noop（幂等）
- payload.cancellation 元数据写入正确（requested_at / requested_by / reason）

不测试：进程内 fast-path event 信号（依赖 asyncio Event 真实状态，由
test_pipeline_tracker_cancel.py 的集成测试覆盖）。
"""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from negentropy.knowledge import api as knowledge_api
from negentropy.knowledge.cancellation import _CANCEL_EVENTS
from negentropy.knowledge.schemas import PipelineCancelRequest


def _make_record(*, status: str, run_id: str = "run-1", version: int = 1):
    """生成 KnowledgePipelineRun 同形 SimpleNamespace。"""
    return SimpleNamespace(
        id=uuid4(),
        run_id=run_id,
        status=status,
        version=version,
        payload={"operation": "ingest_text", "stages": {}, "input": {}},
        updated_at=datetime.now(UTC),
    )


class _FakeDao:
    def __init__(self, behavior: dict[str, object]):
        self._behavior = behavior

    async def request_pipeline_run_cancel(self, *, app_name, run_id, cancellation_meta):
        _ = (app_name, run_id, cancellation_meta)
        result = self._behavior["result"]
        # 模拟 cancellation_meta 合并到 payload.cancellation
        if isinstance(result, tuple) and result[1] is not None:
            new_status, record = result
            new_payload = dict(record.payload or {})
            new_payload["cancellation"] = cancellation_meta
            record.payload = new_payload
            return (new_status, record)
        return result


@pytest.mark.asyncio
async def test_cancel_pending_run_directly_to_cancelled(monkeypatch):
    """pending 状态的 run 直接转 cancelled。"""
    record = _make_record(status="cancelled")  # request_pipeline_run_cancel 已变更
    dao = _FakeDao(behavior={"result": ("cancelled", record)})
    monkeypatch.setattr(knowledge_api, "_get_dao", lambda: dao)
    _CANCEL_EVENTS.clear()

    result = await knowledge_api.cancel_pipeline_run(
        run_id="run-1",
        payload=PipelineCancelRequest(app_name="negentropy", reason="user_cancel"),
        user=None,
    )

    assert result.status == "cancelled"
    assert result.run_id == "run-1"
    assert result.in_process is False  # 无 task 在本进程
    assert result.record["status"] == "cancelled"
    assert result.record["payload"]["cancellation"]["reason"] == "user_cancel"


@pytest.mark.asyncio
async def test_cancel_running_run_to_cancelling(monkeypatch):
    """running 状态的 run 转 cancelling，task 待检查点退出。"""
    record = _make_record(status="cancelling")
    dao = _FakeDao(behavior={"result": ("cancelling", record)})
    monkeypatch.setattr(knowledge_api, "_get_dao", lambda: dao)
    _CANCEL_EVENTS.clear()

    result = await knowledge_api.cancel_pipeline_run(
        run_id="run-1",
        payload=PipelineCancelRequest(app_name="negentropy"),
        user=None,
    )

    assert result.status == "cancelling"
    assert result.in_process is False


@pytest.mark.asyncio
async def test_cancel_terminal_run_returns_409(monkeypatch):
    """已 completed 的 run 不能取消。"""
    record = _make_record(status="completed")
    dao = _FakeDao(behavior={"result": ("terminal", record)})
    monkeypatch.setattr(knowledge_api, "_get_dao", lambda: dao)
    _CANCEL_EVENTS.clear()

    with pytest.raises(HTTPException) as exc_info:
        await knowledge_api.cancel_pipeline_run(
            run_id="run-1",
            payload=PipelineCancelRequest(),
            user=None,
        )
    assert exc_info.value.status_code == 409
    assert "terminal" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_cancel_nonexistent_run_returns_404(monkeypatch):
    """不存在的 run 返回 404。"""
    dao = _FakeDao(behavior={"result": ("not_found", None)})
    monkeypatch.setattr(knowledge_api, "_get_dao", lambda: dao)
    _CANCEL_EVENTS.clear()

    with pytest.raises(HTTPException) as exc_info:
        await knowledge_api.cancel_pipeline_run(
            run_id="nonexistent",
            payload=PipelineCancelRequest(),
            user=None,
        )
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_cancel_already_cancelling_is_noop(monkeypatch):
    """已 cancelling 的 run 二次取消幂等返回 noop。"""
    record = _make_record(status="cancelling")
    dao = _FakeDao(behavior={"result": ("noop", record)})
    monkeypatch.setattr(knowledge_api, "_get_dao", lambda: dao)
    _CANCEL_EVENTS.clear()

    result = await knowledge_api.cancel_pipeline_run(
        run_id="run-1",
        payload=PipelineCancelRequest(),
        user=None,
    )
    assert result.status == "noop"
    assert result.run_id == "run-1"


@pytest.mark.asyncio
async def test_cancel_writes_payload_metadata(monkeypatch):
    """cancellation 元数据正确写入 payload（requested_at / requested_by / reason）。"""
    record = _make_record(status="cancelling")
    captured_meta: dict = {}

    class _CapturingDao:
        async def request_pipeline_run_cancel(self, *, app_name, run_id, cancellation_meta):
            captured_meta.update(cancellation_meta)
            new_payload = dict(record.payload or {})
            new_payload["cancellation"] = cancellation_meta
            record.payload = new_payload
            return ("cancelling", record)

    monkeypatch.setattr(knowledge_api, "_get_dao", lambda: _CapturingDao())
    _CANCEL_EVENTS.clear()

    user = SimpleNamespace(email="alice@example.com")
    await knowledge_api.cancel_pipeline_run(
        run_id="run-1",
        payload=PipelineCancelRequest(reason="too slow"),
        user=user,
    )

    assert captured_meta["reason"] == "too slow"
    assert captured_meta["requested_by"] == "alice@example.com"
    assert "requested_at" in captured_meta
    # ISO-8601 时间戳格式校验
    datetime.fromisoformat(captured_meta["requested_at"])


@pytest.mark.asyncio
async def test_cancel_default_reason_is_user_cancel(monkeypatch):
    """未传 reason 时默认为 user_cancel。"""
    record = _make_record(status="cancelling")
    captured: dict = {}

    class _CapturingDao:
        async def request_pipeline_run_cancel(self, *, app_name, run_id, cancellation_meta):
            captured.update(cancellation_meta)
            return ("cancelling", record)

    monkeypatch.setattr(knowledge_api, "_get_dao", lambda: _CapturingDao())
    _CANCEL_EVENTS.clear()

    await knowledge_api.cancel_pipeline_run(
        run_id="run-1",
        payload=PipelineCancelRequest(),
        user=None,
    )
    assert captured["reason"] == "user_cancel"
    assert captured["requested_by"] is None
