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
        md = "<!-- image -->"
        images = [
            FakeImage(filename="a.png", caption="A"),
            FakeImage(filename="b.png", caption="B"),
        ]
        result = normalize_image_references(md, images)
        assert "![A](./images/a.png)" in result
        assert "b.png" not in result  # 多余图片不引用

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
