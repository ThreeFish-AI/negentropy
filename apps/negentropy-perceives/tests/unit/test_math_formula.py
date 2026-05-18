"""src/negentropy/perceives/pdf/math_formula.py 核心模块的单元测试。"""

from negentropy.perceives.pdf.math_formula import (
    DoclingFormulaEnricher,
    FormulaReconstructor,
    MathRegion,
    detect_script_type,
    has_math_unicode,
    is_math_font,
    protect_math_content,
    unicode_to_latex,
)


# ============================================================
# TestUnicodeToLatex
# ============================================================
class TestUnicodeToLatex:
    """Unicode→LaTeX 映射与转换函数测试。"""

    def test_relation_operators(self) -> None:
        assert r"\in" in unicode_to_latex("∈")
        assert r"\subseteq" in unicode_to_latex("⊆")
        assert r"\neq" in unicode_to_latex("≠")
        assert r"\leq" in unicode_to_latex("≤")
        assert r"\geq" in unicode_to_latex("≥")
        assert r"\approx" in unicode_to_latex("≈")

    def test_greek_letters(self) -> None:
        assert r"\alpha" in unicode_to_latex("α")
        assert r"\beta" in unicode_to_latex("β")
        assert r"\phi" in unicode_to_latex("ϕ")
        assert r"\omega" in unicode_to_latex("ω")
        assert r"\Gamma" in unicode_to_latex("Γ")
        assert r"\Delta" in unicode_to_latex("Δ")
        assert r"\Sigma" in unicode_to_latex("Σ")

    def test_set_logic_operators(self) -> None:
        assert r"\cup" in unicode_to_latex("∪")
        assert r"\cap" in unicode_to_latex("∩")
        assert r"\bigcup" in unicode_to_latex("⋃")
        assert r"\emptyset" in unicode_to_latex("∅")
        assert r"\forall" in unicode_to_latex("∀")
        assert r"\exists" in unicode_to_latex("∃")

    def test_arrows(self) -> None:
        assert r"\to" in unicode_to_latex("→")
        assert r"\leftarrow" in unicode_to_latex("←")
        assert r"\Rightarrow" in unicode_to_latex("⇒")
        assert r"\mapsto" in unicode_to_latex("↦")

    def test_operators(self) -> None:
        assert r"\times" in unicode_to_latex("×")
        assert r"\div" in unicode_to_latex("÷")
        assert r"\pm" in unicode_to_latex("±")
        assert r"\cdot" in unicode_to_latex("·")
        assert r"\infty" in unicode_to_latex("∞")
        assert r"\partial" in unicode_to_latex("∂")

    def test_blackboard_bold(self) -> None:
        assert r"\mathbb{R}" in unicode_to_latex("ℝ")
        assert r"\mathbb{N}" in unicode_to_latex("ℕ")
        assert r"\mathbb{Z}" in unicode_to_latex("ℤ")
        assert r"\mathbb{C}" in unicode_to_latex("ℂ")

    def test_superscript_subscript(self) -> None:
        assert "^{2}" in unicode_to_latex("²")
        assert "^{n}" in unicode_to_latex("ⁿ")
        assert "_{1}" in unicode_to_latex("₁")
        assert "_{n}" in unicode_to_latex("ₙ")

    def test_mixed_text(self) -> None:
        result = unicode_to_latex("E_rel ⊆ E")
        assert r"\subseteq" in result
        assert "E_rel" in result

    def test_preserves_plain_text(self) -> None:
        assert unicode_to_latex("hello world") == "hello world"
        assert unicode_to_latex("x = 42") == "x = 42"

    def test_empty_input(self) -> None:
        assert unicode_to_latex("") == ""
        assert unicode_to_latex(None) is None

    def test_complex_formula(self) -> None:
        """论文中的典型公式：C = ⋃_{e∈E_rel} Char(e)"""
        result = unicode_to_latex("C = ⋃ Char(e)")
        assert r"\bigcup" in result

    def test_misc_symbols(self) -> None:
        assert r"\ldots" in unicode_to_latex("…")
        assert r"\langle" in unicode_to_latex("⟨")
        assert r"\rangle" in unicode_to_latex("⟩")


# ============================================================
# TestHasMathUnicode
# ============================================================
class TestHasMathUnicode:
    """has_math_unicode 快速检测测试。"""

    def test_detects_math_symbols(self) -> None:
        assert has_math_unicode("E ∈ S") is True
        assert has_math_unicode("x → y") is True
        assert has_math_unicode("α + β") is True

    def test_rejects_plain_text(self) -> None:
        assert has_math_unicode("hello world") is False
        assert has_math_unicode("x = 42") is False

    def test_empty_and_none(self) -> None:
        assert has_math_unicode("") is False
        assert has_math_unicode(None) is False


# ============================================================
# TestMathFontDetection
# ============================================================
class TestMathFontDetection:
    """数学字体检测测试。"""

    def test_computer_modern(self) -> None:
        assert is_math_font("CMMI10") is True
        assert is_math_font("CMSY8") is True
        assert is_math_font("CMEX10") is True
        assert is_math_font("CMR12") is True

    def test_ams_fonts(self) -> None:
        assert is_math_font("MSAM10") is True
        assert is_math_font("MSBM7") is True

    def test_stix_math(self) -> None:
        assert is_math_font("STIXMath-Regular") is True
        assert is_math_font("STIX Two Math") is True

    def test_other_math_fonts(self) -> None:
        assert is_math_font("CambriaMath") is True  # "Math" suffix matches
        assert is_math_font("Cambria Math") is True
        assert is_math_font("Euler") is True
        assert is_math_font("Symbol") is True
        assert is_math_font("Latin Modern Math") is True

    def test_non_math_fonts(self) -> None:
        assert is_math_font("Arial") is False
        assert is_math_font("Times New Roman") is False
        assert is_math_font("Helvetica") is False
        assert is_math_font("") is False


# ============================================================
# TestScriptDetection
# ============================================================
class TestScriptDetection:
    """上下标检测测试。"""

    def test_normal_text(self) -> None:
        result = detect_script_type(
            span_size=12.0, span_origin_y=100.0, baseline_y=100.0, normal_size=12.0
        )
        assert result == "normal"

    def test_superscript(self) -> None:
        result = detect_script_type(
            span_size=8.0, span_origin_y=95.0, baseline_y=100.0, normal_size=12.0
        )
        assert result == "superscript"

    def test_subscript(self) -> None:
        result = detect_script_type(
            span_size=8.0, span_origin_y=105.0, baseline_y=100.0, normal_size=12.0
        )
        assert result == "subscript"

    def test_small_text_defaults_to_superscript(self) -> None:
        """字号很小但 y 偏移不显著时默认为上标。"""
        result = detect_script_type(
            span_size=6.0, span_origin_y=100.0, baseline_y=100.0, normal_size=12.0
        )
        assert result == "superscript"

    def test_zero_normal_size(self) -> None:
        result = detect_script_type(
            span_size=8.0, span_origin_y=95.0, baseline_y=100.0, normal_size=0.0
        )
        assert result == "normal"


# ============================================================
# TestFormulaReconstructor
# ============================================================
class TestFormulaReconstructor:
    """FormulaReconstructor 公式重建测试。"""

    def setup_method(self) -> None:
        self.reconstructor = FormulaReconstructor()

    def test_reconstruct_simple_math_span(self) -> None:
        """简单的数学字体 span 应被重建为 LaTeX。"""
        line_dict = {
            "bbox": [0, 100, 500, 112],
            "spans": [
                {"text": "E", "font": "CMMI10", "size": 12.0, "origin": (50, 100)},
                {"text": " = ", "font": "CMR10", "size": 12.0, "origin": (60, 100)},
                {"text": "mc", "font": "CMMI10", "size": 12.0, "origin": (80, 100)},
            ],
        }
        result = self.reconstructor.reconstruct_line_formulas(line_dict)
        assert "$" in result  # 包含数学标记

    def test_reconstruct_unicode_symbols(self) -> None:
        """含 Unicode 数学符号的 span 应被转换。"""
        line_dict = {
            "bbox": [0, 100, 500, 112],
            "spans": [
                {
                    "text": "x ∈ S",
                    "font": "TimesNewRoman",
                    "size": 12.0,
                    "origin": (50, 100),
                },
            ],
        }
        result = self.reconstructor.reconstruct_line_formulas(line_dict)
        assert r"\in" in result

    def test_reconstruct_subscript(self) -> None:
        """下标 span 应被重建为 LaTeX 下标。"""
        line_dict = {
            "bbox": [0, 100, 500, 112],
            "spans": [
                {
                    "text": "The ",
                    "font": "TimesNewRoman",
                    "size": 12.0,
                    "origin": (10, 100),
                },
                {"text": "E", "font": "CMMI10", "size": 12.0, "origin": (50, 100)},
                # 字号为 8.5 (ratio=0.708, < 0.75 触发脚本检测)
                # baseline 由多数 span 确定为 ~100，y 偏移 +5 > 2.0 → subscript
                {"text": "rel", "font": "CMMI10", "size": 8.5, "origin": (60, 105)},
                {
                    "text": " set",
                    "font": "TimesNewRoman",
                    "size": 12.0,
                    "origin": (80, 100),
                },
            ],
        }
        result = self.reconstructor.reconstruct_line_formulas(line_dict)
        assert "_{" in result

    def test_reconstruct_empty_line(self) -> None:
        line_dict = {"bbox": [0, 0, 0, 0], "spans": []}
        assert self.reconstructor.reconstruct_line_formulas(line_dict) == ""

    def test_is_block_formula_centered(self) -> None:
        """居中且含数学内容的块应被识别为块级公式。"""
        block_dict = {
            "bbox": [150, 200, 450, 220],
            "lines": [
                {
                    "spans": [
                        {
                            "text": "C = ⋃ Char(e)",
                            "font": "CMMI10",
                            "size": 12.0,
                            "origin": (200, 210),
                        },
                    ]
                }
            ],
        }
        is_block, eq_num = self.reconstructor.is_block_formula(
            block_dict, page_width=600
        )
        assert is_block is True
        assert eq_num is None

    def test_is_block_formula_with_equation_number(self) -> None:
        """含等式编号的块应提取编号。"""
        block_dict = {
            "bbox": [100, 200, 500, 220],
            "lines": [
                {
                    "spans": [
                        {
                            "text": "C = ⋃ Char(e) (2)",
                            "font": "CMMI10",
                            "size": 12.0,
                            "origin": (200, 210),
                        },
                    ]
                }
            ],
        }
        is_block, eq_num = self.reconstructor.is_block_formula(
            block_dict, page_width=600
        )
        assert is_block is True
        assert eq_num == "2"

    def test_non_centered_block_not_formula(self) -> None:
        """左对齐的文本块不应被识别为块级公式。"""
        block_dict = {
            "bbox": [20, 200, 200, 220],
            "lines": [
                {
                    "spans": [
                        {
                            "text": "Some text ∈ here",
                            "font": "CMMI10",
                            "size": 12.0,
                            "origin": (30, 210),
                        },
                    ]
                }
            ],
        }
        is_block, _ = self.reconstructor.is_block_formula(block_dict, page_width=600)
        assert is_block is False


# ============================================================
# TestDoclingPostprocess
# ============================================================
class TestDoclingPostprocess:
    """Docling LaTeX 后处理清洗测试。"""

    def test_compress_subscript_spaces(self) -> None:
        result = DoclingFormulaEnricher.postprocess_latex(r"f _ { f i e l d }")
        assert "f_{field}" in result

    def test_compress_superscript_spaces(self) -> None:
        result = DoclingFormulaEnricher.postprocess_latex(r"x ^ { 2 }")
        assert "x^{2}" in result

    def test_fix_backslash_space(self) -> None:
        result = DoclingFormulaEnricher.postprocess_latex(r"\ text { hello }")
        assert r"\text" in result

    def test_clean_environment_wrappers(self) -> None:
        result = DoclingFormulaEnricher.postprocess_latex(
            r"\begin{align} x = y \end{align}"
        )
        assert r"\begin{align}" not in result
        assert r"\end{align}" not in result
        assert "x = y" in result

    def test_normalize_equation_tags(self) -> None:
        result = DoclingFormulaEnricher.postprocess_latex(r"x = y \tag{1}")
        assert "(1)" in result
        assert r"\tag" not in result

    def test_empty_input(self) -> None:
        assert DoclingFormulaEnricher.postprocess_latex("") == ""
        assert DoclingFormulaEnricher.postprocess_latex(None) is None

    def test_clean_alignment_residue(self) -> None:
        result = DoclingFormulaEnricher.postprocess_latex("x & = y + z")
        assert "x = y + z" in result


# ============================================================
# TestProtectMathContent
# ============================================================
class TestProtectMathContent:
    """数学内容保护 (extract-process-restore) 测试。"""

    def test_inline_math_protected(self) -> None:
        """行内公式中的空格不应被压缩。"""
        text = "Text $x  +  y$ more"
        result = protect_math_content(text, lambda t: t.replace("  ", " "))
        assert "$x  +  y$" in result
        assert "Text " in result

    def test_block_math_protected(self) -> None:
        """块级公式中的内容不应被修改。"""
        text = "Before $$x  =  y$$ after"
        result = protect_math_content(text, lambda t: t.replace("  ", " "))
        assert "$$x  =  y$$" in result

    def test_escaped_dollar_not_math(self) -> None:
        """转义的美元符号不应被误当作数学定界符。"""
        text = r"Price is \$10 and \$20"
        result = protect_math_content(text, lambda t: t.upper())
        assert "PRICE" in result

    def test_bracket_notation_protected(self) -> None:
        r"""``\[...\]`` 和 ``\(...\)`` 表示法保护。"""
        text = r"Text \[x  +  y\] more"
        result = protect_math_content(text, lambda t: t.replace("  ", " "))
        assert r"\[x  +  y\]" in result

    def test_empty_input(self) -> None:
        assert protect_math_content("", lambda t: t) == ""
        assert protect_math_content(None, lambda t: t) is None

    def test_no_math_passthrough(self) -> None:
        """无数学内容时正常执行处理函数。"""
        text = "Hello  world"
        result = protect_math_content(text, lambda t: t.replace("  ", " "))
        assert result == "Hello world"


# ============================================================
# TestMathRegionDataclass
# ============================================================
class TestMathRegionDataclass:
    """MathRegion 数据结构测试。"""

    def test_create_inline_region(self) -> None:
        region = MathRegion(
            latex=r"\alpha + \beta",
            formula_type="inline",
            page_number=0,
        )
        assert region.formula_type == "inline"
        assert region.equation_number is None

    def test_create_block_region_with_eq_number(self) -> None:
        region = MathRegion(
            latex=r"C = \bigcup_{e \in E_{rel}} \text{Char}(e)",
            formula_type="block",
            page_number=3,
            equation_number="2",
        )
        assert region.formula_type == "block"
        assert region.equation_number == "2"
