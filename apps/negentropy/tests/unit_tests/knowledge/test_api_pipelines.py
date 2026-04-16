"""Pipeline API 路由单元测试。

验证 Pipeline 查询与更新接口的类型化响应、诊断摘要字段传递、
空输出载荷规范化以及 OpenAPI Schema 正确性等场景。
"""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from negentropy.knowledge import api as knowledge_api


@pytest.mark.asyncio
async def test_get_pipelines_returns_diagnostic_summary_in_typed_response(monkeypatch):
    run_id = uuid4()

    class FakeDao:
        async def list_pipeline_runs(self, app_name: str, limit: int = 50, offset: int = 0):
            _ = (app_name, limit, offset)
            return [
                SimpleNamespace(
                    id=run_id,
                    run_id="pipeline-1",
                    status="failed",
                    version=3,
                    payload={
                        "operation": "rebuild_source",
                        "stages": {
                            "extract_primary": {
                                "status": "failed",
                                "error": {
                                    "message": "Tool input schema could not be normalized for document extraction",
                                    "failure_category": "low_confidence_contract",
                                    "diagnostic_summary": "契约为 unknown，要求额外必填字段 opaque，当前提取源无法构造最小调用参数",
                                    "diagnostics": {"summary": "ignored because direct summary exists"},
                                },
                            }
                        },
                    },
                    updated_at=SimpleNamespace(isoformat=lambda: "2026-03-09T11:30:00+08:00"),
                )
            ]

        async def count_pipeline_runs(self, app_name: str) -> int:
            _ = app_name
            return 1

    monkeypatch.setattr(knowledge_api, "_get_dao", lambda: FakeDao())

    result = await knowledge_api.get_pipelines(app_name="negentropy")

    assert result.last_updated_at == "2026-03-09T11:30:00+08:00"
    assert result.runs[0].stages["extract_primary"].error is not None
    assert result.runs[0].stages["extract_primary"].error.failure_category == "low_confidence_contract"
    assert (
        result.runs[0].stages["extract_primary"].error.diagnostic_summary
        == "契约为 unknown，要求额外必填字段 opaque，当前提取源无法构造最小调用参数"
    )


@pytest.mark.asyncio
async def test_get_pipelines_normalizes_null_output_payloads(monkeypatch):
    run_id = uuid4()

    class FakeDao:
        async def list_pipeline_runs(self, app_name: str, limit: int = 50, offset: int = 0):
            _ = (app_name, limit, offset)
            return [
                SimpleNamespace(
                    id=run_id,
                    run_id="pipeline-null-output",
                    status="completed",
                    version=1,
                    payload={
                        "input": None,
                        "output": None,
                        "stages": {
                            "extract_primary": {
                                "status": "completed",
                                "output": None,
                            }
                        },
                    },
                    updated_at=SimpleNamespace(isoformat=lambda: "2026-03-09T16:30:00+08:00"),
                )
            ]

        async def count_pipeline_runs(self, app_name: str) -> int:
            _ = app_name
            return 1

    monkeypatch.setattr(knowledge_api, "_get_dao", lambda: FakeDao())

    result = await knowledge_api.get_pipelines(app_name="negentropy")

    assert result.last_updated_at == "2026-03-09T16:30:00+08:00"
    assert result.runs[0].input == {}
    assert result.runs[0].output == {}
    assert result.runs[0].stages["extract_primary"].output == {}


def test_get_pipelines_openapi_includes_diagnostic_summary() -> None:
    app = FastAPI()
    app.include_router(knowledge_api.router)

    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()

    pipeline_error_schema = schema["components"]["schemas"]["PipelineErrorPayloadResponse"]
    assert "diagnostic_summary" in pipeline_error_schema["properties"]
    assert (
        pipeline_error_schema["properties"]["diagnostic_summary"]["description"]
        == "一条可直接展示的摘要，默认用于契约类失败。"
    )


@pytest.mark.asyncio
async def test_upsert_pipelines_returns_typed_response(monkeypatch):
    class FakeDao:
        async def upsert_pipeline_run(
            self,
            *,
            app_name: str,
            run_id: str,
            status: str,
            payload: dict,
            idempotency_key,
            expected_version,
        ):
            _ = (app_name, run_id, status, payload, idempotency_key, expected_version)
            return SimpleNamespace(
                status="updated",
                record={
                    "id": str(uuid4()),
                    "run_id": "pipeline-2",
                    "status": "failed",
                    "payload": {
                        "stages": {
                            "extract_primary": {
                                "status": "failed",
                                "error": {
                                    "failure_category": "low_confidence_contract",
                                    "diagnostic_summary": "契约为 unknown，要求额外必填字段 opaque，当前提取源无法构造最小调用参数",
                                },
                            }
                        }
                    },
                    "version": 2,
                    "updated_at": "2026-03-09T11:40:00+08:00",
                },
            )

    monkeypatch.setattr(knowledge_api, "_get_dao", lambda: FakeDao())

    result = await knowledge_api.upsert_pipelines(
        knowledge_api.PipelinesUpsertRequest(
            app_name="negentropy",
            run_id="pipeline-2",
            status="failed",
            payload={},
        )
    )

    assert result.status == "updated"
    assert result.pipeline.run_id == "pipeline-2"
    assert result.pipeline.payload["stages"]["extract_primary"]["error"]["diagnostic_summary"].startswith(
        "契约为 unknown"
    )


def test_upsert_pipelines_openapi_uses_explicit_response_model() -> None:
    app = FastAPI()
    app.include_router(knowledge_api.router)

    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()

    post_operation = schema["paths"]["/knowledge/pipelines"]["post"]
    response_schema = post_operation["responses"]["200"]["content"]["application/json"]["schema"]
    assert response_schema["$ref"] == "#/components/schemas/PipelineUpsertResponse"
