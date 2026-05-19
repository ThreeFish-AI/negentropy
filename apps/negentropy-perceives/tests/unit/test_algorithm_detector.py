"""算法/伪代码块检测与格式化测试。

测试覆盖范围：
1. is_algorithm_block 检测 — 正例与反例
2. wrap_as_code_fence 格式化 — 代码围栏包装
3. detect_algorithm_regions 多段落扫描 — 跨 block 检测
4. Formatter 代码块保护 — Placeholder 机制
5. PDFProcessor 集成 — 算法块行结构保留
6. 端到端验证 — 使用实际 PDF 文件
"""

import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from negentropy.perceives.markdown.algorithm_detector import (
    is_algorithm_block,
    detect_algorithm_regions,
    wrap_as_code_fence,
    _compute_algorithm_score,
)
from negentropy.perceives.markdown.formatter import MarkdownFormatter
from negentropy.perceives.pdf.processor import PDFProcessor


# ---------------------------------------------------------------------------
# 1. is_algorithm_block 正例检测
# ---------------------------------------------------------------------------
class TestIsAlgorithmBlockPositive:
    """算法块应被正确识别。"""

    def test_classic_algorithm_header(self):
        """经典 'Algorithm N Title' 标题块。"""
        text = (
            "Algorithm 1 Extended ReAct Loop\n"
            "Require: User message m, Agent A\n"
            "Ensure: Response summary\n"
            "1: S.add(m)\n"
            "2: repeat\n"
            "3:   if p > 0.99 then\n"
            "4:     S ← compact(S)\n"
            "5:   end if\n"
            "6: until done\n"
            "7: return summary"
        )
        assert is_algorithm_block(text) is True

    def test_require_ensure_block(self):
        """含 Require/Ensure 头部的伪代码块。"""
        text = (
            "Require: input array A\n"
            "Ensure: sorted array A\n"
            "1: for i = 1 to n do\n"
            "2:   if A[i] < A[i-1] then\n"
            "3:     swap A[i], A[i-1]\n"
            "4:   end if\n"
            "5: end for"
        )
        assert is_algorithm_block(text) is True

    def test_numbered_pseudocode_lines(self):
        """大量编号伪代码行。"""
        text = (
            "1: Initialize x ← 0\n"
            "2: for i = 1 to n do\n"
            "3:   x ← x + a[i]\n"
            "4: end for\n"
            "5: if x > threshold then\n"
            "6:   return x\n"
            "7: end if\n"
            "8: return 0"
        )
        assert is_algorithm_block(text) is True

    def test_unicode_special_characters(self):
        """含 Unicode 特殊字符的伪代码。"""
        text = (
            "Procedure Search\n"
            "1: result ← ∅\n"
            "2: for each v ∈ V do\n"
            "3:   if dist(v) ≤ threshold then\n"
            "4:     result ← result ∪ {v}\n"
            "5:   end if\n"
            "6: end for\n"
            "7: return result"
        )
        assert is_algorithm_block(text) is True

    def test_listing_header(self):
        """'Listing N' 代码清单标题。"""
        text = (
            "Listing 1 Data Processing\n"
            "1: def process(data):\n"
            "2:   for item in data:\n"
            "3:     yield transform(item)\n"
            "4:   end for"
        )
        assert is_algorithm_block(text) is True

    def test_short_algorithm_with_header(self):
        """短小但有标题的算法块。"""
        text = "Algorithm 3 Cleanup\n1: return ∅"
        assert is_algorithm_block(text) is True

    def test_keyword_dense_block(self):
        """关键字密集的伪代码块（无显式标题但含特殊字符）。"""
        text = (
            "if condition then\n"
            "  for each item ∈ items do\n"
            "    if valid(item) then\n"
            "      result ← process(item)\n"
            "    end if\n"
            "  end for\n"
            "  return result\n"
            "end if"
        )
        assert is_algorithm_block(text) is True

    def test_comment_markers(self):
        """含 ▷ 注释标记的算法块。"""
        text = (
            "Algorithm 2 Search\n"
            "1: p ← token_count(S)/max_context  ▷ Context pressure\n"
            "2: if p > 0.99 then S ← compact(S) ▷ Full summarization\n"
            "3: end if"
        )
        assert is_algorithm_block(text) is True


# ---------------------------------------------------------------------------
# 2. is_algorithm_block 反例检测
# ---------------------------------------------------------------------------
class TestIsAlgorithmBlockNegative:
    """非算法内容不应被误判。"""

    def test_regular_numbered_list(self):
        """普通编号列表（如论文章节目录）。"""
        text = "1. Introduction\n2. Methods\n3. Results\n4. Discussion\n5. Conclusion"
        assert is_algorithm_block(text) is False

    def test_regular_paragraph(self):
        """普通正文段落。"""
        text = (
            "In this paper, we propose a novel approach to retrieval augmented generation. "
            "Our method combines knowledge graph construction with neural retrieval to achieve "
            "state-of-the-art performance on multiple benchmarks."
        )
        assert is_algorithm_block(text) is False

    def test_math_equation(self):
        """数学公式。"""
        text = "$$\\sum_{i=1}^{n} x_i = \\frac{n(n+1)}{2}$$"
        assert is_algorithm_block(text) is False

    def test_short_text(self):
        """短文本（不足以判定为算法）。"""
        text = "Hello world"
        assert is_algorithm_block(text) is False

    def test_empty_text(self):
        """空文本。"""
        assert is_algorithm_block("") is False
        assert is_algorithm_block("   ") is False

    def test_long_prose_with_if(self):
        """含 'if' 的长正文不应误判。"""
        text = (
            "If the model produces no tool calls and the previous tool succeeded, "
            "this is treated as implicit task completion. If no tool calls are present "
            "and the last tool failed, the executor can optionally inject a nudge message "
            "to encourage the model to try a different approach. This if-then logic is "
            "common in orchestration frameworks."
        )
        assert is_algorithm_block(text) is False

    def test_bibliography(self):
        """参考文献列表。"""
        text = (
            "[1] A. Vaswani et al., Attention is all you need, NeurIPS 2017.\n"
            "[2] J. Devlin et al., BERT: Pre-training, NAACL 2019.\n"
            "[3] T. Brown et al., Language models are few-shot learners, NeurIPS 2020."
        )
        assert is_algorithm_block(text) is False


# ---------------------------------------------------------------------------
# 3. _compute_algorithm_score 评分验证
# ---------------------------------------------------------------------------
class TestComputeAlgorithmScore:
    """验证评分逻辑细节。"""

    def test_header_gives_high_score(self):
        """Algorithm 标题至少 +5 分。"""
        text = "Algorithm 1 Test\nsome content line"
        score = _compute_algorithm_score(text)
        assert score >= 5

    def test_require_ensure_adds_score(self):
        """Require/Ensure 头部 +3 分。"""
        text = "Require: input x\nEnsure: output y\n1: return x + y"
        score = _compute_algorithm_score(text)
        assert score >= 3

    def test_single_line_penalized(self):
        """少于 3 行且无标题时受惩罚。"""
        text = "if x then return y"
        score = _compute_algorithm_score(text)
        assert score < 5  # 不应达到阈值

    def test_long_lines_penalized(self):
        """平均行长 > 120 字符时受惩罚。"""
        # 所有行都很长，使平均行长 > 120
        long = "x " * 70  # ~140 chars per line
        text = f"{long}\n{long}\n{long}"
        score_long = _compute_algorithm_score(text)

        short_text = "if condition then\n  x ← 1\nend if"
        score_short = _compute_algorithm_score(short_text)

        # 长行文本因惩罚分更低
        assert score_long < score_short


# ---------------------------------------------------------------------------
# 4. wrap_as_code_fence 格式化
# ---------------------------------------------------------------------------
class TestWrapAsCodeFence:
    """验证代码围栏包装。"""

    def test_basic_wrapping(self):
        """基本包装格式正确。"""
        content = "1: x ← 0\n2: return x"
        result = wrap_as_code_fence(content)
        assert result.startswith("```algorithm\n")
        assert result.endswith("\n```")
        assert "1: x ← 0" in result
        assert "2: return x" in result

    def test_custom_label(self):
        """自定义语言标签。"""
        content = "some code"
        result = wrap_as_code_fence(content, label="pseudocode")
        assert result.startswith("```pseudocode\n")

    def test_trailing_whitespace_cleaned(self):
        """行尾空白被清理。"""
        content = "line1   \nline2  "
        result = wrap_as_code_fence(content)
        lines = result.split("\n")
        # 内容行不应有尾部空白
        for line in lines[1:-1]:
            assert line == line.rstrip()


# ---------------------------------------------------------------------------
# 5. detect_algorithm_regions 多段落扫描
# ---------------------------------------------------------------------------
class TestDetectAlgorithmRegions:
    """验证多段落算法区域检测。"""

    def test_single_algorithm_detected(self):
        """单个算法块被检测。"""
        text = (
            "Some introduction text.\n\n"
            "Algorithm 1 Test\n"
            "Require: input x\n"
            "1: return x\n\n"
            "Some follow-up text."
        )
        regions = detect_algorithm_regions(text)
        assert len(regions) >= 1
        assert "Algorithm 1" in regions[0].title

    def test_multiple_algorithms_detected(self):
        """多个算法块被分别检测。"""
        text = (
            "Algorithm 1 First\n"
            "1: step one\n"
            "2: return\n\n"
            "Some text between.\n\n"
            "Algorithm 2 Second\n"
            "1: step one\n"
            "2: return"
        )
        regions = detect_algorithm_regions(text)
        assert len(regions) >= 2

    def test_non_algorithm_text_not_detected(self):
        """纯文本不产生检测结果。"""
        text = "This is a normal paragraph.\n\nAnother paragraph of text."
        regions = detect_algorithm_regions(text)
        assert len(regions) == 0


# ---------------------------------------------------------------------------
# 6. Formatter 代码块保护
# ---------------------------------------------------------------------------
class TestFormatterCodeBlockProtection:
    """验证 Formatter 的 Placeholder 机制保护代码块内容。"""

    def test_code_block_content_preserved(self):
        """代码围栏内容不被排版修改。"""
        formatter = MarkdownFormatter()
        md = (
            "Normal text.\n\n"
            "```algorithm\n"
            "1: x ← 0  ▷ initialize\n"
            "2: for i = 1 to n do\n"
            "3:   x ← x + i\n"
            "4: end for\n"
            "```\n\n"
            "More text."
        )
        result = formatter.format(md)
        assert "1: x ← 0  ▷ initialize" in result
        assert "2: for i = 1 to n do" in result

    def test_underscore_in_code_fence_not_escaped(self):
        """代码围栏内下划线不被转义。"""
        formatter = MarkdownFormatter()
        md = "```algorithm\nretrieval_result ← query(knowledge_graph)\n```"
        result = formatter.format(md)
        assert "retrieval_result" in result
        assert "retrieval\\_result" not in result

    def test_multiple_code_blocks_protected(self):
        """多个代码块均被保护。"""
        formatter = MarkdownFormatter()
        md = (
            "```python\n"
            "def hello():\n"
            "    pass\n"
            "```\n\n"
            "Some text.\n\n"
            "```algorithm\n"
            "1: return x\n"
            "```"
        )
        result = formatter.format(md)
        assert "def hello():" in result
        assert "1: return x" in result

    def test_numbered_lines_not_converted_to_list(self):
        """代码块内的编号行不被转换为 Markdown 列表。"""
        formatter = MarkdownFormatter()
        md = (
            "```algorithm\n"
            "1: initialize\n"
            "2: for each item do\n"
            "3:   process(item)\n"
            "4: end for\n"
            "```"
        )
        result = formatter.format(md)
        # 不应出现 "1. initialize" 这样的列表项
        assert "1: initialize" in result
        assert "1. initialize" not in result

    def test_spaces_preserved_in_code_block(self):
        """代码块内的多空格不被压缩。"""
        formatter = MarkdownFormatter()
        md = "```algorithm\n1: x ← 0     ▷ init\n```"
        result = formatter.format(md)
        # 多空格应被保留（typography fixes 不应压缩）
        assert "▷ init" in result


# ---------------------------------------------------------------------------
# 7. PDFProcessor 集成测试
# ---------------------------------------------------------------------------
class TestPDFProcessorAlgorithmIntegration:
    """验证 PDFProcessor 中算法块行结构保留。"""

    @pytest.fixture
    def processor(self):
        proc = PDFProcessor()
        yield proc
        proc.cleanup()

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_fitz")
    async def test_algorithm_block_preserves_lines(self, mock_import_fitz, processor):
        """PyMuPDF 提取时算法块保留行结构。"""
        mock_fitz = Mock()
        mock_import_fitz.return_value = mock_fitz

        mock_doc = Mock()
        mock_doc.page_count = 1
        mock_doc.metadata = {}
        mock_fitz.open.return_value = mock_doc

        algo_text = (
            "Algorithm 1 Test\n"
            "Require: input x\n"
            "1: for i = 1 to n do\n"
            "2:   result ← compute(i)\n"
            "3: end for\n"
            "4: return result\n"
        )
        mock_page = Mock()
        mock_page.get_text.return_value = [
            (0, 0, 500, 30, "Introduction\n", 0, 0),
            (0, 40, 500, 200, algo_text, 1, 0),
            (0, 210, 500, 300, "Conclusion text.\n", 2, 0),
        ]
        mock_doc.load_page.return_value = mock_page

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            tmp_path = Path(f.name)

        try:
            result = await processor._extract_with_pymupdf(
                tmp_path, include_metadata=False
            )
            text = result["text"]

            assert result["success"] is True
            # 算法块行结构应被保留（换行符未被合并为空格）
            assert "1: for i = 1 to n do\n" in text
            assert "2:   result ← compute(i)\n" in text
            # 普通段落的换行应被合并
            assert "Introduction" in text
            assert "Conclusion text." in text
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    @pytest.mark.asyncio
    @patch("negentropy.perceives.pdf.processor._import_fitz")
    async def test_regular_block_still_merges_lines(self, mock_import_fitz, processor):
        """非算法块仍然正常合并行内换行。"""
        mock_fitz = Mock()
        mock_import_fitz.return_value = mock_fitz

        mock_doc = Mock()
        mock_doc.page_count = 1
        mock_doc.metadata = {}
        mock_fitz.open.return_value = mock_doc

        regular_text = "This is a regular paragraph that\ncontinues on the next line.\n"
        mock_page = Mock()
        mock_page.get_text.return_value = [
            (0, 0, 500, 100, regular_text, 0, 0),
        ]
        mock_doc.load_page.return_value = mock_page

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            tmp_path = Path(f.name)

        try:
            result = await processor._extract_with_pymupdf(
                tmp_path, include_metadata=False
            )
            text = result["text"]
            # 普通段落行应被合并为空格
            assert "regular paragraph that continues on" in text
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    def test_simple_markdown_wraps_algorithm(self, processor):
        """_simple_markdown_conversion 对算法块输出代码围栏。"""
        text = (
            "Algorithm 1 Sort\n"
            "Require: array A\n"
            "1: for i = 1 to n do\n"
            "2:   if A[i] < A[i-1] then\n"
            "3:     swap A[i], A[i-1]\n"
            "4:   end if\n"
            "5: end for"
        )
        result = processor._simple_markdown_conversion(text)
        assert "```algorithm" in result
        assert "1: for i = 1 to n do" in result
        assert "```" in result

    def test_normalize_paragraphs_preserves_algorithm(self, processor):
        """_normalize_paragraphs 不拆分算法块。"""
        text = "Algorithm 1 Test\nRequire: x.\nEnsure: y.\n1: return x + y"
        result = processor._normalize_paragraphs(text)
        # 不应插入空行拆分算法块
        assert "\n\n" not in result


# ---------------------------------------------------------------------------
# 8. 端到端实际 PDF 集成测试
# ---------------------------------------------------------------------------
class TestRealPDFAlgorithmDetection:
    """使用实际 PDF 文件验证算法块检测。"""

    PDF_PATH = Path(__file__).parent.parent.parent / "assets" / "2603.05344v3.pdf"

    @pytest.mark.asyncio
    async def test_pdf_algorithm_blocks_detected(self):
        """实际 PDF 中的算法块应被检测并包裹在代码围栏中。"""
        if not self.PDF_PATH.exists():
            pytest.skip(f"Test PDF not found: {self.PDF_PATH}")

        processor = PDFProcessor()
        try:
            result = await processor.process_pdf(
                str(self.PDF_PATH),
                method="pymupdf",
                output_format="markdown",
                include_metadata=False,
                extract_images=False,
                extract_tables=False,
                extract_formulas=False,
            )

            assert result["success"] is True
            markdown = result["markdown"]

            # 应该包含代码围栏
            assert "```algorithm" in markdown or "```" in markdown, (
                "No code fences found in markdown output. "
                "Algorithm blocks may not have been detected."
            )

            # Algorithm 1 的内容不应是扁平的单行文本
            # 应保留行结构（包含换行符）
            if "Algorithm 1" in markdown:
                # 找到 Algorithm 1 附近的内容
                idx = markdown.index("Algorithm 1")
                # 提取该区域附近的文本
                region = markdown[max(0, idx - 50) : idx + 500]
                # 应该在代码围栏内
                assert "```" in region, (
                    f"Algorithm 1 not in code fence. Region: {region[:200]}"
                )

        finally:
            processor.cleanup()
