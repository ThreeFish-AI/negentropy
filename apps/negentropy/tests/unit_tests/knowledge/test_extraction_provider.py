"""DataExtractorProvider 单元测试

测试 DataExtractorProvider._invoke_target 和 .extract 方法的各种场景，
包括批量/单文件 schema 适配、重试机制、failover 和契约诊断。
"""

import asyncio
from collections.abc import Iterator
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest

from negentropy.knowledge.ingestion import extraction as extraction_mod
from negentropy.knowledge.ingestion.extraction import (
    ROUTE_FILE_PDF,
    AdaptiveToolInvocationPlan,
    DataExtractorProvider,
    ExtractionGateQueueTimeout,
    _extraction_gate,
)

from .conftest import (
    FakeImageContent,
    FakeMcpClient,
    FakeMcpSession,
    FakeTextItem,
    patch_extraction_deps,
)

# ---------------------------------------------------------------------------
# _invoke_target: batch schema & normalisation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_uses_pdf_batch_schema_and_normalizes_batch_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    captured: list[dict[str, object]] = []
    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=True,
                structured_content={
                    "results": [
                        {
                            "success": True,
                            "result": {
                                "markdown_content": "# Title",
                                "plain_text": "Title",
                                "metadata": {"provider": "batch"},
                            },
                        }
                    ]
                },
                content=[],
                error=None,
                duration_ms=18,
            )
        ],
        capture_arguments=captured,
    )

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            input_schema={
                "type": "object",
                "properties": {
                    "pdf_sources": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "filename": {"type": "string"},
                                "content_type": {"type": "string"},
                                "content_base64": {"type": "string"},
                            },
                        },
                    },
                },
            },
        ),
    )

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdfs_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is True
    assert captured[0] == {
        "pdf_sources": [
            {
                "filename": "report.pdf",
                "content_type": "application/pdf",
                "content_base64": "JVBERi0xLjU=",
            }
        ]
    }
    extracted = result["result"]
    assert extracted.markdown_content == "# Title"
    assert extracted.plain_text == "Title"
    assert extracted.metadata["provider"] == "batch"
    assert extracted.metadata["adapter_name"] == "batch_sources_v2"
    assert extracted.trace["llm_fallback_used"] is False


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_normalizes_list_structured_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=True,
                structured_content=[
                    {
                        "result": {
                            "markdown_content": "# List Title",
                        }
                    }
                ],
                content=[],
                error=None,
                duration_ms=18,
            )
        ],
    )

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            input_schema={"type": "object", "properties": {"pdf_sources": {"type": "array"}}},
        ),
    )

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdfs_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is True
    extracted = result["result"]
    assert extracted.markdown_content == "# List Title"
    assert extracted.plain_text == "# List Title"


# ---------------------------------------------------------------------------
# _invoke_target: JSON text / plain text fallbacks
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_normalizes_json_text_content_when_structured_content_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=True,
                structured_content=None,
                content=[
                    FakeTextItem(text='{"result": {"markdown_content": "# JSON Title", "plain_text": "JSON Title"}}')
                ],
                error=None,
                duration_ms=13,
            )
        ],
    )

    patch_extraction_deps(monkeypatch, server_id)

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdf_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is True
    extracted = result["result"]
    assert extracted.markdown_content == "# JSON Title"
    assert extracted.plain_text == "JSON Title"


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_rejects_failed_json_text_envelope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=True,
                structured_content=None,
                content=[
                    FakeTextItem(
                        text='{"success":false,"total_pdfs":0,"successful_count":0,"failed_count":0,"results":[],"total_pages":0}'
                    )
                ],
                error=None,
                duration_ms=13,
            )
        ],
    )

    patch_extraction_deps(monkeypatch, server_id)

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdf_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is False
    assert result["attempt"].failure_category == "tool_execution_failed"


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_uses_plain_text_content_when_json_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=True,
                structured_content=None,
                content=[FakeTextItem(text="# Plain Markdown")],
                error=None,
                duration_ms=13,
            )
        ],
    )

    patch_extraction_deps(monkeypatch, server_id)

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdf_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is True
    extracted = result["result"]
    assert extracted.markdown_content == "# Plain Markdown"
    assert extracted.plain_text == "# Plain Markdown"


# ---------------------------------------------------------------------------
# _invoke_target: batch rejection
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_rejects_batch_payload_without_successful_documents(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=True,
                structured_content={
                    "success": True,
                    "successful_count": 0,
                    "failed_count": 1,
                    "results": [],
                },
                content=[],
                error=None,
                duration_ms=17,
            )
        ],
    )

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            input_schema={
                "type": "object",
                "properties": {"pdf_sources": {"type": "array"}},
            },
        ),
    )

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdfs_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is False
    assert result["attempt"].failure_category == "no_successful_documents"


# ---------------------------------------------------------------------------
# _invoke_target: validation retry with batch wrapper
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_retries_after_validation_error_with_batch_wrapper(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []
    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=False,
                structured_content=None,
                content=[],
                error=(
                    "7 validation errors for call[parse_pdfs_to_markdown]\n"
                    "pdf_sources\n  Missing required argument\n"
                    "source_type\n  Unexpected keyword argument\n"
                    "content_base64\n  Unexpected keyword argument\n"
                ),
                duration_ms=12,
            ),
            SimpleNamespace(
                success=True,
                structured_content={
                    "result": {
                        "markdown_content": "# Retried",
                        "plain_text": "Retried",
                    }
                },
                content=[],
                error=None,
                duration_ms=20,
            ),
        ],
        capture_arguments=call_arguments,
    )

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            input_schema={"type": "object"},
            description="Convert PDFs to markdown",
        ),
    )

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdfs_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is True
    assert call_arguments[0]["source_type"] == ROUTE_FILE_PDF
    assert call_arguments[1] == {
        "pdf_sources": [
            {
                "filename": "report.pdf",
                "content_type": "application/pdf",
                "content_base64": "JVBERi0xLjU=",
            }
        ]
    }
    extracted = result["result"]
    assert extracted.metadata["adapter_name"] == "batch_sources_retry_v1"
    assert extracted.trace["adapter_attempts"][0]["success"] is False
    assert extracted.trace["adapter_attempts"][1]["reasoning_source"] == "validation_retry"


# ---------------------------------------------------------------------------
# _invoke_target: single string source adapters
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_uses_schema_string_source_for_single_pdf_without_llm(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []
    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=True,
                structured_content={"result": {"markdown_content": "# PDF", "plain_text": "PDF"}},
                content=[],
                error=None,
                duration_ms=9,
            )
        ],
        capture_arguments=call_arguments,
    )

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            server_name="negentropy-perceives",
            input_schema={
                "type": "object",
                "properties": {
                    "pdf_source": {"type": "string"},
                    "include_metadata": {"type": "boolean"},
                },
                "required": ["pdf_source"],
            },
            description="single pdf",
        ),
    )

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdf_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is True
    assert len(call_arguments) == 1
    assert isinstance(call_arguments[0]["pdf_source"], str)
    assert call_arguments[0]["pdf_source"].endswith(".pdf")
    assert result["result"].metadata["adapter_name"] == "single_string_source_v1"
    assert result["result"].trace["llm_fallback_used"] is False
    assert result["result"].trace["adapter_schema_summary"]["selected_source_kind"] == "local_path"


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_uses_llm_selected_string_source_for_single_pdf(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []

    async def fake_llm_plan(**kwargs):  # type: ignore[no-untyped-def]
        return AdaptiveToolInvocationPlan(
            adapter_name="single_string_source_v1",
            arguments={"pdf_source": "/tmp/fake.pdf"},
            reasoning_source="llm",
            diagnostics={"selected_source_kind": "local_path", "contract_mode": "nested_single"},
        )

    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=True,
                structured_content={"result": {"markdown_content": "# PDF", "plain_text": "PDF"}},
                content=[],
                error=None,
                duration_ms=9,
            )
        ],
        capture_arguments=call_arguments,
        discover_tools_response=SimpleNamespace(
            success=True,
            error=None,
            tools=[
                SimpleNamespace(
                    name="parse_pdf_to_markdown",
                    description="single pdf",
                    input_schema={
                        "type": "object",
                        "properties": {
                            "pdf_source": {"type": "string"},
                            "include_metadata": {"type": "boolean"},
                        },
                        "required": ["pdf_source"],
                    },
                )
            ],
        ),
    )

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            server_name="negentropy-perceives",
            scalar_returns_none=True,
        ),
        llm_plan=fake_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdf_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is True
    assert call_arguments == [{"pdf_source": "/tmp/fake.pdf"}]
    assert result["result"].metadata["adapter_name"] == "single_string_source_v1"
    assert result["result"].trace["llm_fallback_used"] is True


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_keeps_string_contract_on_missing_single_source_retry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []
    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=False,
                structured_content=None,
                content=[],
                error=("1 validation error for call[parse_pdf_to_markdown]\npdf_source\n  Missing required argument\n"),
                duration_ms=8,
            ),
            SimpleNamespace(
                success=True,
                structured_content={"result": {"markdown_content": "# PDF", "plain_text": "PDF"}},
                content=[],
                error=None,
                duration_ms=10,
            ),
        ],
        capture_arguments=call_arguments,
    )

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            input_schema={
                "type": "object",
                "properties": {
                    "pdf_source": {"type": "string"},
                },
                "required": ["pdf_source"],
            },
            description="single pdf",
        ),
    )

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdf_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is True
    assert len(call_arguments) == 2
    assert all(isinstance(item["pdf_source"], str) for item in call_arguments)
    assert result["result"].metadata["adapter_name"] == "single_string_source_retry_v1"
    assert result["result"].trace["adapter_attempts"][1]["reasoning_source"] == "validation_retry"
    assert (
        result["result"].trace["adapter_attempts"][1]["diagnostics"]["schema_shape"] == "validation_retry.scalar_value"
    )


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_fails_fast_when_single_string_source_has_no_candidate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_count: list[dict[str, object]] = []
    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=True,
                structured_content={"result": {"markdown_content": "# should not happen", "plain_text": "bad"}},
                content=[],
                error=None,
                duration_ms=1,
            )
        ],
        capture_arguments=call_count,
    )

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            input_schema={
                "type": "object",
                "properties": {
                    "pdf_source": {"type": "string"},
                },
                "required": ["pdf_source"],
            },
            description="single pdf",
        ),
    )

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdf_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=None,
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is False
    assert len(call_count) == 0
    assert result["attempt"].failure_category == "low_confidence_contract"
    assert "string source" in result["attempt"].diagnostic_summary


# ---------------------------------------------------------------------------
# .extract: failover across targets
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_failovers_when_primary_returns_empty_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []
    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=True,
                structured_content={"result": {"metadata": {"provider": "primary"}}},
                content=[],
                error=None,
                duration_ms=10,
            ),
            SimpleNamespace(
                success=True,
                structured_content={"result": {"markdown_content": "# Secondary", "plain_text": "Secondary"}},
                content=[],
                error=None,
                duration_ms=12,
            ),
        ],
        capture_arguments=call_arguments,
    )

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            input_schema={
                "type": "object",
                "properties": {
                    "pdf_sources": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "filename": {"type": "string"},
                                "content_type": {"type": "string"},
                                "content_base64": {"type": "string"},
                            },
                        },
                    }
                },
            },
        ),
    )

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider.extract(
        app_name="negentropy",
        corpus_id=uuid4(),
        source_kind=ROUTE_FILE_PDF,
        corpus_config={
            "extractor_routes": {
                "file_pdf": {
                    "targets": [
                        {"server_id": str(server_id), "tool_name": "convert_pdfs_to_markdown", "priority": 0},
                        {"server_id": str(server_id), "tool_name": "parse_pdfs_to_markdown", "priority": 1},
                    ]
                }
            }
        },
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert len(call_arguments) == 2
    assert result.plain_text == "Secondary"
    assert result.trace["attempts"][0]["failure_category"] == "empty_payload"


# ---------------------------------------------------------------------------
# _invoke_target: contract diagnostics
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_marks_unknown_contract_as_unsupported_for_failover(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            input_schema={"type": "object", "properties": {"opaque": {"type": "integer"}}},
        ),
    )

    provider = DataExtractorProvider()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdf_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is False
    attempt = result["attempt"]
    assert attempt.failure_category == "unsupported_contract"
    assert attempt.diagnostics["capability"]["schema_confidence"] == "medium"
    assert "未声明可识别的文档 source 字段" in attempt.diagnostic_summary


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_marks_unknown_contract_with_extra_required_fields_as_low_confidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            input_schema={
                "type": "object",
                "properties": {
                    "pdf_sources": {"type": "array"},
                    "opaque": {"type": "integer"},
                },
                "required": ["pdf_sources", "opaque"],
            },
        ),
    )

    provider = DataExtractorProvider()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdf_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is False
    attempt = result["attempt"]
    assert attempt.failure_category == "low_confidence_contract"
    assert "opaque" in attempt.diagnostic_summary
    assert attempt.diagnostics["branches"][0]["unsupported_required_fields"] == ["opaque"]


# ---------------------------------------------------------------------------
# _invoke_target: string batch retry via LLM
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_retries_with_string_batch_contract_after_string_type_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []
    llm_calls: list[dict[str, object]] = []

    async def fake_llm_plan(**kwargs):  # type: ignore[no-untyped-def]
        llm_calls.append(kwargs)
        validation_error = kwargs.get("validation_error")
        if validation_error is None:
            return AdaptiveToolInvocationPlan(
                adapter_name="batch_sources_v2",
                arguments={"pdf_sources": [{"filename": "report.pdf"}]},
                reasoning_source="llm",
                diagnostics={"selected_source_kind": "inline_object"},
            )
        return AdaptiveToolInvocationPlan(
            adapter_name="batch_string_sources_v1",
            arguments={"pdf_sources": ["/tmp/retry.pdf"]},
            reasoning_source="llm",
            diagnostics={"selected_source_kind": "local_path"},
        )

    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=False,
                structured_content=None,
                content=[],
                error=(
                    "1 validation error for call[parse_pdfs_to_markdown]\n"
                    "pdf_sources.0\n  Input should be a valid string\n"
                ),
                duration_ms=7,
            ),
            SimpleNamespace(
                success=True,
                structured_content={"result": {"markdown_content": "# Batch", "plain_text": "Batch"}},
                content=[],
                error=None,
                duration_ms=11,
            ),
        ],
        capture_arguments=call_arguments,
    )

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            server_name="negentropy-perceives",
            input_schema={
                "type": "object",
                "properties": {
                    "pdf_sources": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["pdf_sources"],
            },
            description="batch pdfs",
        ),
        llm_plan=fake_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdfs_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is True
    assert call_arguments[0] == {"pdf_sources": [{"filename": "report.pdf"}]}
    assert call_arguments[1] == {"pdf_sources": ["/tmp/retry.pdf"]}
    assert len(llm_calls) == 2
    assert llm_calls[1]["validation_error"].string_item_fields == ["pdf_sources.0"]


# ---------------------------------------------------------------------------
# _invoke_target: ImageContent in content_items merged into assets
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_merges_image_content_items_into_assets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """当 structured_content 不含 assets，但 content_items 有 ImageContent 时，
    图片应被提取并与 Markdown 引用匹配，生成正确的 ExtractionAsset 列表。
    """
    server_id = uuid4()
    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=True,
                structured_content={
                    "markdown_content": (
                        "# PDF Report\n"
                        "![](img_1_36_20260324_135001.png)\n"
                        "Some analysis text.\n"
                        "![](img_1_37_20260324_135001.png)"
                    ),
                    "plain_text": "PDF Report\nSome analysis text.",
                    "metadata": {"pages": 5},
                },
                content=[
                    FakeTextItem(text=""),
                    FakeImageContent(data="cG5nX2RhdGFfMQ==", mime="image/png"),
                    FakeImageContent(data="cG5nX2RhdGFfMg==", mime="image/png"),
                ],
                error=None,
                duration_ms=42,
            )
        ],
    )

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            input_schema={
                "type": "object",
                "properties": {
                    "content_base64": {"type": "string"},
                    "filename": {"type": "string"},
                },
            },
        ),
    )

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdf_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is True
    extracted = result["result"]

    assert "# PDF Report" in extracted.markdown_content

    assert len(extracted.assets) == 2
    assert extracted.assets[0].name == "img_1_36_20260324_135001.png"
    assert extracted.assets[0].content_type == "image/png"
    assert extracted.assets[0].data_base64 == "cG5nX2RhdGFfMQ=="
    assert extracted.assets[1].name == "img_1_37_20260324_135001.png"
    assert extracted.assets[1].data_base64 == "cG5nX2RhdGFfMg=="


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_structured_assets_take_precedence_over_content_items(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """当 structured_content 中已包含带 data_base64 的 assets，
    content_items 中的同名 ImageContent 不应覆盖。
    """
    server_id = uuid4()
    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=True,
                structured_content={
                    "markdown_content": "# Report\n![](chart.png)",
                    "plain_text": "Report",
                    "assets": [
                        {
                            "name": "chart.png",
                            "content_type": "image/png",
                            "data_base64": "c3RydWN0dXJlZF9kYXRh",
                        }
                    ],
                },
                content=[
                    FakeImageContent(data="Y29udGVudF9kYXRh", mime="image/png"),
                ],
                error=None,
                duration_ms=20,
            )
        ],
    )

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            input_schema={
                "type": "object",
                "properties": {"content_base64": {"type": "string"}},
            },
        ),
    )

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdf_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is True
    extracted = result["result"]
    assert len(extracted.assets) == 1
    assert extracted.assets[0].name == "chart.png"
    assert extracted.assets[0].data_base64 == "c3RydWN0dXJlZF9kYXRh"


@pytest.mark.asyncio
async def test_negentropy_perceives_provider_reads_enhanced_assets_from_output_directory(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    server_id = uuid4()
    output_dir = tmp_path / "enhanced_assets"
    output_dir.mkdir()
    (output_dir / "img_1.png").write_bytes(b"png")

    client = FakeMcpClient(
        responses=[
            SimpleNamespace(
                success=True,
                structured_content={
                    "markdown_content": "# Report\n![](img_1.png)",
                    "plain_text": "Report",
                    "enhanced_assets": {
                        "output_directory": str(output_dir),
                        "images": {
                            "count": 1,
                            "files": ["img_1.png"],
                        },
                    },
                },
                content=[],
                error=None,
                duration_ms=20,
            )
        ],
    )

    patch_extraction_deps(
        monkeypatch,
        server_id,
        session=FakeMcpSession(
            server_id=server_id,
            input_schema={
                "type": "object",
                "properties": {"content_base64": {"type": "string"}},
            },
        ),
    )

    provider = DataExtractorProvider()
    provider._client = client

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="parse_pdf_to_markdown",
            timeout_ms=None,
            tool_options={},
        ),
        source_kind=ROUTE_FILE_PDF,
        url=None,
        content=b"%PDF-1.5",
        filename="report.pdf",
        content_type="application/pdf",
    )

    assert result["success"] is True
    extracted = result["result"]
    assert len(extracted.assets) == 1
    assert extracted.assets[0].name == "img_1.png"
    assert extracted.assets[0].local_path == str((output_dir / "img_1.png").resolve())
    assert extracted.assets[0].metadata["source"] == "enhanced_output_directory"


# ---------------------------------------------------------------------------
# 并发闸门 _extraction_gate：串行化 / 粒度隔离 / 排队超时
#
# 动机见 extraction.py 模块注释：perceives 重引擎单 worker + 单机 MPS，
# 并发 PDF 提取会互相争抢致双双超时。此处直接验证闸门语义。
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_extraction_gates() -> Iterator[None]:
    """每个用例前后清空模块级闸门状态，确保 (server_id, source_kind) 用例隔离。"""
    extraction_mod._EXTRACTION_GATES.clear()
    extraction_mod._EXTRACTION_INFLIGHT.clear()
    yield
    extraction_mod._EXTRACTION_GATES.clear()
    extraction_mod._EXTRACTION_INFLIGHT.clear()


async def _measure_concurrent_entries(
    server_id: str,
    source_kinds: list[str],
    *,
    hold_seconds: float = 0.05,
) -> tuple[int, int]:
    """并发对给定 (server_id, source_kind) 序列各进入一次闸门，返回 (最大并发数, 完成数)。"""
    state: dict[str, int] = {"concurrent": 0, "max": 0, "done": 0}
    lock = asyncio.Lock()

    async def enter(source_kind: str) -> None:
        async with _extraction_gate(server_id, source_kind):
            async with lock:
                state["concurrent"] += 1
                state["max"] = max(state["max"], state["concurrent"])
            await asyncio.sleep(hold_seconds)
            async with lock:
                state["concurrent"] -= 1
                state["done"] += 1

    await asyncio.gather(*(enter(sk) for sk in source_kinds))
    return state["max"], state["done"]


@pytest.mark.asyncio
async def test_extraction_gate_serializes_same_server_and_source_kind() -> None:
    """同一 (server, source_kind)、limit=1：两次进入严格互斥，最大并发为 1。"""
    max_concurrent, done = await _measure_concurrent_entries(str(uuid4()), [ROUTE_FILE_PDF, ROUTE_FILE_PDF])
    assert done == 2
    assert max_concurrent == 1  # 闸门限流 1 → 任意时刻至多 1 个在临界区


@pytest.mark.asyncio
async def test_extraction_gate_isolates_different_source_kinds() -> None:
    """同一 server、不同 source_kind（file_pdf vs url）使用独立闸门，可真并发（max=2）。

    防止误把 URL/webpage 抓取（scrapy/selenium）与 PDF 提取（docling）串到一起。
    """
    max_concurrent, done = await _measure_concurrent_entries(str(uuid4()), ["file_pdf", "url"])
    assert done == 2
    assert max_concurrent == 2  # 不同 source_kind → 不同闸门 → 真并发


@pytest.mark.asyncio
async def test_extraction_gate_queue_timeout_raises_cleanly(monkeypatch: pytest.MonkeyPatch) -> None:
    """排队超过 queue_timeout 抛 ExtractionGateQueueTimeout，而非无限空等。"""
    monkeypatch.setattr(
        extraction_mod,
        "settings",
        SimpleNamespace(
            knowledge=SimpleNamespace(
                extraction_max_concurrency=1,
                extraction_queue_timeout_seconds=0.2,
            )
        ),
    )
    server_id = str(uuid4())
    release_holder = asyncio.Event()

    async def hold() -> None:
        async with _extraction_gate(server_id, ROUTE_FILE_PDF):
            await asyncio.wait_for(release_holder.wait(), timeout=2.0)

    holder = asyncio.create_task(hold())
    await asyncio.sleep(0.05)  # 让 holder 先进入临界区占住 limit=1 的闸门

    try:
        with pytest.raises(ExtractionGateQueueTimeout):
            async with _extraction_gate(server_id, ROUTE_FILE_PDF):
                pytest.fail("排队超时不应进入临界区")
    finally:
        release_holder.set()
        await holder
