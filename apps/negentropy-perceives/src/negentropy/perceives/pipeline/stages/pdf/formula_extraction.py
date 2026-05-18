"""S5: 公式提取 Stage。

数学公式检测与 LaTeX 转换。

委托关系：
- ``pdf.math_formula.FormulaReconstructor`` — PyMuPDF 字体分析降级路径
- ``pdf.math_formula.DoclingFormulaEnricher`` — Docling CodeFormula 高保真路径
- ``pdf.mineru_engine.MinerUEngine`` — MinerU 公式提取
- ``pdf.docling_engine.DoclingEngine`` — Docling 全文转换中的公式
"""

from __future__ import annotations

import logging
from typing import Dict, List

from ...base import Stage, StageResult
from ...models import (
    ExtractedFormula,
    FormulaExtractionOutput,
    PreprocessingOutput,
)
from ...registry import register_tool
from .._base import PDFToolBase

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 工具适配器
# ---------------------------------------------------------------------------


@register_tool("formula_extraction.mineru")
class MinerUFormulaExtractor(PDFToolBase):
    """基于 MinerU 的公式提取工具。"""

    tool_name = "mineru"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.mineru import MinerUEngine

            return MinerUEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[FormulaExtractionOutput]:
        """使用 MinerU 提取数学公式。"""
        try:
            from ....core.cancellation import current_cancel_scope
            from ....infra import get_engine_pool
            from ....pdf.engines._mineru_kwargs import build_mineru_init_kwargs

            _scope = current_cancel_scope()
            result = await get_engine_pool().run(
                "mineru",
                kwargs={
                    "pdf_path": str(input_data.local_path),
                    "page_range": input_data.page_range,
                },
                init_kwargs=build_mineru_init_kwargs(),
                deadline_monotonic=_scope.deadline_monotonic if _scope else None,
            )
            if result is None:
                return StageResult(success=False, error="MinerU 转换返回空结果")

            formulas: List[ExtractedFormula] = []
            for idx, f in enumerate(result.formulas):
                formulas.append(
                    ExtractedFormula(
                        formula_id=f"formula_{idx}",
                        latex=f.latex,
                        formula_type=f.formula_type,
                        page_number=(f.page_number if f.page_number is not None else 0),
                        original_text=f.original_text,
                    )
                )

            inline_count = sum(1 for f in formulas if f.formula_type == "inline")
            block_count = sum(1 for f in formulas if f.formula_type == "block")

            output = FormulaExtractionOutput(
                formulas=formulas,
                inline_count=inline_count,
                block_count=block_count,
                metadata={"engine": "mineru"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("MinerU 公式提取失败: %s", e)
            return StageResult(success=False, error=f"MinerU 公式提取失败: {e}")


@register_tool("formula_extraction.docling")
class DoclingFormulaExtractor(PDFToolBase):
    """基于 Docling 的公式提取工具。"""

    tool_name = "docling"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.docling import DoclingEngine

            return DoclingEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[FormulaExtractionOutput]:
        """使用 Docling 提取公式。"""
        try:
            from ....core.cancellation import current_cancel_scope
            from ....infra import get_engine_pool
            from ....pdf.engines._docling_kwargs import build_docling_init_kwargs

            _scope = current_cancel_scope()
            # 跨 Stage 共享 init_kwargs 以触发 worker 内 _ConvertCache 命中
            # （DoclingEngine 默认已启用 enable_formula_enrichment=True；
            # MPS 设备上 device_config 会自动降级 formula_enrichment=False，
            # 与传入显式 True 等价）。
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

            formulas: List[ExtractedFormula] = []
            for idx, f in enumerate(result.formulas):
                formulas.append(
                    ExtractedFormula(
                        formula_id=f"formula_{idx}",
                        latex=f.latex,
                        formula_type=f.formula_type,
                        page_number=(f.page_number if f.page_number is not None else 0),
                        original_text=f.original_text,
                    )
                )

            inline_count = sum(1 for f in formulas if f.formula_type == "inline")
            block_count = sum(1 for f in formulas if f.formula_type == "block")

            output = FormulaExtractionOutput(
                formulas=formulas,
                inline_count=inline_count,
                block_count=block_count,
                metadata={"engine": "docling"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("Docling 公式提取失败: %s", e)
            return StageResult(success=False, error=f"Docling 公式提取失败: {e}")


@register_tool("formula_extraction.pymupdf_heuristic")
class FitzHeuristicFormulaExtractor(PDFToolBase):
    """基于 PyMuPDF 字体分析的启发式公式提取工具。

    委托给 ``FormulaReconstructor``，通过字体检测与 Unicode 映射重建 LaTeX。
    """

    tool_name = "pymupdf_heuristic"

    def is_available(self) -> bool:
        try:
            from ....pdf._imports import import_fitz

            import_fitz()
            return True
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[FormulaExtractionOutput]:
        """使用 PyMuPDF 字体分析提取公式。"""
        try:
            from ....pdf._imports import import_fitz
            from ....pdf.math_formula import FormulaReconstructor

            fitz = import_fitz()
            reconstructor = FormulaReconstructor()

            doc = fitz.open(str(input_data.local_path))
            start_page = 0
            end_page = doc.page_count
            if input_data.page_range:
                start_page = max(0, input_data.page_range[0])
                end_page = min(doc.page_count, input_data.page_range[1])

            formulas: List[ExtractedFormula] = []
            formula_idx = 0

            for page_idx in range(start_page, end_page):
                page = doc[page_idx]
                _, math_regions = reconstructor.extract_formulas_from_page(
                    page, page_idx
                )
                for region in math_regions:
                    bbox = None
                    if region.bbox:
                        bbox = (
                            region.bbox.get("x0", 0),
                            region.bbox.get("y0", 0),
                            region.bbox.get("x1", 0),
                            region.bbox.get("y1", 0),
                        )
                    formulas.append(
                        ExtractedFormula(
                            formula_id=f"formula_{formula_idx}",
                            latex=region.latex,
                            formula_type=region.formula_type,
                            page_number=page_idx,
                            bbox=bbox,
                            original_text=region.original_text,
                        )
                    )
                    formula_idx += 1

            doc.close()

            inline_count = sum(1 for f in formulas if f.formula_type == "inline")
            block_count = sum(1 for f in formulas if f.formula_type == "block")

            output = FormulaExtractionOutput(
                formulas=formulas,
                inline_count=inline_count,
                block_count=block_count,
                metadata={"engine": "pymupdf_heuristic"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("PyMuPDF 启发式公式提取失败: %s", e)
            return StageResult(
                success=False,
                error=f"PyMuPDF 启发式公式提取失败: {e}",
            )


# ---------------------------------------------------------------------------
# Stage 本地工具映射
# ---------------------------------------------------------------------------

_TOOLS: Dict[str, type] = {
    "mineru": MinerUFormulaExtractor,
    "docling": DoclingFormulaExtractor,
    "pymupdf_heuristic": FitzHeuristicFormulaExtractor,
}


# ---------------------------------------------------------------------------
# Stage 类
# ---------------------------------------------------------------------------


class FormulaExtractionStage(Stage[PreprocessingOutput, FormulaExtractionOutput]):
    """S5: 公式提取 Stage。"""

    STAGE_ID = "formula_extraction"
    STAGE_NAME = "数学公式提取"
    TOOLS = _TOOLS

    @property
    def stage_id(self) -> str:
        return self.STAGE_ID

    @property
    def stage_name(self) -> str:
        return self.STAGE_NAME

    async def execute(
        self, input_data: PreprocessingOutput
    ) -> StageResult[FormulaExtractionOutput]:
        """按降级顺序执行公式提取。"""
        for tool_cls in _TOOLS.values():
            tool = tool_cls()
            if tool.is_available():
                result = await tool.execute(input_data)
                if result.success:
                    return result
        return StageResult(success=False, error="无可用的公式提取工具")
