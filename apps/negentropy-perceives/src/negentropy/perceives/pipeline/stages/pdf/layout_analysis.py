"""S2: 版面分析 Stage。

检测文档物理布局结构（文本区域、表格、图片、公式、代码块等），
确定正确阅读顺序。这是竞争模式的核心 Stage。

委托关系：
- ``pdf.docling_engine.DoclingEngine`` — Docling AI 布局分析
- ``pdf.mineru_engine.MinerUEngine`` — MinerU DocLayout-YOLO
- ``pdf.marker_engine.MarkerEngine`` — Marker Surya layout
- PyMuPDF — 启发式分析（基于字体大小/位置）
"""

from __future__ import annotations

import logging
from typing import Dict, List, Tuple

from ...base import Stage, StageResult
from ...models import LayoutAnalysisOutput, LayoutRegion, PreprocessingOutput
from ...registry import register_tool
from .._base import PDFToolBase

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 工具适配器
# ---------------------------------------------------------------------------


@register_tool("layout_analysis.docling")
class DoclingLayoutAnalyzer(PDFToolBase):
    """基于 Docling 的版面分析工具。"""

    tool_name = "docling"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.docling import DoclingEngine

            return DoclingEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[LayoutAnalysisOutput]:
        """使用 Docling 执行版面分析。"""
        try:
            from ....core.cancellation import current_cancel_scope
            from ....infra import get_engine_pool
            from ....pdf.engines._docling_kwargs import build_docling_init_kwargs

            _scope = current_cancel_scope()
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

            # 从 Docling 文档对象中提取布局区域
            regions: List[LayoutRegion] = []
            reading_order = 0

            # Docling 的 iterate_items 按阅读顺序遍历文档元素
            if hasattr(result, "markdown") and result.markdown:
                # 从表格中提取布局区域
                for table in result.tables:
                    regions.append(
                        LayoutRegion(
                            region_type="table",
                            bbox=table.bbox or (0, 0, 0, 0),
                            page_number=table.page_number or 0,
                            reading_order=reading_order,
                        )
                    )
                    reading_order += 1

                # 从图片中提取布局区域
                for image in result.images:
                    bbox = (0.0, 0.0, 0.0, 0.0)
                    if image.bbox:
                        bbox = image.bbox  # type: ignore[assignment]
                    regions.append(
                        LayoutRegion(
                            region_type="figure",
                            bbox=bbox,
                            page_number=image.page_number or 0,
                            reading_order=reading_order,
                            metadata={
                                "caption": image.caption or "",
                                "classification": image.classification or "",
                            },
                        )
                    )
                    reading_order += 1

                # 从公式中提取布局区域
                for formula in result.formulas:
                    regions.append(
                        LayoutRegion(
                            region_type="formula",
                            bbox=(0, 0, 0, 0),
                            page_number=formula.page_number or 0,
                            reading_order=reading_order,
                        )
                    )
                    reading_order += 1

                # 代码块
                for code_block in result.code_blocks:
                    regions.append(
                        LayoutRegion(
                            region_type="code",
                            bbox=(0, 0, 0, 0),
                            page_number=code_block.page_number or 0,
                            reading_order=reading_order,
                            metadata={"language": code_block.language or ""},
                        )
                    )
                    reading_order += 1

            output = LayoutAnalysisOutput(
                regions=regions,
                page_count=result.page_count,
                metadata={"engine": "docling"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("Docling 版面分析失败: %s", e)
            return StageResult(success=False, error=f"Docling 版面分析失败: {e}")


@register_tool("layout_analysis.mineru")
class MinerULayoutAnalyzer(PDFToolBase):
    """基于 MinerU 的版面分析工具。"""

    tool_name = "mineru"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.mineru import MinerUEngine

            return MinerUEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[LayoutAnalysisOutput]:
        """使用 MinerU 执行版面分析。"""
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

            regions: List[LayoutRegion] = []
            reading_order = 0

            for table in result.tables:
                regions.append(
                    LayoutRegion(
                        region_type="table",
                        bbox=table.bbox or (0, 0, 0, 0),
                        page_number=table.page_number or 0,
                        reading_order=reading_order,
                    )
                )
                reading_order += 1

            for image in result.images:
                regions.append(
                    LayoutRegion(
                        region_type="figure",
                        bbox=image.bbox or (0, 0, 0, 0),
                        page_number=image.page_number or 0,
                        reading_order=reading_order,
                    )
                )
                reading_order += 1

            for formula in result.formulas:
                regions.append(
                    LayoutRegion(
                        region_type="formula",
                        bbox=(0, 0, 0, 0),
                        page_number=formula.page_number or 0,
                        reading_order=reading_order,
                    )
                )
                reading_order += 1

            output = LayoutAnalysisOutput(
                regions=regions,
                page_count=result.page_count,
                metadata={"engine": "mineru"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("MinerU 版面分析失败: %s", e)
            return StageResult(success=False, error=f"MinerU 版面分析失败: {e}")


@register_tool("layout_analysis.marker")
class MarkerLayoutAnalyzer(PDFToolBase):
    """基于 Marker 的版面分析工具。"""

    tool_name = "marker"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.marker import MarkerEngine

            return MarkerEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[LayoutAnalysisOutput]:
        """使用 Marker 执行版面分析。"""
        try:
            from ....core.cancellation import current_cancel_scope
            from ....infra import get_engine_pool
            from ....pdf.engines._marker_kwargs import build_marker_init_kwargs

            _scope = current_cancel_scope()
            result = await get_engine_pool().run(
                "marker",
                kwargs={"pdf_path": str(input_data.local_path)},
                init_kwargs=build_marker_init_kwargs(),
                deadline_monotonic=_scope.deadline_monotonic if _scope else None,
            )
            if result is None:
                return StageResult(success=False, error="Marker 转换返回空结果")

            regions: List[LayoutRegion] = []
            reading_order = 0

            for table in result.tables:
                regions.append(
                    LayoutRegion(
                        region_type="table",
                        bbox=(0, 0, 0, 0),
                        page_number=table.page_number or 0,
                        reading_order=reading_order,
                    )
                )
                reading_order += 1

            for image in result.images:
                regions.append(
                    LayoutRegion(
                        region_type="figure",
                        bbox=(0, 0, 0, 0),
                        page_number=image.page_number or 0,
                        reading_order=reading_order,
                    )
                )
                reading_order += 1

            for formula in result.formulas:
                regions.append(
                    LayoutRegion(
                        region_type="formula",
                        bbox=(0, 0, 0, 0),
                        page_number=formula.page_number or 0,
                        reading_order=reading_order,
                    )
                )
                reading_order += 1

            for code_block in result.code_blocks:
                regions.append(
                    LayoutRegion(
                        region_type="code",
                        bbox=(0, 0, 0, 0),
                        page_number=code_block.page_number or 0,
                        reading_order=reading_order,
                    )
                )
                reading_order += 1

            output = LayoutAnalysisOutput(
                regions=regions,
                page_count=result.page_count,
                metadata={"engine": "marker"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("Marker 版面分析失败: %s", e)
            return StageResult(success=False, error=f"Marker 版面分析失败: {e}")


@register_tool("layout_analysis.pymupdf")
class FitzLayoutAnalyzer(PDFToolBase):
    """基于 PyMuPDF 的启发式版面分析工具。

    通过分析字体大小、位置和块类型进行启发式布局检测。
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
    ) -> StageResult[LayoutAnalysisOutput]:
        """使用 PyMuPDF 启发式方法执行版面分析。"""
        try:
            from ....pdf._imports import import_fitz

            fitz = import_fitz()

            doc = fitz.open(str(input_data.local_path))
            start_page = 0
            end_page = doc.page_count
            if input_data.page_range:
                start_page = max(0, input_data.page_range[0])
                end_page = min(doc.page_count, input_data.page_range[1])

            regions: List[LayoutRegion] = []
            reading_order = 0

            for page_idx in range(start_page, end_page):
                page = doc[page_idx]
                blocks = page.get_text("dict", flags=0).get("blocks", [])

                for block in blocks:
                    block_type = block.get("type", 0)
                    bbox_raw = block.get("bbox", [0, 0, 0, 0])
                    bbox: Tuple[float, float, float, float] = (
                        float(bbox_raw[0]),
                        float(bbox_raw[1]),
                        float(bbox_raw[2]),
                        float(bbox_raw[3]),
                    )

                    if block_type == 1:
                        # 图片块
                        regions.append(
                            LayoutRegion(
                                region_type="figure",
                                bbox=bbox,
                                page_number=page_idx,
                                reading_order=reading_order,
                            )
                        )
                        reading_order += 1
                    elif block_type == 0:
                        # 文本块：通过字体大小启发式判断类型
                        lines = block.get("lines", [])
                        if not lines:
                            continue

                        # 计算该块的平均字号
                        font_sizes = []
                        for line in lines:
                            for span in line.get("spans", []):
                                size = span.get("size", 0)
                                if size > 0:
                                    font_sizes.append(size)

                        region_type = "text"
                        if font_sizes:
                            avg_size = sum(font_sizes) / len(font_sizes)
                            # 大字号 -> 标题
                            if avg_size > 14:
                                region_type = "header"

                        regions.append(
                            LayoutRegion(
                                region_type=region_type,
                                bbox=bbox,
                                page_number=page_idx,
                                reading_order=reading_order,
                                confidence=0.6,
                            )
                        )
                        reading_order += 1

            doc.close()

            output = LayoutAnalysisOutput(
                regions=regions,
                page_count=end_page - start_page,
                metadata={"engine": "pymupdf_heuristic"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("PyMuPDF 版面分析失败: %s", e)
            return StageResult(success=False, error=f"PyMuPDF 版面分析失败: {e}")


# ---------------------------------------------------------------------------
# Stage 本地工具映射
# ---------------------------------------------------------------------------

_TOOLS: Dict[str, type] = {
    "docling": DoclingLayoutAnalyzer,
    "mineru": MinerULayoutAnalyzer,
    "marker": MarkerLayoutAnalyzer,
    "pymupdf": FitzLayoutAnalyzer,
}


# ---------------------------------------------------------------------------
# OpenDataLoader 版面分析工具（延迟导入避免 Java/JVM 启动开销）
# ---------------------------------------------------------------------------


@register_tool("layout_analysis.opendataloader")
class OpenDataLoaderLayoutAnalyzer(PDFToolBase):
    """基于 OpenDataLoader 的版面分析工具（Apache-2.0 / CPU-only / 全元素 bbox）。"""

    tool_name = "opendataloader"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.opendataloader import OpenDataLoaderEngine

            return OpenDataLoaderEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[LayoutAnalysisOutput]:
        try:
            from ....core.cancellation import current_cancel_scope
            from ....infra import get_engine_pool

            _scope = current_cancel_scope()
            result = await get_engine_pool().run(
                "opendataloader",
                kwargs={
                    "pdf_path": str(input_data.local_path),
                },
                init_kwargs={},
                deadline_monotonic=_scope.deadline_monotonic if _scope else None,
            )
            if result is None:
                return StageResult(success=False, error="OpenDataLoader 转换返回空结果")

            regions: List[LayoutRegion] = []
            reading_order = 0

            for table in result.tables:
                regions.append(
                    LayoutRegion(
                        region_type="table",
                        bbox=table.bbox or (0, 0, 0, 0),
                        page_number=table.page_number or 0,
                        reading_order=reading_order,
                    )
                )
                reading_order += 1

            for image in result.images:
                regions.append(
                    LayoutRegion(
                        region_type="figure",
                        bbox=image.bbox or (0, 0, 0, 0),
                        page_number=image.page_number or 0,
                        reading_order=reading_order,
                    )
                )
                reading_order += 1

            output = LayoutAnalysisOutput(
                regions=regions,
                page_count=result.page_count,
                metadata={"engine": "opendataloader"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("OpenDataLoader 版面分析失败: %s", e)
            return StageResult(success=False, error=f"OpenDataLoader 版面分析失败: {e}")


# 更新 tools 映射
_TOOLS["opendataloader"] = OpenDataLoaderLayoutAnalyzer


# ---------------------------------------------------------------------------
# Stage 类
# ---------------------------------------------------------------------------


class LayoutAnalysisStage(Stage[PreprocessingOutput, LayoutAnalysisOutput]):
    """S2: 版面分析与阅读顺序 Stage。"""

    STAGE_ID = "layout_analysis"
    STAGE_NAME = "版面分析与阅读顺序"
    TOOLS = _TOOLS

    @property
    def stage_id(self) -> str:
        return self.STAGE_ID

    @property
    def stage_name(self) -> str:
        return self.STAGE_NAME

    async def execute(
        self, input_data: PreprocessingOutput
    ) -> StageResult[LayoutAnalysisOutput]:
        """按降级顺序执行版面分析。"""
        for tool_cls in _TOOLS.values():
            tool = tool_cls()
            if tool.is_available():
                result = await tool.execute(input_data)
                if result.success:
                    return result
        return StageResult(success=False, error="无可用的版面分析工具")
