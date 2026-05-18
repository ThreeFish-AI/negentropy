"""公式占位符解析模块的单元测试。

覆盖场景：
- ``<!-- formula-not-decoded -->`` 占位符替换（单个、多个、按序匹配）
- 占位符与回退公式数量不匹配的边界 Case
- Unicode 数学上下文回退（``unicode_to_latex`` 转换）
- ``remove_unresolved`` 清理策略
- ``MathRegion`` / ``DoclingFormula`` 协议兼容性
- ``has_formula_placeholders`` 快速检测
"""

from dataclasses import dataclass
from typing import Optional


from negentropy.perceives.markdown.formula_placeholder_resolver import (
    FormulaMeta,
    has_formula_placeholders,
    resolve_formula_placeholders,
)


# ---------------------------------------------------------------------------
# 测试用 Fake 数据类
# ---------------------------------------------------------------------------


@dataclass
class FakeFormula:
    """满足 FormulaMeta 协议的最小测试桩。"""

    latex: str
    formula_type: str = "block"
    equation_number: Optional[str] = None


# ============================================================
# 快速检测
# ============================================================
class TestHasFormulaPlaceholders:
    """测试 ``has_formula_placeholders`` 快速检测。"""

    def test_with_placeholder(self) -> None:
        assert has_formula_placeholders("text <!-- formula-not-decoded --> more")

    def test_with_extra_whitespace(self) -> None:
        assert has_formula_placeholders("<!--  formula-not-decoded  -->")

    def test_without_placeholder(self) -> None:
        assert not has_formula_placeholders("# Title\nSome text with $$x=1$$")

    def test_empty_string(self) -> None:
        assert not has_formula_placeholders("")

    def test_similar_but_different_comment(self) -> None:
        assert not has_formula_placeholders("<!-- image -->")
        assert not has_formula_placeholders("<!-- formula-decoded -->")


# ============================================================
# 占位符替换（Phase 1）
# ============================================================
class TestReplaceWithFallback:
    """测试回退公式替换占位符。"""

    def test_single_placeholder_replaced(self) -> None:
        md = "Before\n\n<!-- formula-not-decoded -->\n\nAfter"
        formulas = [FakeFormula(latex=r"C = \bigcup_{e \in E_{rel}} \text{Char}(e)")]
        result = resolve_formula_placeholders(md, formulas)
        assert r"$$C = \bigcup_{e \in E_{rel}} \text{Char}(e)$$" in result
        assert "<!-- formula-not-decoded -->" not in result

    def test_multiple_placeholders_in_order(self) -> None:
        md = "<!-- formula-not-decoded -->\ntext\n<!-- formula-not-decoded -->"
        formulas = [
            FakeFormula(latex="x = y"),
            FakeFormula(latex="a + b = c"),
        ]
        result = resolve_formula_placeholders(md, formulas)
        assert "$$x = y$$" in result
        assert "$$a + b = c$$" in result
        assert result.index("$$x = y$$") < result.index("$$a + b = c$$")

    def test_placeholder_with_extra_whitespace(self) -> None:
        md = "<!--  formula-not-decoded  -->"
        formulas = [FakeFormula(latex="E = mc^2")]
        result = resolve_formula_placeholders(md, formulas)
        assert "$$E = mc^2$$" in result

    def test_more_placeholders_than_formulas(self) -> None:
        md = "<!-- formula-not-decoded -->\n\n<!-- formula-not-decoded -->"
        formulas = [FakeFormula(latex="x = 1")]
        result = resolve_formula_placeholders(md, formulas)
        assert "$$x = 1$$" in result
        assert "<!-- formula-not-decoded -->" in result  # 第二个保留

    def test_more_formulas_than_placeholders(self) -> None:
        md = "<!-- formula-not-decoded -->"
        formulas = [
            FakeFormula(latex="x = 1"),
            FakeFormula(latex="y = 2"),
        ]
        result = resolve_formula_placeholders(md, formulas)
        assert "$$x = 1$$" in result
        assert "y = 2" not in result  # 多余公式不使用

    def test_no_placeholders_no_change(self) -> None:
        md = "# Title\nSome text with $$x=1$$"
        result = resolve_formula_placeholders(md, [])
        assert result == md

    def test_inline_formulas_skipped(self) -> None:
        """仅块级公式匹配占位符，行内公式不参与。"""
        md = "<!-- formula-not-decoded -->"
        formulas = [FakeFormula(latex="x", formula_type="inline")]
        result = resolve_formula_placeholders(md, formulas)
        # 行内公式不匹配，占位符保留
        assert "<!-- formula-not-decoded -->" in result

    def test_formula_with_equation_number(self) -> None:
        md = "<!-- formula-not-decoded -->"
        formulas = [FakeFormula(latex="E = mc^2", equation_number="2")]
        result = resolve_formula_placeholders(md, formulas)
        assert "$$E = mc^2$$ (2)" in result

    def test_formula_latex_whitespace_stripped(self) -> None:
        md = "<!-- formula-not-decoded -->"
        formulas = [FakeFormula(latex="  x = y  ")]
        result = resolve_formula_placeholders(md, formulas)
        assert "$$x = y$$" in result


# ============================================================
# Unicode 上下文回退（Phase 2）
# ============================================================
class TestUnicodeContextSalvage:
    """测试 Unicode 数学上下文回退转换。"""

    def test_unicode_math_after_placeholder_converted(self) -> None:
        """占位符后含 Unicode 数学符号的行应被转换。"""
        md = "<!-- formula-not-decoded -->\nE_rel ⊆ E"
        result = resolve_formula_placeholders(md, [])
        assert r"\subseteq" in result

    def test_no_math_unicode_line_unchanged(self) -> None:
        """占位符后无数学符号的行保持不变。"""
        md = "<!-- formula-not-decoded -->\nPlain text without math"
        result = resolve_formula_placeholders(md, [])
        assert "Plain text without math" in result

    def test_remove_unresolved_cleans_placeholder(self) -> None:
        """remove_unresolved=True 时清除残留占位符。"""
        md = "Before\n\n<!-- formula-not-decoded -->\n\nAfter"
        result = resolve_formula_placeholders(md, [], remove_unresolved=True)
        assert "<!-- formula-not-decoded -->" not in result
        assert "After" in result

    def test_keep_unresolved_default(self) -> None:
        """默认保留未解析的占位符。"""
        md = "Before\n<!-- formula-not-decoded -->\nAfter"
        result = resolve_formula_placeholders(md, [])
        assert "<!-- formula-not-decoded -->" in result

    def test_remove_unresolved_no_triple_blank_lines(self) -> None:
        """移除占位符后不产生三个以上连续空行。"""
        md = "Before\n\n<!-- formula-not-decoded -->\n\nAfter"
        result = resolve_formula_placeholders(md, [], remove_unresolved=True)
        assert "\n\n\n" not in result


# ============================================================
# 空输入与边界
# ============================================================
class TestEdgeCases:
    """边界条件与空输入。"""

    def test_empty_markdown(self) -> None:
        assert resolve_formula_placeholders("", []) == ""

    def test_empty_formulas_list(self) -> None:
        """空回退列表时触发 Phase 2。"""
        md = "<!-- formula-not-decoded -->\nE ∈ S"
        result = resolve_formula_placeholders(md, [])
        # Phase 2 应尝试 Unicode 转换
        assert r"\in" in result

    def test_mixed_resolved_and_unresolved(self) -> None:
        """部分占位符被替换，部分保留。"""
        md = "<!-- formula-not-decoded -->\n\ntext\n\n<!-- formula-not-decoded -->"
        formulas = [FakeFormula(latex="x = y")]
        result = resolve_formula_placeholders(md, formulas)
        assert "$$x = y$$" in result
        # 第二个占位符保留（无更多回退公式）
        assert "<!-- formula-not-decoded -->" in result

    def test_placeholder_at_end_of_document(self) -> None:
        md = "Text\n\n<!-- formula-not-decoded -->"
        result = resolve_formula_placeholders(md, [], remove_unresolved=True)
        assert "<!-- formula-not-decoded -->" not in result
        assert "Text" in result


# ============================================================
# 协议兼容性
# ============================================================
class TestProtocolCompatibility:
    """验证真实数据类满足 FormulaMeta 协议。"""

    def test_math_region_satisfies_protocol(self) -> None:
        from negentropy.perceives.pdf.math_formula import MathRegion

        region = MathRegion(latex=r"\alpha + \beta", formula_type="block")
        assert isinstance(region, FormulaMeta)

    def test_docling_formula_satisfies_protocol(self) -> None:
        from negentropy.perceives.pdf.docling_engine import DoclingFormula

        formula = DoclingFormula(latex=r"x = y", formula_type="inline")
        assert isinstance(formula, FormulaMeta)

    def test_fake_formula_satisfies_protocol(self) -> None:
        formula = FakeFormula(latex="test")
        assert isinstance(formula, FormulaMeta)
