from __future__ import annotations

import base64
import json
import re
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
from negentropy.storage.service import DocumentStorageService

from .content import (
    extract_file_content,
    extract_file_markdown,
    fetch_content,
    optimize_markdown_content,
    sanitize_filename,
)

logger = get_logger("negentropy.knowledge.extraction")

SourceKind = Literal["url", "file_pdf", "file_generic"]

EXTRACTOR_ROUTES_KEY = "extractor_routes"
ROUTE_URL = "url"
ROUTE_FILE_PDF = "file_pdf"
ROUTE_FILE_GENERIC = "file_generic"


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
    raw_error: str = ""


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


def _parse_structured_payload(payload: Any, content_items: list[Any]) -> dict[str, Any]:
    if isinstance(payload, dict):
        return payload

    if isinstance(payload, str):
        try:
            parsed = json.loads(payload)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return {}

    fallback_text = _result_text_from_content_items(content_items)
    if fallback_text:
        try:
            parsed = json.loads(fallback_text)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return {}
    return {}


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


def _is_url_source_schema(schema: Any) -> bool:
    properties = _schema_property_names(schema)
    return "url" in properties or "uri" in properties


def _is_file_source_schema(schema: Any) -> bool:
    properties = _schema_property_names(schema)
    return bool({"filename", "content_base64", "data_base64"} & properties)


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
            item_schema = _expand_schema_variants(schema.get("items"), root_schema=input_schema)
            selected_item_schema = next(
                (item for item in item_schema if _matches_source_schema(item, source_kind)),
                None,
            )
            if selected_item_schema:
                return NormalizedToolContract(
                    mode="batch",
                    schema_shape="object.array",
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
            nested_variants = _expand_schema_variants(schema, root_schema=input_schema)
            selected_variant = next(
                (item for item in nested_variants if _matches_source_schema(item, source_kind)),
                None,
            )
            if selected_variant:
                return NormalizedToolContract(
                    mode="nested_single",
                    schema_shape="object.object",
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
    diagnostics: dict[str, Any] | None = None,
) -> AdaptiveToolInvocationPlan:
    diagnostics = dict(diagnostics or {})
    arguments: dict[str, Any]
    if contract.mode == "batch" and contract.batch_property:
        arguments = {
            contract.batch_property: [_build_source_item(request=request, item_schema=contract.item_schema)],
        }
        top_properties = _schema_properties(contract.object_schema)
        option_fields = _filter_declared_fields(request.options, top_properties.get("options"))
        if option_fields and "options" in top_properties:
            arguments["options"] = option_fields
        context_fields = _filter_declared_fields(request.context, top_properties.get("context"))
        if context_fields and "context" in top_properties:
            arguments["context"] = context_fields
    elif contract.mode == "nested_single" and contract.source_property:
        arguments = {
            contract.source_property: _build_source_item(request=request, item_schema=contract.item_schema),
        }
        top_properties = _schema_properties(contract.object_schema)
        option_fields = _filter_declared_fields(request.options, top_properties.get("options"))
        if option_fields and "options" in top_properties:
            arguments["options"] = option_fields
        context_fields = _filter_declared_fields(request.context, top_properties.get("context"))
        if context_fields and "context" in top_properties:
            arguments["context"] = context_fields
    elif contract.mode == "flat":
        arguments = _build_flat_payload(request=request, allowed_fields=contract.source_fields)
    else:
        arguments = _build_flat_payload(request=request, allowed_fields=set())

    diagnostics.setdefault("contract_mode", contract.mode)
    diagnostics.setdefault("schema_shape", contract.schema_shape)
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
        )
    )


def _summarize_validation_error(error: str | None) -> ValidationErrorSummary:
    raw = str(error or "")
    missing = re.findall(r"\n([A-Za-z0-9_]+)\n\s+Missing required argument", raw)
    unexpected = re.findall(r"\n([A-Za-z0-9_]+)\n\s+Unexpected keyword argument", raw)
    return ValidationErrorSummary(
        missing_fields=missing,
        unexpected_fields=unexpected,
        raw_error=raw,
    )


def _source_fields_for_kind(source_kind: SourceKind) -> set[str]:
    return {"url", "uri"} if source_kind == ROUTE_URL else {"filename", "content_type", "content_base64", "data_base64"}


def _build_retry_contract_from_error(
    *,
    input_schema: dict[str, Any] | None,
    request: CanonicalExtractionRequest,
    validation_error: ValidationErrorSummary,
) -> NormalizedToolContract | None:
    missing = validation_error.missing_fields
    if not missing:
        return None

    source_fields = _source_fields_for_kind(request.source_kind)
    for field_name in missing:
        if field_name in _preferred_batch_keys(request.source_kind) or field_name.endswith("_sources"):
            return NormalizedToolContract(
                mode="batch",
                schema_shape="validation_retry.batch",
                root_schema=input_schema,
                batch_property=field_name,
                item_schema={"type": "object", "properties": {name: {"type": "string"} for name in source_fields}},
                source_fields=source_fields,
            )
        if field_name in _preferred_source_keys(request.source_kind) or field_name.endswith("_source"):
            return NormalizedToolContract(
                mode="nested_single",
                schema_shape="validation_retry.nested",
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


async def _build_llm_retry_plan(
    *,
    tool_name: str,
    tool_description: str | None,
    input_schema: dict[str, Any] | None,
    request: CanonicalExtractionRequest,
    validation_error: ValidationErrorSummary,
) -> AdaptiveToolInvocationPlan | None:
    if not isinstance(input_schema, dict):
        return None

    canonical_request_payload = {
        "source": request.source.__dict__,
        "options": request.options,
        "context": request.context,
    }
    prompt = (
        "You are adapting arguments for an MCP tool call.\n"
        "Return only a JSON object containing valid tool arguments.\n"
        "Do not include explanations.\n\n"
        f"tool_name: {tool_name}\n"
        f"tool_description: {tool_description or ''}\n"
        f"source_kind: {request.source_kind}\n"
        f"canonical_request: {json.dumps(canonical_request_payload, ensure_ascii=False)}\n"
        f"input_schema: {json.dumps(input_schema, ensure_ascii=False)}\n"
        f"validation_error: {validation_error.raw_error}\n"
    )

    response = await litellm.acompletion(
        model=settings.llm.full_model_name,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        **settings.llm.to_litellm_kwargs(),
    )
    content = response.choices[0].message.content or "{}"
    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        logger.warning("extractor_llm_retry_invalid_json", tool_name=tool_name)
        return None
    if not isinstance(payload, dict):
        return None
    sanitized = _sanitize_payload_by_schema(payload, input_schema, root_schema=input_schema)
    if not isinstance(sanitized, dict) or not sanitized:
        return None
    return AdaptiveToolInvocationPlan(
        adapter_name="llm_adaptive_v1",
        arguments=sanitized,
        reasoning_source="llm",
        diagnostics={
            "contract_mode": "llm",
            "schema_shape": "llm_retry",
            "top_level_fields": sorted(sanitized.keys()),
        },
    )


def _looks_like_document_payload(payload: Any) -> bool:
    if not isinstance(payload, dict):
        return False
    return any(
        key in payload
        for key in ("markdown", "markdown_content", "text", "plain_text", "assets", "metadata")
    )


def _extract_document_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    if _looks_like_document_payload(payload):
        return payload
    for key in ("result", "document", "data"):
        candidate = payload.get(key)
        if _looks_like_document_payload(candidate):
            return candidate
    for key in ("results", "items", "documents"):
        candidates = payload.get(key)
        if not isinstance(candidates, list):
            continue
        for item in candidates:
            if not isinstance(item, dict):
                continue
            status = str(item.get("status") or "").lower()
            if item.get("success") is False or status in {"failed", "error"}:
                continue
            direct = _extract_document_payload(item)
            if direct:
                return direct
    return payload


async def _increment_tool_call_count(*, server_id: UUID, tool_name: str) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(McpTool)
            .where(McpTool.server_id == server_id, McpTool.name == tool_name)
            .values(call_count=McpTool.call_count + 1)
        )
        await db.commit()


class LegacyExtractionProvider:
    async def extract_url(self, *, url: str) -> ExtractedDocumentResult:
        markdown = optimize_markdown_content(await fetch_content(url))
        return ExtractedDocumentResult(
            plain_text=markdown,
            markdown_content=markdown,
            metadata={"provider": "legacy", "source_kind": ROUTE_URL},
            trace={"provider": "legacy"},
        )

    async def extract_file(
        self,
        *,
        content: bytes,
        filename: str,
        content_type: str | None = None,
    ) -> ExtractedDocumentResult:
        text = await extract_file_content(content=content, filename=filename, content_type=content_type)
        markdown = await extract_file_markdown(content=content, filename=filename, content_type=content_type)
        return ExtractedDocumentResult(
            plain_text=text,
            markdown_content=markdown,
            metadata={
                "provider": "legacy",
                "source_kind": resolve_source_kind(filename=filename, content_type=content_type),
            },
            trace={"provider": "legacy"},
        )


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
        last_error: str | None = None

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
                    "attempts": [item.__dict__ for item in attempts],
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

            last_error = attempt["attempt"].error
            if tracker:
                await tracker.fail_stage(
                    stage_name,
                    {
                        "server_id": str(target.server_id),
                        "tool_name": target.tool_name,
                        "message": last_error,
                    },
                )

        raise ValueError(last_error or "All extractor MCP targets failed")

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
                    ),
                }

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
        contract = normalize_tool_contract(
            input_schema=tool.input_schema if tool else None,
            source_kind=source_kind,
        )
        plans: list[AdaptiveToolInvocationPlan] = [
            _build_plan_from_contract(
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
                diagnostics={"top_level_fields": sorted(contract.top_level_fields)},
            )
        ]
        invocation_trace: list[dict[str, Any]] = []

        for index, plan in enumerate(plans):
            result = await self._call_tool_with_plan(
                server=server,
                target=target,
                plan=plan,
            )
            await _increment_tool_call_count(server_id=target.server_id, tool_name=target.tool_name)
            invocation_trace.append(
                {
                    "attempt": index + 1,
                    "adapter_name": plan.adapter_name,
                    "reasoning_source": plan.reasoning_source,
                    "diagnostics": plan.diagnostics,
                    "success": result.success,
                    "error": result.error,
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

            if index > 0 or not _is_validation_error(result.error):
                break

            validation_error = _summarize_validation_error(result.error)
            retry_contract = _build_retry_contract_from_error(
                input_schema=tool.input_schema if tool else None,
                request=request,
                validation_error=validation_error,
            )
            if retry_contract:
                plans.append(
                    _build_plan_from_contract(
                        contract=retry_contract,
                        request=request,
                        adapter_name=(
                            "batch_sources_retry_v1"
                            if retry_contract.mode == "batch"
                            else "nested_single_retry_v1"
                        ),
                        reasoning_source="validation_retry",
                        diagnostics={
                            "retry_reason": "validation_error",
                            "validation_error_summary": {
                                "missing_fields": validation_error.missing_fields,
                                "unexpected_fields": validation_error.unexpected_fields,
                            },
                        },
                    )
                )
                continue

            llm_plan = await _build_llm_retry_plan(
                tool_name=target.tool_name,
                tool_description=tool.description if tool else None,
                input_schema=tool.input_schema if tool else None,
                request=request,
                validation_error=validation_error,
            )
            if llm_plan:
                llm_plan.diagnostics.setdefault(
                    "validation_error_summary",
                    {
                        "missing_fields": validation_error.missing_fields,
                        "unexpected_fields": validation_error.unexpected_fields,
                    },
                )
                plans.append(llm_plan)

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
            ),
        }

    async def _call_tool_with_plan(
        self,
        *,
        server: McpServer,
        target: McpToolTarget,
        plan: AdaptiveToolInvocationPlan,
    ) -> Any:
        return await self._client.call_tool(
            transport_type=server.transport_type,
            tool_name=target.tool_name,
            arguments=plan.arguments,
            command=server.command,
            args=server.args,
            env=server.env,
            url=server.url,
            headers=server.headers,
            timeout_seconds=(target.timeout_ms / 1000.0) if target.timeout_ms else None,
        )

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
        payload = _extract_document_payload(
            _parse_structured_payload(result.structured_content, result.content)
        )
        markdown = str(payload.get("markdown") or payload.get("markdown_content") or "").strip()
        plain_text = str(payload.get("text") or payload.get("plain_text") or "").strip()
        if not markdown and plain_text:
            markdown = optimize_markdown_content(plain_text)
        if not plain_text and markdown:
            plain_text = markdown
        if not plain_text:
            return {
                "success": False,
                "attempt": ExtractionAttempt(
                    server_id=attempt.server_id,
                    server_name=attempt.server_name,
                    tool_name=attempt.tool_name,
                    status="failed",
                    duration_ms=attempt.duration_ms,
                    error="Extractor returned empty content",
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
    if targets:
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

    legacy = LegacyExtractionProvider()
    if source_kind == ROUTE_URL:
        result = await legacy.extract_url(url=url or "")
    else:
        result = await legacy.extract_file(
            content=content or b"",
            filename=filename or "unknown",
            content_type=content_type,
        )
    result.trace = {"provider": "legacy", "source_kind": source_kind, "attempts": []}
    return result


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
