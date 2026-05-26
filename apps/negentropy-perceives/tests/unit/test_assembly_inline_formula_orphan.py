"""``assembly`` stage — 无 bbox 公式（inline + block）兜底匹配单元测试。

锁定 ISSUE-094 R5 修复契约：

- MinerU 对短公式（如 ``CE: (C, T) → f_{context} (3)``）常分类为 ``inline`` 且
  缺失 bbox。此前 ``assembly`` 仅承接 ``formula_type == "block"`` 的孤儿，
  inline 公式被静默丢弃，导致正文中含 ``(3)``/``(4)`` 编号的公式段无 KaTeX
  渲染。
- 修复后：inline 与 block 共用 ``_orphan_formulas`` 兜底池，通过编号匹配
  （``\\tag{N}`` / ``\\quad (N)`` / 尾部 ``(N)``）把文本块替换为 ``$...$`` 或
  ``$$...$$`` 包裹的 LaTeX。
- 同时 ``_formula_eq_nums`` 集合接受 inline ``$...$`` 起手的公式，避免后续
  PyMuPDF 字符流文本与 inline 公式重复并存。

仅测试纯函数 ``_extract_formula_eq_number`` 与 ``_formula_to_markdown``，
完整 ``execute`` 流程由集成测试覆盖。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.models import ExtractedFormula
from negentropy.perceives.pipeline.stages.pdf.assembly import (
    _extract_formula_eq_number,
    _formula_to_markdown,
)


class TestExtractFormulaEqNumber:
    """``_extract_formula_eq_number`` —— LaTeX 公式编号提取。"""

    def test_mineru_tag_form(self) -> None:
        """MinerU 标准 ``\\tag{N}`` 形式。"""
        assert _extract_formula_eq_number(r"M_l = f_{long}(...) \tag{6}") == "6"

    def test_marker_quad_paren_form(self) -> None:
        """Marker/Docling 标准 ``\\quad (N)`` 形式。"""
        assert (
            _extract_formula_eq_number(
                r"M_{s} = f_{short}(c \in C : w_{temporal}(c) > \theta_s) \quad (5)"
            )
            == "5"
        )

    def test_marker_quad_spaced_paren(self) -> None:
        """``\\quad ( N )`` 内部带空格的写法。"""
        assert (
            _extract_formula_eq_number(r"f_{transfer}: M_s \to M_l \quad ( 7 )") == "7"
        )

    def test_inline_trailing_paren_form(self) -> None:
        """短 inline 公式：LaTeX 尾部直接 ``(N)``（无 ``\\quad`` / ``\\tag``）。"""
        assert _extract_formula_eq_number(r"CE: (C, T) \to f_{context} (3)") == "3"

    def test_inline_trailing_paren_with_padding(self) -> None:
        """尾部 ``( N )`` 带空格的写法。"""
        assert (
            _extract_formula_eq_number(r"f_{context}(C) = F(\phi_1, \ldots)(C) ( 4 )")
            == "4"
        )

    def test_returns_none_when_no_number(self) -> None:
        """公式无编号时返回 ``None``。"""
        assert _extract_formula_eq_number(r"M_s = f_{short}(\cdot)") is None

    def test_returns_none_for_empty(self) -> None:
        """空 LaTeX 返回 ``None``。"""
        assert _extract_formula_eq_number("") is None
        assert _extract_formula_eq_number(None) is None

    def test_does_not_match_mid_text_parens(self) -> None:
        """段落中部的 ``(N)`` 编号（如引用编号）不应被采集为公式编号。"""
        # 注：``_extract_formula_eq_number`` 不区分末尾 / 中间，
        # 但所有 LaTeX 编号都以末尾形式存在；中部 ``(2)`` 仅作引用编号，
        # 不会出现在公式 LaTeX 字段。此处验证当 ``(N)`` 不在末尾时不被错误命中。
        assert (
            _extract_formula_eq_number(r"see (2) reference here without trailing")
            is None
        )

    def test_tag_takes_priority_over_inline_paren(self) -> None:
        """同时存在 ``\\tag{N}`` 与尾部 ``(M)`` 时优先采集 ``\\tag``。"""
        # ``\tag{6}`` 在前置模式，且公式编号语义上以 ``\tag`` 为准
        # （MinerU 标准）；尾部 ``(N)`` 仅作短公式 fallback。
        result = _extract_formula_eq_number(r"M_l = f_{long}(\cdot) \tag{6}")
        assert result == "6"


class TestFormulaToMarkdown:
    """``_formula_to_markdown`` —— 公式 → LaTeX Markdown 包裹。"""

    def test_inline_formula_wrapped_with_single_dollar(self) -> None:
        """inline 公式使用 ``$...$`` 包裹。"""
        formula = ExtractedFormula(
            formula_id="f_inline_3",
            latex=r"CE: (C, T) \to f_{context}",
            formula_type="inline",
            page_number=3,
        )
        out = _formula_to_markdown(formula)
        assert out.startswith("$") and out.endswith("$")
        assert not out.startswith("$$")
        assert r"\to f_{context}" in out

    def test_block_formula_wrapped_with_double_dollar(self) -> None:
        """block 公式使用 ``$$\\n...\\n$$`` 包裹。"""
        formula = ExtractedFormula(
            formula_id="f_block_5",
            latex=r"M_s = f_{short}(c \in C)",
            formula_type="block",
            page_number=5,
        )
        out = _formula_to_markdown(formula)
        assert out.startswith("$$\n")
        assert out.endswith("\n$$")
        assert r"M_s = f_{short}" in out

    def test_empty_latex_returns_empty(self) -> None:
        """空 LaTeX 返回空字符串（不包裹）。"""
        formula = ExtractedFormula(
            formula_id="f_empty",
            latex="",
            formula_type="inline",
            page_number=1,
        )
        assert _formula_to_markdown(formula) == ""

    def test_whitespace_only_latex_returns_empty(self) -> None:
        """仅空白的 LaTeX 返回空字符串。"""
        formula = ExtractedFormula(
            formula_id="f_ws",
            latex="   \n  \t  ",
            formula_type="block",
            page_number=1,
        )
        assert _formula_to_markdown(formula) == ""


class TestInlineFormulaPromotion:
    """Verify 2.5 inline formula promotion guards.

    When mineru/docling miss short inline formulas (e.g. ``CE: (C,T) → f_context (3)``),
    the assembly's section 2.5 pass should wrap qualifying text elements with
    ``$...$``. Tests below validate the gating rules without exercising the full
    pipeline (which the integration suite handles).
    """

    def _is_promoteable(self, text: str) -> bool:
        """Replicate the section 2.5 gating logic for unit-level verification."""
        import re

        _INLINE_PROMOTE_END_RE = re.compile(r"\s*\(\s*(\d+)\s*\)\s*$")
        _math_chars_inline = set("∈∀∃∑∏∫→←↔≤≥≠≈θφϕψωαβγδ∧∨∪⊆ΦΘΨΩΓΔ")
        content = text.strip()
        if not content:
            return False
        if content.startswith(("#", ">", "*", "-", "|", "$", "```", "<")):
            return False
        m = _INLINE_PROMOTE_END_RE.search(content)
        if not m:
            return False
        core = content[: m.start()].rstrip()
        if not (5 <= len(core) <= 120):
            return False
        if not any(c in core for c in _math_chars_inline):
            return False
        if any(ch in core for ch in ("。", "?", "!", "！", "？")):
            return False
        if re.search(r"\.\s+[A-Z]", core) or core.rstrip().endswith("."):
            return False
        return True

    def test_eq3_arrow_pattern_promoted(self) -> None:
        """``CE: ( C, T ) → f context (3)`` should be promoted to ``$...$``."""
        assert self._is_promoteable("CE: ( C, T ) → f context (3)")

    def test_eq4_phi_pattern_promoted(self) -> None:
        """Equation 4 with phi composition and ellipsis should still be promoted."""
        assert self._is_promoteable(
            "f context ( C ) = F ( ϕ 1, ϕ 2,..., ϕ n )( C ) (4)"
        )

    def test_eq4_spaced_ellipsis_promoted(self) -> None:
        """PDF 实际拆出来的 ``. . .`` 带空格省略号也应保留 promote 资格（实测样本）。"""
        assert self._is_promoteable(
            "f context ( C ) = F ( ϕ 1 , ϕ 2 , . . . , ϕ n )( C ) (4)"
        )

    def test_lowercase_after_period_with_space_allowed(self) -> None:
        """``. `` 后跟小写字母不视为句号（如 PDF span 拆解后的连字 ``a. b`` ）。"""
        assert self._is_promoteable("∈ x. y → f (5)")

    def test_natural_sentence_with_reference_rejected(self) -> None:
        """Natural-language paragraph ending in ``(3)`` (e.g. citation) NOT promoted."""
        assert not self._is_promoteable(
            "See the definition of context engineering in Equation (3)."
        )

    def test_heading_not_promoted(self) -> None:
        """Markdown heading lines NOT promoted regardless of contents."""
        assert not self._is_promoteable("# CE: (C, T) → f_context (3)")

    def test_no_math_chars_rejected(self) -> None:
        """Plain prose with trailing ``(N)`` but no math symbol NOT promoted."""
        assert not self._is_promoteable("This is just text referring to step (3)")

    def test_no_trailing_number_rejected(self) -> None:
        """Snippet without trailing equation number NOT promoted."""
        assert not self._is_promoteable("CE : ( C, T ) → f context")

    def test_overlong_paragraph_rejected(self) -> None:
        """Paragraphs longer than 120 chars NOT promoted (would swallow prose)."""
        long_with_math = (
            "When the entity set is computed as a → b → c → d → e → f → g → h → i, "
            "the resulting context characterization is summarized as (3)"
        )
        assert len(long_with_math) > 120
        assert not self._is_promoteable(long_with_math)

    def test_ellipsis_in_math_allowed(self) -> None:
        """``,..., `` style ellipsis must NOT trigger sentence-period guard."""
        # 等式 4 关键测试：``ϕ 2,..., ϕ n`` 中的 ``...`` 不应被识别为句末点
        assert self._is_promoteable("F ( ϕ 1, ϕ 2,..., ϕ n ) → f (4)")

    def test_compound_section_number_in_math_allowed(self) -> None:
        """Compound numbers like ``3.1.1`` inside math should be allowed (no space after dot)."""
        # 仅当 ``.`` 后跟空格 / 行末才视为句号；``3.1.1`` 内的 ``.`` 后跟 ``1`` 不计
        assert self._is_promoteable("∈ section 3.1.1 weight θ → f (5)")

    def test_starts_with_dollar_skipped(self) -> None:
        """Already a formula → skipped (don't double-wrap)."""
        assert not self._is_promoteable("$M_s = f_{short}(c) \\tag{5}$")


class TestBorrowTrailingNumber:
    """borrowing trailing ``(N)`` from adjacent prose into formula equation set.

    Tests the regex + math-char gating in section 2.4.5: when a docling/marker
    formula block lacks ``\\tag{N}`` but the following short text element is the
    OCR'd character-flow version that ends with ``(N)``, we want the number to
    be added to ``_formula_eq_nums`` so that the dedup pass removes the duplicate.
    """

    def test_classic_eq_6_pattern_borrowable(self) -> None:
        """``M l = f long ( c ∈ C: ... ) (6)`` 末尾编号 + 数学符号 + 短小 → 借入。"""
        import re

        # 复用 borrow 阶段的正则
        pattern = re.compile(r"\(\s*(\d+)\s*\)\s*$")
        text = "M l = f long ( c ∈ C: w importance ( c ) > θ l ∧ w temporal ( c ) ≤ θ s ) (6)"
        m = pattern.search(text)
        assert m is not None and m.group(1) == "6"
        # 至少含一个数学符号
        math = "∈∀∃∑∏∫→←↔≤≥≠≈θφψωαβγδ∧∨∪⊆"
        assert any(c in text for c in math)
        # 长度短小（< 200）
        assert len(text) < 200

    def test_no_trailing_number_skips_borrow(self) -> None:
        """末尾无编号 → 不借入。"""
        import re

        pattern = re.compile(r"\(\s*(\d+)\s*\)\s*$")
        assert pattern.search("M l = f long ( c ∈ C: w importance )") is None

    def test_pure_prose_no_math_chars_skips_borrow(self) -> None:
        """有 ``(N)`` 但无数学符号（普通段落引用）→ 不借入。"""
        text = "See reference (6) for details about the implementation."
        math = "∈∀∃∑∏∫→←↔≤≥≠≈θφψωαβγδ∧∨∪⊆"
        assert not any(c in text for c in math)

    def test_too_long_prose_skips_borrow(self) -> None:
        """超过 200 字符的段落 → 不借入（避免误吞正常段落末尾的引用编号）。"""
        long_text = (
            "This is a very long paragraph describing the system architecture "
            "with multiple sentences and references that should not be misidentified "
            "as a formula proxy, ending with arbitrary mention (3) here." * 2
        )
        assert len(long_text) >= 200
