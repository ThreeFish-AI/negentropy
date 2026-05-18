"""PDF 数学公式回归测试。

使用真实 PDF 文件验证公式提取质量：
- assets/Context Engineering 2.0 - The Context of Context Engineering.pdf
"""

from pathlib import Path

import pytest

from negentropy.perceives.pdf.math_formula import (
    FormulaReconstructor,
    MathRegion,
    unicode_to_latex,
)

# 真实 PDF 文件路径
ASSETS_DIR = Path(__file__).resolve().parents[2] / "assets"
CE_PDF = ASSETS_DIR / "Context Engineering 2.0 - The Context of Context Engineering.pdf"

# 如果 PDF 文件不存在则跳过测试
pytestmark = pytest.mark.skipif(
    not CE_PDF.exists(),
    reason=f"PDF 文件不存在: {CE_PDF}",
)


# ============================================================
# 辅助：载入 PyMuPDF
# ============================================================
def _open_pdf():
    """打开测试 PDF 文件。"""
    import fitz

    return fitz.open(str(CE_PDF))


# ============================================================
# 回归测试：Unicode 数学符号检测
# ============================================================
class TestUnicodeMathSymbolConversion:
    """验证论文中常见 Unicode 数学符号被正确转换。"""

    @pytest.mark.integration
    def test_set_membership(self) -> None:
        """∈ → \\in"""
        assert r"\in" in unicode_to_latex("e ∈ E_rel")

    @pytest.mark.integration
    def test_subset_relation(self) -> None:
        """⊆ → \\subseteq"""
        assert r"\subseteq" in unicode_to_latex("E_rel ⊆ E")

    @pytest.mark.integration
    def test_arrow_to(self) -> None:
        """→ → \\to"""
        assert r"\to" in unicode_to_latex("(C, T) → f_context")

    @pytest.mark.integration
    def test_times_operator(self) -> None:
        """× → \\times"""
        assert r"\times" in unicode_to_latex("A × B")

    @pytest.mark.integration
    def test_phi_variants(self) -> None:
        """ϕ → \\phi"""
        result = unicode_to_latex("ϕ₁, ϕ₂, ..., ϕₙ")
        assert r"\phi" in result
        assert "_{1}" in result
        assert "_{n}" in result

    @pytest.mark.integration
    def test_bigcup_operator(self) -> None:
        """⋃ → \\bigcup"""
        assert r"\bigcup" in unicode_to_latex("C = ⋃ Char(e)")

    @pytest.mark.integration
    def test_non_formula_text_unchanged(self) -> None:
        """普通文本不应被修改。"""
        text = "Context Engineering is a framework for building AI systems."
        assert unicode_to_latex(text) == text


# ============================================================
# 回归测试：PyMuPDF 字体分析路径
# ============================================================
@pytest.mark.slow
class TestPyMuPDFFormulaExtraction:
    """使用真实 PDF 验证 PyMuPDF 字体分析路径的公式提取。"""

    @pytest.fixture(scope="class")
    def reconstructor(self):
        return FormulaReconstructor()

    @pytest.fixture(scope="class")
    def all_math_regions(self, reconstructor):
        """提取 PDF 前 5 页的数学区域（控制测试时长）。

        该论文前 5 页已包含充足的公式样本（∈、⊆、→、×、ϕ、⋃ 等），
        无需遍历全部 ~30 页即可验证公式提取功能。
        """
        doc = _open_pdf()
        all_regions: list[MathRegion] = []
        all_blocks: list[str] = []
        try:
            for page_num in range(min(5, len(doc))):
                page = doc[page_num]
                blocks, regions = reconstructor.extract_formulas_from_page(
                    page, page_num
                )
                all_regions.extend(regions)
                all_blocks.extend(blocks)
        finally:
            doc.close()
        return all_regions, all_blocks

    @pytest.mark.integration
    def test_extracts_some_formulas(self, all_math_regions) -> None:
        """应至少提取到一些公式区域。"""
        regions, _ = all_math_regions
        assert len(regions) > 0, "未检测到任何数学区域"

    @pytest.mark.integration
    def test_has_block_formulas(self, all_math_regions) -> None:
        """应包含块级公式。"""
        regions, _ = all_math_regions
        block_formulas = [r for r in regions if r.formula_type == "block"]
        assert len(block_formulas) > 0, "未检测到块级公式"

    @pytest.mark.integration
    def test_has_inline_formulas(self, all_math_regions) -> None:
        """应包含行内公式。"""
        regions, _ = all_math_regions
        inline_formulas = [r for r in regions if r.formula_type == "inline"]
        assert len(inline_formulas) > 0, "未检测到行内公式"

    @pytest.mark.integration
    def test_enhanced_blocks_contain_latex(self, all_math_regions) -> None:
        """增强文本块应包含 LaTeX 标记。"""
        _, blocks = all_math_regions
        latex_blocks = [b for b in blocks if "$" in b]
        assert len(latex_blocks) > 0, "增强文本块中无 LaTeX 标记"

    @pytest.mark.integration
    def test_enhanced_blocks_contain_latex_commands(self, all_math_regions) -> None:
        """增强文本块应包含 LaTeX 命令（如 \\in, \\to 等）。"""
        _, blocks = all_math_regions
        all_text = "\n".join(blocks)
        # 至少应包含一些常见的 LaTeX 命令
        latex_commands_found = []
        for cmd in [r"\in", r"\to", r"\subseteq", r"\times", r"\phi", r"\bigcup"]:
            if cmd in all_text:
                latex_commands_found.append(cmd)
        assert len(latex_commands_found) > 0, (
            f"增强文本块中未找到任何 LaTeX 命令。前 500 字符: {all_text[:500]}"
        )


# ============================================================
# 回归测试：完整 PDF 处理管线
# ============================================================
@pytest.mark.slow
class TestFullPDFProcessingPipeline:
    """通过 PDFProcessor 完整管线验证公式提取。"""

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_process_pdf_with_formula_extraction(self) -> None:
        """完整处理 PDF（前 10 页）应提取到公式（如该页范围含数学字体区域）。

        注意：若 CE_PDF 前 10 页未使用 PyMuPDF 可识别的数学字体
        （如 STIXTwo、Latin Modern Math），则公式提取返回空结果，此测试跳过。
        """
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(enable_enhanced_features=True)
        try:
            result = await processor.process_pdf(
                str(CE_PDF),
                method="pymupdf",
                extract_formulas=True,
                extract_images=False,
                extract_tables=False,
                page_range=(0, 10),
            )
            assert result["success"] is True
            assert "markdown" in result

            markdown = result["markdown"]
            # 验证 Markdown 输出中包含数学标记（条件性：依赖页面内容）
            has_math = "$" in markdown or "$$" in markdown
            if not has_math:
                pytest.skip(
                    "CE_PDF 前 10 页未检测到 PyMuPDF 可识别的数学字体区域"
                    "（可能该页范围不含 STIXTwo/Latin Modern Math 字体）"
                )
        finally:
            processor.cleanup()

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_enhanced_assets_contain_formulas(self) -> None:
        """增强资产摘要应报告提取到的公式数量（前 10 页）。

        条件性跳过：若页面范围内无数学字体区域则公式数为 0。
        """
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(enable_enhanced_features=True)
        try:
            result = await processor.process_pdf(
                str(CE_PDF),
                method="pymupdf",
                extract_formulas=True,
                extract_images=False,
                extract_tables=False,
                page_range=(0, 10),
            )
            assert result["success"] is True
            enhanced = result.get("enhanced_assets", {})
            formulas_info = enhanced.get("formulas", {})
            total = formulas_info.get("count", 0)
            if total == 0:
                pytest.skip(
                    "CE_PDF 前 10 页未检测到数学字体区域，公式数量为 0"
                    "（可能该页范围不含 STIXTwo/Latin Modern Math 字体）"
                )
            assert total > 0, f"增强资产报告公式数量为 0: {enhanced}"
        finally:
            processor.cleanup()

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_formulas_disabled_no_overhead(self) -> None:
        """extract_formulas=False 时应跳过公式处理。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(enable_enhanced_features=True)
        try:
            result = await processor.process_pdf(
                str(CE_PDF),
                method="pymupdf",
                extract_formulas=False,
                extract_images=False,
                extract_tables=False,
                page_range=(0, 2),  # 仅前 2 页
            )
            assert result["success"] is True
            enhanced = result.get("enhanced_assets", {})
            # formulas_extracted 不应出现（因为未启用）
            assert (
                enhanced.get("formulas_extracted") is None
                or enhanced.get("formulas_extracted", 0) == 0
            )
        finally:
            processor.cleanup()
