"""图片引用规范化模块的单元测试。

覆盖场景：
- ``<!-- image -->`` 占位符替换（单个、多个、按序匹配）
- 占位符与图片数量不匹配的边界 Case
- 已有 ``![alt](path)`` 路径规范化
- base64 data URI 与外部 URL 的安全跳过
- ``DoclingImage`` / ``ExtractedImage`` 协议兼容性
"""

from dataclasses import dataclass
from typing import Optional


from negentropy.perceives.markdown.image_ref_normalizer import (
    ImageMeta,
    normalize_image_references,
)


# ---------------------------------------------------------------------------
# 测试用 Fake 数据类
# ---------------------------------------------------------------------------


@dataclass
class FakeImage:
    """满足 ImageMeta 协议的最小测试桩。"""

    filename: Optional[str] = None
    caption: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    page_number: Optional[int] = None


# ============================================================
# 占位符替换
# ============================================================
class TestReplaceImagePlaceholders:
    """测试 ``<!-- image -->`` 占位符替换。"""

    def test_single_placeholder_replaced(self) -> None:
        md = "Before\n\n<!-- image -->\n\nAfter"
        images = [FakeImage(filename="img_p1_0.png", caption="Figure 1")]
        result = normalize_image_references(md, images)
        assert "![Figure 1](./images/img_p1_0.png)" in result
        assert "<!-- image -->" not in result

    def test_multiple_placeholders_in_order(self) -> None:
        md = "<!-- image -->\ntext\n<!-- image -->"
        images = [
            FakeImage(filename="a.png", caption="A"),
            FakeImage(filename="b.png", caption="B"),
        ]
        result = normalize_image_references(md, images)
        assert "![A](./images/a.png)" in result
        assert "![B](./images/b.png)" in result
        assert result.index("![A]") < result.index("![B]")

    def test_placeholder_with_extra_whitespace(self) -> None:
        md = "<!--  image  -->"
        images = [FakeImage(filename="x.png", caption="X")]
        result = normalize_image_references(md, images)
        assert "![X](./images/x.png)" in result

    def test_more_placeholders_than_images(self) -> None:
        md = "<!-- image -->\n<!-- image -->"
        images = [FakeImage(filename="only.png", caption="Only")]
        result = normalize_image_references(md, images)
        assert "![Only](./images/only.png)" in result
        assert "<!-- image -->" in result  # 第二个保留

    def test_more_images_than_placeholders(self) -> None:
        """多余图片在默认 append_orphans=True 下作为孤儿追加；
        关闭后则不应在文档中出现。"""
        md = "<!-- image -->"
        images = [
            FakeImage(filename="a.png", caption="A"),
            FakeImage(filename="b.png", caption="B"),
        ]
        result_default = normalize_image_references(md, images)
        assert "![A](./images/a.png)" in result_default
        # 默认追加孤儿（Phase 3）
        assert "![B](./images/b.png)" in result_default

        result_no_orphan = normalize_image_references(md, images, append_orphans=False)
        assert "![A](./images/a.png)" in result_no_orphan
        assert "b.png" not in result_no_orphan  # 关闭后多余图片不引用

    def test_no_placeholders_no_change(self) -> None:
        md = "# Title\nSome text"
        result = normalize_image_references(md, [])
        assert result == md

    def test_images_without_filename_skipped(self) -> None:
        md = "<!-- image -->\n<!-- image -->"
        images = [
            FakeImage(filename=None, caption="No file"),
            FakeImage(filename="real.png", caption="Real"),
        ]
        result = normalize_image_references(md, images)
        # filename=None 被过滤，仅 "real.png" 参与匹配第一个占位符
        assert "![Real](./images/real.png)" in result
        assert "<!-- image -->" in result  # 第二个保留

    def test_caption_fallback_to_filename(self) -> None:
        md = "<!-- image -->"
        images = [FakeImage(filename="chart.png", caption=None)]
        result = normalize_image_references(md, images)
        assert "![chart.png](./images/chart.png)" in result

    def test_caption_and_filename_both_none(self) -> None:
        md = "<!-- image -->"
        images = [FakeImage(filename=None, caption=None)]
        result = normalize_image_references(md, images)
        # filename 为 None 被过滤，占位符保留
        assert "<!-- image -->" in result


# ============================================================
# 路径规范化
# ============================================================
class TestNormalizeExistingRefs:
    """测试已有 ``![alt](path)`` 引用的路径规范化。"""

    def test_bare_filename_normalized(self) -> None:
        md = "![fig](img_p1_0.png)"
        images = [FakeImage(filename="img_p1_0.png")]
        result = normalize_image_references(md, images)
        assert "![fig](./images/img_p1_0.png)" in result

    def test_absolute_path_normalized(self) -> None:
        md = "![fig](/tmp/docling_images_xyz/img_p1_0.png)"
        images = [FakeImage(filename="img_p1_0.png")]
        result = normalize_image_references(md, images)
        assert "![fig](./images/img_p1_0.png)" in result

    def test_relative_subdir_path_normalized(self) -> None:
        md = "![fig](output/images/img_p1_0.png)"
        images = [FakeImage(filename="img_p1_0.png")]
        result = normalize_image_references(md, images)
        assert "![fig](./images/img_p1_0.png)" in result

    def test_base64_data_uri_untouched(self) -> None:
        md = "![fig](data:image/png;base64,iVBORw0KGgo=)"
        result = normalize_image_references(md, [])
        assert "data:image/png;base64,iVBORw0KGgo=" in result

    def test_already_normalized_untouched(self) -> None:
        md = "![fig](./images/img_p1_0.png)"
        images = [FakeImage(filename="img_p1_0.png")]
        result = normalize_image_references(md, images)
        assert result.count("./images/img_p1_0.png") == 1

    def test_unknown_filename_untouched(self) -> None:
        md = "![logo](https://example.com/logo.png)"
        images = [FakeImage(filename="img_p1_0.png")]
        result = normalize_image_references(md, images)
        assert "https://example.com/logo.png" in result

    def test_multiple_refs_mixed(self) -> None:
        md = (
            "![a](img_a.png)\n"
            "![b](./images/img_b.png)\n"
            "![c](data:image/png;base64,abc=)\n"
            "![d](/abs/path/img_d.png)\n"
        )
        images = [
            FakeImage(filename="img_a.png"),
            FakeImage(filename="img_b.png"),
            FakeImage(filename="img_d.png"),
        ]
        result = normalize_image_references(md, images)
        assert "![a](./images/img_a.png)" in result
        assert "![b](./images/img_b.png)" in result  # 保持不变
        assert "data:image/png;base64,abc=" in result  # data URI 不动
        assert "![d](./images/img_d.png)" in result


# ============================================================
# 孤儿图追加（Phase 3）
# ============================================================
class TestOrphanImageAppend:
    """落盘图未被 Markdown 引用时，按列表顺序追加到文档末尾。"""

    def test_single_orphan_appended(self) -> None:
        md = "# Doc\n\nSome content."
        images = [FakeImage(filename="fig_p39_1.png", caption="Figure 13: lifecycle")]
        result = normalize_image_references(md, images)
        assert "![Figure 13: lifecycle](./images/fig_p39_1.png)" in result
        assert result.rstrip().endswith("(./images/fig_p39_1.png)")

    def test_referenced_image_not_duplicated(self) -> None:
        md = "# Doc\n\n![a](./images/fig_a.png)"
        images = [FakeImage(filename="fig_a.png", caption="A")]
        result = normalize_image_references(md, images)
        assert result.count("fig_a.png") == 1

    def test_mixed_referenced_and_orphan(self) -> None:
        md = "# Doc\n\n![a](fig_a.png)\n"
        images = [
            FakeImage(filename="fig_a.png", caption="A"),
            FakeImage(filename="fig_b.png", caption="B (orphan)"),
        ]
        result = normalize_image_references(md, images)
        assert "![a](./images/fig_a.png)" in result
        assert "![B (orphan)](./images/fig_b.png)" in result
        # 顺序：a 在 b 之前
        assert result.index("fig_a.png") < result.index("fig_b.png")

    def test_orphan_with_no_caption_uses_filename(self) -> None:
        md = "# Doc"
        images = [FakeImage(filename="orphan.png", caption=None)]
        result = normalize_image_references(md, images)
        assert "![orphan.png](./images/orphan.png)" in result

    def test_append_orphans_disabled(self) -> None:
        md = "# Doc"
        images = [FakeImage(filename="orphan.png", caption="X")]
        result = normalize_image_references(md, images, append_orphans=False)
        assert "orphan.png" not in result

    def test_html_img_tag_counts_as_reference(self) -> None:
        """HTML ``<img src="...">`` 标签应视为已引用，不再作为孤儿重复追加。

        regression: Context Engineering 2.0 论文 — assembly 阶段把所有图渲染为
        ``<img src="./images/xxx.png" width="20" height="22" />`` 形式（承载
        PDF 原始显示尺寸），仅扫描 ``![alt](path)`` markdown 语法会把全部 56
        张图判为孤儿，在末尾整段重复追加，破坏 1:1 还原。
        """
        md = (
            '<img src="./images/fig_a.png" alt="A" width="100" height="50" '
            'style="max-width:100%;height:auto;" />\n\n'
            "Some content.\n"
        )
        images = [FakeImage(filename="fig_a.png", caption="A")]
        result = normalize_image_references(md, images)
        # HTML img 已引用 → 不应作为孤儿再次追加
        assert result.count("fig_a.png") == 1, "HTML img 已引用的图不应被重复追加"
        assert "<!-- orphan images appended" not in result

    def test_html_and_markdown_img_mixed_no_duplicate(self) -> None:
        """同一张图同时以 HTML 和 markdown 形式出现时也不重复追加。"""
        md = (
            '<img src="./images/fig_a.png" alt="A" width="100" height="50" />\n\n'
            "![b](./images/fig_b.png)\n"
        )
        images = [
            FakeImage(filename="fig_a.png", caption="A"),
            FakeImage(filename="fig_b.png", caption="B"),
            FakeImage(filename="fig_c.png", caption="C (real orphan)"),
        ]
        result = normalize_image_references(md, images)
        assert result.count("fig_a.png") == 1
        assert result.count("fig_b.png") == 1
        # 真正未引用的孤儿 fig_c 才追加
        assert "![C (real orphan)](./images/fig_c.png)" in result

    def test_html_img_with_api_path_counts_as_reference(self) -> None:
        """HTML ``src`` 含 ``/api/...`` 绝对路径时按 basename 匹配。

        backend 中可能把图片路径重写为 ``/api/documents/<id>/assets/<basename>``，
        normalizer 必须能识别这类引用，避免在末尾追加重复孤儿引用。
        """
        md = (
            '<img src="/api/documents/abc-123/assets/img_0_0_20260525.png" '
            'alt="x" width="20" height="22" />\n'
        )
        images = [FakeImage(filename="img_0_0_20260525.png", caption="x")]
        result = normalize_image_references(md, images)
        assert "<!-- orphan images appended" not in result


# ============================================================
# page-dominant 同页 orphan 抑制
# ============================================================
class TestPageDominantOrphanSuppression:
    """封面/整页插图页：全页大图已引用时，抑制同页冗余 orphan 碎片。"""

    def test_cover_fragment_orphans_suppressed(self) -> None:
        """封面全页图(816x1056)已引用，同页 2 张碎片 orphan 不再追加。"""
        md = (
            '<img src="./images/img_0_0.png" alt="cover" '
            'width="816" height="1056" style="max-width:100%;height:auto;" />'
        )
        images = [
            FakeImage(
                filename="img_0_0.png",
                caption="cover",
                width=816,
                height=1056,
                page_number=0,
            ),
            FakeImage(filename="fig_p1_1.png", caption=None, page_number=0),
            FakeImage(filename="fig_p1_2.png", caption=None, page_number=0),
        ]
        result = normalize_image_references(md, images)
        assert "<!-- orphan images appended" not in result
        assert "fig_p1_1.png" not in result
        assert "fig_p1_2.png" not in result
        # 主图保留
        assert "img_0_0.png" in result

    def test_content_figure_preserved_not_page_dominant(self) -> None:
        """正文 figure(167k < 500k 阈值)非 page-dominant，同页 orphan 不抑制。"""
        md = (
            '<img src="./images/fig_p14_1.png" alt="图1.1" '
            'width="457" height="365" style="max-width:100%;height:auto;" />'
        )
        images = [
            FakeImage(
                filename="fig_p14_1.png",
                caption="图1.1",
                width=457,
                height=365,
                page_number=13,
            ),
            FakeImage(filename="fig_p14_2.png", caption=None, page_number=13),
        ]
        result = normalize_image_references(md, images)
        # 非主导图页：fig_p14_2 作为正常 orphan 仍追加
        assert "<!-- orphan images appended" in result
        assert "fig_p14_2.png" in result

    def test_no_page_number_is_noop(self) -> None:
        """page_number 缺失时安全降级，保留既有 orphan 追加行为。"""
        md = '<img src="./images/big.png" alt="x" width="816" height="1056" />'
        images = [
            FakeImage(
                filename="big.png", caption="x", width=816, height=1056
            ),  # page_number=None
            FakeImage(filename="frag.png", caption=None),  # page_number=None
        ]
        result = normalize_image_references(md, images)
        # 无页码维度无法安全抑制 → frag.png 仍作为 orphan 追加（不丢图）
        assert "<!-- orphan images appended" in result
        assert "frag.png" in result

    def test_orphan_on_different_page_not_suppressed(self) -> None:
        """orphan 与 dominant 图不同页时不抑制（多页文档）。"""
        md = '<img src="./images/cover.png" alt="cover" width="816" height="1056" />'
        images = [
            FakeImage(
                filename="cover.png",
                caption="cover",
                width=816,
                height=1056,
                page_number=0,
            ),
            FakeImage(filename="other.png", caption=None, page_number=5),
        ]
        result = normalize_image_references(md, images)
        # other.png 在第 5 页，不受第 0 页 dominant 影响 → 正常追加
        assert "<!-- orphan images appended" in result
        assert "other.png" in result


# ============================================================
# 空输入与边界
# ============================================================
class TestEdgeCases:
    """边界条件与空输入。"""

    def test_empty_markdown(self) -> None:
        assert normalize_image_references("", []) == ""

    def test_empty_images_list(self) -> None:
        md = "# Title\n![fig](some.png)"
        result = normalize_image_references(md, [])
        # 无已知图片，引用原样保留
        assert "![fig](some.png)" in result

    def test_custom_image_dir(self) -> None:
        md = "<!-- image -->\n![fig](img.png)"
        images = [FakeImage(filename="img.png", caption="Img")]
        result = normalize_image_references(md, images, image_dir="./assets")
        assert "![Img](./assets/img.png)" in result
        assert "![fig](./assets/img.png)" in result

    def test_combined_placeholders_and_refs(self) -> None:
        md = "<!-- image -->\nSome text\n![existing](img_p2_0.png)"
        images = [
            FakeImage(filename="img_p1_0.png", caption="First"),
            FakeImage(filename="img_p2_0.png", caption="Second"),
        ]
        result = normalize_image_references(md, images)
        assert "![First](./images/img_p1_0.png)" in result
        assert "![existing](./images/img_p2_0.png)" in result


# ============================================================
# 协议兼容性
# ============================================================
class TestProtocolCompatibility:
    """验证真实数据类满足 ImageMeta 协议。"""

    def test_docling_image_satisfies_protocol(self) -> None:
        from negentropy.perceives.pdf.docling_engine import DoclingImage

        img = DoclingImage(filename="test.png", caption="Test")
        assert isinstance(img, ImageMeta)

    def test_extracted_image_satisfies_protocol(self) -> None:
        from negentropy.perceives.pdf.enhanced import ExtractedImage

        img = ExtractedImage(id="i1", filename="test.png", local_path="/tmp/test.png")
        assert isinstance(img, ImageMeta)
