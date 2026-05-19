"""S4: 表格提取 Stage。

结构化表格识别与 Markdown 表格生成。

委托关系：
- ``pdf.docling_engine.DoclingEngine`` — Docling TableFormer 表格识别
- ``pdf.enhanced.EnhancedPDFProcessor`` — PyMuPDF 启发式表格提取
"""

from __future__ import annotations

import logging
from typing import Dict, List

from ...base import Stage, StageResult
from ...models import (
    ExtractedTable,
    PreprocessingOutput,
    TableExtractionOutput,
)
from ...registry import register_tool
from .._base import PDFToolBase

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 工具适配器
# ---------------------------------------------------------------------------


@register_tool("table_extraction.docling")
class DoclingTableExtractor(PDFToolBase):
    """基于 Docling TableFormer 的表格提取工具。"""

    tool_name = "docling"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.docling import DoclingEngine

            return DoclingEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[TableExtractionOutput]:
        """使用 Docling 提取结构化表格。"""
        try:
            from ....core.cancellation import current_cancel_scope
            from ....infra import get_engine_pool
            from ....pdf.engines._docling_kwargs import build_docling_init_kwargs

            _scope = current_cancel_scope()
            # 跨 Stage 共享 init_kwargs 以触发 worker 内 _ConvertCache 命中
            # （DoclingEngine 默认已启用 enable_table_structure=True）。
            result = await get_engine_pool().run(
                "docling",
                kwargs={
                    "pdf_path": str(input_data.local_path),
                    "page_range": input_data.page_range,
                },
                init_kwargs=build_docling_init_kwargs(),
                deadline_monotonic=_scope.deadline_monotonic if _scope else None,
            )
            if result is None:
                return StageResult(success=False, error="Docling 转换返回空结果")

            tables: List[ExtractedTable] = []
            for idx, table in enumerate(result.tables):
                tables.append(
                    ExtractedTable(
                        table_id=f"tbl_{idx}",
                        markdown=table.markdown,
                        rows=table.rows,
                        columns=table.columns,
                        page_number=(
                            table.page_number if table.page_number is not None else 0
                        ),
                        bbox=table.bbox,
                        caption=table.caption,
                    )
                )

            output = TableExtractionOutput(
                tables=tables,
                total_count=len(tables),
                metadata={"engine": "docling"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("Docling 表格提取失败: %s", e)
            return StageResult(success=False, error=f"Docling 表格提取失败: {e}")


@register_tool("table_extraction.pymupdf")
class FitzTableExtractor(PDFToolBase):
    """基于 PyMuPDF 的启发式表格提取工具。

    委托给 ``EnhancedPDFProcessor.extract_tables_with_geometry()``。
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
    ) -> StageResult[TableExtractionOutput]:
        """使用 PyMuPDF 启发式提取表格。"""
        try:
            from ....pdf._imports import import_fitz
            from ....pdf.enhanced import EnhancedPDFProcessor

            fitz = import_fitz()
            processor = EnhancedPDFProcessor()

            doc = fitz.open(str(input_data.local_path))
            start_page = 0
            end_page = doc.page_count
            if input_data.page_range:
                start_page = max(0, input_data.page_range[0])
                end_page = min(doc.page_count, input_data.page_range[1])

            tables: List[ExtractedTable] = []
            table_idx = 0

            for page_idx in range(start_page, end_page):
                page = doc[page_idx]
                # extract_tables_with_geometry(pdf_document, page_num, text_blocks)
                # 返回 (bbox_map, all_tables)；遵循 pdf/processor.py 调用范式。
                text_blocks = page.get_text("blocks")
                _, page_tables = processor.extract_tables_with_geometry(
                    doc,
                    page_idx,
                    text_blocks,
                )
                for extracted_table in page_tables:
                    tables.append(
                        ExtractedTable(
                            table_id=f"tbl_{table_idx}",
                            markdown=extracted_table.markdown,
                            rows=extracted_table.rows,
                            columns=extracted_table.columns,
                            page_number=page_idx,
                            bbox=extracted_table.bbox,
                            caption=extracted_table.caption,
                            headers=extracted_table.headers,
                        )
                    )
                    table_idx += 1

            doc.close()

            output = TableExtractionOutput(
                tables=tables,
                total_count=len(tables),
                metadata={"engine": "pymupdf"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("PyMuPDF 表格提取失败: %s", e)
            return StageResult(success=False, error=f"PyMuPDF 表格提取失败: {e}")


@register_tool("table_extraction.camelot")
class CamelotTableExtractor(PDFToolBase):
    """基于 Camelot 的表格提取工具。"""

    tool_name = "camelot"

    def is_available(self) -> bool:
        try:
            import camelot  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[TableExtractionOutput]:
        """使用 Camelot 提取表格。"""
        try:
            import camelot

            pages = "all"
            if input_data.page_range:
                # Camelot 页码从 1 开始
                start_p = input_data.page_range[0] + 1
                end_p = input_data.page_range[1]
                pages = f"{start_p}-{end_p}"

            raw_tables = camelot.read_pdf(str(input_data.local_path), pages=pages)

            tables: List[ExtractedTable] = []
            for idx, table in enumerate(raw_tables):
                md = table.df.to_markdown(index=False)
                rows, cols = table.df.shape
                tables.append(
                    ExtractedTable(
                        table_id=f"tbl_{idx}",
                        markdown=md,
                        rows=rows,
                        columns=cols,
                        page_number=table.page - 1,  # 转为 0-based
                    )
                )

            output = TableExtractionOutput(
                tables=tables,
                total_count=len(tables),
                metadata={"engine": "camelot"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("Camelot 表格提取失败: %s", e)
            return StageResult(success=False, error=f"Camelot 表格提取失败: {e}")


@register_tool("table_extraction.pdfplumber")
class PDFPlumberTableExtractor(PDFToolBase):
    """基于 pdfplumber 的表格提取工具。"""

    tool_name = "pdfplumber"

    def is_available(self) -> bool:
        try:
            import pdfplumber  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[TableExtractionOutput]:
        """使用 pdfplumber 提取表格。"""
        try:
            import pdfplumber

            pdf = pdfplumber.open(str(input_data.local_path))
            start_page = 0
            end_page = len(pdf.pages)
            if input_data.page_range:
                start_page = max(0, input_data.page_range[0])
                end_page = min(len(pdf.pages), input_data.page_range[1])

            tables: List[ExtractedTable] = []
            table_idx = 0

            for page_idx in range(start_page, end_page):
                page = pdf.pages[page_idx]
                page_tables = page.extract_tables()
                for raw_table in page_tables:
                    if not raw_table:
                        continue
                    # 构建 Markdown 表格
                    headers = raw_table[0] if raw_table else []
                    md_lines = []
                    if headers:
                        md_lines.append(
                            "| " + " | ".join(str(h or "") for h in headers) + " |"
                        )
                        md_lines.append(
                            "| " + " | ".join("---" for _ in headers) + " |"
                        )
                    for row in raw_table[1:]:
                        md_lines.append(
                            "| " + " | ".join(str(c or "") for c in row) + " |"
                        )

                    md = "\n".join(md_lines)
                    tables.append(
                        ExtractedTable(
                            table_id=f"tbl_{table_idx}",
                            markdown=md,
                            rows=len(raw_table) - 1,
                            columns=len(headers),
                            page_number=page_idx,
                            headers=[str(h or "") for h in headers],
                        )
                    )
                    table_idx += 1

            pdf.close()

            output = TableExtractionOutput(
                tables=tables,
                total_count=len(tables),
                metadata={"engine": "pdfplumber"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("pdfplumber 表格提取失败: %s", e)
            return StageResult(success=False, error=f"pdfplumber 表格提取失败: {e}")


@register_tool("table_extraction.opendataloader")
class OpenDataLoaderTableExtractor(PDFToolBase):
    """基于 OpenDataLoader 的表格提取工具（Apache-2.0 / CPU-only / 全元素 bbox）。"""

    tool_name = "opendataloader"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.opendataloader import OpenDataLoaderEngine

            return OpenDataLoaderEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[TableExtractionOutput]:
        try:
            from ....core.cancellation import current_cancel_scope
            from ....infra import get_engine_pool

            _scope = current_cancel_scope()
            result = await get_engine_pool().run(
                "opendataloader",
                kwargs={"pdf_path": str(input_data.local_path)},
                init_kwargs={},
                deadline_monotonic=_scope.deadline_monotonic if _scope else None,
            )
            if result is None:
                return StageResult(success=False, error="OpenDataLoader 转换返回空结果")

            tables: List[ExtractedTable] = []
            for idx, t in enumerate(result.tables):
                tables.append(
                    ExtractedTable(
                        table_id=f"tbl_{idx}",
                        markdown=t.markdown,
                        rows=t.rows,
                        columns=t.columns,
                        page_number=(t.page_number if t.page_number is not None else 0),
                        bbox=t.bbox,
                    )
                )

            output = TableExtractionOutput(
                tables=tables,
                total_count=len(tables),
                metadata={"engine": "opendataloader"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("OpenDataLoader 表格提取失败: %s", e)
            return StageResult(success=False, error=f"OpenDataLoader 表格提取失败: {e}")


# ---------------------------------------------------------------------------
# Stage 本地工具映射
# ---------------------------------------------------------------------------

_TOOLS: Dict[str, type] = {
    "docling": DoclingTableExtractor,
    "camelot": CamelotTableExtractor,
    "pdfplumber": PDFPlumberTableExtractor,
    "pymupdf": FitzTableExtractor,
    "opendataloader": OpenDataLoaderTableExtractor,
}


# ---------------------------------------------------------------------------
# Stage 类
# ---------------------------------------------------------------------------


class TableExtractionStage(Stage[PreprocessingOutput, TableExtractionOutput]):
    """S4: 表格提取 Stage。"""

    STAGE_ID = "table_extraction"
    STAGE_NAME = "表格识别与提取"
    TOOLS = _TOOLS

    @property
    def stage_id(self) -> str:
        return self.STAGE_ID

    @property
    def stage_name(self) -> str:
        return self.STAGE_NAME

    async def execute(
        self, input_data: PreprocessingOutput
    ) -> StageResult[TableExtractionOutput]:
        """按降级顺序执行表格提取。"""
        for tool_cls in _TOOLS.values():
            tool = tool_cls()
            if tool.is_available():
                result = await tool.execute(input_data)
                if result.success:
                    return result

        # 诊断：区分"工具不可用"和"工具可用但提取失败"两种场景
        unavailable = [name for name, cls in _TOOLS.items() if not cls().is_available()]
        if unavailable:
            logger.warning(
                "无可用的表格提取工具。不可用: %s。"
                "提示: 安装 camelot-py 需同时安装 ghostscript "
                '(uv add "negentropy-perceives[table-extras]")',
                unavailable,
            )
        else:
            logger.warning(
                "所有表格提取工具均可用但提取失败，请检查 PDF 内容是否包含有效表格结构",
            )
        return StageResult(success=False, error="无可用的表格提取工具")
