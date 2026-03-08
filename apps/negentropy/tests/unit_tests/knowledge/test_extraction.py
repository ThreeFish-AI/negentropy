from types import SimpleNamespace
from uuid import uuid4

import pytest

from negentropy.knowledge.extraction import (
    ROUTE_FILE_PDF,
    ROUTE_URL,
    DataExtractorProvider,
    build_tool_adapter,
    extract_source,
    normalize_tool_contract,
    resolve_source_kind,
    resolve_targets,
)


def test_resolve_source_kind_for_url_and_pdf() -> None:
    assert resolve_source_kind(source_uri="https://example.com/doc") == ROUTE_URL
    assert resolve_source_kind(filename="report.pdf") == ROUTE_FILE_PDF
    assert resolve_source_kind(content_type="application/pdf") == ROUTE_FILE_PDF


def test_resolve_targets_sorts_and_filters_invalid_items() -> None:
    server_id = str(uuid4())
    targets = resolve_targets(
        {
            "extractor_routes": {
                "url": {
                    "targets": [
                        {"server_id": server_id, "tool_name": "secondary", "priority": 2},
                        {"server_id": server_id, "tool_name": "primary", "priority": 1},
                        {"server_id": "", "tool_name": "ignored"},
                    ]
                }
            }
        },
        ROUTE_URL,
    )

    assert [item.tool_name for item in targets] == ["primary", "secondary"]


@pytest.mark.asyncio
async def test_extract_source_uses_legacy_provider_without_routes(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_extract_url(self, *, url: str):  # type: ignore[no-untyped-def]
        from negentropy.knowledge.extraction import ExtractedDocumentResult

        return ExtractedDocumentResult(
            plain_text="legacy text",
            markdown_content="legacy markdown",
        )

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.LegacyExtractionProvider.extract_url",
        fake_extract_url,
    )

    result = await extract_source(
        app_name="negentropy",
        corpus_id=uuid4(),
        corpus_config={},
        source_kind=ROUTE_URL,
        url="https://example.com",
    )

    assert result.plain_text == "legacy text"
    assert result.markdown_content == "legacy markdown"
    assert result.trace["provider"] == "legacy"


def test_build_tool_adapter_wraps_pdf_request_into_batch_sources_schema() -> None:
    request = build_tool_adapter(
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
                "options": {
                    "type": "object",
                    "properties": {
                        "ocr": {"type": "boolean"},
                    },
                },
            },
        },
        request=SimpleNamespace(
            source_kind=ROUTE_FILE_PDF,
            source=SimpleNamespace(
                url=None,
                filename="report.pdf",
                content_type="application/pdf",
                content_base64="cGRm",
            ),
            options={"ocr": True, "ignored": "value"},
            context={"app_name": "negentropy", "corpus_id": "cid"},
        ),
    )

    assert request.name == "batch_sources_v2"
    assert request.arguments == {
        "pdf_sources": [
            {
                "filename": "report.pdf",
                "content_type": "application/pdf",
                "content_base64": "cGRm",
            }
        ],
        "options": {"ocr": True},
    }


def test_normalize_tool_contract_supports_ref_wrapped_batch_schema() -> None:
    contract = normalize_tool_contract(
        input_schema={
            "type": "object",
            "properties": {
                "pdf_sources": {
                    "type": "array",
                    "items": {"$ref": "#/$defs/PdfSource"},
                }
            },
            "$defs": {
                "PdfSource": {
                    "type": "object",
                    "properties": {
                        "filename": {"type": "string"},
                        "data_base64": {"type": "string"},
                    },
                }
            },
        },
        source_kind=ROUTE_FILE_PDF,
    )

    assert contract.mode == "batch"
    assert contract.batch_property == "pdf_sources"
    assert contract.source_fields == {"filename", "data_base64"}


@pytest.mark.asyncio
async def test_data_extractor_provider_uses_pdf_batch_schema_and_normalizes_batch_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    captured_arguments: dict[str, object] = {}

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, model, key):  # type: ignore[no-untyped-def]
            _ = (model, key)
            return SimpleNamespace(
                id=server_id,
                name="pdf-extractor",
                is_enabled=True,
                transport_type="http",
                command=None,
                args=[],
                env={},
                url="https://example.com/mcp",
                headers={},
            )

        async def scalar(self, stmt):  # type: ignore[no-untyped-def]
            _ = stmt
            return SimpleNamespace(
                is_enabled=True,
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
            )

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

    async def fake_increment_tool_call_count(**_: object) -> None:
        return None

    monkeypatch.setattr("negentropy.knowledge.extraction.AsyncSessionLocal", lambda: FakeSession())
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        fake_increment_tool_call_count,
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
async def test_data_extractor_provider_retries_after_validation_error_with_batch_wrapper(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, model, key):  # type: ignore[no-untyped-def]
            _ = (model, key)
            return SimpleNamespace(
                id=server_id,
                name="pdf-extractor",
                is_enabled=True,
                transport_type="http",
                command=None,
                args=[],
                env={},
                url="https://example.com/mcp",
                headers={},
            )

        async def scalar(self, stmt):  # type: ignore[no-untyped-def]
            _ = stmt
            return SimpleNamespace(
                is_enabled=True,
                description="Convert PDFs to markdown",
                input_schema={"type": "object"},
            )

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

    async def fake_increment_tool_call_count(**_: object) -> None:
        return None

    monkeypatch.setattr("negentropy.knowledge.extraction.AsyncSessionLocal", lambda: FakeSession())
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        fake_increment_tool_call_count,
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
