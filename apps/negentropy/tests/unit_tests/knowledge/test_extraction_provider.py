"""DataExtractorProvider 单元测试

测试 DataExtractorProvider._invoke_target 和 .extract 方法的各种场景，
包括批量/单文件 schema 适配、重试机制、failover 和契约诊断。
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from negentropy.knowledge.extraction import (
    ROUTE_FILE_PDF,
    AdaptiveToolInvocationPlan,
    DataExtractorProvider,
)

from .conftest import FakeMcpSession, noop_increment_tool_call_count, noop_llm_plan


# ---------------------------------------------------------------------------
# _invoke_target: batch schema & normalisation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_data_extractor_provider_uses_pdf_batch_schema_and_normalizes_batch_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    captured_arguments: dict[str, object] = {}

    class FakeClient:
        async def call_tool(self, **kwargs):  # type: ignore[no-untyped-def]
            captured_arguments.update(kwargs["arguments"])
            return SimpleNamespace(
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

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(
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
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        noop_increment_tool_call_count,
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._build_llm_invocation_plan",
        noop_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = FakeClient()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="batch_convert_pdfs_to_markdown",
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
    assert captured_arguments == {
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
async def test_data_extractor_provider_normalizes_list_structured_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()

    class FakeClient:
        async def call_tool(self, **kwargs):  # type: ignore[no-untyped-def]
            _ = kwargs
            return SimpleNamespace(
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

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(
            server_id=server_id,
            input_schema={"type": "object", "properties": {"pdf_sources": {"type": "array"}}},
        ),
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        noop_increment_tool_call_count,
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._build_llm_invocation_plan",
        noop_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = FakeClient()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="batch_convert_pdfs_to_markdown",
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
async def test_data_extractor_provider_normalizes_json_text_content_when_structured_content_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()

    class FakeTextItem:
        type = "text"
        text = '{"result": {"markdown_content": "# JSON Title", "plain_text": "JSON Title"}}'

    class FakeClient:
        async def call_tool(self, **kwargs):  # type: ignore[no-untyped-def]
            _ = kwargs
            return SimpleNamespace(
                success=True,
                structured_content=None,
                content=[FakeTextItem()],
                error=None,
                duration_ms=13,
            )

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(server_id=server_id),
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        noop_increment_tool_call_count,
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._build_llm_invocation_plan",
        noop_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = FakeClient()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="convert_pdf_to_markdown",
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
async def test_data_extractor_provider_rejects_failed_json_text_envelope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()

    class FakeTextItem:
        type = "text"
        text = (
            '{"success":false,"total_pdfs":0,"successful_count":0,'
            '"failed_count":0,"results":[],"total_pages":0}'
        )

    class FakeClient:
        async def call_tool(self, **kwargs):  # type: ignore[no-untyped-def]
            _ = kwargs
            return SimpleNamespace(
                success=True,
                structured_content=None,
                content=[FakeTextItem()],
                error=None,
                duration_ms=13,
            )

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(server_id=server_id),
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        noop_increment_tool_call_count,
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._build_llm_invocation_plan",
        noop_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = FakeClient()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="convert_pdf_to_markdown",
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
async def test_data_extractor_provider_uses_plain_text_content_when_json_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()

    class FakeTextItem:
        type = "text"
        text = "# Plain Markdown"

    class FakeClient:
        async def call_tool(self, **kwargs):  # type: ignore[no-untyped-def]
            _ = kwargs
            return SimpleNamespace(
                success=True,
                structured_content=None,
                content=[FakeTextItem()],
                error=None,
                duration_ms=13,
            )

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(server_id=server_id),
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        noop_increment_tool_call_count,
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._build_llm_invocation_plan",
        noop_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = FakeClient()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="convert_pdf_to_markdown",
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
async def test_data_extractor_provider_rejects_batch_payload_without_successful_documents(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()

    class FakeClient:
        async def call_tool(self, **kwargs):  # type: ignore[no-untyped-def]
            _ = kwargs
            return SimpleNamespace(
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

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(
            server_id=server_id,
            input_schema={
                "type": "object",
                "properties": {"pdf_sources": {"type": "array"}},
            },
        ),
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        noop_increment_tool_call_count,
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._build_llm_invocation_plan",
        noop_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = FakeClient()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="batch_convert_pdfs_to_markdown",
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
async def test_data_extractor_provider_retries_after_validation_error_with_batch_wrapper(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []

    class FakeClient:
        def __init__(self) -> None:
            self.calls = 0

        async def call_tool(self, **kwargs):  # type: ignore[no-untyped-def]
            self.calls += 1
            call_arguments.append(kwargs["arguments"])
            if self.calls == 1:
                return SimpleNamespace(
                    success=False,
                    structured_content=None,
                    content=[],
                    error=(
                        "7 validation errors for call[batch_convert_pdfs_to_markdown]\n"
                        "pdf_sources\n  Missing required argument\n"
                        "source_type\n  Unexpected keyword argument\n"
                        "content_base64\n  Unexpected keyword argument\n"
                    ),
                    duration_ms=12,
                )
            return SimpleNamespace(
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
            )

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(
            server_id=server_id,
            input_schema={"type": "object"},
            description="Convert PDFs to markdown",
        ),
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        noop_increment_tool_call_count,
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._build_llm_invocation_plan",
        noop_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = FakeClient()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="batch_convert_pdfs_to_markdown",
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
async def test_data_extractor_provider_uses_schema_string_source_for_single_pdf_without_llm(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []

    class FakeClient:
        async def call_tool(self, **kwargs):  # type: ignore[no-untyped-def]
            call_arguments.append(kwargs["arguments"])
            return SimpleNamespace(
                success=True,
                structured_content={"result": {"markdown_content": "# PDF", "plain_text": "PDF"}},
                content=[],
                error=None,
                duration_ms=9,
            )

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(
            server_id=server_id,
            server_name="data-extractor",
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
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        noop_increment_tool_call_count,
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._build_llm_invocation_plan",
        noop_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = FakeClient()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="convert_pdf_to_markdown",
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
async def test_data_extractor_provider_uses_llm_selected_string_source_for_single_pdf(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []

    class FakeClient:
        async def call_tool(self, **kwargs):  # type: ignore[no-untyped-def]
            call_arguments.append(kwargs["arguments"])
            return SimpleNamespace(
                success=True,
                structured_content={"result": {"markdown_content": "# PDF", "plain_text": "PDF"}},
                content=[],
                error=None,
                duration_ms=9,
            )

        async def discover_tools(self, **kwargs):  # type: ignore[no-untyped-def]
            _ = kwargs
            return SimpleNamespace(
                success=True,
                error=None,
                tools=[
                    SimpleNamespace(
                        name="convert_pdf_to_markdown",
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
            )

    async def fake_llm_plan(**kwargs):  # type: ignore[no-untyped-def]
        return AdaptiveToolInvocationPlan(
            adapter_name="single_string_source_v1",
            arguments={"pdf_source": "/tmp/fake.pdf"},
            reasoning_source="llm",
            diagnostics={"selected_source_kind": "local_path", "contract_mode": "nested_single"},
        )

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(
            server_id=server_id,
            server_name="data-extractor",
            scalar_returns_none=True,
        ),
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        noop_increment_tool_call_count,
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._build_llm_invocation_plan",
        fake_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = FakeClient()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="convert_pdf_to_markdown",
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
async def test_data_extractor_provider_keeps_string_contract_on_missing_single_source_retry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []

    class FakeClient:
        def __init__(self) -> None:
            self.calls = 0

        async def call_tool(self, **kwargs):  # type: ignore[no-untyped-def]
            self.calls += 1
            call_arguments.append(kwargs["arguments"])
            if self.calls == 1:
                return SimpleNamespace(
                    success=False,
                    structured_content=None,
                    content=[],
                    error=(
                        "1 validation error for call[convert_pdf_to_markdown]\n"
                        "pdf_source\n  Missing required argument\n"
                    ),
                    duration_ms=8,
                )
            return SimpleNamespace(
                success=True,
                structured_content={"result": {"markdown_content": "# PDF", "plain_text": "PDF"}},
                content=[],
                error=None,
                duration_ms=10,
            )

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(
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
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        noop_increment_tool_call_count,
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._build_llm_invocation_plan",
        noop_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = FakeClient()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="convert_pdf_to_markdown",
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
    assert result["result"].trace["adapter_attempts"][1]["diagnostics"]["schema_shape"] == "validation_retry.scalar_value"


@pytest.mark.asyncio
async def test_data_extractor_provider_fails_fast_when_single_string_source_has_no_candidate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_count = 0

    class FakeClient:
        async def call_tool(self, **kwargs):  # type: ignore[no-untyped-def]
            nonlocal call_count
            call_count += 1
            _ = kwargs
            return SimpleNamespace(
                success=True,
                structured_content={"result": {"markdown_content": "# should not happen", "plain_text": "bad"}},
                content=[],
                error=None,
                duration_ms=1,
            )

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(
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
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        noop_increment_tool_call_count,
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._build_llm_invocation_plan",
        noop_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = FakeClient()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="convert_pdf_to_markdown",
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
    assert call_count == 0
    assert result["attempt"].failure_category == "low_confidence_contract"
    assert "string source" in result["attempt"].diagnostic_summary


# ---------------------------------------------------------------------------
# .extract: failover across targets
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_data_extractor_provider_failovers_when_primary_returns_empty_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []

    class FakeClient:
        def __init__(self) -> None:
            self.calls = 0

        async def call_tool(self, **kwargs):  # type: ignore[no-untyped-def]
            self.calls += 1
            call_arguments.append(kwargs["arguments"])
            if self.calls == 1:
                return SimpleNamespace(
                    success=True,
                    structured_content={"result": {"metadata": {"provider": "primary"}}},
                    content=[],
                    error=None,
                    duration_ms=10,
                )
            return SimpleNamespace(
                success=True,
                structured_content={"result": {"markdown_content": "# Secondary", "plain_text": "Secondary"}},
                content=[],
                error=None,
                duration_ms=12,
            )

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(
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
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        noop_increment_tool_call_count,
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._build_llm_invocation_plan",
        noop_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = FakeClient()

    result = await provider.extract(
        app_name="negentropy",
        corpus_id=uuid4(),
        source_kind=ROUTE_FILE_PDF,
        corpus_config={
            "extractor_routes": {
                "file_pdf": {
                    "targets": [
                        {"server_id": str(server_id), "tool_name": "convert_pdfs_to_markdown", "priority": 0},
                        {"server_id": str(server_id), "tool_name": "batch_convert_pdfs_to_markdown", "priority": 1},
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
async def test_data_extractor_provider_marks_unknown_contract_as_unsupported_for_failover(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(
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
            tool_name="convert_pdf_to_markdown",
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
async def test_data_extractor_provider_marks_unknown_contract_with_extra_required_fields_as_low_confidence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(
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
            tool_name="convert_pdf_to_markdown",
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
async def test_data_extractor_provider_retries_with_string_batch_contract_after_string_type_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []
    llm_calls: list[dict[str, object]] = []

    class FakeClient:
        def __init__(self) -> None:
            self.calls = 0

        async def call_tool(self, **kwargs):  # type: ignore[no-untyped-def]
            self.calls += 1
            call_arguments.append(kwargs["arguments"])
            if self.calls == 1:
                return SimpleNamespace(
                    success=False,
                    structured_content=None,
                    content=[],
                    error=(
                        "1 validation error for call[batch_convert_pdfs_to_markdown]\n"
                        "pdf_sources.0\n  Input should be a valid string\n"
                    ),
                    duration_ms=7,
                )
            return SimpleNamespace(
                success=True,
                structured_content={"result": {"markdown_content": "# Batch", "plain_text": "Batch"}},
                content=[],
                error=None,
                duration_ms=11,
            )

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

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.AsyncSessionLocal",
        lambda: FakeMcpSession(
            server_id=server_id,
            server_name="data-extractor",
            input_schema={
                "type": "object",
                "properties": {
                    "pdf_sources": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["pdf_sources"],
            },
            description="batch pdfs",
        ),
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        noop_increment_tool_call_count,
    )
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._build_llm_invocation_plan",
        fake_llm_plan,
    )

    provider = DataExtractorProvider()
    provider._client = FakeClient()

    result = await provider._invoke_target(
        app_name="negentropy",
        corpus_id=uuid4(),
        target=SimpleNamespace(
            server_id=server_id,
            tool_name="batch_convert_pdfs_to_markdown",
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
