"""``assembly`` stage 辅助函数单元测试。

锁定关键回归契约：

1. ``_image_to_markdown``：PDF 管线图片须输出内嵌 HTML ``<img>``，并优先采用
   ``bbox``（PDF 点坐标）作为展示尺寸，与 UI ``DocumentMarkdownRenderer``
   的 ``parsePixelValue()`` 直接对接，避免历史上「原始像素分辨率被当作
   展示宽度，小图被放大到容器宽」的回归。
2. ``_formula_text_signature`` / ``_text_block_matches_formula``：检测
   PyMuPDF 把 LaTeX 视觉渲染区抽成"字符流文本"产生的冗余文本块，
   作为 ``_block_overlaps_special`` 几何检测的语义层兜底。
"""

from __future__ import annotations

import re
from types import SimpleNamespace

from negentropy.perceives.pipeline.models import ExtractedImage
from negentropy.perceives.pipeline.stages.pdf.assembly import (
    _formula_text_signature,
    _image_to_markdown,
    _text_block_matches_formula,
)


class TestImageToMarkdown:
    """``_image_to_markdown`` —— 图片 Markdown 渲染契约。"""

    def test_emits_html_img_with_bbox_display_size(self) -> None:
        """有 ``bbox`` 时应输出 HTML ``<img>``，width/height 由 bbox 尺寸 × 96/72 换算。

        ISSUE-094 R7：PDF 点（72pt = 1in）→ CSS 像素（96px = 1in）换算因子 4/3。
        bbox 宽 35pt → CSS 47px、bbox 高 27pt → CSS 36px。修复前直接把 pt 当
        px 输出导致 figure 在 markdown view 中显示为 PDF 原版尺寸的 75%。
        """
        img = ExtractedImage(
            image_id="img_p0_0",
            filename="img_p0_0.png",
            width=1536,
            height=1024,
            bbox=(72.0, 35.0, 107.0, 62.0),  # PDF 点坐标 35x27 pt 显示尺寸
        )
        out = _image_to_markdown(img)
        assert out.startswith('<img src="./images/img_p0_0.png"')
        assert 'alt="img_p0_0.png"' in out
        # bbox 优先 + 96/72 换算：宽 round(35*4/3)=47 / 高 round(27*4/3)=36
        m_w = re.search(r'width="(\d+)"', out)
        m_h = re.search(r'height="(\d+)"', out)
        assert m_w is not None and int(m_w.group(1)) == 47
        assert m_h is not None and int(m_h.group(1)) == 36
        assert 'style="max-width:100%;height:auto;"' in out
        assert out.endswith("/>")

    def test_falls_back_to_pixel_dims_when_no_bbox(self) -> None:
        """``bbox`` 缺失时退化使用引擎报告的像素分辨率，避免完全丢弃尺寸。

        ``image.width`` / ``image.height`` 是引擎报告的 px 单位，不应再次乘以
        96/72 系数（仅 bbox 的 pt 单位需换算）。
        """
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

    def test_full_width_figure_region_outputs_pixel_width(self) -> None:
        """A4 全宽 figure region（595pt × 730pt）→ PDF pt × 4/3 输出 793 × 973 CSS px。

        ISSUE-094 R9 D-3 修复：之前 ``is_large_figure → width="100%"`` 分支让
        所有全宽 figure 拍扁到容器宽度，丢失 PDF 中半宽 / 全宽 figure 的相对比例
        信息。修复后始终输出 CSS px，配合 ``style="max-width:100%;height:auto"``
        在窄屏自适应，等价于 R7 设计意图。
        """
        img = ExtractedImage(
            image_id="rendered_0_0",
            filename="fig_p1_1.png",
            bbox=(0.0, 0.0, 595.0, 730.0),  # A4 全宽 figure
        )
        out = _image_to_markdown(img)
        # 595 * 4/3 = 793.33 → 793；730 * 4/3 = 973.33 → 973
        assert 'width="793"' in out
        assert 'height="973"' in out
        assert 'width="100%"' not in out
        # 响应式 style 兜底窄屏
        assert 'style="max-width:100%;height:auto;"' in out

    def test_context_engineering_figure1_real_dims_outputs_pixel_width(self) -> None:
        """Context Engineering 2.0 Figure 1 实测尺寸 373pt × 215pt → 497 × 287 CSS px。

        ISSUE-094 R9 D-3 修复：取消 ``is_large_figure`` 阈值判定，统一输出 px。
        """
        img = ExtractedImage(
            image_id="rendered_0_5",
            filename="fig_p1_5.png",
            bbox=(0.0, 0.0, 373.0, 215.0),
        )
        out = _image_to_markdown(img)
        # 373 * 4/3 = 497.33 → 497；215 * 4/3 = 286.67 → 287
        assert 'width="497"' in out
        assert 'height="287"' in out
        assert 'width="100%"' not in out

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


class TestFormulaTextSignature:
    """``_formula_text_signature`` 字符级扁平签名归一化契约。"""

    def test_latex_commands_stripped(self) -> None:
        """``\\theta``/``\\in`` 等 LaTeX 命令被剥除，仅留字母数字。"""
        sig = _formula_text_signature(r"\theta_{long} \in \mathcal{R}")
        # \theta, \in, \mathcal 命令均被剥；保留 long, R
        assert sig == "longr"

    def test_braces_and_punct_dropped(self) -> None:
        sig = _formula_text_signature(r"M _ { l } = f _ { l o n g } ( c )")
        assert sig == "mlflongc"

    def test_unicode_math_chars_dropped(self) -> None:
        sig = _formula_text_signature("M l = f long ( c ∈ C : w > θ l ∧ s)")
        # ∈ θ ∧ 均被丢弃；保留字母数字
        assert sig == "mlflongcCwls".lower()

    def test_latex_and_text_form_equivalent(self) -> None:
        """同一公式 LaTeX 形式 vs PyMuPDF 字符流文本形式签名几乎等价。"""
        latex = (
            r"M _ { l } = f _ { l o n g } \left( c \in C : "
            r"w _ { i m p o r t a n c e } ( c ) > \theta _ { l } "
            r"\wedge w _ { t e m p o r a l } ( c ) \le "
            r"\theta _ { s } \right)\tag{6}"
        )
        text = (
            "M l = f long ( c ∈ C : w importance ( c ) > θ l "
            "∧ w temporal ( c ) ≤ θ s ) ( 6 )"
        )
        sig_latex = _formula_text_signature(latex)
        sig_text = _formula_text_signature(text)
        # PyMuPDF 字符流文本经签名后应包含 LaTeX 签名（完整或前缀子串）
        assert sig_latex in sig_text or sig_text in sig_latex


class TestTextBlockMatchesFormula:
    """``_text_block_matches_formula`` 语义层兜底过滤契约。"""

    def _block(self, text: str, page: int = 0):
        """构造最小化 TextBlock-likes（仅供本测试使用）。"""
        return SimpleNamespace(text=text, page_number=page, bbox=None)

    def test_matches_pymupdf_char_stream_of_formula(self) -> None:
        """PyMuPDF 抽出的公式字符流文本应被识别为冗余。"""
        latex = (
            r"M _ { l } = f _ { l o n g } \left( c \in C : "
            r"w _ { i m p o r t a n c e } ( c ) > \theta _ { l } "
            r"\wedge w _ { t e m p o r a l } ( c ) \le "
            r"\theta _ { s } \right)\tag{6}"
        )
        sig = _formula_text_signature(latex)
        signatures = {0: [sig]}
        block = self._block(
            "M l = f long ( c ∈ C : w importance ( c ) > θ l "
            "∧ w temporal ( c ) ≤ θ s ) ( 6 )"
        )
        assert _text_block_matches_formula(block, signatures) is True

    def test_skips_normal_prose_paragraph(self) -> None:
        """正文段不应被误判为公式字符流。"""
        latex = r"M _ { l } = f _ { l o n g } ( c \in C )\tag{6}"
        signatures = {0: [_formula_text_signature(latex)]}
        block = self._block(
            "where w importance is the importance weight of context "
            "element c, and theta l is the importance threshold for "
            "long-term memory consolidation."
        )
        assert _text_block_matches_formula(block, signatures) is False

    def test_different_page_no_match(self) -> None:
        """公式签名按页索引：跨页文本块不匹配。"""
        latex = r"M _ { l } = f _ { l o n g } ( c \in C )\tag{6}"
        signatures = {3: [_formula_text_signature(latex)]}
        block = self._block("M l = f long ( c ∈ C ) ( 6 )", page=5)
        assert _text_block_matches_formula(block, signatures) is False

    def test_short_signature_skipped(self) -> None:
        """短公式签名 (<20 字符) 不参与匹配，避免假阳性。"""
        # 短公式 ``E = mc^2`` 签名仅 ``emc2`` (4 字符)
        signatures = {0: [_formula_text_signature(r"E = m c ^ 2")]}
        block = self._block("Energy mass conversion E = m c squared formula")
        assert _text_block_matches_formula(block, signatures) is False
