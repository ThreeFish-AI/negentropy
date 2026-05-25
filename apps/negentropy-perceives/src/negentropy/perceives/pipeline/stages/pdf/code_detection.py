"""S7: 代码块检测 Stage。

代码块与算法/伪代码检测，支持多引擎竞争。

委托关系：
- ``pdf.docling_engine.DoclingEngine`` — Docling CodeFormula 代码块提取
- ``pdf.marker_engine.MarkerEngine`` — Marker 代码块提取
- ``markdown.algorithm_detector`` — 启发式算法/伪代码检测
"""

from __future__ import annotations

import logging
from importlib.util import find_spec
from typing import Dict, List

from ...base import Stage, StageResult
from ...models import (
    CodeDetectionOutput,
    ExtractedCodeBlock,
    PreprocessingOutput,
)
from ...registry import register_tool
from .._base import PDFToolBase

logger = logging.getLogger(__name__)


def _docling_code_enrichment_disabled() -> bool:
    """检测当前运行环境下 docling 是否会静默禁用 ``do_code_enrichment``。

    与 ``pdf/engines/docling.py::_configure_mps_code_formula_options`` 的判定
    对齐:

    - device != ``mps`` (CPU / CUDA / XPU): docling 走 default preset, 不依赖
      mlx_vlm, code enrichment 正常启用 → 返回 False
    - device == ``mps`` 且 ``mlx_vlm`` 不可用: docling 主动 ``do_code_enrichment
      = False`` 避免 pipeline 退回 CPU → 返回 True
    - device == ``mps`` 且 ``mlx_vlm`` 可用: 走 granite_mlx preset → 返回 False
    - ``pdf_docling_mps_enrichment == "disable"``: 用户显式关闭 → 返回 True

    Returns:
        True 表示当前环境下 docling 不会输出 code_blocks, ``DoclingCodeDetector``
        应主动返回 ``success=False`` 触发 scheduler 降级到 ``algorithm_detector``,
        避免"空 code_blocks 假成功"造成有代码 PDF 被静默漏检 (PR #163 留下的边界
        情况, 修复见本文件 ``DoclingCodeDetector._run`` 的 early-return)。
    """
    try:
        from ....config import settings

        policy = str(
            getattr(settings, "pdf_docling_mps_enrichment", "granite_mlx")
        ).lower()
    except (ImportError, AttributeError):
        policy = "granite_mlx"

    if policy == "disable":
        return True

    try:
        from ....pdf.hardware.detection import DeviceType, detect_device

        # 直接持有 ``DeviceType`` 枚举: 不能用 ``str(DeviceType.MPS)`` —— 在 Python
        # 3.13 上 ``str``-mixin Enum 的 ``__str__`` 仍返回 ``'DeviceType.MPS'``
        # (只有 ``enum.StrEnum`` 才会回退到 ``.value``), 经 ``.lower()`` 后
        # ``'devicetype.mps' != 'mps'``, 会让本函数在真实 MPS 硬件上恒返回
        # False, mps + no-mlx_vlm 安全网失效。
        device = detect_device() or DeviceType.CPU
    except Exception:  # noqa: BLE001 — 探测失败保守认为未禁用
        return False

    if device != DeviceType.MPS:
        return False

    return find_spec("mlx_vlm") is None


# ---------------------------------------------------------------------------
# 工具适配器
# ---------------------------------------------------------------------------


@register_tool("code_detection.docling")
class DoclingCodeDetector(PDFToolBase):
    """基于 Docling 的代码块检测工具。"""

    tool_name = "docling"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.docling import DoclingEngine

            return DoclingEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[CodeDetectionOutput]:
        """使用 Docling 检测代码块。

        Early-return: 若当前运行环境下 docling 会静默禁用 code enrichment
        (mps + mlx_vlm 缺失, 或 ``pdf_docling_mps_enrichment=disable``),
        直接返回 ``success=False`` 触发 scheduler 降级到 ``algorithm_detector``,
        避免"空 code_blocks 假成功"导致有代码 PDF 被静默漏检, 同时省去 docling
        冷启动开销。
        """
        if _docling_code_enrichment_disabled():
            logger.info(
                "Docling code enrichment 在当前运行环境下被静默禁用 "
                "(mps + mlx_vlm 缺失 或 policy=disable); "
                "code_detection Stage 已转交 scheduler 降级至 algorithm_detector"
            )
            return StageResult(
                success=False,
                error=(
                    "docling code enrichment disabled "
                    "(mlx_vlm unavailable on mps or policy=disable); "
                    "降级至 algorithm_detector"
                ),
            )

        try:
            from ....core.cancellation import current_cancel_scope
            from ....infra import get_engine_pool
            from ....pdf.engines._docling_kwargs import build_docling_init_kwargs

            _scope = current_cancel_scope()
            # 跨 Stage 共享 init_kwargs 以触发 worker 内 _ConvertCache 命中。
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

            code_blocks: List[ExtractedCodeBlock] = []
            for idx, cb in enumerate(result.code_blocks):
                code_blocks.append(
                    ExtractedCodeBlock(
                        code_id=f"code_{idx}",
                        code=cb.code,
                        language=cb.language,
                        page_number=(
                            cb.page_number if cb.page_number is not None else 0
                        ),
                        confidence=0.9,
                    )
                )

            output = CodeDetectionOutput(
                code_blocks=code_blocks,
                total_count=len(code_blocks),
                metadata={"engine": "docling"},
            )

            # 空结果时降级到 algorithm_detector：学术论文的伪代码
            # 无缩进/等宽字体特征，Docling 通常检测不到
            if not code_blocks:
                return StageResult(
                    success=False,
                    error="Docling 未检测到代码块，降级至 algorithm_detector",
                )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("Docling 代码块检测失败: %s", e)
            return StageResult(success=False, error=f"Docling 代码块检测失败: {e}")


@register_tool("code_detection.marker")
class MarkerCodeDetector(PDFToolBase):
    """基于 Marker 的代码块检测工具。"""

    tool_name = "marker"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.marker import MarkerEngine

            return MarkerEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[CodeDetectionOutput]:
        """使用 Marker 检测代码块。"""
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

            code_blocks: List[ExtractedCodeBlock] = []
            for idx, cb in enumerate(result.code_blocks):
                code_blocks.append(
                    ExtractedCodeBlock(
                        code_id=f"code_{idx}",
                        code=cb.code,
                        language=cb.language,
                        page_number=(
                            cb.page_number if cb.page_number is not None else 0
                        ),
                        confidence=0.85,
                    )
                )

            output = CodeDetectionOutput(
                code_blocks=code_blocks,
                total_count=len(code_blocks),
                metadata={"engine": "marker"},
            )

            if not code_blocks:
                return StageResult(
                    success=False,
                    error="Marker 未检测到代码块，降级至 algorithm_detector",
                )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("Marker 代码块检测失败: %s", e)
            return StageResult(success=False, error=f"Marker 代码块检测失败: {e}")


@register_tool("code_detection.algorithm_detector")
class AlgorithmCodeDetector(PDFToolBase):
    """基于启发式评分的算法/伪代码检测工具。

    委托给 ``markdown.algorithm_detector.detect_algorithm_regions()``，
    在已提取的文本中扫描算法伪代码区域。
    """

    tool_name = "algorithm_detector"

    def is_available(self) -> bool:
        try:
            from ....markdown.algorithm_detector import detect_algorithm_regions  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[CodeDetectionOutput]:
        """使用启发式评分检测算法/伪代码块。

        从 PDF 中提取全文，然后用 ``detect_algorithm_regions()`` 扫描。
        """
        try:
            from ....markdown.algorithm_detector import (
                detect_algorithm_regions,
            )
            from ....pdf._imports import import_fitz

            fitz = import_fitz()

            doc = fitz.open(str(input_data.local_path))
            start_page = 0
            end_page = doc.page_count
            if input_data.page_range:
                start_page = max(0, input_data.page_range[0])
                end_page = min(doc.page_count, input_data.page_range[1])

            # 逐页扫描算法块，把页码绑定到每个 region；避免全文拼接后页码丢失，
            # 导致 assembly 把跨页算法块全部锚定到首页 (page=0) 顶部。
            code_blocks: List[ExtractedCodeBlock] = []
            counter = 0
            for page_idx in range(start_page, end_page):
                page = doc[page_idx]
                page_text = page.get_text("text")
                if not page_text.strip():
                    continue
                for region in detect_algorithm_regions(page_text):
                    code_blocks.append(
                        ExtractedCodeBlock(
                            code_id=f"algo_{counter}",
                            code=region.content,
                            language="algorithm",
                            is_algorithm=True,
                            page_number=page_idx,
                            confidence=region.confidence,
                        )
                    )
                    counter += 1

            doc.close()

            output = CodeDetectionOutput(
                code_blocks=code_blocks,
                total_count=len(code_blocks),
                metadata={
                    "engine": "algorithm_detector",
                    "detection_threshold": "heuristic",
                },
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("算法检测器执行失败: %s", e)
            return StageResult(success=False, error=f"算法检测器执行失败: {e}")


@register_tool("code_detection.opendataloader")
class OpenDataLoaderCodeDetector(PDFToolBase):
    """基于 OpenDataLoader 的代码块检测工具（Apache-2.0 / CPU-only / 全元素 bbox）。

    注意：OpenDataLoader local mode 不支持代码块提取
    （``supports_code_blocks=False``），因此 ``result.code_blocks`` 始终为空。
    此工具保留用于 hybrid mode 场景下的兼容性。
    """

    tool_name = "opendataloader"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.opendataloader import OpenDataLoaderEngine

            return OpenDataLoaderEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[CodeDetectionOutput]:
        """使用 OpenDataLoader 检测代码块。

        local mode 下 code_blocks 为空，直接返回空结果（success=True），
        避免因无代码块而阻断后续 Stage。
        """
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

            code_blocks: List[ExtractedCodeBlock] = []
            for idx, cb in enumerate(result.code_blocks):
                code_blocks.append(
                    ExtractedCodeBlock(
                        code_id=f"code_{idx}",
                        code=cb.code,
                        language=cb.language,
                        page_number=(
                            cb.page_number if cb.page_number is not None else 0
                        ),
                        confidence=0.85,
                    )
                )

            output = CodeDetectionOutput(
                code_blocks=code_blocks,
                total_count=len(code_blocks),
                metadata={"engine": "opendataloader"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("OpenDataLoader 代码块检测失败: %s", e)
            return StageResult(
                success=False, error=f"OpenDataLoader 代码块检测失败: {e}"
            )


# ---------------------------------------------------------------------------
# Stage 本地工具映射
# ---------------------------------------------------------------------------

_TOOLS: Dict[str, type] = {
    "docling": DoclingCodeDetector,
    "marker": MarkerCodeDetector,
    "algorithm_detector": AlgorithmCodeDetector,
    "opendataloader": OpenDataLoaderCodeDetector,
}


# ---------------------------------------------------------------------------
# Stage 类
# ---------------------------------------------------------------------------


class CodeDetectionStage(Stage[PreprocessingOutput, CodeDetectionOutput]):
    """S7: 代码块检测 Stage。"""

    STAGE_ID = "code_detection"
    STAGE_NAME = "代码块与算法检测"
    TOOLS = _TOOLS

    @property
    def stage_id(self) -> str:
        return self.STAGE_ID

    @property
    def stage_name(self) -> str:
        return self.STAGE_NAME

    async def execute(
        self, input_data: PreprocessingOutput
    ) -> StageResult[CodeDetectionOutput]:
        """按降级顺序执行代码块检测。"""
        for tool_cls in _TOOLS.values():
            tool = tool_cls()
            if tool.is_available():
                result = await tool.execute(input_data)
                if result.success:
                    return result
        return StageResult(success=False, error="无可用的代码块检测工具")
