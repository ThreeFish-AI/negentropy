"""task_executions.metrics 序列化单测 — registry 与 scheduler_api 两路 serializer 均含 metrics（无 DB）。"""

from __future__ import annotations

from types import SimpleNamespace

from negentropy.engine.schedulers.registry import _serialize_execution as registry_serialize
from negentropy.interface.scheduler_api import _serialize_execution as api_serialize


def _fake_task() -> SimpleNamespace:
    return SimpleNamespace(
        key="pdf_fidelity_patrol",
        handler_kind="pdf_fidelity_patrol",
        role="supervisor",
        scenario="pdf_fidelity",
        category="cognitive",
    )


def _fake_exec(**overrides: object) -> SimpleNamespace:
    base: dict[str, object] = dict(
        id="00000000-0000-0000-0000-000000000001",
        task_id="00000000-0000-0000-0000-000000000002",
        started_at=None,
        finished_at=None,
        status="ok",
        duration_ms=12,
        tokens_used=None,
        output_summary="patrol started: doc=d1",
        error=None,
        fire_reason="tick",
        skill_id=None,
        skill_schedule_id=None,
        memory_id=None,
        pipeline_run_id=None,
        thread_id=None,
        metrics={"routine_id": "r-123", "doc_id": "d1"},
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_registry_serialize_execution_includes_metrics():
    out = registry_serialize(_fake_task(), _fake_exec())
    assert out["metrics"] == {"routine_id": "r-123", "doc_id": "d1"}
    assert out["task_key"] == "pdf_fidelity_patrol"


def test_api_serialize_execution_includes_metrics():
    out = api_serialize(_fake_exec(), _fake_task())
    assert out["metrics"]["routine_id"] == "r-123"
    assert out["task_key"] == "pdf_fidelity_patrol"


def test_serialize_execution_metrics_defaults_empty():
    """metrics 缺省（旧数据 / 未回填）兜底为 {}，不抛。"""
    out = api_serialize(_fake_exec(metrics=None), _fake_task())
    assert out["metrics"] == {}
