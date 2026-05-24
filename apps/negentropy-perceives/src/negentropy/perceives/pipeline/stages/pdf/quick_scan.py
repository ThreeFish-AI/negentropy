"""S1: 文档特征快速扫描 Stage。

使用 PyMuPDF ``get_text("dict")`` 进行字体级分析，
输出 ``DocumentCharacteristics``，为后续 Stage 的引擎选择与竞争策略提供决策依据。

委托关系：
- ``pdf.llm_orchestrator.LLMOrchestrator._quick_scan()`` — 核心扫描逻辑
"""

from __future__ import annotations

import logging
import re
from typing import Dict, List

from ...base import Stage, StageResult
from ...models import DocumentCharacteristics, PreprocessingOutput
from ...registry import register_tool
from .._base import PDFToolBase

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 工具适配器
# ---------------------------------------------------------------------------


@register_tool("quick_scan.pymupdf")
class FitzQuickScanner(PDFToolBase):
    """基于 PyMuPDF 的文档特征快速扫描工具。

    复用 ``LLMOrchestrator._quick_scan()`` 的核心扫描逻辑。
    """

    tool_name = "pymupdf"

    def is_available(self) -> bool:
        try:
            from ....pdf._imports import import_fitz

            import_fitz()
            return True
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[DocumentCharacteristics]:
        """对已预处理的 PDF 执行轻量级特征扫描。"""
        try:
            from ....pdf._imports import import_fitz

            fitz = import_fitz()

            doc = fitz.open(str(input_data.local_path))
            chars = DocumentCharacteristics(page_count=doc.page_count)

            # 确定扫描范围
            start_page = 0
            end_page = doc.page_count
            if input_data.page_range:
                start_page = max(0, input_data.page_range[0])
                end_page = min(doc.page_count, input_data.page_range[1])

            sample_texts: List[str] = []
            total_chars = 0
            image_count = 0
            math_font_count = 0
            table_indicator_count = 0
            native_table_count = 0
            code_indicator_count = 0
            code_font_count = 0
            inline_math_hits = 0

            # 仅扫描前 10 页（或指定范围内的前 10 页）
            # 学术论文数学公式常集中在方法/理论章节，可能不在前 5 页
            scan_pages = min(10, end_page - start_page)
            for page_idx in range(start_page, start_page + scan_pages):
                page = doc[page_idx]

                # 文本与字体分析
                text_dict = page.get_text("dict", flags=0)
                page_text = page.get_text("text")
                total_chars += len(page_text)
                if len("\n".join(sample_texts)) < 500:
                    sample_texts.append(page_text[:200])

                # 图片数量
                image_count += len(page.get_images())

                # 表格原生检测: PyMuPDF 1.23+ 内置 find_tables 比纯文本启发式准确得多
                # (尤其对数字版 PDF 用 ruling lines 与 column alignment 分析,
                # 而非依赖 markdown pipe 字符)。PR #163 矩阵实测显示纯 pipe-line
                # 启发式在 Context Engineering 2.0 上漏报 3 个真表格, 导致
                # ``ProfileAwareSelector`` 错误跳过 ``table_extraction``。
                try:
                    finder = page.find_tables()
                    native_table_count += len(getattr(finder, "tables", []) or [])
                except Exception:  # noqa: BLE001  # nosec B110 — find_tables 在旧版 fitz 可能不存在
                    pass

                # 字体分析: 检测数学字体 / 等宽 (代码) 字体
                for block in text_dict.get("blocks", []):
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            font_name = span.get("font", "").lower()
                            if any(
                                kw in font_name
                                for kw in (
                                    "math",
                                    "symbol",
                                    "cmr",
                                    "cmsy",
                                    "cmmi",
                                    "cmex",
                                    "cmbx",
                                    "stix",
                                    "cambria",
                                    "pazo",
                                )
                            ):
                                math_font_count += 1
                            # 等宽 / 代码字体: 提升 code_blocks 召回率
                            if any(
                                kw in font_name
                                for kw in (
                                    "mono",
                                    "courier",
                                    "consolas",
                                    "menlo",
                                    "code",
                                    "fira",
                                    "source code",
                                )
                            ):
                                code_font_count += 1

                # 文本级启发式: pipe-line 表格 + 代码 indent + inline math
                for line in page_text.split("\n"):
                    stripped = line.strip()
                    if (
                        stripped.startswith("|")
                        and stripped.endswith("|")
                        and stripped.count("|") >= 3
                    ):
                        table_indicator_count += 1
                    # 代码指示器
                    if re.match(r"^    \S", line) or "def " in line or "class " in line:
                        code_indicator_count += 1

                # inline math (避免漏报无数学字体但用 $...$ / \(...\) 的论文)
                inline_math_hits += len(re.findall(r"\$[^\$\n]{1,80}\$", page_text))
                inline_math_hits += len(re.findall(r"\\\([^)]{1,80}\\\)", page_text))

            doc.close()

            # 综合判断 (PR #164: 启发式从 OR 多源降低漏报):
            # - has_tables: 原生 find_tables 命中 ≥ 1 || pipe-line ≥ 3
            # - has_formulas: math 字体 ≥ 4 || inline math ≥ 3
            # - has_code_blocks: indent/def/class ≥ 5 || 等宽字体 ≥ 30 (代码块通常有大量等宽字符)
            chars.has_images = image_count > 0
            chars.has_formulas = math_font_count >= 3 or inline_math_hits >= 3
            chars.has_tables = native_table_count >= 1 or table_indicator_count > 2
            chars.has_code_blocks = code_indicator_count > 5 or code_font_count >= 30
            chars.sample_text = "\n".join(sample_texts)[:500]

            # 文本密度
            avg_chars_per_page = total_chars / max(scan_pages, 1)
            if avg_chars_per_page < 200:
                chars.text_density = "sparse"
                chars.is_scanned = True
            elif avg_chars_per_page > 2000:
                chars.text_density = "dense"
            else:
                chars.text_density = "normal"

            # 布局复杂度
            chars.has_complex_layout = (
                chars.has_tables or chars.has_formulas or chars.has_images
            )

            # 内容类型摘要
            content_types: List[str] = []
            if chars.has_tables:
                content_types.append("表格")
            if chars.has_formulas:
                content_types.append("数学公式")
            if chars.has_code_blocks:
                content_types.append("代码块")
            if chars.has_images:
                content_types.append("图片")
            chars.estimated_content_types = content_types or ["纯文本"]

            return StageResult(
                success=True,
                output=chars,
                engine_used=self.tool_name,
                metadata={
                    "scan_pages": scan_pages,
                    "total_chars": total_chars,
                    "image_count": image_count,
                    "math_font_count": math_font_count,
                    "inline_math_hits": inline_math_hits,
                    "native_table_count": native_table_count,
                    "table_indicator_count": table_indicator_count,
                    "code_indicator_count": code_indicator_count,
                    "code_font_count": code_font_count,
                },
            )

        except ImportError as e:
            return StageResult(success=False, error=f"PyMuPDF 未安装: {e}")
        except Exception as e:
            logger.exception("快速扫描阶段异常")
            return StageResult(success=False, error=f"快速扫描失败: {e}")


# ---------------------------------------------------------------------------
# Stage 本地工具映射
# ---------------------------------------------------------------------------

_TOOLS: Dict[str, type] = {
    "pymupdf": FitzQuickScanner,
}


# ---------------------------------------------------------------------------
# Stage 类
# ---------------------------------------------------------------------------


class QuickScanStage(Stage[PreprocessingOutput, DocumentCharacteristics]):
    """S1: 文档特征快速扫描 Stage。"""

    STAGE_ID = "quick_scan"
    STAGE_NAME = "文档特征快速扫描"
    TOOLS = _TOOLS

    @property
    def stage_id(self) -> str:
        return self.STAGE_ID

    @property
    def stage_name(self) -> str:
        return self.STAGE_NAME

    async def execute(
        self, input_data: PreprocessingOutput
    ) -> StageResult[DocumentCharacteristics]:
        """执行文档特征快速扫描。"""
        for tool_cls in _TOOLS.values():
            tool = tool_cls()
            if tool.is_available():
                return await tool.execute(input_data)
        return StageResult(success=False, error="无可用的扫描工具（pymupdf 未安装）")
