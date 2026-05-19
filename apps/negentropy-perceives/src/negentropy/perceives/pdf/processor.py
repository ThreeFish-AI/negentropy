"""PDF processing module for extracting text and converting to Markdown."""

import logging
import tempfile
import os
import re
from typing import Dict, List, Any, Optional
from pathlib import Path
import asyncio

from ._imports import import_fitz, import_pypdf
from ._sources import download_pdf_to_temp, is_pdf_url
from .enhanced import (
    EnhancedPDFProcessor,
    ExtractedImage,
    ExtractedTable,
)
from ..markdown.algorithm_detector import is_algorithm_block
from .math_formula import (
    MathRegion,
)
from .engines.docling import DoclingEngine
from .engines.mineru import MinerUEngine
from .engines.marker import MarkerEngine
from .engines.opendataloader import OpenDataLoaderEngine

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 引擎优先级与降级链
# ---------------------------------------------------------------------------

# 每个 "auto" 模式的降级链：按优先级排列，前面的引擎不可用或失败时自动降级
_ENGINE_FALLBACK_CHAIN = [
    "docling",  # 最佳整体质量（MIT 许可证）
    "opendataloader",  # CPU-only / 全元素 bbox / Apache-2.0
    "mineru",  # 最佳 LaTeX 公式提取（Apache 2.0）
    "marker",  # 最佳整体准确率（GPL-3.0，需确认许可证）
    "pymupdf",  # 快速文本提取（始终可用）
    "pypdf",  # 基础降级（始终可用）
]

# 简化降级链（不包含 MinerU/Marker，保持向后兼容）
_SIMPLE_FALLBACK_CHAIN = ["docling", "opendataloader", "pymupdf", "pypdf"]


def _import_fitz():
    """兼容导出：延迟导入 PyMuPDF。"""
    return import_fitz()


def _import_pypdf():
    """兼容导出：延迟导入 pypdf。"""
    return import_pypdf()


class PDFProcessor:
    """PDF processor for extracting text and converting to Markdown."""

    def __init__(
        self,
        enable_enhanced_features: bool = True,
        output_dir: Optional[str] = None,
        prefer_docling: bool = True,
    ):
        """
        Initialize the PDF processor.

        Args:
            enable_enhanced_features: Whether to enable enhanced extraction features
            output_dir: Directory to save extracted images and assets
            prefer_docling: Whether to prefer Docling engine when available (default: True)
        """
        self.supported_methods = [
            "pymupdf",
            "pypdf",
            "auto",
            "docling",
            "opendataloader",
            "smart",
            "mineru",
            "marker",
        ]
        self.temp_dir = tempfile.mkdtemp(prefix="pdf_extractor_")
        self._output_dir = output_dir
        self.enable_enhanced_features = enable_enhanced_features
        self.prefer_docling = prefer_docling

        # Initialize enhanced processor for images, tables, and formulas
        self.enhanced_processor: Optional[EnhancedPDFProcessor]
        if self.enable_enhanced_features:
            self.enhanced_processor = EnhancedPDFProcessor(output_dir)
        else:
            self.enhanced_processor = None

        # Docling 引擎（延迟初始化，仅当 prefer_docling=True 且已安装时）
        self._docling_engine: Optional[DoclingEngine] = None
        self._opendataloader_engine: Optional[OpenDataLoaderEngine] = None
        self._mineru_engine: Optional[MinerUEngine] = None
        self._marker_engine: Optional[MarkerEngine] = None

        # 传递给 Worker 的 init_kwargs：process 隔离模式下子进程据此实例化
        # 对应引擎；与主进程侧 `_*_engine` 实例使用同一组 kwargs，保证行为一致。
        self._docling_init_kwargs: Dict[str, Any] = {}
        self._opendataloader_init_kwargs: Dict[str, Any] = {}
        self._mineru_init_kwargs: Dict[str, Any] = {}
        self._marker_init_kwargs: Dict[str, Any] = {}

        if prefer_docling and DoclingEngine.is_available():
            from ..config import settings

            self._docling_init_kwargs = {
                "output_dir": output_dir,
                "device": settings.accelerator_device,
                "num_threads": settings.accelerator_num_threads,
                "enable_formula_enrichment": settings.docling_formula_extraction_enabled,
                "enable_table_structure": settings.docling_table_extraction_enabled,
                "enable_ocr": settings.docling_ocr_enabled,
                "ocr_batch_size": settings.accelerator_ocr_batch_size,
                "layout_batch_size": settings.accelerator_layout_batch_size,
                "table_batch_size": settings.accelerator_table_batch_size,
            }
            self._docling_engine = DoclingEngine(**self._docling_init_kwargs)

        # OpenDataLoader 引擎（延迟初始化，仅当配置启用且已安装时）
        self._init_opendataloader_engine()

        # MinerU 引擎（延迟初始化，仅当配置启用且已安装时）
        self._init_mineru_engine()

        # Marker 引擎（延迟初始化，仅当配置启用且已安装时）
        self._init_marker_engine()

        # Page-level image maps populated during enhanced extraction,
        # consumed during text extraction for inline image placement.
        # Structure: {page_num: {block_no: ExtractedImage}}
        self._page_image_maps: Dict[int, Dict[int, ExtractedImage]] = {}

        # Page-level table maps populated during enhanced extraction,
        # consumed during text extraction for inline table placement.
        # Structure: {page_num: {(x0, y0, x1, y1): ExtractedTable}}
        self._page_table_maps: Dict[int, Dict[tuple, ExtractedTable]] = {}

        # Page-level enhanced text blocks from formula reconstruction.
        # Structure: {page_num: [text_block_str, ...]}
        self._page_math_blocks: Dict[int, List[str]] = {}

        # Page-level math regions detected during formula extraction.
        # Structure: {page_num: [MathRegion, ...]}
        self._page_math_regions: Dict[int, List[MathRegion]] = {}

    # ------------------------------------------------------------------
    # 引擎初始化辅助方法
    # ------------------------------------------------------------------

    def _init_opendataloader_engine(self) -> None:
        """初始化 OpenDataLoader 引擎（仅当配置启用且已安装时）。"""
        try:
            from ..config import settings

            if (
                getattr(settings, "opendataloader_enabled", True)
                and OpenDataLoaderEngine.is_available()
            ):
                self._opendataloader_init_kwargs = {
                    "use_struct_tree": getattr(
                        settings, "opendataloader_use_struct_tree", True
                    ),
                    "sanitize": getattr(settings, "opendataloader_sanitize", False),
                }
                self._opendataloader_engine = OpenDataLoaderEngine(
                    **self._opendataloader_init_kwargs
                )
                logger.info("OpenDataLoader 引擎已初始化")
        except Exception as e:
            logger.warning("OpenDataLoader 引擎初始化失败: %s", e)
            self._opendataloader_engine = None

    def _init_mineru_engine(self) -> None:
        """初始化 MinerU 引擎（仅当配置启用且已安装时）。"""
        try:
            from ..config import settings

            if settings.mineru_enabled and MinerUEngine.is_available():
                self._mineru_init_kwargs = {
                    "output_dir": self._output_dir,
                    "device": settings.mineru_device,
                    "backend": settings.mineru_backend,
                }
                self._mineru_engine = MinerUEngine(**self._mineru_init_kwargs)
                logger.info("MinerU 引擎已初始化")
        except Exception as e:
            logger.warning("MinerU 引擎初始化失败: %s", e)
            self._mineru_engine = None

    def _init_marker_engine(self) -> None:
        """初始化 Marker 引擎（仅当配置启用且已安装时）。"""
        try:
            from ..config import settings

            if settings.marker_enabled and MarkerEngine.is_available():
                if not settings.marker_license_acknowledged:
                    logger.warning(
                        "Marker 引擎已安装且已启用，但 GPL-3.0 许可证未确认。"
                        "请设置 NEGENTROPY_PERCEIVES_MARKER_LICENSE_ACKNOWLEDGED=true "
                        "以启用 Marker 引擎。"
                    )
                    return
                self._marker_init_kwargs = {
                    "output_dir": self._output_dir,
                    "llm_enhanced": settings.marker_llm_enhanced,
                }
                self._marker_engine = MarkerEngine(**self._marker_init_kwargs)
                logger.info("Marker 引擎已初始化")
        except Exception as e:
            logger.warning("Marker 引擎初始化失败: %s", e)
            self._marker_engine = None

    # ------------------------------------------------------------------
    # 引擎可用性检测与动态选择
    # ------------------------------------------------------------------

    def _get_available_engines(self) -> List[str]:
        """获取当前可用的引擎列表（按优先级排序）。

        Returns:
            可用引擎名称列表，按降级链优先级排序。
        """
        available: List[str] = []

        for engine_name in _ENGINE_FALLBACK_CHAIN:
            if self._is_engine_available(engine_name):
                available.append(engine_name)

        return available

    def _is_engine_available(self, engine_name: str) -> bool:
        """检测指定引擎是否可用。

        Args:
            engine_name: 引擎名称。

        Returns:
            引擎是否可用。
        """
        if engine_name == "docling":
            return self._docling_engine is not None
        elif engine_name == "mineru":
            return self._mineru_engine is not None
        elif engine_name == "marker":
            return self._marker_engine is not None
        elif engine_name == "pymupdf":
            try:
                from ._imports import import_fitz

                import_fitz()
                return True
            except ImportError:
                return False
        elif engine_name == "pypdf":
            try:
                from ._imports import import_pypdf

                import_pypdf()
                return True
            except ImportError:
                return False
        return False

    def _select_engine(self, method: str) -> Optional[str]:
        """根据 method 参数动态选择引擎。

        Args:
            method: "auto" 表示自动选择，其他值表示显式指定引擎。

        Returns:
            选中的引擎名称，或 None（无法选择时）。
        """
        if method != "auto":
            # 显式指定引擎
            if self._is_engine_available(method):
                return method
            return None

        # auto 模式：按降级链选择第一个可用引擎
        available = self._get_available_engines()
        return available[0] if available else None

    async def process_pdf(
        self,
        pdf_source: str,
        method: str = "auto",
        include_metadata: bool = True,
        page_range: Optional[tuple] = None,
        output_format: str = "markdown",
        *,
        extract_images: bool = True,
        extract_tables: bool = True,
        extract_formulas: bool = True,
        embed_images: bool = False,
        enhanced_options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Process a PDF file from URL or local path.

        Args:
            pdf_source: URL or local file path to PDF
            method: Extraction method: auto, pymupdf, pypdf, docling, smart, mineru, marker (default: auto)
            include_metadata: Include PDF metadata in result (default: True)
            page_range: Tuple of (start_page, end_page) for partial extraction (optional)
            output_format: Output format: markdown, text (default: markdown)
            extract_images: Whether to extract images (default: True)
            extract_tables: Whether to extract tables (default: True)
            extract_formulas: Whether to extract mathematical formulas (default: True)
            embed_images: Whether to embed images as base64 in markdown (default: False)
            enhanced_options: Additional options for enhanced processing (optional)

        Returns:
            Dict containing extracted text/markdown and metadata, including enhanced assets
        """
        pdf_path = None
        try:
            # Validate method
            if method not in self.supported_methods:
                return {
                    "success": False,
                    "error": f"Method must be one of: {', '.join(self.supported_methods)}",
                    "source": pdf_source,
                }

            # Check if source is URL or local path
            if self._is_url(pdf_source):
                pdf_path = await self._download_pdf(pdf_source)
                if not pdf_path:
                    return {
                        "success": False,
                        "error": "Failed to download PDF from URL",
                        "source": pdf_source,
                    }
            else:
                pdf_path = Path(pdf_source)
                if not pdf_path.exists():
                    return {
                        "success": False,
                        "error": "PDF file does not exist",
                        "source": pdf_source,
                    }

            # Derive PDF basename for image naming
            pdf_name = Path(pdf_source).stem if pdf_source else ""

            # ── LLM 编排路径（smart 模式） ──
            if method == "smart":
                try:
                    from .llm.client import LLMClient
                    from .llm.orchestrator import LLMOrchestrator

                    if not LLMClient.is_available():
                        logger.warning("LiteLLM 未安装，降级至 auto 模式")
                        method = "auto"
                    else:
                        from ..config import settings

                        llm_client = LLMClient(
                            model=settings.llm_model,
                            api_key=settings.llm_api_key,
                            temperature=settings.llm_temperature,
                            max_tokens=settings.llm_max_tokens,
                            timeout=settings.llm_timeout,
                            max_retries=settings.llm_max_retries,
                        )
                        orchestrator = LLMOrchestrator(
                            llm_client=llm_client,
                            docling_engine=self._docling_engine,
                            output_dir=self._output_dir
                            if hasattr(self, "_output_dir")
                            else None,
                        )
                        orch_result = await orchestrator.orchestrate(
                            pdf_path=pdf_path,
                            page_range=page_range,
                            extract_images=extract_images,
                            extract_tables=extract_tables,
                            extract_formulas=extract_formulas,
                        )
                        return self._build_result_from_orchestration(
                            orch_result,
                            pdf_source=pdf_source,
                            include_metadata=include_metadata,
                            output_format=output_format,
                        )
                except Exception as e:
                    logger.warning("LLM 编排失败，降级至 auto 模式: %s", e)
                    method = "auto"

            # ── 引擎降级链（Docling → OpenDataLoader → MinerU → Marker） ──
            from ._engine_dispatch import DISPATCH_TABLE, try_dispatch_engine

            for desc in DISPATCH_TABLE:
                dispatch_result = await try_dispatch_engine(
                    processor=self,
                    desc=desc,
                    pdf_path=str(pdf_path),
                    page_range=page_range if page_range else None,
                    embed_images=embed_images,
                    pdf_source=pdf_source,
                    include_metadata=include_metadata,
                    output_format=output_format,
                    method=method,
                )
                if dispatch_result is not None:
                    # 非None = 有结果（可能是成功结果或显式指定不可用的错误）
                    if dispatch_result.get("success"):
                        return dispatch_result
                    # 显式指定但不可用 → 返回错误
                    if method == desc.name:
                        return dispatch_result
                    # auto 模式下此引擎失败 → 继续尝试下一个
                    logger.debug("引擎 %s 调度返回失败，继续降级链", desc.name)

            # ── PyMuPDF/PyPDF 降级路径 ──
            # 1. Extract enhanced assets (images with positions) FIRST
            #    This populates self._page_image_maps for inline placement
            enhanced_assets = None
            if self.enable_enhanced_features and self.enhanced_processor:
                enhanced_assets = await self._extract_enhanced_assets(
                    pdf_path,
                    page_range,
                    extract_images,
                    extract_tables,
                    extract_formulas,
                    pdf_name=pdf_name,
                )

            # 2. Extract text (with inline image references when available)
            extraction_result = None
            if method == "auto":
                extraction_result = await self._auto_extract(
                    pdf_path, page_range, include_metadata
                )
            elif method == "pymupdf":
                extraction_result = await self._extract_with_pymupdf(
                    pdf_path, page_range, include_metadata
                )
            elif method == "pypdf":
                extraction_result = await self._extract_with_pypdf(
                    pdf_path, page_range, include_metadata
                )

            if not extraction_result or not extraction_result.get("success"):
                return extraction_result or {
                    "success": False,
                    "error": "Unknown extraction error",
                    "source": pdf_source,
                }

            # 3. Convert to markdown if requested
            if output_format == "markdown":
                markdown_content = self._convert_to_markdown(extraction_result["text"])

                # Enhance markdown with remaining assets (unplaced images, tables, formulas)
                if enhanced_assets:
                    enhanced_options = enhanced_options or {}
                    embed_images_setting = enhanced_options.get(
                        "embed_images", embed_images
                    )
                    image_size = enhanced_options.get("image_size")

                    markdown_content = (
                        self.enhanced_processor.enhance_markdown_with_assets(  # type: ignore[union-attr]
                            markdown_content,
                            embed_images=embed_images_setting,
                            image_size=image_size,
                        )
                    )

                    # 图片引用规范化：统一路径为 ./images/filename
                    if not embed_images_setting:
                        from ..markdown.image_ref_normalizer import (
                            normalize_image_references,
                        )

                        markdown_content = normalize_image_references(
                            markdown_content,
                            self.enhanced_processor.images,  # type: ignore[union-attr]
                        )

                    # Add enhanced assets summary to result
                    extraction_result["enhanced_assets"] = (
                        self.enhanced_processor.get_extraction_summary()  # type: ignore[union-attr]
                    )

                extraction_result["markdown"] = markdown_content

            # Add processing info
            extraction_result.update(
                {
                    "source": pdf_source,
                    "method_used": extraction_result.get("method_used", method),
                    "output_format": output_format,
                    "pages_processed": extraction_result.get("pages_processed", 0),
                    "word_count": len(extraction_result["text"].split()),
                    "character_count": len(extraction_result["text"]),
                }
            )

            return extraction_result

        except Exception as e:
            logger.error(f"Error processing PDF {pdf_source}: {str(e)}")
            return {"success": False, "error": str(e), "source": pdf_source}
        finally:
            # Clean up downloaded files if they're in temp directory
            if pdf_path and str(pdf_path).startswith(self.temp_dir):
                try:
                    os.unlink(pdf_path)
                except (FileNotFoundError, PermissionError, OSError):
                    pass
            # Reset per-run state
            self._page_image_maps.clear()
            self._page_table_maps.clear()
            self._page_math_blocks.clear()
            self._page_math_regions.clear()

    async def batch_process_pdfs(
        self,
        pdf_sources: List[str],
        method: str = "auto",
        include_metadata: bool = True,
        page_range: Optional[tuple] = None,
        output_format: str = "markdown",
        extract_images: bool = True,
        extract_tables: bool = True,
        extract_formulas: bool = True,
        embed_images: bool = False,
        enhanced_options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Process multiple PDF files concurrently.

        Args:
            pdf_sources: List of URLs or local file paths
            method: Extraction method for all PDFs
            include_metadata: Include metadata for all PDFs
            page_range: Page range for all PDFs (if applicable)
            output_format: Output format for all PDFs
            extract_images: Extract images from all PDFs
            extract_tables: Extract tables from all PDFs
            extract_formulas: Extract formulas from all PDFs
            embed_images: Embed images as base64 instead of saving as files
            enhanced_options: Enhanced processing options for all PDFs

        Returns:
            Dict containing batch processing results and summary
        """
        if not pdf_sources:
            return {"success": False, "error": "PDF sources list cannot be empty"}

        logger.info(f"Batch processing {len(pdf_sources)} PDFs with method: {method}")

        # Process PDFs concurrently
        tasks = [
            self.process_pdf(
                pdf_source=source,
                method=method,
                include_metadata=include_metadata,
                page_range=page_range,
                output_format=output_format,
                extract_images=extract_images,
                extract_tables=extract_tables,
                extract_formulas=extract_formulas,
                embed_images=embed_images,
                enhanced_options=enhanced_options,
            )
            for source in pdf_sources
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results and handle exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append(
                    {"success": False, "error": str(result), "source": pdf_sources[i]}
                )
            else:
                processed_results.append(result)  # type: ignore[arg-type]

        # Calculate summary statistics
        successful_results = [r for r in processed_results if r.get("success")]
        failed_results = [r for r in processed_results if not r.get("success")]

        total_pages = sum(r.get("pages_processed", 0) for r in successful_results)  # type: ignore[misc]
        total_words = sum(r.get("word_count", 0) for r in successful_results)  # type: ignore[misc]

        return {
            "success": True,
            "results": processed_results,
            "summary": {
                "total_pdfs": len(pdf_sources),
                "successful": len(successful_results),
                "failed": len(failed_results),
                "total_pages_processed": total_pages,
                "total_words_extracted": total_words,
                "method_used": method,
                "output_format": output_format,
            },
        }

    def _is_url(self, source: str) -> bool:
        """兼容导出：判断给定源是否为 URL。"""
        return is_pdf_url(source)

    async def _download_pdf(self, url: str) -> Optional[Path]:
        """兼容导出：下载 PDF 到当前处理器临时目录。"""
        return await download_pdf_to_temp(url, self.temp_dir)

    async def _auto_extract(
        self,
        pdf_path: Path,
        page_range: Optional[tuple] = None,
        include_metadata: bool = True,
    ) -> Dict[str, Any]:
        """Auto-select best method for PDF extraction."""
        # Try PyMuPDF first (generally more reliable)
        try:
            result = await self._extract_with_pymupdf(
                pdf_path, page_range, include_metadata
            )
            if result.get("success"):
                result["method_used"] = "pymupdf"
                return result
        except Exception as e:
            logger.warning(f"PyMuPDF failed for {pdf_path}, trying pypdf: {str(e)}")

        # Fall back to pypdf
        try:
            result = await self._extract_with_pypdf(
                pdf_path, page_range, include_metadata
            )
            if result.get("success"):
                result["method_used"] = "pypdf"
                return result
        except Exception as e:
            logger.error(f"Both methods failed for {pdf_path}: {str(e)}")

        return {
            "success": False,
            "error": "Both PyMuPDF and pypdf extraction methods failed",
        }

    async def _extract_with_pymupdf(
        self,
        pdf_path: Path,
        page_range: Optional[tuple] = None,
        include_metadata: bool = True,
    ) -> Dict[str, Any]:
        """Extract text using PyMuPDF (fitz), interleaving images inline."""
        try:
            fitz = _import_fitz()
            doc = fitz.open(str(pdf_path))

            # Determine page range
            total_pages = doc.page_count
            start_page = 0
            end_page = total_pages

            if page_range:
                start_page = max(0, page_range[0])
                end_page = min(total_pages, page_range[1])

            # Extract text from pages using block-level extraction
            # Each block naturally corresponds to a paragraph/text element.
            # Tables and images are placed inline at their correct y-positions.
            text_content = []
            for page_num in range(start_page, end_page):
                page = doc.load_page(page_num)

                # Get the image and table maps for this page
                page_image_map = self._page_image_maps.get(page_num, {})
                page_table_map = self._page_table_maps.get(page_num, {})
                blocks = page.get_text("blocks")

                # Pre-compute which text blocks overlap with table regions.
                # 算法/伪代码块优先于表格检测：若表格区域与算法文本块重叠，
                # 则移除该表格区域（避免将算法内容拆解为表格列）。
                table_block_nos = set()
                if page_table_map:
                    # 收集算法文本块的 bbox
                    algo_bboxes = []
                    for block in blocks:
                        if block[6] == 0:
                            text = block[4].strip()
                            if text and is_algorithm_block(text):
                                algo_bboxes.append(
                                    (block[0], block[1], block[2], block[3])
                                )

                    # 过滤与算法块重叠的表格区域
                    if algo_bboxes:
                        filtered = {}
                        for tbbox, table in page_table_map.items():
                            tx0, ty0, tx1, ty1 = tbbox
                            overlaps_algo = any(
                                min(ax1, tx1) > max(ax0, tx0)
                                and min(ay1, ty1) > max(ay0, ty0)
                                for ax0, ay0, ax1, ay1 in algo_bboxes
                            )
                            if not overlaps_algo:
                                filtered[tbbox] = table
                        page_table_map = filtered

                    for block in blocks:
                        if block[6] == 0:  # text block
                            bx0, by0, bx1, by1 = (
                                block[0],
                                block[1],
                                block[2],
                                block[3],
                            )
                            for tbbox in page_table_map:
                                tx0, ty0, tx1, ty1 = tbbox
                                # Check geometric intersection
                                if min(bx1, tx1) > max(bx0, tx0) and min(
                                    by1, ty1
                                ) > max(by0, ty0):
                                    table_block_nos.add(block[5])
                                    break

                # Pre-compute which text blocks overlap with image/figure regions.
                # 图内文字过滤：与 table_block_nos 相同的模式，将落在图片边界
                # 框内的文本块排除，防止图表标注混入正文。
                figure_block_nos: set = set()
                if page_image_map:
                    from .figure_text_filter import (
                        is_caption_text,
                        is_text_inside_figure,
                    )

                    # 收集图片边界框
                    image_bboxes = []
                    for block in blocks:
                        if block[6] == 1:  # image block
                            image_bboxes.append(
                                (block[0], block[1], block[2], block[3])
                            )
                    # 同时使用 ExtractedImage 的精确位置
                    for _bno, img in page_image_map.items():
                        pos = img.position
                        if pos:
                            image_bboxes.append(
                                (pos["x0"], pos["y0"], pos["x1"], pos["y1"])
                            )

                    for block in blocks:
                        if block[6] != 0:
                            continue
                        block_text = block[4].strip() if block[4] else ""
                        if not block_text:
                            continue
                        if is_caption_text(block_text):
                            continue
                        text_bbox = (block[0], block[1], block[2], block[3])
                        for img_bbox in image_bboxes:
                            if is_text_inside_figure(text_bbox, img_bbox):
                                figure_block_nos.add(block[5])
                                break

                # Build unified element list: (y_position, content)
                # to maintain correct vertical ordering
                page_elements: list = []

                # If formula reconstruction produced enhanced blocks, use them
                math_blocks = self._page_math_blocks.get(page_num)
                if math_blocks is not None:
                    # 公式增强路径：使用已含 LaTeX 的增强文本块
                    for i, mb in enumerate(math_blocks):
                        page_elements.append((i, mb))
                    # 补充图片引用
                    if page_image_map:
                        for block in sorted(blocks, key=lambda b: (b[1], b[0])):
                            if block[6] == 1 and block[5] in page_image_map:
                                img = page_image_map[block[5]]
                                alt_text = img.caption or img.filename
                                page_elements.append(
                                    (block[1], f"![{alt_text}]({img.filename})")
                                )
                else:
                    # 标准路径：算法检测 + 表格过滤 + 图片内联
                    for block in sorted(blocks, key=lambda b: (b[1], b[0])):
                        block_no = block[5]

                        if block[6] == 0:  # text block
                            if block_no in table_block_nos:
                                continue  # Skip text covered by a table
                            if block_no in figure_block_nos:
                                continue  # Skip text inside a figure/chart
                            block_text = block[4].strip()
                            if block_text:
                                if is_algorithm_block(block_text):
                                    # 算法/伪代码块：保留行结构
                                    page_elements.append((block[1], block_text))
                                else:
                                    # Merge line breaks within a block into spaces
                                    # (intra-paragraph line wraps from PDF layout)
                                    block_text = re.sub(r"\n+", " ", block_text)
                                    page_elements.append((block[1], block_text))

                        elif block[6] == 1 and page_image_map:  # image block
                            if block_no in page_image_map:
                                img = page_image_map[block_no]
                                alt_text = img.caption or img.filename
                                page_elements.append(
                                    (block[1], f"![{alt_text}]({img.filename})")
                                )

                # Insert tables at correct vertical positions
                for tbbox, table in page_table_map.items():
                    table_y = tbbox[1]  # y0 of table bbox
                    md = table.markdown
                    if table.caption:
                        md = f"**{table.caption}**\n\n{md}"
                    page_elements.append((table_y, md))

                # Sort by y-position and assemble
                page_elements.sort(key=lambda e: e[0])
                page_paragraphs = [elem[1] for elem in page_elements]

                if page_paragraphs:
                    page_text = "\n\n".join(page_paragraphs)
                    text_content.append(f"<!-- Page {page_num + 1} -->\n\n{page_text}")

            full_text = "\n\n".join(text_content)

            result = {
                "success": True,
                "text": full_text,
                "pages_processed": end_page - start_page,
                "total_pages": total_pages,
            }

            # Add metadata if requested
            if include_metadata:
                metadata = doc.metadata
                result["metadata"] = {
                    "title": metadata.get("title", ""),
                    "author": metadata.get("author", ""),
                    "subject": metadata.get("subject", ""),
                    "creator": metadata.get("creator", ""),
                    "producer": metadata.get("producer", ""),
                    "creation_date": metadata.get("creationDate", ""),
                    "modification_date": metadata.get("modDate", ""),
                    "total_pages": total_pages,
                    "file_size_bytes": pdf_path.stat().st_size,
                }

            doc.close()
            return result

        except Exception as e:
            return {"success": False, "error": f"PyMuPDF extraction failed: {str(e)}"}

    async def _extract_with_pypdf(
        self,
        pdf_path: Path,
        page_range: Optional[tuple] = None,
        include_metadata: bool = True,
    ) -> Dict[str, Any]:
        """Extract text using pypdf library."""
        try:
            with open(pdf_path, "rb") as file:
                pypdf = _import_pypdf()
                reader = pypdf.PdfReader(file)
                total_pages = len(reader.pages)

                # Determine page range
                start_page = 0
                end_page = total_pages

                if page_range:
                    start_page = max(0, page_range[0])
                    end_page = min(total_pages, page_range[1])

                # Extract text from pages with paragraph normalization
                text_content = []
                for page_num in range(start_page, end_page):
                    page = reader.pages[page_num]
                    text = page.extract_text()
                    if text.strip():  # Only add non-empty pages
                        text = self._normalize_paragraphs(text)
                        text_content.append(f"<!-- Page {page_num + 1} -->\n\n{text}")

                full_text = "\n\n".join(text_content)

                result = {
                    "success": True,
                    "text": full_text,
                    "pages_processed": end_page - start_page,
                    "total_pages": total_pages,
                }

                # Add metadata if requested
                if include_metadata:
                    metadata = reader.metadata or {}
                    result["metadata"] = {
                        "title": str(metadata.get("/Title", "")),
                        "author": str(metadata.get("/Author", "")),
                        "subject": str(metadata.get("/Subject", "")),
                        "creator": str(metadata.get("/Creator", "")),
                        "producer": str(metadata.get("/Producer", "")),
                        "creation_date": str(metadata.get("/CreationDate", "")),
                        "modification_date": str(metadata.get("/ModDate", "")),
                        "total_pages": total_pages,
                        "file_size_bytes": pdf_path.stat().st_size,
                    }

                return result

        except Exception as e:
            return {"success": False, "error": f"pypdf extraction failed: {str(e)}"}

    def _convert_to_markdown(self, text: str) -> str:
        """Convert extracted text to Markdown format using MarkItDown."""
        from ._markdown_builder import convert_to_markdown

        return convert_to_markdown(text)

    def _merge_algorithm_regions(self, text: str) -> str:
        """检测并合并跨段落的算法区域为代码围栏。"""
        from ._markdown_builder import merge_algorithm_regions

        return merge_algorithm_regions(text)

    def _simple_markdown_conversion(self, text: str) -> str:
        """Simple fallback markdown conversion with paragraph grouping."""
        from ._markdown_builder import simple_markdown_conversion

        return simple_markdown_conversion(text)

    def _looks_like_title(self, line: str) -> bool:
        """Check if a line looks like a title."""
        from ._markdown_builder import looks_like_title

        return looks_like_title(line)

    def _normalize_paragraphs(self, text: str) -> str:
        """Normalize paragraph separation in raw extracted text."""
        from ._markdown_builder import normalize_paragraphs

        return normalize_paragraphs(text)

    def _has_markdown_structure(self, text: str) -> bool:
        """Check if text has proper markdown structure."""
        from ._markdown_builder import has_markdown_structure

        return has_markdown_structure(text)

    async def _extract_enhanced_assets(
        self,
        pdf_path: Path,
        page_range: Optional[tuple],
        extract_images: bool,
        extract_tables: bool,
        extract_formulas: bool,
        pdf_name: str = "",
    ) -> Dict[str, Any]:
        """提取增强资源（图片、表格、公式），委托至 _enhanced_assets 模块。"""
        if not self.enhanced_processor:
            return {}

        from ._enhanced_assets import extract_enhanced_assets

        return await extract_enhanced_assets(
            enhanced_processor=self.enhanced_processor,
            page_image_maps=self._page_image_maps,
            page_table_maps=self._page_table_maps,
            page_math_blocks=self._page_math_blocks,
            page_math_regions=self._page_math_regions,
            pdf_path=pdf_path,
            page_range=page_range,
            extract_images=extract_images,
            extract_tables=extract_tables,
            extract_formulas=extract_formulas,
            pdf_name=pdf_name,
        )

    def _extract_formulas_dual_path(
        self,
        doc,  # noqa: ANN001 — fitz.Document
        pdf_path: Path,
        start_page: int,
        end_page: int,
    ) -> None:
        """使用双路径策略提取公式，委托至 _enhanced_assets 模块。"""
        from ._enhanced_assets import extract_formulas_dual_path

        extract_formulas_dual_path(
            enhanced_processor=self.enhanced_processor,
            page_math_blocks=self._page_math_blocks,
            page_math_regions=self._page_math_regions,
            doc=doc,
            pdf_path=pdf_path,
            start_page=start_page,
            end_page=end_page,
        )

    def _inject_docling_formulas(self, docling_md: str) -> None:
        """从 Docling 输出的 Markdown 中提取公式，委托至 _enhanced_assets 模块。"""
        from ._enhanced_assets import inject_docling_formulas

        inject_docling_formulas(self.enhanced_processor, docling_md)

    def _build_result_from_engine(
        self,
        engine_result: Any,
        engine_name: str,
        pdf_source: str,
        include_metadata: bool,
        output_format: str,
    ) -> Dict[str, Any]:
        """将引擎转换结果转换为项目标准输出格式。

        统一替代原先分引擎的 ``_build_result_from_docling``、
        ``_build_result_from_mineru`` 和 ``_build_result_from_marker``，
        利用鸭子类型消除 ~200 行重复代码。

        Args:
            engine_result: 引擎转换结果（Docling/MinerU/Marker ConversionResult）。
            engine_name: 引擎名称，用于 ``method_used`` 字段。
            pdf_source: PDF 源路径或 URL。
            include_metadata: 是否包含文档元数据。
            output_format: 输出格式 ``"text"`` 或 ``"markdown"``。

        Returns:
            项目标准输出字典。
        """
        content = engine_result.markdown

        # 安全网：清理残留的公式占位符
        from ..markdown.formula_placeholder_resolver import (
            has_formula_placeholders,
            resolve_formula_placeholders,
        )

        if has_formula_placeholders(content):
            content = resolve_formula_placeholders(content, remove_unresolved=True)

        # 构建 enhanced_assets 摘要
        enhanced_assets: Dict[str, Any] = {}

        images = getattr(engine_result, "images", None)
        if images:
            enhanced_assets["images"] = {
                "count": len(images),
                "items": [
                    {
                        "caption": getattr(img, "caption", None) or "",
                        "page": getattr(img, "page_number", None),
                        "filename": getattr(img, "filename", None),
                        "local_path": getattr(img, "local_path", None),
                        "width": getattr(img, "width", None),
                        "height": getattr(img, "height", None),
                        "mime_type": getattr(img, "mime_type", "image/png"),
                        **(
                            {"classification": img.classification}
                            if hasattr(img, "classification")
                            and img.classification is not None
                            else {}
                        ),
                    }
                    for img in images
                ],
                "files": [
                    getattr(img, "filename", None)
                    for img in images
                    if getattr(img, "filename", None)
                ],
            }

        tables = getattr(engine_result, "tables", None)
        if tables:
            enhanced_assets["tables"] = {
                "count": len(tables),
                "items": [
                    {
                        "rows": t.rows,
                        "columns": t.columns,
                        "caption": getattr(t, "caption", None) or "",
                        "page": getattr(t, "page_number", None),
                        "markdown": t.markdown,
                    }
                    for t in tables
                ],
            }

        formulas = getattr(engine_result, "formulas", None)
        if formulas:
            enhanced_assets["formulas"] = {
                "count": len(formulas),
                "block_count": sum(1 for f in formulas if f.formula_type == "block"),
                "inline_count": sum(1 for f in formulas if f.formula_type == "inline"),
            }

        code_blocks = getattr(engine_result, "code_blocks", None)
        if code_blocks:
            enhanced_assets["code_blocks"] = {
                "count": len(code_blocks),
                "languages": list({cb.language for cb in code_blocks if cb.language}),
            }

        # 输出目录
        engine = getattr(self, f"_{engine_name}_engine", None)
        if engine and hasattr(engine, "_output_dir") and engine._output_dir:
            enhanced_assets["output_directory"] = str(engine._output_dir)

        result: Dict[str, Any] = {
            "success": True,
            "text": content,
            "source": pdf_source,
            "method_used": engine_name,
            "output_format": output_format,
            "pages_processed": engine_result.page_count,
            "word_count": len(content.split()),
            "character_count": len(content),
            "enhanced_assets": enhanced_assets,
        }

        if output_format == "markdown":
            result["markdown"] = content

        if include_metadata:
            result["metadata"] = engine_result.metadata

        return result

    def _build_result_from_orchestration(
        self,
        orch_result: Any,
        pdf_source: str,
        include_metadata: bool,
        output_format: str,
    ) -> Dict[str, Any]:
        """将 OrchestrationResult 转换为项目标准输出格式。"""
        content = orch_result.content
        text = content

        result: Dict[str, Any] = {
            "success": bool(content),
            "text": text,
            "source": pdf_source,
            "method_used": "smart",
            "output_format": output_format,
            "pages_processed": orch_result.page_count,
            "word_count": len(text.split()) if text else 0,
            "character_count": len(text) if text else 0,
            "enhanced_assets": orch_result.enhanced_assets or {},
            "orchestration_info": {
                "engines_used": orch_result.engines_used,
                "synthesis_strategy": (
                    orch_result.plan.synthesis_strategy
                    if orch_result.plan
                    else "unknown"
                ),
                "synthesis_reasoning": orch_result.synthesis_reasoning,
            },
        }

        if output_format == "markdown":
            result["markdown"] = content

        if include_metadata:
            result["metadata"] = orch_result.metadata

        if not content:
            result["success"] = False
            result["error"] = (
                orch_result.synthesis_reasoning or "编排失败：所有引擎均无输出"
            )

        return result

    def cleanup(self):
        """Clean up temporary files and directories."""
        try:
            import shutil

            # Clean up enhanced processor
            if self.enhanced_processor:
                self.enhanced_processor.cleanup()

            if os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)

            self._page_image_maps.clear()
            self._page_table_maps.clear()
            self._page_math_blocks.clear()
            self._page_math_regions.clear()
        except Exception as e:
            logger.warning(f"Failed to cleanup temp directory: {str(e)}")
