"""ImageContent 提取与 assets 合并逻辑单元测试。

验证 MCP 返回的 ImageContent 能正确转换为 ExtractionAsset，
并与 Markdown 中的图片引用正确匹配。
"""

import base64
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from negentropy.knowledge.extraction import (
    ExtractionAsset,
    _extract_enhanced_image_assets,
    _extract_base64_from_asset,
    _extract_image_assets_from_content_items,
    _extract_markdown_image_refs,
    _guess_image_content_type,
    _is_gcs_uri,
    _merge_extraction_assets,
    _mime_to_extension,
    _normalize_assets,
    persist_extracted_assets,
)


# ---------------------------------------------------------------------------
# _extract_markdown_image_refs
# ---------------------------------------------------------------------------


class TestExtractMarkdownImageRefs:
    def test_extracts_simple_refs(self):
        md = "# Title\n![fig1](img_1.png)\ntext\n![fig2](img_2.jpg)"
        assert _extract_markdown_image_refs(md) == ["img_1.png", "img_2.jpg"]

    def test_extracts_refs_with_relative_path(self):
        md = "![](./images/photo.png)\n![](../assets/chart.svg)"
        assert _extract_markdown_image_refs(md) == ["photo.png", "chart.svg"]

    def test_skips_absolute_urls(self):
        md = (
            "![](https://example.com/img.png)\n"
            "![](data:image/png;base64,abc)\n"
            "![](http://cdn.example.com/pic.jpg)\n"
            "![](blob:https://localhost/uuid)\n"
            "![](local.png)"
        )
        assert _extract_markdown_image_refs(md) == ["local.png"]

    def test_empty_markdown(self):
        assert _extract_markdown_image_refs("") == []
        assert _extract_markdown_image_refs("# No images here\nJust text.") == []

    def test_complex_filenames(self):
        md = "![](img_1_36_20260324_135001.png)\n![alt text](chart-v2_final.webp)"
        assert _extract_markdown_image_refs(md) == [
            "img_1_36_20260324_135001.png",
            "chart-v2_final.webp",
        ]

    def test_preserves_order(self):
        md = "![](c.png)\n![](a.png)\n![](b.png)"
        assert _extract_markdown_image_refs(md) == ["c.png", "a.png", "b.png"]

    def test_alt_text_with_brackets(self):
        md = "![caption [1]](figure.png)"
        # 不匹配 —— 正则只匹配不含 ] 的 alt text
        # 这是有意的简化，不影响实际提取工具生成的 Markdown
        assert _extract_markdown_image_refs(md) == []


# ---------------------------------------------------------------------------
# _mime_to_extension
# ---------------------------------------------------------------------------


class TestMimeToExtension:
    def test_known_types(self):
        assert _mime_to_extension("image/png") == ".png"
        assert _mime_to_extension("image/jpeg") == ".jpg"
        assert _mime_to_extension("image/gif") == ".gif"
        assert _mime_to_extension("image/webp") == ".webp"
        assert _mime_to_extension("image/svg+xml") == ".svg"

    def test_unknown_defaults_to_png(self):
        assert _mime_to_extension("image/unknown") == ".png"
        assert _mime_to_extension("application/octet-stream") == ".png"

    def test_case_insensitive(self):
        assert _mime_to_extension("Image/PNG") == ".png"
        assert _mime_to_extension("IMAGE/JPEG") == ".jpg"


class TestGuessImageContentType:
    def test_known_suffixes(self):
        assert _guess_image_content_type("chart.png") == "image/png"
        assert _guess_image_content_type("chart.jpeg") == "image/jpeg"
        assert _guess_image_content_type("chart.svg") == "image/svg+xml"

    def test_unknown_suffix_defaults_to_octet_stream(self):
        assert _guess_image_content_type("chart.bin") == "application/octet-stream"


# ---------------------------------------------------------------------------
# _extract_image_assets_from_content_items
# ---------------------------------------------------------------------------


class TestExtractImageAssetsFromContentItems:
    def test_extracts_and_matches_by_order(self):
        content_items = [
            SimpleNamespace(type="text", text="# Hello"),
            SimpleNamespace(type="image", data="aGVsbG8=", mimeType="image/png"),
            SimpleNamespace(type="text", text="world"),
            SimpleNamespace(type="image", data="d29ybGQ=", mimeType="image/jpeg"),
        ]
        md = "# Hello\n![](fig1.png)\nworld\n![](fig2.jpg)"

        assets = _extract_image_assets_from_content_items(content_items, md)

        assert len(assets) == 2
        assert assets[0].name == "fig1.png"
        assert assets[0].content_type == "image/png"
        assert assets[0].data_base64 == "aGVsbG8="
        assert assets[1].name == "fig2.jpg"
        assert assets[1].content_type == "image/jpeg"
        assert assets[1].data_base64 == "d29ybGQ="

    def test_fallback_naming_when_more_images_than_refs(self):
        content_items = [
            SimpleNamespace(type="image", data="abc", mimeType="image/png"),
            SimpleNamespace(type="image", data="def", mimeType="image/jpeg"),
        ]
        md = "![](only_one.png)"

        assets = _extract_image_assets_from_content_items(content_items, md)

        assert len(assets) == 2
        assert assets[0].name == "only_one.png"
        assert assets[1].name == "image-content-2.jpg"

    def test_returns_empty_when_no_images(self):
        content_items = [SimpleNamespace(type="text", text="just text")]
        assert _extract_image_assets_from_content_items(content_items, "text") == []

    def test_returns_empty_for_empty_content_items(self):
        assert _extract_image_assets_from_content_items([], "![](img.png)") == []

    def test_skips_image_without_data(self):
        content_items = [
            SimpleNamespace(type="image", data=None, mimeType="image/png"),
            SimpleNamespace(type="image", data="valid", mimeType="image/png"),
        ]
        md = "![](img.png)"
        assets = _extract_image_assets_from_content_items(content_items, md)
        assert len(assets) == 1
        assert assets[0].data_base64 == "valid"
        assert assets[0].name == "img.png"

    def test_skips_image_without_mime_type(self):
        content_items = [
            SimpleNamespace(type="image", data="data123", mimeType=None),
        ]
        assert _extract_image_assets_from_content_items(content_items, "![](x.png)") == []

    def test_fewer_images_than_refs(self):
        content_items = [
            SimpleNamespace(type="image", data="abc", mimeType="image/png"),
        ]
        md = "![](first.png)\n![](second.png)\n![](third.png)"

        assets = _extract_image_assets_from_content_items(content_items, md)
        assert len(assets) == 1
        assert assets[0].name == "first.png"

    def test_real_world_pdf_image_names(self):
        content_items = [
            SimpleNamespace(type="image", data="img1data", mimeType="image/png"),
            SimpleNamespace(type="image", data="img2data", mimeType="image/png"),
        ]
        md = "# PDF Document\n![](img_1_36_20260324_135001.png)\nSome text\n![](img_1_37_20260324_135001.png)"

        assets = _extract_image_assets_from_content_items(content_items, md)
        assert len(assets) == 2
        assert assets[0].name == "img_1_36_20260324_135001.png"
        assert assets[1].name == "img_1_37_20260324_135001.png"


# ---------------------------------------------------------------------------
# _merge_extraction_assets
# ---------------------------------------------------------------------------


class TestMergeExtractionAssets:
    def test_content_images_only(self):
        merged = _merge_extraction_assets(
            [],
            [ExtractionAsset(name="img.png", content_type="image/png", data_base64="abc")],
        )
        assert len(merged) == 1
        assert merged[0].name == "img.png"
        assert merged[0].data_base64 == "abc"

    def test_structured_assets_only(self):
        merged = _merge_extraction_assets(
            [ExtractionAsset(name="img.png", content_type="image/png", data_base64="abc")],
            [],
        )
        assert len(merged) == 1
        assert merged[0].data_base64 == "abc"

    def test_structured_wins_when_both_have_data(self):
        merged = _merge_extraction_assets(
            [ExtractionAsset(name="img.png", content_type="image/png", data_base64="structured")],
            [ExtractionAsset(name="img.png", content_type="image/png", data_base64="content")],
        )
        assert len(merged) == 1
        assert merged[0].data_base64 == "structured"

    def test_backfill_missing_data(self):
        merged = _merge_extraction_assets(
            [ExtractionAsset(name="img.png", content_type="image/png")],
            [ExtractionAsset(name="img.png", content_type="image/png", data_base64="backfill")],
        )
        assert len(merged) == 1
        assert merged[0].data_base64 == "backfill"
        assert merged[0].metadata.get("source") == "content_items_backfill"

    def test_different_names_both_kept(self):
        merged = _merge_extraction_assets(
            [ExtractionAsset(name="a.png", content_type="image/png", data_base64="a")],
            [ExtractionAsset(name="b.png", content_type="image/png", data_base64="b")],
        )
        assert len(merged) == 2
        names = {a.name for a in merged}
        assert names == {"a.png", "b.png"}

    def test_structured_with_uri_not_overwritten(self):
        merged = _merge_extraction_assets(
            [ExtractionAsset(name="img.png", content_type="image/png", uri="gs://bucket/img.png")],
            [ExtractionAsset(name="img.png", content_type="image/png", data_base64="content")],
        )
        assert len(merged) == 1
        assert merged[0].uri == "gs://bucket/img.png"
        assert merged[0].data_base64 is None

    def test_both_empty(self):
        assert _merge_extraction_assets([], []) == []

    def test_multiple_content_images_appended(self):
        merged = _merge_extraction_assets(
            [ExtractionAsset(name="existing.png", content_type="image/png", data_base64="e")],
            [
                ExtractionAsset(name="new1.png", content_type="image/png", data_base64="n1"),
                ExtractionAsset(name="new2.png", content_type="image/png", data_base64="n2"),
            ],
        )
        assert len(merged) == 3
        names = [a.name for a in merged]
        assert names == ["existing.png", "new1.png", "new2.png"]

    def test_backfill_when_structured_has_non_gcs_uri(self):
        """非 GCS URI 时允许用 content_items 数据回填。"""
        merged = _merge_extraction_assets(
            [ExtractionAsset(name="img.png", content_type="image/png", uri="file:///tmp/img.png")],
            [ExtractionAsset(name="img.png", content_type="image/png", data_base64="backfill_data")],
        )
        assert len(merged) == 1
        assert merged[0].data_base64 == "backfill_data"
        assert merged[0].uri == "file:///tmp/img.png"
        assert merged[0].metadata.get("source") == "content_items_backfill"

    def test_backfill_when_structured_has_http_uri(self):
        """HTTP URI 时允许回填。"""
        merged = _merge_extraction_assets(
            [ExtractionAsset(name="img.png", content_type="image/png", uri="https://mcp.example.com/img.png")],
            [ExtractionAsset(name="img.png", content_type="image/png", data_base64="content_data")],
        )
        assert len(merged) == 1
        assert merged[0].data_base64 == "content_data"

    def test_no_backfill_when_structured_has_gcs_uri(self):
        """GCS URI 时不回填。"""
        merged = _merge_extraction_assets(
            [ExtractionAsset(name="img.png", content_type="image/png", uri="gs://bucket/path/img.png")],
            [ExtractionAsset(name="img.png", content_type="image/png", data_base64="should_not_use")],
        )
        assert len(merged) == 1
        assert merged[0].data_base64 is None
        assert merged[0].uri == "gs://bucket/path/img.png"


# ---------------------------------------------------------------------------
# _extract_base64_from_asset & _is_gcs_uri
# ---------------------------------------------------------------------------


class TestExtractBase64FromAsset:
    def test_data_base64_field(self):
        assert _extract_base64_from_asset({"data_base64": "abc"}) == "abc"

    def test_content_base64_field(self):
        assert _extract_base64_from_asset({"content_base64": "def"}) == "def"

    def test_data_field(self):
        assert _extract_base64_from_asset({"data": "ghi"}) == "ghi"

    def test_base64_field(self):
        assert _extract_base64_from_asset({"base64": "jkl"}) == "jkl"

    def test_image_data_field(self):
        assert _extract_base64_from_asset({"image_data": "mno"}) == "mno"

    def test_priority_data_base64_over_data(self):
        assert _extract_base64_from_asset({"data_base64": "winner", "data": "loser"}) == "winner"

    def test_skips_empty_string(self):
        assert _extract_base64_from_asset({"data_base64": "", "data": "fallback"}) == "fallback"

    def test_skips_non_string(self):
        assert _extract_base64_from_asset({"data_base64": 123, "data": "ok"}) == "ok"

    def test_returns_none_when_empty(self):
        assert _extract_base64_from_asset({"uri": "gs://bucket/img.png"}) is None


class TestIsGcsUri:
    def test_gcs_uri(self):
        assert _is_gcs_uri("gs://bucket/path/file.png") is True

    def test_http_uri(self):
        assert _is_gcs_uri("https://example.com/file.png") is False

    def test_file_uri(self):
        assert _is_gcs_uri("file:///tmp/file.png") is False

    def test_none(self):
        assert _is_gcs_uri(None) is False

    def test_empty_string(self):
        assert _is_gcs_uri("") is False


# ---------------------------------------------------------------------------
# _normalize_assets
# ---------------------------------------------------------------------------


class TestNormalizeAssets:
    def test_extracts_data_base64_field(self):
        assets = _normalize_assets([{"name": "img.png", "content_type": "image/png", "data_base64": "abc"}])
        assert assets[0].data_base64 == "abc"

    def test_extracts_data_field(self):
        """MCP ImageContent 标准使用 'data' 字段。"""
        assets = _normalize_assets([{"name": "img.png", "content_type": "image/png", "data": "ghi"}])
        assert assets[0].data_base64 == "ghi"

    def test_extracts_base64_field(self):
        assets = _normalize_assets([{"name": "img.png", "content_type": "image/png", "base64": "jkl"}])
        assert assets[0].data_base64 == "jkl"

    def test_priority_data_base64_over_data(self):
        assets = _normalize_assets([{"name": "img.png", "data_base64": "winner", "data": "loser"}])
        assert assets[0].data_base64 == "winner"

    def test_no_base64_returns_none(self):
        assets = _normalize_assets([{"name": "img.png", "uri": "https://example.com/img.png"}])
        assert assets[0].data_base64 is None
        assert assets[0].uri == "https://example.com/img.png"

    def test_empty_list(self):
        assert _normalize_assets([]) == []

    def test_non_list_returns_empty(self):
        assert _normalize_assets(None) == []
        assert _normalize_assets("not a list") == []


class TestExtractEnhancedImageAssets:
    def test_extracts_assets_from_output_directory(self, tmp_path):
        output_dir = tmp_path / "enhanced"
        output_dir.mkdir()
        image_path = output_dir / "figure-1.png"
        image_path.write_bytes(b"png-data")

        assets = _extract_enhanced_image_assets(
            {
                "enhanced_assets": {
                    "output_directory": str(output_dir),
                    "images": {"files": ["figure-1.png"]},
                }
            }
        )

        assert len(assets) == 1
        assert assets[0].name == "figure-1.png"
        assert assets[0].local_path == str(image_path.resolve())
        assert assets[0].content_type == "image/png"
        assert assets[0].metadata["source"] == "enhanced_output_directory"

    def test_ignores_missing_files(self, tmp_path):
        output_dir = tmp_path / "enhanced"
        output_dir.mkdir()

        assets = _extract_enhanced_image_assets(
            {
                "enhanced_assets": {
                    "output_directory": str(output_dir),
                    "images": {"files": ["missing.png"]},
                }
            }
        )

        assert assets == []

    def test_normalizes_nested_paths_to_basename(self, tmp_path):
        output_dir = tmp_path / "enhanced"
        output_dir.mkdir()
        image_path = output_dir / "figure-2.png"
        image_path.write_bytes(b"png-data")

        assets = _extract_enhanced_image_assets(
            {
                "enhanced_assets": {
                    "output_directory": str(output_dir),
                    "images": {"files": ["nested/figure-2.png"]},
                }
            }
        )

        assert len(assets) == 1
        assert assets[0].name == "figure-2.png"


# ---------------------------------------------------------------------------
# persist_extracted_assets
# ---------------------------------------------------------------------------


class TestPersistExtractedAssets:
    @pytest.mark.asyncio
    async def test_uploads_asset_with_non_gcs_uri_and_data(self):
        """有非 GCS URI 但有 data_base64 时，应上传到 GCS。"""
        doc_id = uuid4()
        asset = ExtractionAsset(
            name="img.png",
            content_type="image/png",
            uri="https://mcp.example.com/temp/img.png",
            data_base64=base64.b64encode(b"fake-png").decode(),
        )

        mock_storage = AsyncMock()
        mock_storage.get_document.return_value = SimpleNamespace(metadata_={})
        mock_storage.upload_extraction_asset.return_value = "gs://bucket/assets/img.png"

        with patch("negentropy.knowledge.extraction.DocumentStorageService", return_value=mock_storage):
            result = await persist_extracted_assets(document_id=doc_id, assets=[asset])

        assert len(result) == 1
        assert result[0]["uri"] == "gs://bucket/assets/img.png"
        mock_storage.upload_extraction_asset.assert_called_once()

    @pytest.mark.asyncio
    async def test_skips_upload_for_gcs_uri(self):
        """已有 GCS URI 时不重复上传。"""
        doc_id = uuid4()
        asset = ExtractionAsset(
            name="img.png",
            content_type="image/png",
            uri="gs://bucket/existing/img.png",
        )

        mock_storage = AsyncMock()
        mock_storage.get_document.return_value = SimpleNamespace(metadata_={})

        with patch("negentropy.knowledge.extraction.DocumentStorageService", return_value=mock_storage):
            result = await persist_extracted_assets(document_id=doc_id, assets=[asset])

        assert result[0]["uri"] == "gs://bucket/existing/img.png"
        mock_storage.upload_extraction_asset.assert_not_called()

    @pytest.mark.asyncio
    async def test_uploads_asset_without_uri(self):
        """无 URI 时正常上传。"""
        doc_id = uuid4()
        asset = ExtractionAsset(
            name="img.png",
            content_type="image/png",
            data_base64=base64.b64encode(b"fake-png").decode(),
        )

        mock_storage = AsyncMock()
        mock_storage.get_document.return_value = SimpleNamespace(metadata_={})
        mock_storage.upload_extraction_asset.return_value = "gs://bucket/assets/img.png"

        with patch("negentropy.knowledge.extraction.DocumentStorageService", return_value=mock_storage):
            result = await persist_extracted_assets(document_id=doc_id, assets=[asset])

        assert result[0]["uri"] == "gs://bucket/assets/img.png"
        mock_storage.upload_extraction_asset.assert_called_once()

    @pytest.mark.asyncio
    async def test_uploads_asset_from_local_path_and_cleans_stale_manifest(self, tmp_path):
        doc_id = uuid4()
        local_file = tmp_path / "img.png"
        local_file.write_bytes(b"fake-png")
        asset = ExtractionAsset(
            name="img.png",
            content_type="image/png",
            local_path=str(local_file),
            metadata={"source": "enhanced_output_directory"},
        )

        mock_storage = AsyncMock()
        mock_storage.get_document.return_value = SimpleNamespace(
            metadata_={
                "extracted_assets": [
                    {"name": "stale.png", "uri": "gs://bucket/assets/stale.png", "content_type": "image/png"}
                ]
            }
        )
        mock_storage.upload_extraction_asset.return_value = "gs://bucket/assets/img.png"

        with patch("negentropy.knowledge.extraction.DocumentStorageService", return_value=mock_storage):
            result = await persist_extracted_assets(document_id=doc_id, assets=[asset])

        assert result == [
            {
                "name": "img.png",
                "content_type": "image/png",
                "uri": "gs://bucket/assets/img.png",
                "source": "enhanced_output_directory",
            }
        ]
        mock_storage.update_document_metadata.assert_awaited_once_with(
            document_id=doc_id,
            metadata_patch={"extracted_assets": result},
        )
        mock_storage.delete_gcs_uri.assert_awaited_once_with(gcs_uri="gs://bucket/assets/stale.png")

    @pytest.mark.asyncio
    async def test_clears_manifest_when_assets_empty(self):
        doc_id = uuid4()
        mock_storage = AsyncMock()
        mock_storage.get_document.return_value = SimpleNamespace(
            metadata_={
                "extracted_assets": [
                    {"name": "stale.png", "uri": "gs://bucket/assets/stale.png", "content_type": "image/png"}
                ]
            }
        )

        with patch("negentropy.knowledge.extraction.DocumentStorageService", return_value=mock_storage):
            result = await persist_extracted_assets(document_id=doc_id, assets=[])

        assert result == []
        mock_storage.update_document_metadata.assert_awaited_once_with(
            document_id=doc_id,
            metadata_patch={"extracted_assets": []},
        )
        mock_storage.delete_gcs_uri.assert_awaited_once_with(gcs_uri="gs://bucket/assets/stale.png")
