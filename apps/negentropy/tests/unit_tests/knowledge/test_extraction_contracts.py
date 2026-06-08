"""Extraction 契约与源解析单元测试

测试 resolve_source_kind / resolve_targets / extract_source / build_tool_adapter /
normalize_tool_contract 以及 ExtractionAttempt 数据类的序列化行为。
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from negentropy.knowledge.ingestion.extraction import (
    ROUTE_FILE_PDF,
    ROUTE_URL,
    ExtractionAttempt,
    ExtractorExecutionError,
    _maybe_inject_resume,
    _maybe_inject_tool_timeout,
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
async def test_extract_source_raises_when_no_routes_configured() -> None:
    with pytest.raises(ExtractorExecutionError) as exc_info:
        await extract_source(
            app_name="negentropy",
            corpus_id=uuid4(),
            corpus_config={},
            source_kind=ROUTE_URL,
            url="https://example.com",
        )
    assert "No extractor targets configured" in str(exc_info.value)


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


def test_extraction_attempt_slots_dataclass_is_json_serialized_in_trace() -> None:
    attempt = ExtractionAttempt(
        server_id="server-1",
        server_name="extractor",
        tool_name="parse_pdf_to_markdown",
        status="completed",
        duration_ms=12,
    )

    from negentropy.serialization import to_json_compatible

    assert to_json_compatible([attempt]) == [
        {
            "server_id": "server-1",
            "server_name": "extractor",
            "tool_name": "parse_pdf_to_markdown",
            "status": "completed",
            "duration_ms": 12,
            "error": None,
            "failure_category": None,
            "diagnostic_summary": None,
            "diagnostics": {},
        }
    ]


# ---------------------------------------------------------------------------
# _maybe_inject_tool_timeout：向声明了 timeout 参数的工具注入超时预算
# ---------------------------------------------------------------------------

_TIMEOUT_SCHEMA = {"type": "object", "properties": {"pdf_source": {"type": "string"}, "timeout": {"type": "integer"}}}
_NO_TIMEOUT_SCHEMA = {"type": "object", "properties": {"pdf_source": {"type": "string"}}}


def test_inject_timeout_when_schema_declares_param() -> None:
    """工具 schema 含顶层 timeout 且 arguments 未含时 → 注入。"""
    args: dict = {"pdf_source": "/tmp/x.pdf"}
    _maybe_inject_tool_timeout(arguments=args, input_schema=_TIMEOUT_SCHEMA, timeout_seconds=3600)
    assert args["timeout"] == 3600


def test_inject_timeout_skips_when_already_present() -> None:
    """arguments 已含 timeout（LLM/用户配置）→ 不覆盖。"""
    args: dict = {"pdf_source": "/tmp/x.pdf", "timeout": 120}
    _maybe_inject_tool_timeout(arguments=args, input_schema=_TIMEOUT_SCHEMA, timeout_seconds=3600)
    assert args["timeout"] == 120


def test_inject_timeout_skips_when_schema_lacks_param() -> None:
    """工具 schema 无 timeout 属性 → 不注入（避免非法参数）。"""
    args: dict = {"pdf_source": "/tmp/x.pdf"}
    _maybe_inject_tool_timeout(arguments=args, input_schema=_NO_TIMEOUT_SCHEMA, timeout_seconds=3600)
    assert "timeout" not in args


def test_inject_timeout_skips_when_timeout_none_or_schema_missing() -> None:
    """timeout_seconds 为 None 或 schema 非 dict → 不注入。"""
    args_a: dict = {"pdf_source": "/tmp/x.pdf"}
    _maybe_inject_tool_timeout(arguments=args_a, input_schema=_TIMEOUT_SCHEMA, timeout_seconds=None)
    assert "timeout" not in args_a

    args_b: dict = {"pdf_source": "/tmp/x.pdf"}
    _maybe_inject_tool_timeout(arguments=args_b, input_schema=None, timeout_seconds=3600)
    assert "timeout" not in args_b


# ---------------------------------------------------------------------------
# _maybe_inject_resume：双入口重试向声明了 resume 参数的工具注入续传/重跑意图
# ---------------------------------------------------------------------------

_RESUME_SCHEMA = {"type": "object", "properties": {"pdf_source": {"type": "string"}, "resume": {"type": "boolean"}}}
_NO_RESUME_SCHEMA = {"type": "object", "properties": {"pdf_source": {"type": "string"}}}


def test_inject_resume_true_when_schema_declares_param() -> None:
    """断点续传：schema 含 resume 且 arguments 未含 → 注入 True。"""
    args: dict = {"pdf_source": "/tmp/x.pdf"}
    _maybe_inject_resume(arguments=args, input_schema=_RESUME_SCHEMA, resume=True)
    assert args["resume"] is True


def test_inject_resume_false_for_fresh_restart() -> None:
    """重新开始：注入 resume=False（丢弃 checkpoint 全量重跑）。"""
    args: dict = {"pdf_source": "/tmp/x.pdf"}
    _maybe_inject_resume(arguments=args, input_schema=_RESUME_SCHEMA, resume=False)
    assert args["resume"] is False


def test_inject_resume_skips_when_none() -> None:
    """普通 ingest（resume=None）→ 不注入，沿用 perceives 默认 True。"""
    args: dict = {"pdf_source": "/tmp/x.pdf"}
    _maybe_inject_resume(arguments=args, input_schema=_RESUME_SCHEMA, resume=None)
    assert "resume" not in args


def test_inject_resume_skips_when_already_present() -> None:
    """arguments 已含 resume（LLM/用户配置）→ 不覆盖。"""
    args: dict = {"pdf_source": "/tmp/x.pdf", "resume": True}
    _maybe_inject_resume(arguments=args, input_schema=_RESUME_SCHEMA, resume=False)
    assert args["resume"] is True


def test_inject_resume_skips_when_schema_lacks_param() -> None:
    """工具 schema 无 resume 属性 → 不注入（避免非法参数）。"""
    args: dict = {"pdf_source": "/tmp/x.pdf"}
    _maybe_inject_resume(arguments=args, input_schema=_NO_RESUME_SCHEMA, resume=False)
    assert "resume" not in args
