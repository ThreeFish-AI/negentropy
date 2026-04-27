"""ResourceLink 处理与 Markdown 链接重写单元测试。

验证：
- ``_extract_resource_link_assets`` 把 MCP ResourceLink 与同会话拉取的资源载荷
  正确组装为 ExtractionAsset；
- ``_rewrite_markdown_image_links`` 把相对路径图片引用重写为后端代理 URL，
  且不影响绝对 URL / data URI / 失败占位的引用；
- 部分失败容错（``resource_read_failed`` 占位）保留原始 Markdown 引用。
"""

from types import SimpleNamespace
from uuid import UUID

from negentropy.knowledge.extraction import (
    ExtractionAsset,
    _extract_resource_link_assets,
    _rewrite_markdown_image_links,
)

# ---------------------------------------------------------------------------
# _extract_resource_link_assets
# ---------------------------------------------------------------------------


class TestExtractResourceLinkAssets:
    def test_pairs_resource_link_with_resolved_blob(self):
        link = SimpleNamespace(
            type="resource_link",
            uri="perceives://pdf/abc/img1.png",
            mimeType="image/png",
            name=None,
        )
        markdown = "Hello\n![](img1.png)"
        resolved = {
            "perceives://pdf/abc/img1.png": SimpleNamespace(
                uri="perceives://pdf/abc/img1.png",
                mime_type="image/png",
                blob_base64="ZmFrZV9wbmdfYmFzZTY0",
                text=None,
            )
        }

        assets = _extract_resource_link_assets([link], markdown, resolved)

        assert len(assets) == 1
        a = assets[0]
        assert a.name == "img1.png"
        assert a.content_type == "image/png"
        assert a.data_base64 == "ZmFrZV9wbmdfYmFzZTY0"
        assert a.metadata["source"] == "resource_link"
        assert a.metadata["origin_uri"] == "perceives://pdf/abc/img1.png"
        assert "resource_read_failed" not in a.metadata

    def test_marks_failed_pull_as_placeholder(self):
        link = SimpleNamespace(
            type="resource_link",
            uri="perceives://pdf/abc/lost.png",
            mimeType="image/png",
            name=None,
        )
        # resolved 中无该 URI，模拟拉取失败
        assets = _extract_resource_link_assets([link], "![](lost.png)", {})

        assert len(assets) == 1
        a = assets[0]
        assert a.name == "lost.png"
        assert a.data_base64 is None
        assert a.local_path is None
        assert a.metadata.get("resource_read_failed") is True

    def test_falls_back_to_link_name_when_no_markdown_ref(self):
        link = SimpleNamespace(
            type="resource_link",
            uri="perceives://pdf/abc/odd.png",
            mimeType="image/png",
            name="custom-name.png",
        )
        markdown = "no images at all"
        resolved = {
            "perceives://pdf/abc/odd.png": SimpleNamespace(
                uri="perceives://pdf/abc/odd.png",
                mime_type="image/png",
                blob_base64="QkFTRTY0",
                text=None,
            )
        }

        assets = _extract_resource_link_assets([link], markdown, resolved)

        assert len(assets) == 1
        assert assets[0].name == "custom-name.png"

    def test_falls_back_to_indexed_name_when_no_metadata(self):
        link = SimpleNamespace(
            type="resource_link",
            uri="perceives://pdf/abc/x",
            mimeType="image/jpeg",
            name=None,
        )
        assets = _extract_resource_link_assets([link], "no images", {})

        assert len(assets) == 1
        # 兜底命名：resource-1.jpg（_mime_to_extension）
        assert assets[0].name.startswith("resource-1")
        assert assets[0].name.endswith(".jpg")

    def test_skips_non_resource_link_items(self):
        items = [
            SimpleNamespace(type="text", text="hello"),
            SimpleNamespace(type="image", data="abc", mimeType="image/png"),
        ]
        assets = _extract_resource_link_assets(items, "![](x.png)", {})
        assert assets == []

    def test_preserves_order_via_markdown_refs(self):
        links = [
            SimpleNamespace(
                type="resource_link",
                uri="perceives://pdf/abc/a.png",
                mimeType="image/png",
                name=None,
            ),
            SimpleNamespace(
                type="resource_link",
                uri="perceives://pdf/abc/b.png",
                mimeType="image/png",
                name=None,
            ),
        ]
        markdown = "![](first.png) and ![](second.png)"
        resolved = {
            "perceives://pdf/abc/a.png": SimpleNamespace(
                uri="perceives://pdf/abc/a.png",
                mime_type="image/png",
                blob_base64="QQ==",
                text=None,
            ),
            "perceives://pdf/abc/b.png": SimpleNamespace(
                uri="perceives://pdf/abc/b.png",
                mime_type="image/png",
                blob_base64="Qg==",
                text=None,
            ),
        }
        assets = _extract_resource_link_assets(links, markdown, resolved)
        assert [a.name for a in assets] == ["first.png", "second.png"]


# ---------------------------------------------------------------------------
# _rewrite_markdown_image_links
# ---------------------------------------------------------------------------


_DOC_ID = UUID("00000000-0000-0000-0000-000000000123")


def _asset(name: str, *, with_data: bool = True, failed: bool = False) -> ExtractionAsset:
    return ExtractionAsset(
        name=name,
        content_type="image/png",
        data_base64="QQ==" if with_data else None,
        metadata={"resource_read_failed": True} if failed else {},
    )


class TestRewriteMarkdownImageLinks:
    def test_rewrites_relative_path_when_asset_available(self):
        md = "Title\n![](img1.png)\nMore."
        out = _rewrite_markdown_image_links(
            markdown_content=md,
            assets=[_asset("img1.png")],
            document_id=_DOC_ID,
        )
        assert "![](/api/documents/00000000-0000-0000-0000-000000000123/assets/img1.png)" in out

    def test_keeps_http_url_unchanged(self):
        md = "![](https://example.com/img.png)\n![](img1.png)"
        out = _rewrite_markdown_image_links(
            markdown_content=md,
            assets=[_asset("img1.png")],
            document_id=_DOC_ID,
        )
        assert "https://example.com/img.png" in out
        assert "/api/documents/00000000-0000-0000-0000-000000000123/assets/img1.png" in out

    def test_keeps_data_uri_unchanged(self):
        md = "![](data:image/png;base64,abcd)"
        out = _rewrite_markdown_image_links(
            markdown_content=md,
            assets=[_asset("abcd")],
            document_id=_DOC_ID,
        )
        assert "data:image/png;base64,abcd" in out

    def test_keeps_absolute_path_unchanged(self):
        md = "![](/already/absolute.png)"
        out = _rewrite_markdown_image_links(
            markdown_content=md,
            assets=[_asset("absolute.png")],
            document_id=_DOC_ID,
        )
        assert md == out

    def test_does_not_rewrite_when_asset_failed(self):
        md = "![](img1.png)"
        out = _rewrite_markdown_image_links(
            markdown_content=md,
            assets=[_asset("img1.png", with_data=False, failed=True)],
            document_id=_DOC_ID,
        )
        # 失败 asset 保留原始引用作占位
        assert out == md

    def test_does_not_rewrite_when_asset_missing(self):
        md = "![](unknown.png)"
        out = _rewrite_markdown_image_links(
            markdown_content=md,
            assets=[_asset("img1.png")],
            document_id=_DOC_ID,
        )
        assert out == md

    def test_strips_relative_dir_prefix(self):
        md = "![](attachments/img1.png)"
        out = _rewrite_markdown_image_links(
            markdown_content=md,
            assets=[_asset("img1.png")],
            document_id=_DOC_ID,
        )
        assert "/api/documents/00000000-0000-0000-0000-000000000123/assets/img1.png" in out

    def test_empty_markdown_passthrough(self):
        assert (
            _rewrite_markdown_image_links(
                markdown_content="",
                assets=[_asset("img1.png")],
                document_id=_DOC_ID,
            )
            == ""
        )

    def test_no_assets_passthrough(self):
        md = "![](img1.png)"
        assert (
            _rewrite_markdown_image_links(
                markdown_content=md,
                assets=[],
                document_id=_DOC_ID,
            )
            == md
        )

    def test_does_not_replace_inside_alt_text(self):
        """alt 文本恰好含与 src 同名的子串时，仅 src 被替换，alt 保留原样。

        回归保护：早期实现用 ``full.replace(src, ..., 1)`` 会先命中 alt 的
        同名子串，导致 src 反而保留原始相对路径。
        """
        md = "![img1.png](img1.png)"
        out = _rewrite_markdown_image_links(
            markdown_content=md,
            assets=[_asset("img1.png")],
            document_id=_DOC_ID,
        )
        # alt 文本保留 "img1.png"，src 被替换为代理 URL
        assert out == "![img1.png](/api/documents/00000000-0000-0000-0000-000000000123/assets/img1.png)"
