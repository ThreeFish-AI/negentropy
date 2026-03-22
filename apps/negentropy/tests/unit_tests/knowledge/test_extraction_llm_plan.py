"""Extraction LLM 调用计划单元测试

测试 _build_llm_invocation_plan 的各种场景：成功、跳过、序列化失败、无效 JSON、
非安全 payload。
"""

from types import SimpleNamespace

import pytest

from negentropy.knowledge.extraction import (
    ROUTE_FILE_PDF,
    CanonicalExtractionRequest,
    CanonicalExtractionSource,
    _build_llm_invocation_plan,
    normalize_tool_contract,
)


@pytest.mark.asyncio
async def test_build_llm_invocation_plan_supports_slots_dataclass_request(monkeypatch: pytest.MonkeyPatch) -> None:
    captured_messages: list[dict[str, object]] = []

    async def fake_acompletion(**kwargs):
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
    assert '"content_base64": "cGRm"' not in str(captured_messages[0]["content"])
    assert '"content_base64_length": 4' in str(captured_messages[0]["content"])


@pytest.mark.asyncio
async def test_build_llm_invocation_plan_skips_llm_for_object_file_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    llm_called = False

    async def fake_acompletion(**kwargs):
        nonlocal llm_called
        llm_called = True
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="{}"))])

    monkeypatch.setattr("negentropy.knowledge.extraction.litellm.acompletion", fake_acompletion)

    request = CanonicalExtractionRequest(
        source_kind=ROUTE_FILE_PDF,
        source=CanonicalExtractionSource(
            source_kind=ROUTE_FILE_PDF,
            filename="report.pdf",
            content_type="application/pdf",
            content_base64="cGRm",
        ),
    )
    contract = normalize_tool_contract(
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
        source_kind=ROUTE_FILE_PDF,
    )

    plan = await _build_llm_invocation_plan(
        tool_name="batch_convert_pdfs_to_markdown",
        tool_description="batch pdfs",
        input_schema=contract.root_schema,
        contract=contract,
        request=request,
        source_candidates=[],
    )

    assert plan is None
    assert llm_called is False


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
async def test_build_llm_invocation_plan_logs_info_when_json_is_invalid(monkeypatch: pytest.MonkeyPatch) -> None:
    events: list[tuple[str, dict[str, object]]] = []

    class FakeLogger:
        def info(self, event: str, **kwargs):
            events.append((event, kwargs))

        def warning(self, event: str, **kwargs):
            raise AssertionError(f"unexpected warning: {event} {kwargs}")

    async def fake_acompletion(**kwargs):
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="{not-json"))]
        )

    monkeypatch.setattr("negentropy.knowledge.extraction.logger", FakeLogger())
    monkeypatch.setattr("negentropy.knowledge.extraction.litellm.acompletion", fake_acompletion)

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
    assert events == [
        (
            "extractor_llm_plan_invalid_json",
            {
                "tool_name": "convert_pdf_to_markdown",
                "fallback_strategy": "schema_or_default_contract",
                "reason": "invalid_json",
            },
        )
    ]


@pytest.mark.asyncio
async def test_build_llm_invocation_plan_skips_llm_when_prompt_payload_is_not_json_safe(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    llm_called = False

    async def fake_acompletion(**kwargs):
        nonlocal llm_called
        llm_called = True
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="{}"))])

    monkeypatch.setattr("negentropy.knowledge.extraction.litellm.acompletion", fake_acompletion)

    request = CanonicalExtractionRequest(
        source_kind=ROUTE_FILE_PDF,
        source=CanonicalExtractionSource(source_kind=ROUTE_FILE_PDF, filename="report.pdf"),
        options={"opaque": SimpleNamespace(example=1)},
    )
    contract = normalize_tool_contract(
        input_schema={
            "type": "object",
            "properties": {
                "pdf_source": {"type": "string"},
                "options": {
                    "type": "object",
                    "properties": {"opaque": {"type": "string"}},
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

    assert plan is None
    assert llm_called is False
