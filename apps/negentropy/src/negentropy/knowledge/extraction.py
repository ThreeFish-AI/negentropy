from __future__ import annotations

import base64
import json
import os
import re
import tempfile
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal
from uuid import UUID

import litellm
from sqlalchemy import select, update

from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.plugin import McpServer, McpTool
from negentropy.plugins.execution import McpToolExecutionService, RUN_ORIGIN_KNOWLEDGE_EXTRACTION
from negentropy.serialization import to_json_compatible, to_json_compatible_strict
from negentropy.storage.service import DocumentStorageService

from .content import (
    optimize_markdown_content,
    sanitize_filename,
)

logger = get_logger("negentropy.knowledge.extraction")

SourceKind = Literal["url", "file_pdf", "file_generic"]

EXTRACTOR_ROUTES_KEY = "extractor_routes"
ROUTE_URL = "url"
ROUTE_FILE_PDF = "file_pdf"
ROUTE_FILE_GENERIC = "file_generic"
MAX_LLM_PLANNING_PAYLOAD_CHARS = 16_000
MAX_LLM_VALIDATION_ERROR_CHARS = 1_500


@dataclass(slots=True)
class ExtractionAsset:
    name: str
    content_type: str
    uri: str | None = None
    data_base64: str | None = None
    text: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ExtractionAttempt:
    server_id: str
    server_name: str
    tool_name: str
    status: str
    duration_ms: int
    error: str | None = None
    failure_category: str | None = None
    diagnostic_summary: str | None = None
    diagnostics: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ExtractedDocumentResult:
    plain_text: str
    markdown_content: str
    metadata: dict[str, Any] = field(default_factory=dict)
    assets: list[ExtractionAsset] = field(default_factory=list)
    trace: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class McpToolTarget:
    server_id: UUID
    tool_name: str
    priority: int = 0
    enabled: bool = True
    timeout_ms: int | None = None
    tool_options: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class CanonicalExtractionSource:
    source_kind: SourceKind
    url: str | None = None
    filename: str | None = None
    content_type: str | None = None
    content_base64: str | None = None


@dataclass(slots=True)
class CanonicalExtractionRequest:
    source_kind: SourceKind
    source: CanonicalExtractionSource
    options: dict[str, Any] = field(default_factory=dict)
    context: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ExtractionToolAdapter:
    name: str
    arguments: dict[str, Any]
    schema_summary: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class NormalizedToolContract:
    mode: Literal["batch", "nested_single", "flat", "unknown"]
    schema_shape: str
    source_value_type: Literal["object", "string", "unknown"] = "unknown"
    root_schema: dict[str, Any] | None = None
    object_schema: dict[str, Any] | None = None
    batch_property: str | None = None
    source_property: str | None = None
    item_schema: dict[str, Any] | None = None
    top_level_fields: set[str] = field(default_factory=set)
    source_fields: set[str] = field(default_factory=set)


@dataclass(slots=True)
class AdaptiveToolInvocationPlan:
    adapter_name: str
    arguments: dict[str, Any]
    reasoning_source: Literal["schema", "validation_retry", "llm"]
    diagnostics: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ValidationErrorSummary:
    missing_fields: list[str] = field(default_factory=list)
    unexpected_fields: list[str] = field(default_factory=list)
    string_item_fields: list[str] = field(default_factory=list)
    raw_error: str = ""


@dataclass(slots=True)
class SourceCandidate:
    kind: Literal["inline_object", "local_path", "url", "base64_string"]
    value: Any
    description: str
    preferred: bool = False


@dataclass(slots=True)
class ToolCapabilityProfile:
    has_declared_schema: bool
    accepts_string_source: bool
    accepts_object_source: bool
    supports_batch: bool
    schema_confidence: Literal["high", "medium", "low"]


@dataclass(slots=True)
class ToolContractReadiness:
    compatible: bool
    failure_category: str | None = None
    diagnostic_summary: str | None = None
    diagnostics: dict[str, Any] = field(default_factory=dict)


class ExtractorExecutionError(ValueError):
    def __init__(self, message: str, *, attempts: list[ExtractionAttempt]) -> None:
        super().__init__(message)
        self.attempts = attempts


def resolve_source_kind(
    *,
    source_uri: str | None = None,
    filename: str | None = None,
    content_type: str | None = None,
) -> SourceKind:
    if source_uri and (source_uri.startswith("http://") or source_uri.startswith("https://")):
        return ROUTE_URL

    lower_filename = (filename or "").lower()
    lower_content_type = (content_type or "").lower()
    if lower_filename.endswith(".pdf") or "application/pdf" in lower_content_type:
        return ROUTE_FILE_PDF

    return ROUTE_FILE_GENERIC


def get_chunking_config_only(raw: dict[str, Any] | None) -> dict[str, Any]:
    payload = dict(raw or {})
    payload.pop(EXTRACTOR_ROUTES_KEY, None)
    return payload


def merge_corpus_config(raw: dict[str, Any] | None, chunking_config: dict[str, Any] | None) -> dict[str, Any]:
    merged = dict(raw or {})
    if chunking_config:
        merged.update(chunking_config)
    return merged


def extract_route_config(raw: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    routes = raw.get(EXTRACTOR_ROUTES_KEY)
    return routes if isinstance(routes, dict) else {}


def resolve_targets(raw: dict[str, Any] | None, source_kind: SourceKind) -> list[McpToolTarget]:
    routes = extract_route_config(raw)
    route_payload = routes.get(source_kind)
    if not isinstance(route_payload, dict):
        return []

    targets_payload = route_payload.get("targets")
    if not isinstance(targets_payload, list):
        return []

    targets: list[McpToolTarget] = []
    for item in targets_payload:
        if not isinstance(item, dict):
            continue
        server_id = item.get("server_id")
        tool_name = str(item.get("tool_name") or "").strip()
        if not server_id or not tool_name:
            continue
        try:
            targets.append(
                McpToolTarget(
                    server_id=UUID(str(server_id)),
                    tool_name=tool_name,
                    priority=int(item.get("priority") or 0),
                    enabled=bool(item.get("enabled", True)),
                    timeout_ms=int(item["timeout_ms"]) if item.get("timeout_ms") is not None else None,
                    tool_options=item.get("tool_options") if isinstance(item.get("tool_options"), dict) else {},
                )
            )
        except (TypeError, ValueError):
            logger.warning("invalid_extractor_target_ignored", target=item)

    return sorted((target for target in targets if target.enabled), key=lambda item: item.priority)


def _result_text_from_content_items(content_items: list[Any]) -> str:
    text_chunks: list[str] = []
    for item in content_items:
        if getattr(item, "type", None) == "text" and getattr(item, "text", None):
            text_chunks.append(item.text)
    return "\n".join(text_chunks).strip()


def _json_candidate_from_text(text: str) -> Any:
    raw = text.strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _normalize_assets(raw_assets: Any) -> list[ExtractionAsset]:
    if not isinstance(raw_assets, list):
        return []

    assets: list[ExtractionAsset] = []
    for index, item in enumerate(raw_assets):
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or item.get("filename") or f"asset-{index + 1}")
        content_type = str(item.get("content_type") or item.get("mime_type") or "application/octet-stream")
        assets.append(
            ExtractionAsset(
                name=name,
                content_type=content_type,
                uri=item.get("uri") if isinstance(item.get("uri"), str) else None,
                data_base64=(
                    item.get("data_base64")
                    if isinstance(item.get("data_base64"), str)
                    else item.get("content_base64")
                ),
                text=item.get("text") if isinstance(item.get("text"), str) else None,
                metadata=item.get("metadata") if isinstance(item.get("metadata"), dict) else {},
            )
        )
    return assets


def _schema_properties(schema: Any) -> dict[str, Any]:
    if not isinstance(schema, dict):
        return {}
    properties = schema.get("properties")
    return properties if isinstance(properties, dict) else {}


def _schema_property_names(schema: Any) -> set[str]:
    return set(_schema_properties(schema).keys())


def _schema_required_fields(schema: Any) -> set[str]:
    if not isinstance(schema, dict):
        return set()
    required = schema.get("required")
    if not isinstance(required, list):
        return set()
    return {str(item) for item in required if isinstance(item, str)}


def _is_url_source_schema(schema: Any) -> bool:
    properties = _schema_property_names(schema)
    return "url" in properties or "uri" in properties


def _is_file_source_schema(schema: Any) -> bool:
    properties = _schema_property_names(schema)
    return bool({"filename", "content_base64", "data_base64"} & properties)


def _is_string_schema(schema: Any) -> bool:
    return isinstance(schema, dict) and schema.get("type") == "string"


def _schema_path(schema: dict[str, Any], ref: str) -> dict[str, Any] | None:
    if not ref.startswith("#/"):
        return None
    current: Any = schema
    for part in ref[2:].split("/"):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current if isinstance(current, dict) else None


def _expand_schema_variants(
    schema: dict[str, Any] | None,
    *,
    root_schema: dict[str, Any] | None = None,
    _seen_refs: set[str] | None = None,
) -> list[dict[str, Any]]:
    if not isinstance(schema, dict):
        return []
    root = root_schema or schema
    seen_refs = _seen_refs or set()

    ref = schema.get("$ref")
    if isinstance(ref, str):
        if ref in seen_refs:
            return []
        target = _schema_path(root, ref)
        if not target:
            return []
        return _expand_schema_variants(target, root_schema=root, _seen_refs=seen_refs | {ref})

    variants: list[dict[str, Any]] = []
    for combinator in ("anyOf", "oneOf", "allOf"):
        branches = schema.get(combinator)
        if isinstance(branches, list):
            for branch in branches:
                variants.extend(_expand_schema_variants(branch, root_schema=root, _seen_refs=seen_refs))

    if variants:
        properties = _schema_properties(schema)
        if properties:
            merged: list[dict[str, Any]] = []
            for variant in variants:
                variant_properties = dict(_schema_properties(variant))
                merged_schema = dict(variant)
                merged_schema["properties"] = {**properties, **variant_properties}
                merged.append(merged_schema)
            return merged
        return variants

    return [schema]


def _preferred_batch_keys(source_kind: SourceKind) -> tuple[str, ...]:
    if source_kind == ROUTE_URL:
        return ("url_sources", "sources", "documents", "items")
    return ("pdf_sources", "sources", "documents", "items")


def _preferred_source_keys(source_kind: SourceKind) -> tuple[str, ...]:
    if source_kind == ROUTE_URL:
        return ("source", "url_source", "webpage_source", "document", "item")
    return ("source", "pdf_source", "file_source", "document", "item")


def _matches_source_schema(schema: Any, source_kind: SourceKind) -> bool:
    if source_kind == ROUTE_URL:
        return _is_url_source_schema(schema)
    return _is_file_source_schema(schema)


def _recognized_contract_fields(source_kind: SourceKind) -> set[str]:
    return {
        *_preferred_batch_keys(source_kind),
        *_preferred_source_keys(source_kind),
        "url",
        "uri",
        "filename",
        "content_type",
        "content_base64",
        "data_base64",
        "options",
        "context",
        "source_type",
    }


def _evaluate_unknown_contract_readiness(
    *,
    input_schema: dict[str, Any] | None,
    contract: NormalizedToolContract,
    capability: ToolCapabilityProfile,
    source_kind: SourceKind,
) -> ToolContractReadiness:
    if contract.mode != "unknown" or not isinstance(input_schema, dict):
        return ToolContractReadiness(compatible=True)

    variants = _expand_schema_variants(input_schema, root_schema=input_schema)
    if not variants:
        return ToolContractReadiness(compatible=True)

    recognized_fields = _recognized_contract_fields(source_kind)
    branch_failures: list[dict[str, Any]] = []

    for variant in variants:
        declared_fields = sorted(_schema_property_names(variant))
        required_fields = sorted(_schema_required_fields(variant))
        if not declared_fields:
            return ToolContractReadiness(compatible=True)

        recognized_declared = [field for field in declared_fields if field in recognized_fields]
        unsupported_required = [field for field in required_fields if field not in recognized_fields]

        if recognized_declared and not unsupported_required:
            return ToolContractReadiness(compatible=True)

        branch_failures.append(
            {
                "declared_schema_fields": declared_fields,
                "required_fields": required_fields,
                "recognized_declared_fields": recognized_declared,
                "unsupported_required_fields": unsupported_required,
            }
        )

    any_recognized_declared = any(item["recognized_declared_fields"] for item in branch_failures)
    unsupported_required = sorted(
        {
            field
            for item in branch_failures
            for field in item["unsupported_required_fields"]
        }
    )

    if unsupported_required:
        failure_category = "low_confidence_contract" if any_recognized_declared else "unsupported_contract"
        diagnostic_summary = (
            "契约为 unknown，要求额外必填字段 "
            f"{', '.join(unsupported_required)}，当前提取源无法构造最小调用参数"
        )
    elif any_recognized_declared:
        failure_category = "low_confidence_contract"
        diagnostic_summary = "契约存在候选文档字段，但未找到可安全构造的最小调用参数分支"
    else:
        failure_category = (
            "low_confidence_contract"
            if capability.schema_confidence == "low"
            else "unsupported_contract"
        )
        diagnostic_summary = "契约未声明可识别的文档 source 字段，无法判定为可兼容的提取工具"

    return ToolContractReadiness(
        compatible=False,
        failure_category=failure_category,
        diagnostic_summary=diagnostic_summary,
        diagnostics={
            "contract_mode": contract.mode,
            "schema_shape": contract.schema_shape,
            "branches": branch_failures,
            "recognized_contract_fields": sorted(recognized_fields),
            "capability": {
                "has_declared_schema": capability.has_declared_schema,
                "accepts_string_source": capability.accepts_string_source,
                "accepts_object_source": capability.accepts_object_source,
                "supports_batch": capability.supports_batch,
                "schema_confidence": capability.schema_confidence,
            },
        },
    )


def normalize_tool_contract(
    *,
    input_schema: dict[str, Any] | None,
    source_kind: SourceKind,
) -> NormalizedToolContract:
    if not isinstance(input_schema, dict):
        return NormalizedToolContract(mode="unknown", schema_shape="missing")

    variants = _expand_schema_variants(input_schema, root_schema=input_schema)
    for variant in variants:
        properties = _schema_properties(variant)
        if not properties:
            continue

        for name in [*_preferred_batch_keys(source_kind), *properties.keys()]:
            schema = properties.get(name)
            if not isinstance(schema, dict) or schema.get("type") != "array":
                continue
            if _is_string_schema(schema.get("items")):
                return NormalizedToolContract(
                    mode="batch",
                    schema_shape="scalar.array",
                    source_value_type="string",
                    root_schema=input_schema,
                    object_schema=variant,
                    batch_property=name,
                    item_schema=schema.get("items"),
                    top_level_fields=set(properties.keys()),
                )
            item_schema = _expand_schema_variants(schema.get("items"), root_schema=input_schema)
            selected_item_schema = next(
                (item for item in item_schema if _matches_source_schema(item, source_kind)),
                None,
            )
            if selected_item_schema:
                return NormalizedToolContract(
                    mode="batch",
                    schema_shape="object.array",
                    source_value_type="object",
                    root_schema=input_schema,
                    object_schema=variant,
                    batch_property=name,
                    item_schema=selected_item_schema,
                    top_level_fields=set(properties.keys()),
                    source_fields=_schema_property_names(selected_item_schema),
                )

        for name in [*_preferred_source_keys(source_kind), *properties.keys()]:
            schema = properties.get(name)
            if not isinstance(schema, dict):
                continue
            if _is_string_schema(schema):
                return NormalizedToolContract(
                    mode="nested_single",
                    schema_shape="scalar.value",
                    source_value_type="string",
                    root_schema=input_schema,
                    object_schema=variant,
                    source_property=name,
                    item_schema=schema,
                    top_level_fields=set(properties.keys()),
                )
            nested_variants = _expand_schema_variants(schema, root_schema=input_schema)
            selected_variant = next(
                (item for item in nested_variants if _matches_source_schema(item, source_kind)),
                None,
            )
            if selected_variant:
                return NormalizedToolContract(
                    mode="nested_single",
                    schema_shape="object.object",
                    source_value_type="object",
                    root_schema=input_schema,
                    object_schema=variant,
                    source_property=name,
                    item_schema=selected_variant,
                    top_level_fields=set(properties.keys()),
                    source_fields=_schema_property_names(selected_variant),
                )

        if _matches_source_schema(variant, source_kind):
            return NormalizedToolContract(
                mode="flat",
                schema_shape="object.flat",
                source_value_type="object",
                root_schema=input_schema,
                object_schema=variant,
                top_level_fields=set(properties.keys()),
                source_fields=set(properties.keys()),
            )

    return NormalizedToolContract(mode="unknown", schema_shape="unresolved", root_schema=input_schema)


def _build_canonical_request(
    *,
    source_kind: SourceKind,
    app_name: str,
    corpus_id: UUID,
    tool_options: dict[str, Any],
    url: str | None,
    content: bytes | None,
    filename: str | None,
    content_type: str | None,
) -> CanonicalExtractionRequest:
    return CanonicalExtractionRequest(
        source_kind=source_kind,
        source=CanonicalExtractionSource(
            source_kind=source_kind,
            url=url,
            filename=filename,
            content_type=content_type,
            content_base64=base64.b64encode(content).decode("ascii") if content is not None else None,
        ),
        options=dict(tool_options),
        context={
            "app_name": app_name,
            "corpus_id": str(corpus_id),
        },
    )


def _filter_declared_fields(payload: dict[str, Any], schema: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(schema, dict):
        return {}
    allowed = _schema_property_names(schema)
    if not allowed:
        return {}
    return {key: value for key, value in payload.items() if key in allowed}


def _build_source_item(
    *,
    request: CanonicalExtractionRequest,
    item_schema: dict[str, Any] | None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    allowed = _schema_property_names(item_schema) if isinstance(item_schema, dict) else set()
    if request.source_kind == ROUTE_URL:
        url_value = request.source.url or ""
        if not allowed or "url" in allowed:
            payload["url"] = url_value
        elif "uri" in allowed:
            payload["uri"] = url_value
    else:
        base64_value = request.source.content_base64 or ""
        if not allowed or "filename" in allowed:
            payload["filename"] = request.source.filename
        if not allowed or "content_type" in allowed:
            payload["content_type"] = request.source.content_type
        if not allowed or "content_base64" in allowed:
            payload["content_base64"] = base64_value
        elif "data_base64" in allowed:
            payload["data_base64"] = base64_value
    return {key: value for key, value in payload.items() if value is not None}


def _build_inline_source_payload(request: CanonicalExtractionRequest) -> dict[str, Any]:
    return _build_source_item(request=request, item_schema=None)


def _select_string_source_candidate(
    *,
    source_candidates: list[SourceCandidate],
    preferred_kind: str | None = None,
) -> str | None:
    ordered_candidates = sorted(
        source_candidates,
        key=lambda item: (0 if item.preferred else 1, item.kind),
    )
    if preferred_kind:
        preferred = next((item for item in ordered_candidates if item.kind == preferred_kind), None)
        if preferred and isinstance(preferred.value, str):
            return preferred.value
    for candidate in ordered_candidates:
        if isinstance(candidate.value, str):
            return candidate.value
    return None


def _select_string_source_candidate_kind(
    *,
    source_candidates: list[SourceCandidate],
    preferred_kind: str | None = None,
) -> str | None:
    ordered_candidates = sorted(
        source_candidates,
        key=lambda item: (0 if item.preferred else 1, item.kind),
    )
    if preferred_kind:
        preferred = next((item for item in ordered_candidates if item.kind == preferred_kind), None)
        if preferred and isinstance(preferred.value, str):
            return preferred.kind
    for candidate in ordered_candidates:
        if isinstance(candidate.value, str):
            return candidate.kind
    return None


def _build_arguments_from_contract(
    *,
    contract: NormalizedToolContract,
    request: CanonicalExtractionRequest,
    source_candidates: list[SourceCandidate],
    include_options: bool,
    include_context: bool,
    selected_source_kind: str | None = None,
) -> dict[str, Any]:
    arguments: dict[str, Any]
    top_properties = _schema_properties(contract.object_schema)
    if contract.mode == "batch" and contract.batch_property:
        if contract.source_value_type == "string":
            source_value = _select_string_source_candidate(
                source_candidates=source_candidates,
                preferred_kind=selected_source_kind,
            )
            arguments = {contract.batch_property: [source_value] if source_value else []}
        else:
            arguments = {
                contract.batch_property: [_build_source_item(request=request, item_schema=contract.item_schema)],
            }
    elif contract.mode == "nested_single" and contract.source_property:
        if contract.source_value_type == "string":
            source_value = _select_string_source_candidate(
                source_candidates=source_candidates,
                preferred_kind=selected_source_kind,
            )
            arguments = {contract.source_property: source_value}
        else:
            arguments = {
                contract.source_property: _build_source_item(request=request, item_schema=contract.item_schema),
            }
    elif contract.mode == "flat":
        arguments = _build_flat_payload(request=request, allowed_fields=contract.source_fields)
    else:
        arguments = _build_flat_payload(request=request, allowed_fields=set())

    if include_options:
        option_fields = _filter_declared_fields(request.options, top_properties.get("options"))
        if option_fields and "options" in top_properties:
            arguments["options"] = option_fields
    if include_context:
        context_fields = _filter_declared_fields(request.context, top_properties.get("context"))
        if context_fields and "context" in top_properties:
            arguments["context"] = context_fields
    return {key: value for key, value in arguments.items() if value is not None}


def _build_flat_payload(
    *,
    request: CanonicalExtractionRequest,
    allowed_fields: set[str],
) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if request.source_kind == ROUTE_URL:
        url_value = request.source.url or ""
        if not allowed_fields or "url" in allowed_fields:
            payload["url"] = url_value
        elif "uri" in allowed_fields:
            payload["uri"] = url_value
    else:
        base64_value = request.source.content_base64 or ""
        if not allowed_fields or "filename" in allowed_fields:
            payload["filename"] = request.source.filename
        if not allowed_fields or "content_type" in allowed_fields:
            payload["content_type"] = request.source.content_type
        if not allowed_fields or "content_base64" in allowed_fields:
            payload["content_base64"] = base64_value
        elif "data_base64" in allowed_fields:
            payload["data_base64"] = base64_value

    if not allowed_fields or "source_type" in allowed_fields:
        payload["source_type"] = request.source_kind
    if not allowed_fields or "options" in allowed_fields:
        payload["options"] = request.options
    if not allowed_fields or "context" in allowed_fields:
        payload["context"] = request.context
    return {key: value for key, value in payload.items() if value is not None}


def _build_plan_from_contract(
    *,
    contract: NormalizedToolContract,
    request: CanonicalExtractionRequest,
    adapter_name: str,
    reasoning_source: Literal["schema", "validation_retry"],
    source_candidates: list[SourceCandidate] | None = None,
    diagnostics: dict[str, Any] | None = None,
) -> AdaptiveToolInvocationPlan:
    diagnostics = dict(diagnostics or {})
    selected_source_kind: str | None = None
    if contract.source_value_type == "string":
        candidates = source_candidates or []
        preferred_kind = "url" if request.source_kind == ROUTE_URL else "local_path"
        selected_source_kind = _select_string_source_candidate_kind(
            source_candidates=candidates,
            preferred_kind=preferred_kind,
        )
        if selected_source_kind is None:
            selected_source_kind = _select_string_source_candidate_kind(source_candidates=candidates)

    arguments = _build_arguments_from_contract(
        contract=contract,
        request=request,
        source_candidates=source_candidates or [],
        include_options=True,
        include_context=True,
        selected_source_kind=selected_source_kind,
    )

    diagnostics.setdefault("contract_mode", contract.mode)
    diagnostics.setdefault("schema_shape", contract.schema_shape)
    diagnostics.setdefault("source_value_type", contract.source_value_type)
    if selected_source_kind is not None:
        diagnostics.setdefault("selected_source_kind", selected_source_kind)
    if contract.batch_property:
        diagnostics.setdefault("batch_property", contract.batch_property)
    if contract.source_property:
        diagnostics.setdefault("source_property", contract.source_property)
    return AdaptiveToolInvocationPlan(
        adapter_name=adapter_name,
        arguments=arguments,
        reasoning_source=reasoning_source,
        diagnostics=diagnostics,
    )


def build_tool_adapter(
    *,
    input_schema: dict[str, Any] | None,
    request: CanonicalExtractionRequest,
) -> ExtractionToolAdapter:
    contract = normalize_tool_contract(
        input_schema=input_schema,
        source_kind=request.source_kind,
    )
    plan = _build_plan_from_contract(
        contract=contract,
        request=request,
        adapter_name=(
            "batch_sources_v2"
            if contract.mode == "batch"
            else "nested_single_v2"
            if contract.mode == "nested_single"
            else "canonical_flat_v2"
        ),
        reasoning_source="schema",
        source_candidates=[],
        diagnostics={
            "top_level_fields": sorted(contract.top_level_fields),
        },
    )
    return ExtractionToolAdapter(
        name=plan.adapter_name,
        arguments=plan.arguments,
        schema_summary=plan.diagnostics,
    )


def _is_validation_error(error: str | None) -> bool:
    if not error:
        return False
    lowered = error.lower()
    return any(
        token in lowered
        for token in (
            "validation errors for call",
            "missing required argument",
            "unexpected keyword argument",
            "field required",
            "input should be a valid string",
        )
    )


def _summarize_validation_error(error: str | None) -> ValidationErrorSummary:
    raw = str(error or "")
    missing = re.findall(r"\n([A-Za-z0-9_]+)\n\s+Missing required argument", raw)
    unexpected = re.findall(r"\n([A-Za-z0-9_]+)\n\s+Unexpected keyword argument", raw)
    string_items = re.findall(r"\n([A-Za-z0-9_]+\.\d+)\n\s+Input should be a valid string", raw)
    return ValidationErrorSummary(
        missing_fields=missing,
        unexpected_fields=unexpected,
        string_item_fields=string_items,
        raw_error=raw,
    )


def _ensure_temp_dir() -> Path:
    temp_dir = Path(".temp") / "mcp_sources"
    temp_dir.mkdir(parents=True, exist_ok=True)
    return temp_dir


def _prepare_source_candidates(
    *,
    request: CanonicalExtractionRequest,
    content: bytes | None,
) -> tuple[list[SourceCandidate], list[Path]]:
    candidates: list[SourceCandidate] = []
    cleanup_paths: list[Path] = []
    if request.source_kind == ROUTE_URL and request.source.url:
        candidates.append(
            SourceCandidate(
                kind="url",
                value=request.source.url,
                description="原始 URL 源",
                preferred=True,
            )
        )
        return candidates, cleanup_paths

    inline_payload = _build_inline_source_payload(request)
    if inline_payload:
        candidates.append(
            SourceCandidate(
                kind="inline_object",
                value=inline_payload,
                description="内联文件对象，包含文件名、类型和 base64 内容",
            )
        )

    if content is not None:
        suffix = Path(request.source.filename or "source.bin").suffix or ".bin"
        fd, temp_path_str = tempfile.mkstemp(prefix="mcp-source-", suffix=suffix, dir=_ensure_temp_dir())
        temp_path = Path(temp_path_str)
        os.close(fd)
        with temp_path.open("wb") as handle:
            handle.write(content)
        cleanup_paths.append(temp_path)
        candidates.append(
            SourceCandidate(
                kind="local_path",
                value=str(temp_path.resolve()),
                description="本地临时文件绝对路径",
                preferred=True,
            )
        )

    if request.source.content_base64:
        candidates.append(
            SourceCandidate(
                kind="base64_string",
                value=request.source.content_base64,
                description="纯 base64 字符串",
            )
        )

    return candidates, cleanup_paths


def _cleanup_temp_paths(paths: list[Path]) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            logger.warning("extractor_temp_file_cleanup_failed", path=str(path))


def _truncate_text(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    return f"{value[:limit]}...<truncated:{len(value) - limit}>"


def _canonical_request_for_llm(request: CanonicalExtractionRequest) -> dict[str, Any]:
    source_payload: dict[str, Any] = {
        "source_kind": request.source.source_kind,
        "url": request.source.url,
        "filename": request.source.filename,
        "content_type": request.source.content_type,
    }
    if request.source.content_base64:
        source_payload["content_base64_length"] = len(request.source.content_base64)
    return {
        "source_kind": request.source_kind,
        "source": source_payload,
        "options": request.options,
        "context": request.context,
    }


def _summarize_candidate_value(candidate: SourceCandidate) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "kind": candidate.kind,
        "description": candidate.description,
        "preferred": candidate.preferred,
    }
    if candidate.kind == "inline_object" and isinstance(candidate.value, dict):
        payload["field_names"] = sorted(candidate.value.keys())
        content_value = candidate.value.get("content_base64") or candidate.value.get("data_base64")
        if isinstance(content_value, str):
            payload["content_base64_length"] = len(content_value)
        if isinstance(candidate.value.get("filename"), str):
            payload["filename"] = candidate.value["filename"]
        if isinstance(candidate.value.get("content_type"), str):
            payload["content_type"] = candidate.value["content_type"]
        return payload
    if candidate.kind == "local_path" and isinstance(candidate.value, str):
        path = Path(candidate.value)
        payload["path_preview"] = str(path.name)
        payload["suffix"] = path.suffix
        return payload
    if candidate.kind == "base64_string" and isinstance(candidate.value, str):
        payload["base64_length"] = len(candidate.value)
        return payload
    if candidate.kind == "url" and isinstance(candidate.value, str):
        payload["url_preview"] = _truncate_text(candidate.value, 240)
        return payload
    if isinstance(candidate.value, str):
        payload["value_preview"] = _truncate_text(candidate.value, 240)
    return payload


def _build_attempt_message(attempt: ExtractionAttempt) -> str:
    category = f"[{attempt.failure_category}] " if attempt.failure_category else ""
    return f"{attempt.server_name}/{attempt.tool_name}: {category}{attempt.error or 'unknown error'}"


def _build_aggregated_extraction_error(attempts: list[ExtractionAttempt]) -> str:
    if not attempts:
        return "All extractor MCP targets failed"
    details = "; ".join(_build_attempt_message(attempt) for attempt in attempts)
    return f"All extractor MCP targets failed: {details}"


def _infer_tool_capability_profile(
    *,
    input_schema: dict[str, Any] | None,
    contract: NormalizedToolContract,
) -> ToolCapabilityProfile:
    has_declared_schema = isinstance(input_schema, dict) and bool(input_schema)
    accepts_string_source = contract.source_value_type == "string"
    accepts_object_source = contract.source_value_type == "object" or contract.mode == "flat"
    supports_batch = contract.mode == "batch"
    if contract.mode in {"batch", "nested_single", "flat"} and has_declared_schema:
        schema_confidence: Literal["high", "medium", "low"] = "high"
    elif has_declared_schema:
        schema_confidence = "medium"
    else:
        schema_confidence = "low"
    return ToolCapabilityProfile(
        has_declared_schema=has_declared_schema,
        accepts_string_source=accepts_string_source,
        accepts_object_source=accepts_object_source,
        supports_batch=supports_batch,
        schema_confidence=schema_confidence,
    )


def _source_fields_for_kind(source_kind: SourceKind) -> set[str]:
    return {"url", "uri"} if source_kind == ROUTE_URL else {"filename", "content_type", "content_base64", "data_base64"}


def _build_retry_contract_from_error(
    *,
    input_schema: dict[str, Any] | None,
    request: CanonicalExtractionRequest,
    original_contract: NormalizedToolContract,
    validation_error: ValidationErrorSummary,
) -> NormalizedToolContract | None:
    for field_name in validation_error.string_item_fields:
        container_name = field_name.split(".", 1)[0]
        if container_name in _preferred_batch_keys(request.source_kind) or container_name.endswith("_sources"):
            return NormalizedToolContract(
                mode="batch",
                schema_shape="validation_retry.scalar_array",
                source_value_type="string",
                root_schema=input_schema,
                batch_property=container_name,
                item_schema={"type": "string"},
            )

    missing = validation_error.missing_fields
    if not missing:
        return None

    source_fields = _source_fields_for_kind(request.source_kind)
    for field_name in missing:
        if field_name in _preferred_batch_keys(request.source_kind) or field_name.endswith("_sources"):
            if (
                original_contract.mode == "batch"
                and original_contract.source_value_type == "string"
                and original_contract.batch_property == field_name
            ):
                return NormalizedToolContract(
                    mode="batch",
                    schema_shape="validation_retry.scalar_array",
                    source_value_type="string",
                    root_schema=input_schema,
                    batch_property=field_name,
                    item_schema={"type": "string"},
                )
            return NormalizedToolContract(
                mode="batch",
                schema_shape="validation_retry.batch",
                source_value_type="object",
                root_schema=input_schema,
                batch_property=field_name,
                item_schema={"type": "object", "properties": {name: {"type": "string"} for name in source_fields}},
                source_fields=source_fields,
            )
        if field_name in _preferred_source_keys(request.source_kind) or field_name.endswith("_source"):
            if (
                original_contract.mode == "nested_single"
                and original_contract.source_value_type == "string"
                and original_contract.source_property == field_name
            ):
                return NormalizedToolContract(
                    mode="nested_single",
                    schema_shape="validation_retry.scalar_value",
                    source_value_type="string",
                    root_schema=input_schema,
                    source_property=field_name,
                    item_schema={"type": "string"},
                )
            return NormalizedToolContract(
                mode="nested_single",
                schema_shape="validation_retry.nested",
                source_value_type="object",
                root_schema=input_schema,
                source_property=field_name,
                item_schema={"type": "object", "properties": {name: {"type": "string"} for name in source_fields}},
                source_fields=source_fields,
            )
    return None


def _sanitize_payload_by_schema(
    payload: Any,
    schema: dict[str, Any] | None,
    *,
    root_schema: dict[str, Any] | None = None,
) -> Any:
    if not isinstance(schema, dict):
        return payload
    variants = _expand_schema_variants(schema, root_schema=root_schema or schema)
    if not variants:
        return payload
    variant = variants[0]
    if variant.get("type") == "array" and isinstance(payload, list):
        item_schema = variant.get("items") if isinstance(variant.get("items"), dict) else None
        return [_sanitize_payload_by_schema(item, item_schema, root_schema=root_schema or schema) for item in payload]

    properties = _schema_properties(variant)
    if properties and isinstance(payload, dict):
        sanitized: dict[str, Any] = {}
        for key, value in payload.items():
            if key not in properties:
                continue
            sanitized[key] = _sanitize_payload_by_schema(value, properties.get(key), root_schema=root_schema or schema)
        return sanitized
    return payload


def _default_adapter_name(contract: NormalizedToolContract, *, retry: bool = False) -> str:
    suffix = "_retry_v1" if retry else "_v1"
    if contract.mode == "batch" and contract.source_value_type == "string":
        return f"batch_string_sources{suffix}"
    if contract.mode == "batch":
        return f"batch_sources{suffix.replace('_v1', '_v2') if not retry else suffix}"
    if contract.mode == "nested_single" and contract.source_value_type == "string":
        return f"single_string_source{suffix}"
    if contract.mode == "nested_single":
        return f"nested_single{suffix.replace('_v1', '_v2') if not retry else suffix}"
    return f"canonical_flat{suffix.replace('_v1', '_v2') if not retry else suffix}"


def _serialize_source_candidates(source_candidates: list[SourceCandidate]) -> list[dict[str, Any]]:
    return [_summarize_candidate_value(candidate) for candidate in source_candidates]


async def _build_llm_invocation_plan(
    *,
    tool_name: str,
    tool_description: str | None,
    input_schema: dict[str, Any] | None,
    contract: NormalizedToolContract,
    request: CanonicalExtractionRequest,
    source_candidates: list[SourceCandidate],
    validation_error: ValidationErrorSummary | None = None,
) -> AdaptiveToolInvocationPlan | None:
    if not isinstance(input_schema, dict):
        return None
    if request.source_kind != ROUTE_URL and contract.source_value_type != "string":
        return None

    try:
        candidate_payload = to_json_compatible_strict(
            _serialize_source_candidates(source_candidates),
            label="source_candidates",
        )
        canonical_request_payload = to_json_compatible_strict(
            _canonical_request_for_llm(request),
            label="canonical_request",
        )
        contract_payload = to_json_compatible_strict(
            {
                "mode": contract.mode,
                "source_value_type": contract.source_value_type,
                "batch_property": contract.batch_property,
                "source_property": contract.source_property,
            },
            label="contract",
        )
        input_schema_payload = to_json_compatible_strict(input_schema, label="input_schema")
        validation_error_payload = (
            _truncate_text(validation_error.raw_error, MAX_LLM_VALIDATION_ERROR_CHARS)
            if validation_error
            else ""
        )
        planning_payload_size = sum(
            len(json.dumps(item, ensure_ascii=False))
            for item in (
                candidate_payload,
                canonical_request_payload,
                contract_payload,
                input_schema_payload,
                validation_error_payload,
            )
        )
        if planning_payload_size > MAX_LLM_PLANNING_PAYLOAD_CHARS:
            logger.info(
                "extractor_llm_plan_skipped_payload_budget",
                tool_name=tool_name,
                payload_chars=planning_payload_size,
                payload_limit=MAX_LLM_PLANNING_PAYLOAD_CHARS,
            )
            return None

        if contract.mode in {"batch", "nested_single"} and contract.source_value_type in {"string", "object"}:
            prompt = (
                "You are planning arguments for an MCP tool call.\n"
                "You must return JSON only.\n"
                "Choose one source candidate kind and whether options/context should be included.\n"
                "Do not invent field names. Respect the provided input_schema and contract.\n\n"
                f"tool_name: {tool_name}\n"
                f"tool_description: {tool_description or ''}\n"
                f"contract: {json.dumps(contract_payload, ensure_ascii=False)}\n"
                f"source_candidates: {json.dumps(candidate_payload, ensure_ascii=False)}\n"
                f"canonical_request: {json.dumps(canonical_request_payload, ensure_ascii=False)}\n"
                f"input_schema: {json.dumps(input_schema_payload, ensure_ascii=False)}\n"
                f"validation_error: {validation_error_payload}\n"
                "Return JSON with keys: source_candidate_kind, include_options, include_context.\n"
            )
        else:
            # Unknown/flat contracts still ask LLM to produce raw arguments, then sanitize locally.
            prompt = (
                "You are adapting arguments for an MCP tool call.\n"
                "Return only a JSON object containing valid tool arguments.\n"
                "Do not include explanations.\n\n"
                f"tool_name: {tool_name}\n"
                f"tool_description: {tool_description or ''}\n"
                f"source_kind: {request.source_kind}\n"
                f"source_candidates: {json.dumps(candidate_payload, ensure_ascii=False)}\n"
                f"canonical_request: {json.dumps(canonical_request_payload, ensure_ascii=False)}\n"
                f"input_schema: {json.dumps(input_schema_payload, ensure_ascii=False)}\n"
                f"validation_error: {validation_error_payload}\n"
            )
    except Exception as exc:
        logger.warning("extractor_llm_plan_payload_unsafe", tool_name=tool_name, error=str(exc))
        return None

    try:
        response = await litellm.acompletion(
            model=settings.llm.full_model_name,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            **settings.llm.to_litellm_kwargs(),
        )
    except Exception as exc:
        logger.warning("extractor_llm_plan_failed", tool_name=tool_name, error=str(exc))
        return None
    content = response.choices[0].message.content or "{}"
    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        logger.info(
            "extractor_llm_plan_invalid_json",
            tool_name=tool_name,
            fallback_strategy="schema_or_default_contract",
            reason="invalid_json",
        )
        return None
    if not isinstance(payload, dict):
        return None
    if contract.mode in {"batch", "nested_single"} and contract.source_value_type in {"string", "object"}:
        selected_source_kind = payload.get("source_candidate_kind")
        include_options = bool(payload.get("include_options", False))
        include_context = bool(payload.get("include_context", False))
        arguments = _build_arguments_from_contract(
            contract=contract,
            request=request,
            source_candidates=source_candidates,
            include_options=include_options,
            include_context=include_context,
            selected_source_kind=selected_source_kind if isinstance(selected_source_kind, str) else None,
        )
        return AdaptiveToolInvocationPlan(
            adapter_name=_default_adapter_name(contract),
            arguments=arguments,
            reasoning_source="llm",
            diagnostics={
                "contract_mode": contract.mode,
                "schema_shape": contract.schema_shape,
                "source_value_type": contract.source_value_type,
                "selected_source_kind": selected_source_kind,
                "include_options": include_options,
                "include_context": include_context,
            },
        )
    sanitized = _sanitize_payload_by_schema(payload, input_schema, root_schema=input_schema)
    if not isinstance(sanitized, dict) or not sanitized:
        return None
    return AdaptiveToolInvocationPlan(
        adapter_name="llm_adaptive_v1",
        arguments=sanitized,
        reasoning_source="llm",
        diagnostics={
            "contract_mode": contract.mode,
            "schema_shape": contract.schema_shape,
            "source_value_type": contract.source_value_type,
            "top_level_fields": sorted(sanitized.keys()),
        },
    )


def _looks_like_document_payload(payload: Any) -> bool:
    if not isinstance(payload, dict):
        return False
    return any(
        key in payload
        for key in ("markdown", "markdown_content", "text", "plain_text", "content", "assets", "metadata")
    )


def _looks_like_tool_execution_envelope(payload: Any) -> bool:
    if not isinstance(payload, dict):
        return False
    return any(
        key in payload
        for key in ("success", "results", "items", "documents", "successful_count", "failed_count", "total_pdfs")
    )


def _normalize_document_payload(payload: Any) -> tuple[dict[str, Any], str | None]:
    if isinstance(payload, list):
        last_reason: str | None = None
        for item in payload:
            normalized, reason = _normalize_document_payload(item)
            if normalized:
                return normalized, None
            last_reason = last_reason or reason
        return {}, last_reason

    if not isinstance(payload, dict):
        return {}, None

    if _looks_like_document_payload(payload):
        return payload, None

    if payload.get("success") is False:
        return {}, "tool_execution_failed"

    nested_reason: str | None = None
    for key in ("result", "document", "data"):
        normalized, reason = _normalize_document_payload(payload.get(key))
        if normalized:
            return normalized, None
        nested_reason = nested_reason or reason

    saw_successful_candidate = False
    saw_candidate_list = False
    for key in ("results", "items", "documents"):
        candidates = payload.get(key)
        if not isinstance(candidates, list):
            continue
        saw_candidate_list = True
        for item in candidates:
            if not isinstance(item, dict):
                continue
            status = str(item.get("status") or "").lower()
            if item.get("success") is False or status in {"failed", "error"}:
                continue
            saw_successful_candidate = True
            normalized, reason = _normalize_document_payload(item)
            if normalized:
                return normalized, None
            if reason not in {None, "tool_execution_failed", "no_successful_documents"}:
                nested_reason = nested_reason or reason

    successful_count = payload.get("successful_count")
    if isinstance(successful_count, int) and successful_count <= 0:
        return {}, "no_successful_documents"
    if saw_candidate_list and not saw_successful_candidate:
        return {}, "no_successful_documents"
    if _looks_like_tool_execution_envelope(payload):
        return {}, "empty_payload"

    return {}, nested_reason


def _normalize_document_result(
    *,
    structured_content: Any,
    content_items: list[Any],
) -> tuple[dict[str, Any], str | None]:
    normalized, reason = _normalize_document_payload(structured_content)
    if normalized:
        return normalized, None
    if reason:
        return {}, reason

    fallback_text = _result_text_from_content_items(content_items)
    if not fallback_text:
        return {}, "structured_content_missing_and_text_unusable"

    parsed = _json_candidate_from_text(fallback_text)
    normalized, reason = _normalize_document_payload(parsed)
    if normalized:
        return normalized, None
    if reason:
        return {}, reason

    return {"markdown_content": fallback_text, "plain_text": fallback_text}, None


def _payload_text_fields(payload: dict[str, Any]) -> tuple[str, str]:
    markdown = str(
        payload.get("markdown")
        or payload.get("markdown_content")
        or ""
    ).strip()
    plain_text = str(
        payload.get("text")
        or payload.get("plain_text")
        or payload.get("content")
        or ""
    ).strip()

    if not markdown and plain_text:
        markdown = optimize_markdown_content(plain_text)
    if not plain_text and markdown:
        plain_text = markdown

    return markdown, plain_text


async def _increment_tool_call_count(*, server_id: UUID, tool_name: str) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(McpTool)
            .where(McpTool.server_id == server_id, McpTool.name == tool_name)
            .values(call_count=McpTool.call_count + 1)
        )
        await db.commit()


def _tool_has_usable_schema(tool: McpTool | None) -> bool:
    return bool(tool and isinstance(tool.input_schema, dict) and tool.input_schema)


class DataExtractorProvider:
    def __init__(self) -> None:
        from negentropy.plugins.mcp_client import McpClientService

        self._client = McpClientService()

    async def extract(
        self,
        *,
        app_name: str,
        corpus_id: UUID,
        source_kind: SourceKind,
        corpus_config: dict[str, Any] | None,
        url: str | None = None,
        content: bytes | None = None,
        filename: str | None = None,
        content_type: str | None = None,
        tracker: Any | None = None,
    ) -> ExtractedDocumentResult:
        targets = resolve_targets(corpus_config, source_kind)
        if not targets:
            raise ValueError(f"No extractor route configured for source kind: {source_kind}")

        if tracker:
            await tracker.start_stage("extract_resolve")
            await tracker.complete_stage(
                "extract_resolve",
                {
                    "source_kind": source_kind,
                    "target_count": len(targets),
                    "targets": [{"server_id": str(item.server_id), "tool_name": item.tool_name} for item in targets],
                },
            )

        attempts: list[ExtractionAttempt] = []

        for index, target in enumerate(targets):
            stage_name = "extract_primary" if index == 0 else f"extract_failover_{index}"
            if tracker:
                await tracker.start_stage(stage_name)

            attempt = await self._invoke_target(
                app_name=app_name,
                corpus_id=corpus_id,
                target=target,
                source_kind=source_kind,
                url=url,
                content=content,
                filename=filename,
                content_type=content_type,
            )
            attempts.append(attempt["attempt"])

            if attempt["success"]:
                result = attempt["result"]
                result.trace = {
                    "provider": "mcp",
                    "source_kind": source_kind,
                    **(result.trace if isinstance(result.trace, dict) else {}),
                    "selected_target": {"server_id": str(target.server_id), "tool_name": target.tool_name},
                    "attempts": to_json_compatible(attempts),
                }
                if tracker:
                    await tracker.complete_stage(
                        stage_name,
                        {
                            "server_id": str(target.server_id),
                            "tool_name": target.tool_name,
                            "duration_ms": attempt["attempt"].duration_ms,
                            "asset_count": len(result.assets),
                            "markdown_length": len(result.markdown_content),
                        },
                    )
                    await tracker.start_stage("extract_finalize")
                    await tracker.complete_stage(
                        "extract_finalize",
                        {
                            "plain_text_length": len(result.plain_text),
                            "markdown_length": len(result.markdown_content),
                            "asset_count": len(result.assets),
                        },
                    )
                return result

            if tracker:
                await tracker.fail_stage(
                    stage_name,
                    {
                        "server_id": str(target.server_id),
                        "tool_name": target.tool_name,
                        "message": attempt["attempt"].error,
                        "failure_category": attempt["attempt"].failure_category,
                        "diagnostic_summary": attempt["attempt"].diagnostic_summary,
                        "diagnostics": attempt["attempt"].diagnostics,
                    },
                )

        raise ExtractorExecutionError(
            _build_aggregated_extraction_error(attempts),
            attempts=attempts,
        )

    async def _invoke_target(
        self,
        *,
        app_name: str,
        corpus_id: UUID,
        target: McpToolTarget,
        source_kind: SourceKind,
        url: str | None,
        content: bytes | None,
        filename: str | None,
        content_type: str | None,
    ) -> dict[str, Any]:
        tool: McpTool | None = None
        discovered_tool: Any | None = None
        async with AsyncSessionLocal() as db:
            server = await db.get(McpServer, target.server_id)
            if not server or not server.is_enabled:
                error = "MCP server not found or disabled"
                return {
                    "success": False,
                    "attempt": ExtractionAttempt(
                        server_id=str(target.server_id),
                        server_name="unknown",
                        tool_name=target.tool_name,
                        status="failed",
                        duration_ms=0,
                        error=error,
                        failure_category="tool_unavailable",
                    ),
                }

            tool = await db.scalar(
                select(McpTool).where(McpTool.server_id == target.server_id, McpTool.name == target.tool_name)
            )
            if tool and not tool.is_enabled:
                error = "MCP tool is disabled"
                return {
                    "success": False,
                    "attempt": ExtractionAttempt(
                        server_id=str(target.server_id),
                        server_name=server.name,
                        tool_name=target.tool_name,
                        status="failed",
                        duration_ms=0,
                        error=error,
                        failure_category="tool_disabled",
                    ),
                }

        if not _tool_has_usable_schema(tool):
            discovered_tool = await self._discover_tool_definition(server=server, tool_name=target.tool_name)

        request = _build_canonical_request(
            source_kind=source_kind,
            app_name=app_name,
            corpus_id=corpus_id,
            tool_options=target.tool_options,
            url=url,
            content=content,
            filename=filename,
            content_type=content_type,
        )
        input_schema = (
            discovered_tool.input_schema
            if discovered_tool and isinstance(discovered_tool.input_schema, dict)
            else tool.input_schema
            if tool
            else None
        )
        tool_description = (
            discovered_tool.description
            if discovered_tool and isinstance(discovered_tool.description, str)
            else getattr(tool, "description", None)
            if tool
            else None
        )
        contract = normalize_tool_contract(
            input_schema=input_schema,
            source_kind=source_kind,
        )
        capability = _infer_tool_capability_profile(
            input_schema=input_schema,
            contract=contract,
        )
        source_candidates, cleanup_paths = _prepare_source_candidates(request=request, content=content)
        invocation_trace: list[dict[str, Any]] = []
        validation_error: ValidationErrorSummary | None = None

        try:
            readiness = _evaluate_unknown_contract_readiness(
                input_schema=input_schema,
                contract=contract,
                capability=capability,
                source_kind=source_kind,
            )
            if not readiness.compatible:
                return {
                    "success": False,
                    "attempt": ExtractionAttempt(
                        server_id=str(target.server_id),
                        server_name=server.name,
                        tool_name=target.tool_name,
                        status="failed",
                        duration_ms=0,
                        error="Tool input schema could not be normalized for document extraction",
                        failure_category=readiness.failure_category,
                        diagnostic_summary=readiness.diagnostic_summary,
                        diagnostics=readiness.diagnostics,
                    ),
                }
            for index in range(2):
                plan = await _build_llm_invocation_plan(
                    tool_name=target.tool_name,
                    tool_description=tool_description,
                    input_schema=input_schema,
                    contract=contract,
                    request=request,
                    source_candidates=source_candidates,
                    validation_error=validation_error,
                )
                if plan is None:
                    if index == 0:
                        plan = _build_plan_from_contract(
                            contract=contract,
                            request=request,
                            adapter_name=_default_adapter_name(contract),
                            reasoning_source="schema",
                            source_candidates=source_candidates,
                            diagnostics={
                                "top_level_fields": sorted(contract.top_level_fields),
                                "capability": {
                                    "has_declared_schema": capability.has_declared_schema,
                                    "accepts_string_source": capability.accepts_string_source,
                                    "accepts_object_source": capability.accepts_object_source,
                                    "supports_batch": capability.supports_batch,
                                    "schema_confidence": capability.schema_confidence,
                                },
                            },
                        )
                    elif validation_error:
                        retry_contract = _build_retry_contract_from_error(
                            input_schema=input_schema,
                            request=request,
                            original_contract=contract,
                            validation_error=validation_error,
                        )
                        if retry_contract:
                            plan = _build_plan_from_contract(
                                contract=retry_contract,
                                request=request,
                                adapter_name=_default_adapter_name(retry_contract, retry=True),
                                reasoning_source="validation_retry",
                                source_candidates=source_candidates,
                                diagnostics={
                                    "retry_reason": "validation_error",
                                    "validation_error_summary": {
                                        "missing_fields": validation_error.missing_fields,
                                        "unexpected_fields": validation_error.unexpected_fields,
                                        "string_item_fields": validation_error.string_item_fields,
                                    },
                                },
                            )
                        else:
                            break
                    else:
                        break

                if plan.reasoning_source != "llm" and contract.source_value_type == "string":
                    selected_string_source = _select_string_source_candidate(source_candidates=source_candidates)
                    if not selected_string_source:
                        return {
                            "success": False,
                            "attempt": ExtractionAttempt(
                                server_id=str(target.server_id),
                                server_name=server.name,
                                tool_name=target.tool_name,
                                status="failed",
                                duration_ms=0,
                                error="No usable string source candidate available for MCP tool invocation",
                                failure_category="low_confidence_contract",
                                diagnostic_summary="契约要求 string source，但当前提取源无法构造可用的字符串候选参数",
                                diagnostics={
                                    "adapter_attempts": invocation_trace,
                                    "contract_mode": contract.mode,
                                    "schema_shape": contract.schema_shape,
                                    "source_value_type": contract.source_value_type,
                                    "source_candidates": _serialize_source_candidates(source_candidates),
                                },
                            ),
                        }

                result = await self._call_tool_with_plan(
                    server=server,
                    target=target,
                    plan=plan,
                )
                invocation_trace.append(
                    {
                        "attempt": index + 1,
                        "adapter_name": plan.adapter_name,
                        "reasoning_source": plan.reasoning_source,
                        "diagnostics": plan.diagnostics,
                        "success": result.success,
                        "error": result.error,
                        "failure_category": None if result.success else ("validation_error" if _is_validation_error(result.error) else "tool_error"),
                        "duration_ms": result.duration_ms,
                    }
                )
                if result.success:
                    return self._build_success_result(
                        target=target,
                        server=server,
                        result=result,
                        plan=plan,
                        invocation_trace=invocation_trace,
                        contract=contract,
                    )

                if not _is_validation_error(result.error):
                    break
                validation_error = _summarize_validation_error(result.error)

            last_result = invocation_trace[-1] if invocation_trace else None
            return {
                "success": False,
                "attempt": ExtractionAttempt(
                    server_id=str(target.server_id),
                    server_name=server.name,
                    tool_name=target.tool_name,
                    status="failed",
                    duration_ms=int(last_result["duration_ms"]) if last_result else 0,
                    error=str(last_result["error"]) if last_result else "MCP invocation failed",
                    failure_category=str(last_result["failure_category"]) if last_result else "tool_error",
                    diagnostics={"adapter_attempts": invocation_trace},
                ),
            }
        finally:
            _cleanup_temp_paths(cleanup_paths)

    async def _discover_tool_definition(
        self,
        *,
        server: McpServer,
        tool_name: str,
    ) -> Any | None:
        discovered = await self._client.discover_tools(
            transport_type=server.transport_type,
            command=server.command,
            args=server.args,
            env=server.env,
            url=server.url,
            headers=server.headers,
        )
        if not discovered.success:
            logger.warning(
                "extractor_tool_discovery_failed",
                server_name=server.name,
                tool_name=tool_name,
                error=discovered.error,
            )
            return None
        return next((item for item in discovered.tools if item.name == tool_name), None)

    async def _call_tool_with_plan(
        self,
        *,
        server: McpServer,
        target: McpToolTarget,
        plan: AdaptiveToolInvocationPlan,
    ) -> Any:
        async with AsyncSessionLocal() as db:
            service = McpToolExecutionService(db, client=self._client)
            execution = await service.execute_tool(
                server=server,
                user=None,
                tool_name=target.tool_name,
                arguments=plan.arguments,
                origin=RUN_ORIGIN_KNOWLEDGE_EXTRACTION,
                timeout_seconds=(target.timeout_ms / 1000.0) if target.timeout_ms else None,
            )
            return execution.call_result

    def _build_success_result(
        self,
        *,
        target: McpToolTarget,
        server: McpServer,
        result: Any,
        plan: AdaptiveToolInvocationPlan,
        invocation_trace: list[dict[str, Any]],
        contract: NormalizedToolContract,
    ) -> dict[str, Any]:
        attempt = ExtractionAttempt(
            server_id=str(target.server_id),
            server_name=server.name,
            tool_name=target.tool_name,
            status="completed",
            duration_ms=result.duration_ms,
            error=None,
        )
        payload, normalization_error = _normalize_document_result(
            structured_content=result.structured_content,
            content_items=result.content,
        )
        markdown, plain_text = _payload_text_fields(payload)
        if not plain_text:
            failure_category_map = {
                "structured_content_missing_and_text_unusable": "unrecognized_payload",
                "tool_execution_failed": "tool_execution_failed",
                "no_successful_documents": "no_successful_documents",
                "empty_payload": "empty_payload",
            }
            failure_category = failure_category_map.get(normalization_error or "", "empty_payload")
            diagnostic_summary_map = {
                "structured_content_missing_and_text_unusable": "MCP 返回既无结构化文档结果，也无可用正文文本。",
                "tool_execution_failed": "MCP 工具返回失败响应，未产出可用文档内容。",
                "no_successful_documents": "MCP 批处理调用未返回任何成功文档结果。",
                "empty_payload": "MCP 调用成功，但文档载荷为空或缺少正文内容。",
            }
            return {
                "success": False,
                "attempt": ExtractionAttempt(
                    server_id=attempt.server_id,
                    server_name=attempt.server_name,
                    tool_name=attempt.tool_name,
                    status="failed",
                    duration_ms=attempt.duration_ms,
                    error=normalization_error or "document_payload_recognized_but_empty",
                    failure_category=failure_category,
                    diagnostic_summary=diagnostic_summary_map.get(normalization_error or "", None),
                    diagnostics={
                        "adapter_name": plan.adapter_name,
                        "contract_shape": contract.schema_shape,
                        "normalized_payload_shape": sorted(payload.keys()) if isinstance(payload, dict) else [],
                    },
                ),
            }

        return {
            "success": True,
            "attempt": attempt,
            "result": ExtractedDocumentResult(
                plain_text=plain_text,
                markdown_content=markdown,
                metadata={
                    **(payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}),
                    "adapter_name": plan.adapter_name,
                },
                assets=_normalize_assets(payload.get("assets")),
                trace={
                    "adapter_name": plan.adapter_name,
                    "adapter_schema_summary": plan.diagnostics,
                    "adapter_attempts": invocation_trace,
                    "contract_shape": contract.schema_shape,
                    "normalization_error": normalization_error,
                    "normalized_payload_shape": sorted(payload.keys()) if isinstance(payload, dict) else [],
                    "llm_fallback_used": any(item.get("reasoning_source") == "llm" for item in invocation_trace),
                },
            ),
        }


async def extract_source(
    *,
    app_name: str,
    corpus_id: UUID,
    corpus_config: dict[str, Any] | None,
    source_kind: SourceKind,
    url: str | None = None,
    content: bytes | None = None,
    filename: str | None = None,
    content_type: str | None = None,
    tracker: Any | None = None,
) -> ExtractedDocumentResult:
    targets = resolve_targets(corpus_config, source_kind)
    if not targets:
        if tracker:
            await tracker.start_stage("extract_resolve")
        raise ExtractorExecutionError(
            f"No extractor targets configured for source kind '{source_kind}'. "
            "Please configure the Data Extractor MCP service and ensure the corpus "
            "has valid extractor_routes in its configuration.",
            attempts=[],
        )
    provider = DataExtractorProvider()
    return await provider.extract(
        app_name=app_name,
        corpus_id=corpus_id,
        source_kind=source_kind,
        corpus_config=corpus_config,
        url=url,
        content=content,
        filename=filename,
        content_type=content_type,
        tracker=tracker,
    )


async def persist_extracted_assets(
    *,
    document_id: UUID,
    assets: list[ExtractionAsset],
    tracker: Any | None = None,
) -> list[dict[str, Any]]:
    if not assets:
        return []

    if tracker:
        await tracker.start_stage("extract_assets_store")

    storage_service = DocumentStorageService()
    stored_assets: list[dict[str, Any]] = []
    for asset in assets:
        uri = asset.uri
        if not uri:
            content_bytes: bytes | None = None
            if asset.data_base64:
                try:
                    content_bytes = base64.b64decode(asset.data_base64)
                except (ValueError, TypeError):
                    logger.warning("invalid_asset_base64_skipped", document_id=str(document_id), asset_name=asset.name)
            elif asset.text is not None:
                content_bytes = asset.text.encode("utf-8")

            if content_bytes:
                uri = await storage_service.upload_extraction_asset(
                    document_id=document_id,
                    filename=asset.name,
                    content=content_bytes,
                    content_type=asset.content_type,
                )

        stored_assets.append(
            {
                "name": asset.name,
                "content_type": asset.content_type,
                "uri": uri,
                "metadata": asset.metadata,
            }
        )

    if tracker:
        await tracker.complete_stage("extract_assets_store", {"asset_count": len(stored_assets)})
    return stored_assets


def build_url_document_filename(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    raw_name = sanitize_filename(parsed.path.split("/")[-1] or parsed.netloc or "url_document")
    if "." not in raw_name:
        raw_name = f"{raw_name}.md"
    return raw_name


def build_asset_filename(source_name: str, fallback_suffix: str) -> str:
    stem = Path(source_name).stem or "document"
    safe_stem = sanitize_filename(stem)
    return f"{safe_stem}-{fallback_suffix}"
