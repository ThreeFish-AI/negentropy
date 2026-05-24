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
from collections import Counter
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

        使用 ``get_text("dict")`` 提取字体信息以支持标题检测：
        - 基于字号差异和文本模式识别章节标题；
        - 过滤页眉页脚（含页码、重复 header）。
        """
        from ....pdf._imports import import_fitz

        fitz = import_fitz()

        out: List[Tuple[int, List[TextBlock]]] = []
        doc = fitz.open(pdf_path)
        try:
            # Pass 1: 收集所有页面的正文字号分布，确定 body_font_size
            body_size_counter: Counter = Counter()
            page_dict_blocks: Dict[int, dict] = {}
            for page_idx in range(start_page, end_page):
                page = doc[page_idx]
                pd = page.get_text("dict")
                page_dict_blocks[page_idx] = pd
                for block in pd.get("blocks", []):
                    if block.get("type") != 0:
                        continue
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            size = round(span.get("size", 10), 1)
                            text = span.get("text", "").strip()
                            if text:
                                body_size_counter[size] += len(text)

            body_font_size = (
                body_size_counter.most_common(1)[0][0] if body_size_counter else 10.0
            )

            # Pass 2: 提取文本块，检测标题，过滤页眉页脚
            for page_idx in range(start_page, end_page):
                pd = page_dict_blocks[page_idx]
                page_height = pd.get("height", 792)
                raw_blocks = pd.get("blocks", [])

                page_blocks: List[TextBlock] = []
                in_page_order = 0
                for block in sorted(
                    raw_blocks,
                    key=lambda b: (
                        b.get("bbox", (0, 0, 0, 0))[1],
                        b.get("bbox", (0, 0, 0, 0))[0],
                    ),
                ):
                    if block.get("type") != 0:
                        continue

                    # 从 dict 块中提取文本和字体信息
                    block_spans = []
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text = span.get("text", "").strip()
                            if text:
                                block_spans.append(
                                    {
                                        "text": text,
                                        "size": round(span.get("size", 10), 1),
                                        "font": span.get("font", ""),
                                        "flags": span.get("flags", 0),
                                    }
                                )

                    if not block_spans:
                        continue

                    text = " ".join(s["text"] for s in block_spans)
                    text = re.sub(r"\s+", " ", text).strip()
                    if not text:
                        continue

                    # 过滤页眉页脚和页码
                    if FitzTextExtractor._is_header_footer(
                        text, block.get("bbox", (0, 0, 0, 0)), page_height
                    ):
                        continue

                    max_size = max(s["size"] for s in block_spans)
                    block_bbox = block.get("bbox", (0, 0, 0, 0))
                    bbox = (
                        float(block_bbox[0]),
                        float(block_bbox[1]),
                        float(block_bbox[2]),
                        float(block_bbox[3]),
                    )

                    text = re.sub(r"\n+", " ", text)

                    # 清理页面 header 后缀（如 "SII-GAIR"），保留有意义的标题文本
                    for suffix in ("SII-GAIR", "SII - GAIR"):
                        if text.endswith(suffix):
                            cleaned = text[: -len(suffix)].strip()
                            if cleaned:
                                text = cleaned
                            break

                    # 检测标题
                    block_type = "paragraph"
                    heading_level = None
                    heading_info = FitzTextExtractor._detect_heading(
                        text, max_size, body_font_size
                    )
                    if heading_info:
                        block_type = "heading"
                        heading_level = heading_info

                    # 标题-段落合并拆分：PyMuPDF 有时将标题和首段合并为一个块
                    heading_text, para_text = _split_merged_heading(text)
                    if para_text:
                        page_blocks.append(
                            TextBlock(
                                text=heading_text,
                                page_number=page_idx,
                                bbox=bbox,
                                block_type="heading",
                                heading_level=heading_level,
                                reading_order=in_page_order,
                            )
                        )
                        in_page_order += 1
                        page_blocks.append(
                            TextBlock(
                                text=para_text,
                                page_number=page_idx,
                                bbox=bbox,
                                block_type="paragraph",
                                heading_level=None,
                                reading_order=in_page_order,
                            )
                        )
                        in_page_order += 1
                        continue

                    page_blocks.append(
                        TextBlock(
                            text=text,
                            page_number=page_idx,
                            bbox=bbox,
                            block_type=block_type,
                            heading_level=heading_level,
                            reading_order=in_page_order,
                        )
                    )
                    in_page_order += 1

                out.append((page_idx, page_blocks))
        finally:
            doc.close()
        return out

    @staticmethod
    def _is_header_footer(text: str, bbox: tuple, page_height: float) -> bool:
        """判断文本块是否为页眉页脚或页码。

        检测策略：
        1. 纯页码
        2. arXiv 标识行
        3. 位置启发式：页面顶部 5% 或底部 5% 区域内的短文本
        4. ACM/IEEE 会议论文页眉模式（含 "Conference", "Proceedings" 等）
        5. 仅含作者名列表的页脚行
        """
        text_stripped = text.strip()
        text_len = len(text_stripped)

        # 纯页码（纯数字，短文本）
        if re.match(r"^\d{1,3}$", text_stripped):
            return True

        # arXiv 标识行
        if text_stripped.startswith("arXiv:") and text_len < 80:
            return True

        # 单独的组织标识（剥离后可能残留）
        if text_stripped in ("SII-GAIR", "SII - GAIR"):
            return True

        # 位置启发式：页面顶部 5% 区域内的短文本（<=100 字符）
        y0, y1 = bbox[1], bbox[3]
        if y0 < page_height * 0.05 and text_len <= 100:
            # 排除实际标题（通常字号较大、文本较长）
            return True

        # 底部 5% 区域
        if y1 > page_height * 0.95 and text_len <= 100:
            return True

        # ACM/IEEE 会议论文页眉模式
        _conf_patterns = [
            r"Conference\s+acronym",
            r"Proceedings\s+of",
            r"In\s+Proceedings",
            r"ACM\s+Reference\s+Format",
            r"Permission\s+to\s+make\s+digital",
            r"Copyright\s+.*\d{4}\s+ACM",
        ]
        for pat in _conf_patterns:
            if re.search(pat, text_stripped, re.IGNORECASE):
                return True

        # DOI 行
        if re.search(r"https?://doi\.org/", text_stripped) and text_len < 200:
            return True

        return False

    @staticmethod
    def _detect_heading(
        text: str, max_font_size: float, body_font_size: float
    ) -> Optional[int]:
        """基于字号差异和文本模式检测标题级别。

        编号模式（如 "5.1 Textual Context Processing"）优先于字号守卫，
        因为学术论文中子标题经常使用与正文相同或接近的字号。

        Returns:
            heading_level (1-6) 如果识别为标题，否则 None。
        """
        text_stripped = text.strip()
        text_lower = text_stripped.lower()

        # 优先匹配编号章节标题，如 "1 Introduction", "2.1 Formal Definition",
        # 也支持章号后带句号的格式，如 "2. Theoretical Framework"
        numbered_match = re.match(r"^(\d+(?:\.\d+)*)\.?\s+(.+)$", text_stripped)
        if numbered_match:
            section_num = numbered_match.group(1)
            section_title = numbered_match.group(2).strip()

            # --- 误判过滤 ---
            # 1. Section 0 从不是有效章节号（如 "0 † Corresponding author."）
            if section_num == "0":
                return None

            # 2. 标题正文至少 2 字符
            if len(section_title) < 2:
                return None

            # 3. TOC 条目：尾部含独立页码（如 "Introduction 3"）
            if re.search(r"\s\d{1,3}$", section_title):
                return None

            # 4. TOC 条目：含点号引导符（"........"）
            if "..." in section_title:
                return None

            # 5. TOC 条目：一行含多个子节编号（如 "2.1 Formal... 2.2 Stage..."）
            #    子节号后紧跟大写字母（新标题开头），排除版本号引用如 "Era 1.0 and"
            if re.search(r"\d+\.\d+\s+[A-Z]", section_title):
                return None

            # 6. 作者单位行：含多个编号项（如 "1 SJTU 2 SII 3 GAIR"）
            if re.search(r"\b\d+\s+[A-Z]{2,}\b", section_title):
                return None

            # 7. URL（如 "1 https://github.com/..."）
            if re.search(r"https?://", section_title):
                return None

            depth = section_num.count(".") + 1
            if depth == 1:
                return 1
            elif depth == 2:
                return 2
            elif depth == 3:
                return 3
            else:
                return min(depth, 6)

        # 字号守卫：仅对非编号模式的候选标题生效
        if max_font_size <= body_font_size + 0.5:
            return None

        size_ratio = max_font_size / body_font_size if body_font_size > 0 else 1.0

        # 匹配带前缀的章节标题，如 "Appendix A" 或 "Figure 1:"
        if re.match(
            r"^(Appendix\s+[A-Z]|Figure\s+\d|Table\s+\d)", text_stripped, re.IGNORECASE
        ):
            return 3

        # 特殊标题词（整个文本就是标题）
        special_titles = {
            "abstract",
            "contents",
            "references",
            "acknowledgement",
            "acknowledgments",
            "bibliography",
            "appendix",
            "summary",
            "conclusion",
            "conclusions",
            "keywords",
        }
        if text_lower in special_titles:
            return 1

        # 基于字号比推断级别
        if size_ratio >= 1.6:
            return 1
        elif size_ratio >= 1.3:
            return 2
        elif size_ratio >= 1.15:
            return 3

        return None


def _split_merged_heading(text: str) -> tuple[str, str]:
    """拆分被 PyMuPDF 合并到同一块的标题与段落文本。

    当标题行与紧跟的段落在同一文本块时，整个文本会被当成标题。
    本函数通过启发式检测标题-段落边界，将标题与段落拆开。

    Returns:
        (heading_text, paragraph_text)。若无需拆分，paragraph_text 为空串。
    """
    if len(text) <= 120:
        return text, ""

    m = re.match(r"^(\d+(?:\.\d+)*)\s+(.+)$", text.strip())
    if not m:
        return text, ""

    section_num = m.group(1)
    title_and_para = m.group(2)
    words = title_and_para.split()

    if len(words) <= 8:
        return text, ""

    # 启发式：从第 3 个词开始，找到第一个满足 "该词后紧跟小写词" 的位置
    # 标题通常是 Title Case（每词首字母大写），而段落句中词为小写。
    # 在该词之前切割，前面是标题，后面是段落。
    split_at = None
    for i in range(2, min(len(words), 16)):
        if i + 1 < len(words) and words[i + 1][0].islower():
            split_at = i
            break

    if split_at is None or split_at < 2:
        return text, ""

    heading = f"{section_num} {' '.join(words[:split_at])}"
    para = " ".join(words[split_at:])
    return heading, para


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
