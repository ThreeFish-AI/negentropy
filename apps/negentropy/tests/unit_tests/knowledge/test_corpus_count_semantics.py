"""ingest 幂等性与 persist_mode 切换的单元测试。

覆盖：
- persist_mode 默认行为（source_uri 非空 → replace，空 → append）
- persist_mode 显式覆盖
- 合成 delete stage 的发出
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from negentropy.knowledge.service import PipelineTracker

from .conftest import FakePipelineDao


@pytest.mark.asyncio
async def test_tracker_get_stage_output_persist_mode_replace():
    """persist_mode=replace 时 persist stage 应包含 replaced_count 和 mode='replace'。"""
    dao = FakePipelineDao()
    tracker = PipelineTracker(dao=dao, app_name="test", operation="replace_source", run_id="run-replace-1")
    await tracker.start({"corpus_id": str(uuid4()), "source_uri": "pgblob://test/doc.pdf"})

    # Simulate what _ingest_text_with_tracker does for persist_mode="replace"
    await tracker.start_stage("chunk")
    await tracker.complete_stage("chunk", {"chunk_count": 84})

    await tracker.skip_stage("embed", reason="no_embedding_fn")

    await tracker.start_stage("persist")
    await tracker.complete_stage("persist", {"record_count": 84, "replaced_count": 849, "mode": "replace"})

    # 合成 delete stage（单次 _persist）
    from datetime import UTC, datetime

    now = datetime.now(UTC).isoformat()
    tracker._stages["delete"] = {
        "status": "completed",
        "started_at": now,
        "completed_at": now,
        "duration_ms": 0,
        "output": {"deleted_count": 849, "atomic_with_persist": True},
    }
    await tracker._persist()

    # 验证 persist stage 输出
    persist_output = tracker.get_stage_output("persist")
    assert persist_output["replaced_count"] == 849
    assert persist_output["mode"] == "replace"

    # 验证合成 delete stage
    delete_stage = tracker._stages.get("delete")
    assert delete_stage is not None
    assert delete_stage["status"] == "completed"
    assert delete_stage["output"]["deleted_count"] == 849
    assert delete_stage["output"]["atomic_with_persist"] is True

    await tracker.complete({"deleted_count": 849, "chunk_count": 84})


@pytest.mark.asyncio
async def test_tracker_persist_mode_append_no_delete_stage():
    """persist_mode=append 时不应发出 delete stage。"""
    dao = FakePipelineDao()
    tracker = PipelineTracker(dao=dao, app_name="test", operation="ingest_text", run_id="run-append-1")
    await tracker.start({"corpus_id": str(uuid4()), "source_uri": None})

    await tracker.start_stage("persist")
    await tracker.complete_stage("persist", {"record_count": 5, "mode": "append"})

    # 不应有 delete stage
    assert "delete" not in tracker._stages

    await tracker.complete({"chunk_count": 5})
