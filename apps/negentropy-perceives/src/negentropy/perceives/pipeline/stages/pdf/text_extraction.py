"""S3: 文本内容提取 Stage。

从各文本区域中提取纯文本，保留段落结构与标题层级。

委托关系：
- ``pdf.processor.PDFProcessor._extract_with_pymupdf()`` — PyMuPDF 块级提取
- ``pdf.processor.PDFProcessor._extract_with_pypdf()`` — pypdf 基础提取
- ``pdf.docling_engine.DoclingEngine`` — Docling 全文 Markdown
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from ...base import Stage, StageResult
from ...models import (
    PreprocessingOutput,
    TextBlock,
    TextExtractionOutput,
)
from ...registry import register_tool
from .._base import PDFToolBase

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 工具适配器
# ---------------------------------------------------------------------------


@register_tool("text_extraction.pymupdf")
class FitzTextExtractor(PDFToolBase):
    """基于 PyMuPDF 的文本提取工具。

    针对大文档（>= 10 页）启用多线程页分片并发：
        - 每个 chunk 独立 ``fitz.open()``（PyMuPDF Document 非线程安全[1]）;
        - 使用 ``asyncio.to_thread`` 把 chunk 工作搬到默认线程池,
          释放事件循环, 同时利用 Apple Silicon 多核 / 统一内存 fan-out;
        - 阈值与 chunk 大小由 ``settings.pdf_pymupdf_parallel_pages`` 控制
          (0 = 自动按 CPU 推断, 上限 8, 避免 page out)。

    Reading order 由分片完成后**全局按 (page_idx, in-page order) 重新计算**,
    与串行版本一致。

    References:
        [1] PyMuPDF GitHub 多次 issue 强调 ``Document`` 不可跨线程共享。
    """

    tool_name = "pymupdf"

    # 启用并行的最小页数门槛（开销 vs 收益的拐点估计）
    _PARALLEL_PAGE_THRESHOLD: int = 10

    def is_available(self) -> bool:
        try:
            from ....pdf._imports import import_fitz

            import_fitz()
            return True
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[TextExtractionOutput]:
        """使用 PyMuPDF 提取文本块（自动决定串行/并行路径）。"""
        try:
            from ....pdf._imports import import_fitz

            fitz = import_fitz()

            # 1. 解析页码范围
            doc = fitz.open(str(input_data.local_path))
            start_page = 0
            end_page = doc.page_count
            if input_data.page_range:
                start_page = max(0, input_data.page_range[0])
                end_page = min(doc.page_count, input_data.page_range[1])
            doc.close()

            page_count = end_page - start_page
            chunk_size = self._resolve_chunk_size(page_count)

            # 2. 串行或并行执行
            if chunk_size <= 0 or page_count < self._PARALLEL_PAGE_THRESHOLD:
                page_blocks_seq = await asyncio.to_thread(
                    self._extract_chunk,
                    str(input_data.local_path),
                    start_page,
                    end_page,
                )
            else:
                page_blocks_seq = await self._extract_parallel(
                    str(input_data.local_path),
                    start_page,
                    end_page,
                    chunk_size,
                )

            # 3. 聚合：按 page_idx 排序、重排 reading_order
            blocks: List[TextBlock] = []
            full_text_parts: List[str] = []
            reading_order = 0
            for page_idx, in_page_blocks in page_blocks_seq:
                for tb in in_page_blocks:
                    tb_reordered = TextBlock(
                        text=tb.text,
                        page_number=page_idx,
                        bbox=tb.bbox,
                        block_type=tb.block_type,
                        heading_level=tb.heading_level,
                        reading_order=reading_order,
                    )
                    blocks.append(tb_reordered)
                    full_text_parts.append(tb.text)
                    reading_order += 1

            full_text = "\n\n".join(full_text_parts)
            word_count = len(full_text.split())

            output = TextExtractionOutput(
                blocks=blocks,
                full_text=full_text,
                word_count=word_count,
                metadata={
                    "engine": "pymupdf",
                    "parallel_chunk_size": chunk_size,
                    "page_count_processed": page_count,
                },
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("PyMuPDF 文本提取失败: %s", e)
            return StageResult(success=False, error=f"PyMuPDF 文本提取失败: {e}")

    # ------------------------------------------------------------------
    # 并行执行助手
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_chunk_size(page_count: int) -> int:
        """决定 chunk 大小。

        优先读 ``settings.pdf_pymupdf_parallel_pages``：
            - 0 → 自动: ``max(1, min(8, os.cpu_count() // 2))``
              （Apple Silicon E-core 不参与，避免抢占；上限 8 防止 fitz 句柄爆炸）；
            - >0 → 显式值（用户调优）。
        """
        try:
            from ....config import settings

            override = int(getattr(settings, "pdf_pymupdf_parallel_pages", 0))
        except (ImportError, AttributeError, ValueError):
            override = 0

        if override > 0:
            return override
        cpu = os.cpu_count() or 4
        return max(1, min(8, cpu // 2))

    async def _extract_parallel(
        self,
        pdf_path: str,
        start_page: int,
        end_page: int,
        chunk_size: int,
    ) -> List[Tuple[int, List[TextBlock]]]:
        """多 chunk 并发抽取，返回 ``[(page_idx, blocks), ...]``（已按 page_idx 排序）。"""
        ranges: List[Tuple[int, int]] = []
        for s in range(start_page, end_page, chunk_size):
            ranges.append((s, min(s + chunk_size, end_page)))

        chunk_results = await asyncio.gather(
            *(asyncio.to_thread(self._extract_chunk, pdf_path, s, e) for s, e in ranges)
        )
        merged: List[Tuple[int, List[TextBlock]]] = []
        for partial in chunk_results:
            merged.extend(partial)
        merged.sort(key=lambda kv: kv[0])
        return merged

    @staticmethod
    def _extract_chunk(
        pdf_path: str, start_page: int, end_page: int
    ) -> List[Tuple[int, List[TextBlock]]]:
        """单 chunk 抽取（在 worker 线程内执行）。

        每个 chunk 独立 ``fitz.open()`` 因 PyMuPDF Document 不可跨线程共享。
        返回 ``[(page_idx, in_page_blocks)]`` 列表（reading_order 暂为页内序号，
        全局序号由调用方重排）。
        """
        from ....pdf._imports import import_fitz

        fitz = import_fitz()

        out: List[Tuple[int, List[TextBlock]]] = []
        doc = fitz.open(pdf_path)
        try:
            for page_idx in range(start_page, end_page):
                page = doc[page_idx]
                raw_blocks = page.get_text("blocks")

                page_blocks: List[TextBlock] = []
                in_page_order = 0
                for block in sorted(raw_blocks, key=lambda b: (b[1], b[0])):
                    if block[6] != 0:  # 跳过非文本块
                        continue
                    text = block[4].strip()
                    if not text:
                        continue

                    bbox = (
                        float(block[0]),
                        float(block[1]),
                        float(block[2]),
                        float(block[3]),
                    )

                    # 合并块内换行
                    text = re.sub(r"\n+", " ", text)

                    page_blocks.append(
                        TextBlock(
                            text=text,
                            page_number=page_idx,
                            bbox=bbox,
                            block_type="paragraph",
                            heading_level=None,
                            reading_order=in_page_order,
                        )
                    )
                    in_page_order += 1

                out.append((page_idx, page_blocks))
        finally:
            doc.close()
        return out


@register_tool("text_extraction.docling")
class DoclingTextExtractor(PDFToolBase):
    """基于 Docling 的文本提取工具。"""

    tool_name = "docling"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.docling import DoclingEngine

            return DoclingEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[TextExtractionOutput]:
        """使用 Docling 提取文本。

        优先消费 ``DoclingConversionResult.text_blocks``（携带 0-based ``page_number``
        与 TopLeft bbox），从根本上解决 ``export_to_markdown()`` 聚合输出导致段落
        无法定位到源页面的问题。当 ``text_blocks`` 为空时，降级到旧的「按 ``\\n\\n``
        拆段、page_number 缺省」路径以保持向后兼容。
        """
        try:
            from ....core.cancellation import current_cancel_scope
            from ....infra import get_engine_pool
            from ....pdf.engines._docling_kwargs import build_docling_init_kwargs

            _scope = current_cancel_scope()
            # 跨 Stage 共享 init_kwargs 以触发 worker 内 _ConvertCache 命中
            # （与 layout_analysis / table_extraction / formula_extraction / code_detection 对齐）
            result = await get_engine_pool().run(
                "docling",
                kwargs={
                    "pdf_path": str(input_data.local_path),
                    "page_range": input_data.page_range,
                },
                init_kwargs=build_docling_init_kwargs(),
                deadline_monotonic=_scope.deadline_monotonic if _scope else None,
            )
            if result is None or not result.markdown:
                return StageResult(success=False, error="Docling 返回空结果")

            blocks: List[TextBlock]
            if getattr(result, "text_blocks", None):
                blocks = self._blocks_from_text_blocks(result.text_blocks)
            else:
                blocks = self._fallback_markdown_split(result.markdown)

            full_text = result.markdown
            word_count = len(full_text.split())

            output = TextExtractionOutput(
                blocks=blocks,
                full_text=full_text,
                word_count=word_count,
                metadata={"engine": "docling"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("Docling 文本提取失败: %s", e)
            return StageResult(success=False, error=f"Docling 文本提取失败: {e}")

    @staticmethod
    def _blocks_from_text_blocks(text_blocks: List[Any]) -> List[TextBlock]:
        """从 ``DoclingTextBlock`` 列表构造 ``TextBlock``，保留页码与 bbox。"""
        blocks: List[TextBlock] = []
        for ro, tb in enumerate(text_blocks):
            label = (tb.label or "paragraph").lower()
            if label in ("title", "section_header"):
                block_type = "heading"
                heading_level = tb.heading_level or (1 if label == "title" else 2)
            elif label == "list_item":
                block_type = "list_item"
                heading_level = None
            elif label == "footnote":
                block_type = "footnote"
                heading_level = None
            else:
                block_type = "paragraph"
                heading_level = None

            blocks.append(
                TextBlock(
                    text=tb.text,
                    page_number=tb.page_number if tb.page_number is not None else 0,
                    bbox=tb.bbox,
                    block_type=block_type,
                    heading_level=heading_level,
                    reading_order=ro,
                )
            )
        return blocks

    @staticmethod
    def _fallback_markdown_split(markdown: str) -> List[TextBlock]:
        """旧的兜底路径：按 ``\\n\\n`` 拆段、page_number=0。"""
        blocks: List[TextBlock] = []
        reading_order = 0
        for paragraph in markdown.split("\n\n"):
            paragraph = paragraph.strip()
            if not paragraph:
                continue

            block_type = "paragraph"
            heading_level: Optional[int] = None

            heading_match = re.match(r"^(#{1,6})\s+(.+)", paragraph)
            if heading_match:
                block_type = "heading"
                heading_level = len(heading_match.group(1))
                paragraph = heading_match.group(2)

            if re.match(r"^\s*[-*+]\s", paragraph) or re.match(
                r"^\s*\d+\.\s", paragraph
            ):
                block_type = "list_item"

            blocks.append(
                TextBlock(
                    text=paragraph,
                    page_number=0,
                    block_type=block_type,
                    heading_level=heading_level,
                    reading_order=reading_order,
                )
            )
            reading_order += 1
        return blocks


@register_tool("text_extraction.pypdf")
class PyPDFTextExtractor(PDFToolBase):
    """基于 pypdf 的文本提取工具（降级方案）。"""

    tool_name = "pypdf"

    def is_available(self) -> bool:
        try:
            from ....pdf._imports import import_pypdf

            import_pypdf()
            return True
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[TextExtractionOutput]:
        """使用 pypdf 提取文本。"""
        try:
            from ....pdf._imports import import_pypdf

            pypdf = import_pypdf()

            reader = pypdf.PdfReader(str(input_data.local_path))
            start_page = 0
            end_page = len(reader.pages)
            if input_data.page_range:
                start_page = max(0, input_data.page_range[0])
                end_page = min(len(reader.pages), input_data.page_range[1])

            blocks: List[TextBlock] = []
            full_text_parts: List[str] = []
            reading_order = 0

            for page_idx in range(start_page, end_page):
                text = reader.pages[page_idx].extract_text() or ""
                text = text.strip()
                if not text:
                    continue

                blocks.append(
                    TextBlock(
                        text=text,
                        page_number=page_idx,
                        block_type="paragraph",
                        reading_order=reading_order,
                    )
                )
                full_text_parts.append(text)
                reading_order += 1

            full_text = "\n\n".join(full_text_parts)
            word_count = len(full_text.split())

            output = TextExtractionOutput(
                blocks=blocks,
                full_text=full_text,
                word_count=word_count,
                metadata={"engine": "pypdf"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("pypdf 文本提取失败: %s", e)
            return StageResult(success=False, error=f"pypdf 文本提取失败: {e}")


@register_tool("text_extraction.marker")
class MarkerTextExtractor(PDFToolBase):
    """基于 Marker 的文本提取工具（GPL-3.0 / 扫描版 OCR 路径最佳）。

    设计目的:
        ``EngineSelector._select_text_extraction`` 在扫描版 PDF 上把 ``marker``
        列为 rank=1, 但 PR #163 之前 ``text_extraction.marker`` 适配器从未注册,
        ``_reorder_by_name`` 对缺失 tool 是 no-op, 偏好实际上**不会生效**(死引用)。
        本适配器补齐该缺失, 让 selector 的扫描版偏好真正命中 Marker (Surya OCR
        路径), 由 Phase B 矩阵实测验证其在扫描版 PDF 上是否优于 docling+OCR。

    与 ``MarkerCodeDetector`` / ``MarkerTableExtractor`` 等同 stage 适配器对齐
    复用同一 worker pool 与 init_kwargs (跨 stage 共享 marker converter 缓存)。

    GPL-3.0 风险:
        与 ``marker_enabled`` 引擎级 gate 行为一致, 未额外检查
        ``marker_license_acknowledged``; 商业用户需自行通过设置
        ``NEGENTROPY_PERCEIVES_MARKER_ENABLED=false`` 显式禁用整个 Marker 路径。
    """

    tool_name = "marker"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.marker import MarkerEngine

            return MarkerEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[TextExtractionOutput]:
        """使用 Marker 提取文本。

        Marker 返回的 ``MarkerConversionResult.markdown`` 是聚合的全文字符串,
        不携带逐段 ``page_number`` / ``bbox`` 信息; 与 ``OpenDataLoaderTextExtractor``
        采用相同的"按 ``\\n\\n`` 拆段、``page_number`` 缺省为 0"降级路径。
        """
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
            if result is None or not getattr(result, "markdown", None):
                return StageResult(success=False, error="Marker 返回空结果")

            full_text = result.markdown
            blocks: List[TextBlock] = [
                TextBlock(text=seg, page_number=0)
                for seg in full_text.split("\n\n")
                if seg.strip()
            ]
            word_count = len(full_text.split())

            output = TextExtractionOutput(
                blocks=blocks,
                full_text=full_text,
                word_count=word_count,
                metadata={"engine": "marker"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("Marker 文本提取失败: %s", e)
            return StageResult(success=False, error=f"Marker 文本提取失败: {e}")


@register_tool("text_extraction.opendataloader")
class OpenDataLoaderTextExtractor(PDFToolBase):
    """基于 OpenDataLoader 的文本提取工具（Apache-2.0 / CPU-only / 全元素 bbox）。"""

    tool_name = "opendataloader"

    def is_available(self) -> bool:
        try:
            from ....pdf.engines.opendataloader import OpenDataLoaderEngine

            return OpenDataLoaderEngine.is_available()
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingOutput
    ) -> StageResult[TextExtractionOutput]:
        """使用 OpenDataLoader 提取文本。

        OpenDataLoader 返回的 ``EngineConversionResult.markdown`` 已包含全文，
        但不携带逐段页码/bbox 信息，降级为按 ``\\n\\n`` 拆段、page_number 缺省路径。
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
            if result is None or not result.markdown:
                return StageResult(success=False, error="OpenDataLoader 返回空结果")

            # 降级：OpenDataLoader 不携带逐段页码/bbox 信息，
            # 按 \n\n 拆段、page_number 缺省为 0。
            full_text = result.markdown
            blocks: List[TextBlock] = [
                TextBlock(text=seg, page_number=0)
                for seg in full_text.split("\n\n")
                if seg.strip()
            ]
            word_count = len(full_text.split())

            output = TextExtractionOutput(
                blocks=blocks,
                full_text=full_text,
                word_count=word_count,
                metadata={"engine": "opendataloader"},
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.warning("OpenDataLoader 文本提取失败: %s", e)
            return StageResult(success=False, error=f"OpenDataLoader 文本提取失败: {e}")


# ---------------------------------------------------------------------------
# Stage 本地工具映射
# ---------------------------------------------------------------------------

_TOOLS: Dict[str, type] = {
    "pymupdf": FitzTextExtractor,
    "docling": DoclingTextExtractor,
    "marker": MarkerTextExtractor,
    "opendataloader": OpenDataLoaderTextExtractor,
    "pypdf": PyPDFTextExtractor,
}


# ---------------------------------------------------------------------------
# Stage 类
# ---------------------------------------------------------------------------


class TextExtractionStage(Stage[PreprocessingOutput, TextExtractionOutput]):
    """S3: 文本内容提取 Stage。"""

    STAGE_ID = "text_extraction"
    STAGE_NAME = "文本内容提取"
    TOOLS = _TOOLS

    @property
    def stage_id(self) -> str:
        return self.STAGE_ID

    @property
    def stage_name(self) -> str:
        return self.STAGE_NAME

    async def execute(
        self, input_data: PreprocessingOutput
    ) -> StageResult[TextExtractionOutput]:
        """按降级顺序执行文本提取。"""
        for tool_cls in _TOOLS.values():
            tool = tool_cls()
            if tool.is_available():
                result = await tool.execute(input_data)
                if result.success:
                    return result
        return StageResult(success=False, error="无可用的文本提取工具")
