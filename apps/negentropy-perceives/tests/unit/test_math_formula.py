"""src/negentropy/perceives/pdf/math_formula.py 核心模块的单元测试。"""

from negentropy.perceives.pdf.math_formula import (
    DoclingFormulaEnricher,
    FormulaReconstructor,
    MathRegion,
    detect_script_type,
    has_math_unicode,
    is_math_font,
    math_text_to_latex,
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


# ============================================================
# TestR11MathReconstruction — XCharter 字体 + 下标/上标重建
# ============================================================
class TestR11MathFontDetection:
    """R11-D：XCharter 等数学字体识别。"""

    def test_xcharter_math_recognized(self) -> None:
        assert is_math_font("XCharterMathMI") is True

    def test_xcharter_roman_not_math(self) -> None:
        assert is_math_font("XCharter-Roman") is False

    def test_charter_math_recognized(self) -> None:
        assert is_math_font("CharterMath") is True


class TestR11MathTextToLatex:
    """R11-D：math_text_to_latex 覆盖数学字母块。"""

    def test_math_italic_letters(self) -> None:
        # 𝑈 (U+1D446) → U, 𝑡 (U+1D461) → t
        assert math_text_to_latex("\U0001d448\U0001d461") == "Ut"

    def test_math_italic_greek(self) -> None:
        # 𝜃 (U+1D703) → \theta
        assert math_text_to_latex("\U0001d703") == r"\theta"

    def test_blackboard_bold(self) -> None:
        # 𝔼 (U+1D53C) → \mathbb{E}
        assert math_text_to_latex("\U0001d53c") == r"\mathbb{E}"

    def test_ascii_pass_through(self) -> None:
        assert math_text_to_latex("x = 1") == "x = 1"

    def test_mixed_math_and_ascii(self) -> None:
        # 𝑈 + ASCII + 𝑡
        assert math_text_to_latex("\U0001d448 t") == "U t"


class TestR11SubscriptReconstruction:
    """R11-D：含数学字体行的下标/上标几何重建。"""

    def test_inline_subscript_reconstructed(self) -> None:
        """``The user side U_t supplies`` → 含 ``$U_{t}$``。"""
        line = {
            "spans": [
                {
                    "text": "The user side",
                    "font": "XCharter-Roman",
                    "size": 11.0,
                    "origin": (100, 338.5),
                    "bbox": [100, 329, 160, 341],
                },
                {
                    "text": " \U0001d448",
                    "font": "XCharterMathMI",
                    "size": 10.0,
                    "origin": (160, 338.5),
                    "bbox": [160, 328, 170, 339],
                },
                {
                    "text": "\U0001d461",
                    "font": "XCharterMathMI",
                    "size": 7.3,
                    "origin": (168, 340.1),
                    "bbox": [168, 333, 173, 340],
                },
                {
                    "text": "supplies",
                    "font": "XCharter-Roman",
                    "size": 11.0,
                    "origin": (173, 338.5),
                    "bbox": [173, 329, 210, 341],
                },
            ],
            "bbox": [100, 329, 210, 341],
        }
        out = FormulaReconstructor().reconstruct_line_formulas(line)
        assert "$U_{t}$" in out
        # 散文与 $...$ 之间应有空格分隔
        assert "side $U_{t}$ supplies" in out

    def test_inline_superscript_reconstructed(self) -> None:
        """上标：``x^2`` 的 2 在更高 baseline。"""
        line = {
            "spans": [
                {
                    "text": "value",
                    "font": "XCharter-Roman",
                    "size": 11.0,
                    "origin": (100, 100.0),
                    "bbox": [100, 90, 130, 101],
                },
                {
                    "text": " \U0001d465",
                    "font": "XCharterMathMI",
                    "size": 10.0,
                    "origin": (130, 100.0),
                    "bbox": [130, 90, 138, 101],
                },
                {
                    "text": "2",
                    "font": "XCharterMathMI",
                    "size": 7.0,
                    "origin": (138, 97.5),
                    "bbox": [138, 91, 144, 98],
                },
            ],
            "bbox": [100, 90, 144, 101],
        }
        out = FormulaReconstructor().reconstruct_line_formulas(line)
        assert "$x^{2}$" in out or "$x^2$" in out

    def test_non_math_block_fast_path(self) -> None:
        """无数学字体的行：返回拼接散文（不被 math 逻辑干扰）。"""
        line = {
            "spans": [
                {
                    "text": "Hello world",
                    "font": "XCharter-Roman",
                    "size": 11.0,
                    "origin": (100, 100.0),
                    "bbox": [100, 90, 160, 101],
                },
                {
                    "text": "this is prose.",
                    "font": "XCharter-Roman",
                    "size": 11.0,
                    "origin": (160, 100.0),
                    "bbox": [160, 90, 230, 101],
                },
            ],
            "bbox": [100, 90, 230, 101],
        }
        out = FormulaReconstructor().reconstruct_line_formulas(line)
        assert "$" not in out
        assert "Hello world" in out


class TestR11ScriptDetectionThreshold:
    """R11-D：detect_script_type 阈值校准（XCharter 下标 ~1.6pt 偏移）。"""

    def test_subscript_small_offset_detected(self) -> None:
        """1.6pt 偏移 + ratio 0.66 → subscript（旧 2.0 阈值会漏检）。"""
        result = detect_script_type(
            span_size=7.3, span_origin_y=340.1, baseline_y=338.5, normal_size=11.0
        )
        assert result == "subscript"

    def test_existing_subscript_still_works(self) -> None:
        """5pt 偏移仍判 subscript（既有用例零回归）。"""
        result = detect_script_type(
            span_size=8.0, span_origin_y=105.0, baseline_y=100.0, normal_size=12.0
        )
        assert result == "subscript"


# ============================================================
# TestR11DoubleSubscriptMerge — 连续同型 sub/sup 合并（防 KaTeX Double subscript）
# ============================================================
class TestR11DoubleSubscriptMerge:
    """R11-D2：连续同型下标/上标 span 合并为单个 ``_{...}``/``^{...}``。"""

    def _span(self, text, font, size, oy):
        return {
            "text": text,
            "font": font,
            "size": size,
            "origin": (100, oy),
            "bbox": [100, oy, 120, oy + 10],
        }

    def test_two_letter_subscript_merged(self):
        """``M_{θt}`` 不产生 ``M_{\\theta}_{t}`` 双下标。"""
        line = {
            "spans": [
                self._span("M", "XCharterMathMI", 10.0, 100.0),
                self._span("θ", "XCharterMathMI", 7.0, 102.0),
                self._span("t", "XCharterMathMI", 7.0, 102.0),
            ],
            "bbox": [100, 95, 130, 105],
        }
        out = FormulaReconstructor().reconstruct_line_formulas(line)
        assert "$M_{\\theta t}$" in out
        # 不产生双下标
        assert "_{" in out and out.count("_{") == 1

    def test_multichar_subscript_merged(self):
        """``t_{i-1}`` 的 i/-/1 三个 sub span 合并为单个 ``_{i-1}``。"""
        line = {
            "spans": [
                self._span("t", "XCharterMathMI", 10.0, 100.0),
                self._span("i", "XCharterMathMI", 7.0, 102.0),
                self._span("-", "XCharterMathMI", 7.0, 102.0),
                self._span("1", "XCharterMathMI", 7.0, 102.0),
            ],
            "bbox": [100, 95, 130, 105],
        }
        out = FormulaReconstructor().reconstruct_line_formulas(line)
        assert "$t_{i-1}$" in out

    def test_subscript_then_supcript_not_merged(self):
        """``x_i^j``：sub 后接 sup 不合并（合法 LaTeX）。"""
        line = {
            "spans": [
                self._span("x", "XCharterMathMI", 10.0, 100.0),
                self._span("i", "XCharterMathMI", 7.0, 102.0),
                self._span("j", "XCharterMathMI", 7.0, 98.0),
            ],
            "bbox": [100, 95, 130, 105],
        }
        out = FormulaReconstructor().reconstruct_line_formulas(line)
        assert "_{" in out and "^{" in out
        assert out.count("_{") == 1 and out.count("^{") == 1

    def test_baseline_from_normal_size_spans(self):
        """基线取自正文字号 span，避免下标拉低中位 baseline。"""
        # 2 sub spans + 1 base — old median-baseline would pick sub baseline
        line = {
            "spans": [
                self._span("Z", "XCharterMathMI", 10.0, 100.0),
                self._span("s", "XCharterMathMI", 7.0, 102.0),
                self._span("k", "XCharterMathMI", 7.0, 102.0),
            ],
            "bbox": [100, 95, 130, 105],
        }
        out = FormulaReconstructor().reconstruct_line_formulas(line)
        assert "$Z_{sk}$" in out or "$Z_{s k}$" in out
        assert out.count("_{") == 1


# ============================================================
# TestR11DisplayOperatorNormalSize — display 大运算符不致 normal_size 选错
# ============================================================
class TestR11DisplayOperatorNormalSize:
    """R11-D2 fix：``normal_size = max(sizes)`` 会把 display-style 大运算符
    （∫∑∏√ 等，块公式中字号大于 body）选为参照，致 body 操作数 ratio<0.65 被判
    superscript。修复：排除 display-operator 字形后再取 max。"""

    def _span(self, text, font, size, oy):
        return {
            "text": text,
            "font": font,
            "size": size,
            "origin": (100, oy),
            "bbox": [100, oy, 120, oy + 10],
        }

    def test_integral_not_treats_operands_as_superscript(self):
        """``[∫ 14pt, f 7pt, x 7pt]`` → ``$\\int fx$``，而非 ``$\\int^{fx}$``。"""
        line = {
            "spans": [
                self._span("∫", "XCharterMathMI", 14.0, 100.0),
                self._span("f", "XCharterMathMI", 7.0, 100.0),
                self._span("x", "XCharterMathMI", 7.0, 100.0),
            ],
            "bbox": [100, 95, 130, 105],
        }
        out = FormulaReconstructor().reconstruct_line_formulas(line)
        assert "$\\int fx$" in out
        # 操作数不得被判上标
        assert "^{" not in out

    def test_sum_not_treats_operand_as_superscript(self):
        """``[∑ 16pt, x 10pt]`` → ``$\\sum x$``，而非 ``$\\sum^{x}$``。"""
        line = {
            "spans": [
                self._span("∑", "XCharterMathMI", 16.0, 100.0),
                self._span("x", "XCharterMathMI", 10.0, 100.0),
            ],
            "bbox": [100, 95, 130, 105],
        }
        out = FormulaReconstructor().reconstruct_line_formulas(line)
        assert "$\\sum x$" in out
        assert "^{" not in out

    def test_sqrt_not_treats_operand_as_superscript(self):
        """``[√ 18pt, dx 9pt]`` → ``$\\sqrt dx$``，而非 ``$\\sqrt^{dx}$``。"""
        line = {
            "spans": [
                self._span("√", "XCharterMathMI", 18.0, 100.0),
                self._span("dx", "XCharterMathMI", 9.0, 100.0),
            ],
            "bbox": [100, 95, 130, 105],
        }
        out = FormulaReconstructor().reconstruct_line_formulas(line)
        assert "$\\sqrt dx$" in out
        assert "^{" not in out

    def test_operator_then_greek_no_double_space(self):
        """``∫`` + ``θ`` → ``\\int\\theta``（``\\`` 天然终结前一名，无需空格）。"""
        line = {
            "spans": [
                self._span("∫", "XCharterMathMI", 14.0, 100.0),
                self._span("θ", "XCharterMathMI", 9.0, 100.0),
            ],
            "bbox": [100, 95, 130, 105],
        }
        out = FormulaReconstructor().reconstruct_line_formulas(line)
        assert "$\\int\\theta$" in out

    def test_pure_operator_line_still_renders(self):
        """纯运算符行（排除后无候选）回退到全量 max，仍能产出有效 LaTeX。"""
        line = {
            "spans": [
                self._span("∑", "XCharterMathMI", 16.0, 100.0),
            ],
            "bbox": [100, 95, 130, 105],
        }
        out = FormulaReconstructor().reconstruct_line_formulas(line)
        assert "$\\sum$" in out
