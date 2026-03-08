from types import SimpleNamespace
from uuid import uuid4

import pytest

from negentropy.knowledge.extraction import (
    ROUTE_FILE_PDF,
    ROUTE_URL,
    AdaptiveToolInvocationPlan,
    CanonicalExtractionRequest,
    CanonicalExtractionSource,
    DataExtractorProvider,
    ExtractionAttempt,
    _build_llm_invocation_plan,
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


def test_normalize_tool_contract_supports_string_batch_schema() -> None:
    contract = normalize_tool_contract(
        input_schema={
            "type": "object",
            "properties": {
                "pdf_sources": {
                    "type": "array",
                    "items": {"type": "string"},
                }
            },
        },
        source_kind=ROUTE_FILE_PDF,
    )

    assert contract.mode == "batch"
    assert contract.batch_property == "pdf_sources"
    assert contract.source_value_type == "string"


@pytest.mark.asyncio
async def test_build_llm_invocation_plan_supports_slots_dataclass_request(monkeypatch: pytest.MonkeyPatch) -> None:
    captured_messages: list[dict[str, object]] = []

    async def fake_acompletion(**kwargs):  # type: ignore[no-untyped-def]
        captured_messages.extend(kwargs["messages"])
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content='{"source_candidate_kind":"local_path","include_options":true,"include_context":true}'
                    )
                )
            ]
        )

    monkeypatch.setattr("negentropy.knowledge.extraction.litellm.acompletion", fake_acompletion)

    request = CanonicalExtractionRequest(
        source_kind=ROUTE_FILE_PDF,
        source=CanonicalExtractionSource(
            source_kind=ROUTE_FILE_PDF,
            filename="report.pdf",
            content_type="application/pdf",
            content_base64="cGRm",
        ),
        options={"ocr": True},
        context={"app_name": "negentropy", "corpus_id": "cid"},
    )
    contract = normalize_tool_contract(
        input_schema={
            "type": "object",
            "properties": {
                "pdf_source": {"type": "string"},
                "options": {"type": "object", "properties": {"ocr": {"type": "boolean"}}},
                "context": {
                    "type": "object",
                    "properties": {"app_name": {"type": "string"}, "corpus_id": {"type": "string"}},
                },
            },
        },
        source_kind=ROUTE_FILE_PDF,
    )

    plan = await _build_llm_invocation_plan(
        tool_name="convert_pdf_to_markdown",
        tool_description="single pdf",
        input_schema=contract.root_schema,
        contract=contract,
        request=request,
        source_candidates=[],
    )

    assert plan is not None
    assert plan.reasoning_source == "llm"
    assert plan.arguments == {
        "options": {"ocr": True},
        "context": {"app_name": "negentropy", "corpus_id": "cid"},
    }
    assert '"filename": "report.pdf"' in str(captured_messages[0]["content"])


@pytest.mark.asyncio
async def test_build_llm_invocation_plan_returns_none_when_serialization_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "negentropy.knowledge.extraction.to_json_compatible",
        lambda value: (_ for _ in ()).throw(RuntimeError("serialize failed")),
    )

    request = CanonicalExtractionRequest(
        source_kind=ROUTE_FILE_PDF,
        source=CanonicalExtractionSource(source_kind=ROUTE_FILE_PDF, filename="report.pdf"),
    )
    contract = normalize_tool_contract(
        input_schema={"type": "object", "properties": {"pdf_source": {"type": "string"}}},
        source_kind=ROUTE_FILE_PDF,
    )

    plan = await _build_llm_invocation_plan(
        tool_name="convert_pdf_to_markdown",
        tool_description="single pdf",
        input_schema=contract.root_schema,
        contract=contract,
        request=request,
        source_candidates=[],
    )

    assert plan is None


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
    async def fake_llm_plan(**_: object) -> None:
        return None
    monkeypatch.setattr("negentropy.knowledge.extraction._build_llm_invocation_plan", fake_llm_plan)

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


def test_extraction_attempt_slots_dataclass_is_json_serialized_in_trace() -> None:
    attempt = ExtractionAttempt(
        server_id="server-1",
        server_name="extractor",
        tool_name="convert_pdf_to_markdown",
        status="completed",
        duration_ms=12,
    )

    from negentropy.serialization import to_json_compatible

    assert to_json_compatible([attempt]) == [
        {
            "server_id": "server-1",
            "server_name": "extractor",
            "tool_name": "convert_pdf_to_markdown",
            "status": "completed",
            "duration_ms": 12,
            "error": None,
        }
    ]


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
    async def fake_llm_plan(**_: object) -> None:
        return None
    monkeypatch.setattr("negentropy.knowledge.extraction._build_llm_invocation_plan", fake_llm_plan)

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


@pytest.mark.asyncio
async def test_data_extractor_provider_uses_llm_selected_string_source_for_single_pdf(
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
                name="data-extractor",
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
            return None

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

    async def fake_increment_tool_call_count(**_: object) -> None:
        return None

    monkeypatch.setattr("negentropy.knowledge.extraction.AsyncSessionLocal", lambda: FakeSession())
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        fake_increment_tool_call_count,
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
async def test_data_extractor_provider_retries_with_string_batch_contract_after_string_type_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server_id = uuid4()
    call_arguments: list[dict[str, object]] = []
    llm_calls: list[dict[str, object]] = []

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, model, key):  # type: ignore[no-untyped-def]
            _ = (model, key)
            return SimpleNamespace(
                id=server_id,
                name="data-extractor",
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
                description="batch pdfs",
                input_schema={
                    "type": "object",
                    "properties": {
                        "pdf_sources": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["pdf_sources"],
                },
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

    async def fake_increment_tool_call_count(**_: object) -> None:
        return None

    monkeypatch.setattr("negentropy.knowledge.extraction.AsyncSessionLocal", lambda: FakeSession())
    monkeypatch.setattr(
        "negentropy.knowledge.extraction._increment_tool_call_count",
        fake_increment_tool_call_count,
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
