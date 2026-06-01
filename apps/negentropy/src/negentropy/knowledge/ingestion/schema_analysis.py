"""JSON Schema 分析与 MCP 工具契约归一化。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from negentropy.logging import get_logger

logger = get_logger("negentropy.knowledge.extraction")

SourceKind = Literal["url", "file_pdf", "file_md", "file_generic"]

ROUTE_URL = "url"
ROUTE_FILE_PDF = "file_pdf"


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


# ---------------------------------------------------------------------------
# Schema 结构辅助函数
# ---------------------------------------------------------------------------


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
    unsupported_required = sorted({field for item in branch_failures for field in item["unsupported_required_fields"]})

    if unsupported_required:
        failure_category = "low_confidence_contract" if any_recognized_declared else "unsupported_contract"
        diagnostic_summary = (
            f"契约为 unknown，要求额外必填字段 {', '.join(unsupported_required)}，当前提取源无法构造最小调用参数"
        )
    elif any_recognized_declared:
        failure_category = "low_confidence_contract"
        diagnostic_summary = "契约存在候选文档字段，但未找到可安全构造的最小调用参数分支"
    else:
        failure_category = (
            "low_confidence_contract" if capability.schema_confidence == "low" else "unsupported_contract"
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
