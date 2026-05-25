"""``assembly`` stage 辅助函数单元测试。

锁定关键回归契约：

1. ``_image_to_markdown``：PDF 管线图片须输出内嵌 HTML ``<img>``，并优先采用
   ``bbox``（PDF 点坐标）作为展示尺寸，与 UI ``DocumentMarkdownRenderer``
   的 ``parsePixelValue()`` 直接对接，避免历史上「原始像素分辨率被当作
   展示宽度，小图被放大到容器宽」的回归。
"""

from __future__ import annotations

import re

from negentropy.perceives.pipeline.models import ExtractedImage
from negentropy.perceives.pipeline.stages.pdf.assembly import _image_to_markdown


class TestImageToMarkdown:
    """``_image_to_markdown`` —— 图片 Markdown 渲染契约。"""

    def test_emits_html_img_with_bbox_display_size(self) -> None:
        """有 ``bbox`` 时应输出 HTML ``<img>``，width/height 取 bbox 尺寸。"""
        img = ExtractedImage(
            image_id="img_p0_0",
            filename="img_p0_0.png",
            width=1536,
            height=1024,
            bbox=(72.0, 35.0, 107.0, 62.0),  # PDF 点坐标 35x27 显示尺寸
        )
        out = _image_to_markdown(img)
        assert out.startswith('<img src="./images/img_p0_0.png"')
        assert 'alt="img_p0_0.png"' in out
        # bbox 优先：宽 35 / 高 27，而非原始像素 1536x1024
        m_w = re.search(r'width="(\d+)"', out)
        m_h = re.search(r'height="(\d+)"', out)
        assert m_w is not None and int(m_w.group(1)) == 35
        assert m_h is not None and int(m_h.group(1)) == 27
        assert 'style="max-width:100%;height:auto;"' in out
        assert out.endswith("/>")

    def test_falls_back_to_pixel_dims_when_no_bbox(self) -> None:
        """``bbox`` 缺失时退化使用引擎报告的像素分辨率，避免完全丢弃尺寸。"""
        img = ExtractedImage(
            image_id="img_x",
            filename="fig.png",
            width=320,
            height=180,
            bbox=None,
        )
        out = _image_to_markdown(img)
        assert 'width="320"' in out
        assert 'height="180"' in out
        # 仍是 HTML 形式，便于 UI 端 parsePixelValue 读取
        assert out.startswith("<img ")

    def test_degrades_to_markdown_syntax_when_no_dims(self) -> None:
        """既无 bbox 又无 width/height 时降级为标准 Markdown ``![alt](src)``。"""
        img = ExtractedImage(
            image_id="img_y",
            filename="bare.png",
            width=None,
            height=None,
            bbox=None,
        )
        out = _image_to_markdown(img)
        assert out == "![bare.png](./images/bare.png)"

    def test_html_escapes_alt_and_src(self) -> None:
        """caption 含 HTML 元字符时必须被实体化，防止破坏后续 Markdown 渲染。"""
        img = ExtractedImage(
            image_id="img_z",
            filename="img.png",
            caption='Figure 1: A & B "comparison" <study>',
            bbox=(0.0, 0.0, 100.0, 50.0),
        )
        out = _image_to_markdown(img)
        # & < > " 都应被 entity 化
        assert "&amp;" in out
        assert "&lt;study&gt;" in out
        assert "&quot;comparison&quot;" in out
        # 但 src 中无元字符，不应包含未转义字符
        assert 'src="./images/img.png"' in out

    def test_bbox_zero_size_falls_back_to_pixel_dims(self) -> None:
        """异常 bbox（宽或高为零）应回退到像素尺寸，避免输出 ``width="0"``。"""
        img = ExtractedImage(
            image_id="img_q",
            filename="weird.png",
            width=200,
            height=120,
            bbox=(50.0, 50.0, 50.0, 100.0),  # 宽度=0
        )
        out = _image_to_markdown(img)
        assert 'width="200"' in out
        assert 'height="120"' in out

    def test_caption_used_as_alt_when_present(self) -> None:
        """有 caption 优先作为 alt 文本，便于无障碍/SEO。"""
        img = ExtractedImage(
            image_id="img_p",
            filename="overview.png",
            caption="Figure 1: Overview",
            bbox=(0.0, 0.0, 300.0, 200.0),
        )
        out = _image_to_markdown(img)
        assert 'alt="Figure 1: Overview"' in out
