"""``assembly._image_to_markdown`` —— 图片像素尺寸输出单元测试。

锁定 R9 D3 修复契约：之前的 ``is_large_figure → width="100%"`` 分支让所有
全宽 figure 在 markdown 中拍扁到容器宽度（``width="100%"``），与 PDF 原版
中半宽 / 全宽 figure 的相对比例丢失。R9 修复后**始终输出 CSS 像素值**
（PDF pt × 4/3），配合 ``style="max-width:100%;height:auto"`` CSS 实现
「PDF 原版尺寸 + 窄屏自适应」双赢。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.models import ExtractedImage
from negentropy.perceives.pipeline.stages.pdf.assembly import _image_to_markdown


def _img(
    bbox=None,
    width=None,
    height=None,
    filename="figure_1.png",
    caption=None,
) -> ExtractedImage:
    return ExtractedImage(
        image_id="t",
        filename=filename,
        local_path=None,
        page_number=0,
        bbox=bbox,
        width=width,
        height=height,
        caption=caption,
    )


class TestImageToMarkdownPixelSize:
    """``_image_to_markdown`` —— bbox / fallback 尺寸输出契约。"""

    def test_large_figure_outputs_pixel_width_not_percent(self) -> None:
        """全宽 PDF figure（500pt × 300pt）→ 输出 666×400 CSS px，不是 ``width="100%"``。"""
        out = _image_to_markdown(_img(bbox=(0, 0, 500, 300)))
        # PDF pt × 4/3：500 * 4/3 = 666.67 → 667
        assert 'width="667"' in out
        assert 'height="400"' in out
        assert 'width="100%"' not in out

    def test_small_figure_outputs_pixel_width(self) -> None:
        """小 figure（80pt × 60pt icon）→ 输出 107×80 CSS px。"""
        out = _image_to_markdown(_img(bbox=(0, 0, 80, 60)))
        assert 'width="107"' in out
        assert 'height="80"' in out

    def test_full_a4_width_figure_still_pixels(self) -> None:
        """A4 全页宽（595pt）→ 793 px（绝不再 ``width="100%"``）。"""
        out = _image_to_markdown(_img(bbox=(0, 0, 595, 400)))
        assert 'width="793"' in out
        assert 'width="100%"' not in out

    def test_responsive_style_always_present(self) -> None:
        """所有 px 输出都附带 ``style="max-width:100%;height:auto"`` 兜底窄屏。"""
        out = _image_to_markdown(_img(bbox=(0, 0, 595, 400)))
        assert 'style="max-width:100%;height:auto;"' in out

    def test_fallback_to_image_width_when_no_bbox(self) -> None:
        """无 bbox → 退化到 image.width / height（已是 px 单位）。"""
        out = _image_to_markdown(_img(width=320, height=240))
        assert 'width="320"' in out
        assert 'height="240"' in out

    def test_no_size_info_falls_back_to_markdown_syntax(self) -> None:
        """无 bbox / width / height → 退化为 markdown ``![alt](src)`` 简写。"""
        out = _image_to_markdown(_img(filename="x.png"))
        assert out.startswith("![") and out.endswith(")")
        assert "<img" not in out

    def test_caption_used_as_alt(self) -> None:
        """有 caption → alt 文本用 caption。"""
        out = _image_to_markdown(_img(bbox=(0, 0, 100, 80), caption="Figure 1: Foo"))
        assert 'alt="Figure 1: Foo"' in out
