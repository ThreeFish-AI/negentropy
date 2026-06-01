"""图片/资产处理：从 MCP 调用结果中提取、归一化与合并图片资产。"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from negentropy.logging import get_logger

logger = get_logger("negentropy.knowledge.extraction")

# base64 数据字段名优先级序列（覆盖不同 MCP 工具实现的命名习惯）
_BASE64_FIELD_NAMES = ("data_base64", "content_base64", "data", "base64", "image_data")


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


def _extract_base64_from_asset(item: dict[str, Any]) -> str | None:
    """从 asset dict 中按优先级提取 base64 编码数据。"""
    for field_name in _BASE64_FIELD_NAMES:
        value = item.get(field_name)
        if isinstance(value, str) and value:
            return value
    return None


def _is_gcs_uri(uri: str | None) -> bool:
    """判断 URI 是否为 GCS 路径。"""
    return bool(uri and uri.startswith("gs://"))


# ---------------------------------------------------------------------------
# ExtractionAsset — 定义在此处以便 assets 模块自包含，同时由 extraction.py re-export
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class ExtractionAsset:
    name: str
    content_type: str
    uri: str | None = None
    data_base64: str | None = None
    local_path: str | None = None
    text: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# ImageContent 提取与 Markdown 图片引用匹配
# ---------------------------------------------------------------------------

_MARKDOWN_IMAGE_RE = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")
# 内嵌 HTML <img>（perceives PDF 管线保留宽高时的输出形式），用 src 属性 capture group。
_HTML_IMG_SRC_RE = re.compile(
    r"""<img\b[^>]*?\bsrc=(["'])(?P<src>[^"']+)\1[^>]*?/?>""",
    re.IGNORECASE,
)


def _iter_image_src_matches(markdown_content: str) -> list[tuple[int, int, int, str]]:
    """按文档位置统一返回所有图片引用的 src capture 偏移。

    返回元组 ``(match_start, src_start, src_end, src_text)``，包括：
      - ``![alt](src)`` Markdown 形式（_MARKDOWN_IMAGE_RE）
      - ``<img src="..." />`` HTML 形式（_HTML_IMG_SRC_RE）

    用于路径重写与文件名提取的统一遍历，保证两类语法在
    "文档顺序" 这一维度上的一致性。
    """
    matches: list[tuple[int, int, int, str]] = []
    for m in _MARKDOWN_IMAGE_RE.finditer(markdown_content):
        matches.append((m.start(), m.start(1), m.end(1), m.group(1)))
    for m in _HTML_IMG_SRC_RE.finditer(markdown_content):
        s = m.start("src")
        e = m.end("src")
        matches.append((m.start(), s, e, m.group("src")))
    matches.sort(key=lambda t: t[0])
    return matches


def _extract_markdown_image_refs(markdown_content: str) -> list[str]:
    """按文档顺序提取 Markdown 中本地图片引用的文件名。

    覆盖两种语法：标准 Markdown ``![alt](src)`` 与内嵌 HTML ``<img src="…">``。
    排除绝对 URL（``http``/``https``/``data``/``blob``），从路径中取最后一段。
    """
    refs: list[str] = []
    for _, _, _, src_raw in _iter_image_src_matches(markdown_content):
        src = src_raw.strip()
        if src.startswith(("http://", "https://", "data:", "blob:")):
            continue
        filename = src.split("/")[-1].split("\\")[-1]
        if filename:
            refs.append(filename)
    return refs


def _mime_to_extension(mime_type: str) -> str:
    """将 MIME 类型映射为文件扩展名。"""
    mapping = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
        "image/bmp": ".bmp",
        "image/tiff": ".tiff",
    }
    return mapping.get(mime_type.lower(), ".png")


def _guess_image_content_type(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    mapping = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".bmp": "image/bmp",
        ".tif": "image/tiff",
        ".tiff": "image/tiff",
    }
    return mapping.get(suffix, "application/octet-stream")


def _normalize_assets(raw_assets: Any) -> list[ExtractionAsset]:
    if not isinstance(raw_assets, list):
        return []

    assets: list[ExtractionAsset] = []
    for index, item in enumerate(raw_assets):
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or item.get("filename") or f"asset-{index + 1}")
        content_type = str(item.get("content_type") or item.get("mime_type") or "application/octet-stream")
        data_base64 = _extract_base64_from_asset(item)
        uri = item.get("uri") if isinstance(item.get("uri"), str) else None

        if not data_base64 and not uri and not (isinstance(item.get("text"), str) and item.get("text")):
            logger.warning(
                "asset_missing_data_and_uri",
                asset_name=name,
                available_keys=sorted(item.keys()),
            )

        assets.append(
            ExtractionAsset(
                name=name,
                content_type=content_type,
                uri=uri,
                data_base64=data_base64,
                local_path=item.get("local_path") if isinstance(item.get("local_path"), str) else None,
                text=item.get("text") if isinstance(item.get("text"), str) else None,
                metadata=item.get("metadata") if isinstance(item.get("metadata"), dict) else {},
            )
        )
    return assets


def _extract_resource_link_assets(
    content_items: list[Any],
    markdown_content: str,
    resolved_resources: dict[str, Any],
) -> list[ExtractionAsset]:
    """从 MCP content_items 中提取 ResourceLink 并配对同会话拉取的资源载荷。

    ResourceLink 仅携带 ``uri`` / ``mimeType`` / ``name``，实际二进制由调用方通过
    ``resources/read`` 在同会话内拉取（``resolved_resources``）。

    命名约定：与 ``_extract_image_assets_from_content_items`` 一致——按 result.content
    中 ``resource_link`` 出现顺序与 Markdown image refs 一一对应；ResourceLink
    自带的 ``name`` 字段次之；最后用 ``resource-N.<ext>`` 兜底。
    """
    link_items: list[Any] = []
    for item in content_items or []:
        if getattr(item, "type", None) == "resource_link":
            uri = getattr(item, "uri", None)
            if uri:
                link_items.append(item)

    if not link_items:
        return []

    image_refs = _extract_markdown_image_refs(markdown_content)
    assets: list[ExtractionAsset] = []
    for index, link in enumerate(link_items):
        uri = str(link.uri)
        mime_type = getattr(link, "mimeType", None) or "application/octet-stream"
        link_name = getattr(link, "name", None)

        # 命名优先级：Markdown 引用顺序 > ResourceLink.name > 兜底序号
        if index < len(image_refs):
            asset_name = image_refs[index]
        elif isinstance(link_name, str) and link_name.strip():
            asset_name = Path(link_name).name
        else:
            ext = _mime_to_extension(mime_type)
            asset_name = f"resource-{index + 1}{ext}"

        resource_payload = resolved_resources.get(uri)
        if resource_payload is None:
            # 部分失败：保留 asset 元数据但不写 GCS（data_base64 与 local_path 均空）
            assets.append(
                ExtractionAsset(
                    name=asset_name,
                    content_type=mime_type,
                    metadata={
                        "source": "resource_link",
                        "origin_uri": uri,
                        "resource_read_failed": True,
                    },
                )
            )
            continue

        assets.append(
            ExtractionAsset(
                name=asset_name,
                content_type=getattr(resource_payload, "mime_type", None) or mime_type,
                data_base64=getattr(resource_payload, "blob_base64", None),
                text=getattr(resource_payload, "text", None),
                metadata={
                    "source": "resource_link",
                    "origin_uri": uri,
                },
            )
        )

    return assets


def _extract_image_assets_from_content_items(
    content_items: list[Any],
    markdown_content: str,
) -> list[ExtractionAsset]:
    """从 MCP content_items 中提取 ImageContent 并转换为 ExtractionAsset。

    ImageContent 无文件名字段，通过与 Markdown 中图片引用的顺序一一对应来命名。
    """
    image_items: list[Any] = []
    for item in content_items:
        if getattr(item, "type", None) == "image":
            data = getattr(item, "data", None)
            mime_type = getattr(item, "mimeType", None)
            if data and mime_type:
                image_items.append(item)

    if not image_items:
        return []

    image_refs = _extract_markdown_image_refs(markdown_content)

    assets: list[ExtractionAsset] = []
    for index, img_item in enumerate(image_items):
        data = getattr(img_item, "data", "")
        mime_type = getattr(img_item, "mimeType", "image/png")

        if index < len(image_refs):
            name = image_refs[index]
        else:
            ext = _mime_to_extension(mime_type)
            name = f"image-content-{index + 1}{ext}"

        assets.append(
            ExtractionAsset(
                name=name,
                content_type=mime_type,
                data_base64=data,
                metadata={"source": "content_items"},
            )
        )

    return assets


def _merge_extraction_assets(
    structured_assets: list[ExtractionAsset],
    content_image_assets: list[ExtractionAsset],
) -> list[ExtractionAsset]:
    """合并 structured_content 和 content_items 两个来源的资产。

    structured_assets 优先：同名且已含有效数据的项不被覆盖。
    当 structured asset 无 data_base64 且 URI 非 GCS 地址时，允许 content_items 回填。
    """
    if not content_image_assets:
        return structured_assets
    if not structured_assets:
        return content_image_assets

    existing_names: dict[str, int] = {}
    for idx, asset in enumerate(structured_assets):
        existing_names[asset.name] = idx

    merged = list(structured_assets)
    for img_asset in content_image_assets:
        if img_asset.name in existing_names:
            existing_idx = existing_names[img_asset.name]
            existing = merged[existing_idx]
            # structured 已有 base64 数据 → 不覆盖
            if existing.data_base64:
                continue
            # structured 已有 GCS URI → 不覆盖（GCS URI 可直接服务）
            if _is_gcs_uri(existing.uri):
                continue
            # 其他情况（无数据、或 URI 非 GCS）→ 允许用 content_items 数据回填
            if img_asset.data_base64:
                merged[existing_idx] = ExtractionAsset(
                    name=existing.name,
                    content_type=img_asset.content_type or existing.content_type,
                    uri=existing.uri,
                    data_base64=img_asset.data_base64,
                    text=existing.text,
                    metadata={**existing.metadata, "source": "content_items_backfill"},
                )
        else:
            merged.append(img_asset)
            existing_names[img_asset.name] = len(merged) - 1

    return merged


def _extract_enhanced_image_assets(payload: dict[str, Any]) -> list[ExtractionAsset]:
    """从 enhanced_assets.output_directory + images.files 提取本地图片资产。"""
    enhanced_assets = payload.get("enhanced_assets")
    if not isinstance(enhanced_assets, dict):
        return []

    output_directory = enhanced_assets.get("output_directory")
    images = enhanced_assets.get("images")
    if not isinstance(output_directory, str) or not output_directory.strip():
        return []
    if not isinstance(images, dict):
        return []

    files = images.get("files")
    if not isinstance(files, list):
        return []

    try:
        base_dir = Path(output_directory).expanduser().resolve(strict=True)
    except OSError:
        logger.warning("enhanced_asset_output_directory_invalid", output_directory=output_directory)
        return []

    assets: list[ExtractionAsset] = []
    for raw_name in files:
        if not isinstance(raw_name, str) or not raw_name.strip():
            continue

        safe_name = Path(raw_name).name
        if safe_name != raw_name:
            logger.warning(
                "enhanced_asset_filename_normalized",
                original_name=raw_name,
                normalized_name=safe_name,
            )

        candidate = base_dir / safe_name
        try:
            resolved = candidate.resolve(strict=True)
        except OSError:
            logger.warning(
                "enhanced_asset_file_missing",
                output_directory=str(base_dir),
                asset_name=safe_name,
            )
            continue

        try:
            resolved.relative_to(base_dir)
        except ValueError:
            logger.warning(
                "enhanced_asset_path_outside_output_directory",
                output_directory=str(base_dir),
                asset_path=str(resolved),
            )
            continue
        if not resolved.is_file():
            logger.warning("enhanced_asset_not_a_file", asset_path=str(resolved))
            continue

        assets.append(
            ExtractionAsset(
                name=safe_name,
                content_type=_guess_image_content_type(safe_name),
                local_path=str(resolved),
                metadata={"source": "enhanced_output_directory"},
            )
        )
    return assets


def _extract_structured_image_assets(
    payload: dict[str, Any],
    markdown_content: str,
    resolved_resources: dict[str, Any],
) -> list[ExtractionAsset]:
    """从 payload.image_assets 提取图片资产，匹配 resolved_resources 中的资源载荷。

    parse_pdf_to_markdown 等工具将图片元数据放在 structuredContent.image_assets 中，
    每条包含 filename、resource_uri、mime_type 等。实际二进制通过同会话 resources/read
    拉取后存入 resolved_resources。
    """
    raw_assets = payload.get("image_assets")
    if not isinstance(raw_assets, list):
        return []

    image_refs = _extract_markdown_image_refs(markdown_content)
    assets: list[ExtractionAsset] = []

    for index, item in enumerate(raw_assets):
        if not isinstance(item, dict):
            continue

        filename = item.get("filename") or item.get("name") or f"image-{index + 1}.png"
        asset_name = Path(filename).name
        mime_type = item.get("mime_type") or _guess_image_content_type(asset_name)
        resource_uri = item.get("resource_uri")

        data_base64: str | None = None
        if resource_uri and isinstance(resource_uri, str):
            resource_payload = resolved_resources.get(resource_uri)
            if resource_payload is not None:
                data_base64 = getattr(resource_payload, "blob_base64", None)
                resolved_mime = getattr(resource_payload, "mime_type", None)
                if resolved_mime:
                    mime_type = resolved_mime

        # 命名优先级：Markdown 图片引用顺序 > asset 自带 filename > 兜底序号
        if index < len(image_refs):
            asset_name = image_refs[index]

        metadata: dict[str, Any] = {
            "source": "structured_image_assets",
            "origin_uri": resource_uri or "",
        }
        if "width" in item:
            metadata["width"] = item["width"]
        if "height" in item:
            metadata["height"] = item["height"]
        if "page_number" in item:
            metadata["page_number"] = item["page_number"]
        if resource_uri and not data_base64:
            metadata["resource_read_failed"] = True

        assets.append(
            ExtractionAsset(
                name=asset_name,
                content_type=mime_type,
                data_base64=data_base64,
                metadata=metadata,
            ),
        )

    return assets
