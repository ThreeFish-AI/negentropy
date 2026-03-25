"""ImageContent 提取与 assets 合并逻辑单元测试。

验证 MCP 返回的 ImageContent 能正确转换为 ExtractionAsset，
并与 Markdown 中的图片引用正确匹配。
"""

from types import SimpleNamespace

import pytest

from negentropy.knowledge.extraction import (
    ExtractionAsset,
    _extract_image_assets_from_content_items,
    _extract_markdown_image_refs,
    _merge_extraction_assets,
    _mime_to_extension,
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
        md = (
            "# PDF Document\n"
            "![](img_1_36_20260324_135001.png)\n"
            "Some text\n"
            "![](img_1_37_20260324_135001.png)"
        )

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
