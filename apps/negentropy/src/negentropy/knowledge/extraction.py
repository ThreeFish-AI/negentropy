from __future__ import annotations

import base64
import json
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal, Optional
from uuid import UUID

from sqlalchemy import select, update

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


def resolve_source_kind(*, source_uri: str | None = None, filename: str | None = None, content_type: str | None = None) -> SourceKind:
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
                data_base64=item.get("data_base64") if isinstance(item.get("data_base64"), str) else item.get("content_base64"),
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


def _detect_batch_sources_property(*, input_schema: dict[str, Any] | None, source_kind: SourceKind) -> str | None:
    properties = _schema_properties(input_schema)
    preferred_keys = (
        ("url_sources", "sources", "documents", "items")
        if source_kind == ROUTE_URL
        else ("pdf_sources", "sources", "documents", "items")
    )
    for name in preferred_keys:
        schema = properties.get(name)
        if not isinstance(schema, dict) or schema.get("type") != "array":
            continue
        item_schema = schema.get("items")
        if source_kind == ROUTE_URL and _is_url_source_schema(item_schema):
            return name
        if source_kind != ROUTE_URL and _is_file_source_schema(item_schema):
            return name
    for name, schema in properties.items():
        if not isinstance(schema, dict) or schema.get("type") != "array":
            continue
        item_schema = schema.get("items")
        if source_kind == ROUTE_URL and _is_url_source_schema(item_schema):
            return name
        if source_kind != ROUTE_URL and _is_file_source_schema(item_schema):
            return name
    return None


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


def build_tool_adapter(
    *,
    input_schema: dict[str, Any] | None,
    request: CanonicalExtractionRequest,
) -> ExtractionToolAdapter:
    batch_property = _detect_batch_sources_property(
        input_schema=input_schema,
        source_kind=request.source_kind,
    )
    if batch_property:
        properties = _schema_properties(input_schema)
        item_schema = properties.get(batch_property, {}).get("items")
        arguments = {
            batch_property: [_build_source_item(request=request, item_schema=item_schema)],
        }
        option_fields = _filter_declared_fields(request.options, properties.get("options"))
        if option_fields and "options" in properties:
            arguments["options"] = option_fields
        context_fields = _filter_declared_fields(request.context, properties.get("context"))
        if context_fields and "context" in properties:
            arguments["context"] = context_fields
        return ExtractionToolAdapter(
            name="batch_sources_v1",
            arguments=arguments,
            schema_summary={
                "batch_property": batch_property,
                "top_level_fields": sorted(arguments.keys()),
            },
        )

    arguments: dict[str, Any] = {
        "source_type": request.source_kind,
        "options": request.options,
        "context": request.context,
    }
    if request.source.url:
        arguments["url"] = request.source.url
    if request.source.content_base64 is not None:
        arguments["filename"] = request.source.filename
        arguments["content_type"] = request.source.content_type
        arguments["content_base64"] = request.source.content_base64
    return ExtractionToolAdapter(
        name="canonical_flat_v1",
        arguments=arguments,
        schema_summary={"top_level_fields": sorted(arguments.keys())},
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
            metadata={"provider": "legacy", "source_kind": resolve_source_kind(filename=filename, content_type=content_type)},
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
        adapter = build_tool_adapter(
            input_schema=tool.input_schema if tool else None,
            request=request,
        )

        result = await self._client.call_tool(
            transport_type=server.transport_type,
            tool_name=target.tool_name,
            arguments=adapter.arguments,
            command=server.command,
            args=server.args,
            env=server.env,
            url=server.url,
            headers=server.headers,
            timeout_seconds=(target.timeout_ms / 1000.0) if target.timeout_ms else None,
        )
        await _increment_tool_call_count(server_id=target.server_id, tool_name=target.tool_name)

        attempt = ExtractionAttempt(
            server_id=str(target.server_id),
            server_name=server.name,
            tool_name=target.tool_name,
            status="completed" if result.success else "failed",
            duration_ms=result.duration_ms,
            error=result.error,
        )
        if not result.success:
            return {"success": False, "attempt": attempt}

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
                    "adapter_name": adapter.name,
                },
                assets=_normalize_assets(payload.get("assets")),
                trace={
                    "adapter_name": adapter.name,
                    "adapter_schema_summary": adapter.schema_summary,
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
        result = await legacy.extract_file(content=content or b"", filename=filename or "unknown", content_type=content_type)
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
