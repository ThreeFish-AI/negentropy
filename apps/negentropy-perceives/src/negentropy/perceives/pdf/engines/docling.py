"""Docling 文档转换引擎封装。

当 ``docling`` 可选依赖已安装时，提供基于 Docling DocumentConverter 的
全功能 PDF→Markdown 转换路径，包括布局分析、表格结构识别（TableFormer）、
代码检测、公式提取与图片处理。

降级策略：当 ``docling`` 未安装时，``is_available()`` 返回 ``False``，
``convert()`` 安全返回 ``None``，由上层 ``PDFProcessor`` 自动切换至
PyMuPDF 路径。
"""

import logging
import re
from dataclasses import dataclass, field
from importlib.util import find_spec
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple

if TYPE_CHECKING:
    from ..figure_text_filter import FigureRegion

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# OpenCV 兼容性补丁
# ---------------------------------------------------------------------------

# opencv-python-headless 等精简构建可能缺少 cv2.setNumThreads()。
# docling_ibm_models.tableformer 在模块顶层调用 cv2.setNumThreads(0)，
# 触发 AttributeError 导致整个 Docling 路径失败（回退 PyMuPDF）。
# 此处预先注入 no-op 以确保安全。
try:
    import cv2

    if not hasattr(cv2, "setNumThreads"):
        cv2.setNumThreads = lambda n: None  # type: ignore[assignment]
        logger.debug("cv2.setNumThreads 不存在，已注入 no-op 兼容补丁")
except ImportError:
    pass  # cv2 未安装时无需补丁


# ---------------------------------------------------------------------------
# 数据类：标准化 Docling 输出
# ---------------------------------------------------------------------------


@dataclass
class DoclingTable:
    """Docling 提取的表格。"""

    markdown: str
    rows: int = 0
    columns: int = 0
    page_number: Optional[int] = None
    caption: Optional[str] = None
    bbox: Optional[Tuple[float, float, float, float]] = None


@dataclass
class DoclingImage:
    """Docling 提取的图片。"""

    page_number: Optional[int] = None
    caption: Optional[str] = None
    classification: Optional[str] = None
    bbox: Optional[Tuple[float, float, float, float]] = None
    image_ref: Any = None  # Docling ImageRef 对象
    filename: Optional[str] = None  # 磁盘文件名（如 "img_p1_0.png"）
    local_path: Optional[str] = None  # 磁盘绝对路径
    width: Optional[int] = None  # 图片宽度（像素）
    height: Optional[int] = None  # 图片高度（像素）
    mime_type: str = "image/png"
    base64_data: Optional[str] = None  # base64 编码（embed_images 模式用）


@dataclass
class DoclingFormula:
    """Docling 提取的数学公式。"""

    latex: str
    formula_type: str = "block"  # "inline" or "block"
    page_number: Optional[int] = None
    original_text: str = ""


@dataclass
class DoclingCodeBlock:
    """Docling 提取的代码块。"""

    code: str
    language: Optional[str] = None
    page_number: Optional[int] = None


@dataclass
class DoclingTextBlock:
    """Docling 提取的文本块（含页码与 bbox，TopLeft 坐标系）。"""

    text: str
    page_number: Optional[int] = None
    bbox: Optional[Tuple[float, float, float, float]] = None
    label: str = "paragraph"
    heading_level: Optional[int] = None


@dataclass
class DoclingConversionResult:
    """Docling 转换结果的标准化数据结构。"""

    markdown: str
    tables: List[DoclingTable] = field(default_factory=list)
    images: List[DoclingImage] = field(default_factory=list)
    formulas: List[DoclingFormula] = field(default_factory=list)
    code_blocks: List[DoclingCodeBlock] = field(default_factory=list)
    text_blocks: List[DoclingTextBlock] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    page_count: int = 0


def _infer_heading_level_from_text(text: str) -> Optional[int]:
    """从文本编号模式推断标题层级。

    学术论文/技术文档的常见编号模式：
        "1 Introduction"        → H2（顶级章节）
        "2. Theoretical Frame"  → H2（顶级章节，带尾随点号）
        "2.1 Formal Definition" → H3（子节）
        "3.1.1 Tech Landscape"  → H4（子子节）
        "Abstract"              → None（无编号，不推断）

    Returns:
        heading_level (1-6) 或 None（无法推断时）。
    """
    import re

    # 匹配开头的编号模式：数字(.数字)* 后跟可选点号和空格
    # 支持 "1 Title"、"2. Title"、"2.1 Title"、"3.1.1 Title"
    m = re.match(r"^(\d+(?:\.\d+)*)\.?\s", text)
    if not m:
        return None

    numbering = m.group(1)
    parts = numbering.split(".")

    if len(parts) == 1:
        return 2  # "N Title" → H2（顶级章节）
    elif len(parts) == 2:
        return 3  # "N.N Title" → H3（子节）
    else:
        return 4  # "N.N.N+ Title" → H4


# ---------------------------------------------------------------------------
# Docling 引擎
# ---------------------------------------------------------------------------


class DoclingEngine:
    """Docling 文档转换引擎。

    封装 Docling ``DocumentConverter`` 的完整能力：

    * 全文档 Markdown 转换（含布局分析与阅读顺序保持）
    * 结构化表格提取（TableFormer ACCURATE 模式）
    * 代码块检测与语言识别
    * 数学公式 LaTeX 提取（CodeFormula 模型）
    * 图片提取与分类

    Converter 实例在首次调用时延迟初始化并**类级缓存**，
    避免重复加载 AI 模型（首次约 10-30 秒）。
    """

    # 类级缓存：不同配置签名 → converter 实例
    _converters: Dict[str, Any] = {}

    def __init__(
        self,
        enable_table_structure: bool = True,
        table_mode: str = "accurate",
        enable_code_enrichment: bool = True,
        enable_formula_enrichment: bool = True,
        enable_picture_images: bool = True,
        enable_ocr: bool = False,
        images_scale: float = 2.0,
        output_dir: Optional[str] = None,
        device: Optional[str] = None,
        num_threads: int = 4,
        ocr_batch_size: int = 0,
        layout_batch_size: int = 0,
        table_batch_size: int = 0,
    ) -> None:
        self._enable_table_structure = enable_table_structure
        self._table_mode = table_mode
        self._enable_code_enrichment = enable_code_enrichment
        self._enable_formula_enrichment = enable_formula_enrichment
        self._enable_picture_images = enable_picture_images
        self._enable_ocr = enable_ocr
        self._images_scale = images_scale
        self._output_dir = Path(output_dir) if output_dir else None
        self._device = device
        self._num_threads = num_threads
        self._ocr_batch_size = ocr_batch_size
        self._layout_batch_size = layout_batch_size
        self._table_batch_size = table_batch_size
        self._device_config: Optional[Any] = None

    # ------------------------------------------------------------------
    # 可用性检测
    # ------------------------------------------------------------------

    @staticmethod
    def is_available() -> bool:
        """检测 ``docling`` 是否已安装且可用。"""
        try:
            import docling  # noqa: F401

            return True
        except ImportError:
            return False

    # ------------------------------------------------------------------
    # 设备感知配置解析
    # ------------------------------------------------------------------

    def _resolve_device_config(self) -> Any:
        """延迟解析设备感知配置。

        首次调用时触发硬件检测并根据设备类型应用限制降级，
        后续调用返回缓存结果。
        """
        if self._device_config is None:
            from ..hardware.device_config import resolve_device_config

            self._device_config = resolve_device_config(
                device_preference=self._device,
                num_threads=self._num_threads,
                enable_formula=self._enable_formula_enrichment,
                enable_table=self._enable_table_structure,
                table_mode=self._table_mode,
                ocr_batch_size_override=self._ocr_batch_size,
                layout_batch_size_override=self._layout_batch_size,
                table_batch_size_override=self._table_batch_size,
            )
            # MPS enrichment 策略已在 device_config 层与 mlx_vlm 可用性
            # 联合判定，此处仅记录最终状态
            if (
                self._device_config.device == "mps"
                and self._device_config.do_formula_enrichment
            ):
                logger.info(
                    "MPS formula enrichment 已保留（mlx_vlm 可用），"
                    "将由 _configure_mps_code_formula_options 配置 granite_docling + MLX"
                )
            # 回写降级后的配置以保持一致性
            self._enable_formula_enrichment = self._device_config.do_formula_enrichment
        return self._device_config

    def _mps_enrichment_policy(self) -> str:
        """读取 Apple Silicon MPS 下 Docling code/formula enrichment 策略。"""
        try:
            from ...config import settings

            return str(getattr(settings, "pdf_docling_mps_enrichment", "granite_mlx"))
        except (ImportError, AttributeError):
            return "granite_mlx"

    # ------------------------------------------------------------------
    # 配置签名（用于 converter 缓存键）
    # ------------------------------------------------------------------

    def _config_key(self) -> str:
        device_cfg = self._resolve_device_config()
        return (
            f"tbl={self._enable_table_structure}:{self._table_mode}"
            f"|code={self._enable_code_enrichment}"
            f"|formula={device_cfg.do_formula_enrichment}"
            f"|pic={self._enable_picture_images}"
            f"|ocr={self._enable_ocr}"
            f"|scale={self._images_scale}"
            f"|mps_enrich={self._mps_enrichment_policy() if device_cfg.device == 'mps' else 'default'}"
            f"|{device_cfg.cache_key_segment}"
        )

    # ------------------------------------------------------------------
    # Converter 延迟初始化
    # ------------------------------------------------------------------

    def _configure_mps_code_formula_options(
        self,
        pipeline_options: Any,
    ) -> Tuple[str, str]:
        """按 MPS enrichment 策略配置 Docling code/formula 子模型。

        Returns:
            ``(preset, engine)``，用于日志与测试观测。
        """
        policy = self._mps_enrichment_policy()
        if policy == "disable":
            pipeline_options.do_code_enrichment = False
            pipeline_options.do_formula_enrichment = False
            logger.info(
                "Docling MPS code/formula enrichment 已禁用；"
                "TableFormer MPS 仍由 Docling 上游禁用，表格结构可能使用 CPU"
            )
            return ("disabled", "none")

        if find_spec("mlx_vlm") is None:
            logger.warning(
                "Apple Silicon MPS 下配置为 pdf.docling_mps_enrichment=granite_mlx，"
                "但当前环境未安装 mlx-vlm；code/formula enrichment 已禁用。"
                "请执行 `uv sync --python 3.13` 以启用。"
            )
            pipeline_options.do_code_enrichment = False
            pipeline_options.do_formula_enrichment = False
            return ("disabled", "none")

        from docling.datamodel.pipeline_options import (  # type: ignore[import-untyped]
            CodeFormulaVlmOptions,
        )
        from docling.datamodel.vlm_engine_options import (  # type: ignore[import-untyped]
            MlxVlmEngineOptions,
        )

        pipeline_options.code_formula_options = CodeFormulaVlmOptions.from_preset(
            "granite_docling",
            engine_options=MlxVlmEngineOptions(),
        )
        logger.info(
            "Docling MPS code/formula enrichment 使用 preset=granite_docling engine=mlx；"
            "TableFormer MPS 仍由 Docling 上游禁用，表格结构可能使用 CPU"
        )
        return ("granite_docling", "mlx")

    def _get_converter(self) -> Any:
        """延迟初始化并返回 DocumentConverter 实例（含硬件加速）。"""
        key = self._config_key()
        if key in DoclingEngine._converters:
            return DoclingEngine._converters[key]

        from docling.datamodel.base_models import InputFormat  # type: ignore[import-untyped]
        from docling.datamodel.pipeline_options import (  # type: ignore[import-untyped]
            PdfPipelineOptions,
        )
        from docling.document_converter import (  # type: ignore[import-untyped]
            DocumentConverter,
            PdfFormatOption,
        )

        device_cfg = self._resolve_device_config()

        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_table_structure = self._enable_table_structure
        pipeline_options.do_code_enrichment = self._enable_code_enrichment
        pipeline_options.do_formula_enrichment = device_cfg.do_formula_enrichment
        pipeline_options.generate_picture_images = self._enable_picture_images
        pipeline_options.images_scale = self._images_scale
        pipeline_options.do_ocr = self._enable_ocr

        # 禁用非必要的页面图像生成以节省内存
        pipeline_options.generate_page_images = False

        code_formula_preset = "default"
        code_formula_engine = "auto_inline"
        if device_cfg.device == "mps":
            code_formula_preset, code_formula_engine = (
                self._configure_mps_code_formula_options(pipeline_options)
            )

        # GPU 批处理吞吐优化
        if hasattr(pipeline_options, "ocr_batch_size"):
            pipeline_options.ocr_batch_size = device_cfg.ocr_batch_size
        if hasattr(pipeline_options, "layout_batch_size"):
            pipeline_options.layout_batch_size = device_cfg.layout_batch_size
        if hasattr(pipeline_options, "table_batch_size"):
            pipeline_options.table_batch_size = device_cfg.table_batch_size

        logger.info(
            "Docling batch sizes: ocr=%d, layout=%d, table=%d (device=%s)",
            device_cfg.ocr_batch_size,
            device_cfg.layout_batch_size,
            device_cfg.table_batch_size,
            device_cfg.device,
        )

        # macOS 原生 OCR 引擎（Apple Vision Framework）
        if device_cfg.ocr_engine == "mac_native" and self._enable_ocr:
            try:
                from docling.datamodel.pipeline_options import OcrMacOptions  # type: ignore[import-untyped]

                pipeline_options.ocr_options = OcrMacOptions()
                logger.info("macOS 原生 OCR (Apple Vision Framework) 已启用")
            except ImportError:
                logger.debug(
                    "OcrMacOptions 不可用（需 docling[mac] 依赖），使用默认 OCR 引擎"
                )

        # 硬件加速配置
        from docling.datamodel.accelerator_options import (  # type: ignore[import-untyped]
            AcceleratorDevice,
            AcceleratorOptions,
        )

        accelerator_options = AcceleratorOptions(
            device=AcceleratorDevice(device_cfg.device),
            num_threads=device_cfg.num_threads,
        )
        pipeline_options.accelerator_options = accelerator_options

        if self._enable_table_structure:
            from docling.datamodel.pipeline_options import (  # type: ignore[import-untyped]
                TableFormerMode,
                TableStructureOptions,
            )

            mode = (
                TableFormerMode.ACCURATE
                if self._table_mode == "accurate"
                else TableFormerMode.FAST
            )
            pipeline_options.table_structure_options = TableStructureOptions(
                mode=mode,
                do_cell_matching=True,
            )

        converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_options=pipeline_options,
                )
            }
        )
        DoclingEngine._converters[key] = converter
        logger.info(
            "Docling DocumentConverter 初始化完成 "
            "(config=%s, device=%s, code_formula_preset=%s, code_formula_engine=%s)",
            key,
            device_cfg.device,
            code_formula_preset,
            code_formula_engine,
        )
        return converter

    # ------------------------------------------------------------------
    # 核心转换
    # ------------------------------------------------------------------

    def convert(
        self,
        pdf_path: str,
        page_range: Optional[Tuple[int, int]] = None,
        embed_images: bool = False,
    ) -> Optional[DoclingConversionResult]:
        """执行完整文档转换。

        Args:
            pdf_path: PDF 文件本地路径。
            page_range: 可选的页码范围 ``(start, end)``，0-based start / exclusive end。
            embed_images: 是否将图片以 base64 嵌入 Markdown（默认 False，
                使用文件引用模式）。

        Returns:
            ``DoclingConversionResult`` 或 ``None``（当 Docling 不可用或转换失败时）。
        """
        if not self.is_available():
            return None

        try:
            converter = self._get_converter()

            # 构建 Docling convert() 关键字参数
            convert_kwargs: Dict[str, Any] = {}
            if page_range is not None:
                # 项目约定: 0-based start, exclusive end — (80, 82) = 页面 80, 81
                # Docling 约定: 1-based start, inclusive end — (81, 82) = 页面 81, 82
                docling_start = page_range[0] + 1
                docling_end = page_range[1]
                if docling_start >= 1 and docling_end >= docling_start:
                    convert_kwargs["page_range"] = (docling_start, docling_end)
                    logger.info(
                        "Docling page_range: (%d, %d) (1-based inclusive)",
                        docling_start,
                        docling_end,
                    )

            result = converter.convert(pdf_path, **convert_kwargs)
            doc = result.document

            # 1. 先提取图片（保存到磁盘），供后续 REFERENCED 模式引用
            images = self._extract_images(doc)

            # 2. 导出完整 Markdown（选择正确的 ImageRefMode）
            markdown = self._export_markdown_with_image_mode(
                doc, embed_images=embed_images
            )

            # 2.5 移除图内文字（figure-internal text filtering）
            markdown = self._filter_figure_internal_texts(doc, markdown)

            # 3. LaTeX 后处理（复用现有清洗逻辑）
            from ..math_formula import DoclingFormulaEnricher

            markdown = DoclingFormulaEnricher.postprocess_latex(markdown)

            # 3.1 公式占位符解析：替换 <!-- formula-not-decoded -->
            from ...markdown.formula_placeholder_resolver import (
                extract_fallback_formulas,
                has_formula_placeholders,
                resolve_formula_placeholders,
            )

            if has_formula_placeholders(markdown):
                fallback_regions = extract_fallback_formulas(
                    pdf_path, page_range=page_range
                )
                markdown = resolve_formula_placeholders(
                    markdown, fallback_formulas=fallback_regions
                )

            # 3.5 图片引用规范化：替换占位符、统一路径格式
            if not embed_images:
                from ...markdown.image_ref_normalizer import normalize_image_references

                markdown = normalize_image_references(markdown, images)

            # 4. 提取结构化元素（表格、公式、代码块、文本块）
            tables = self._extract_tables(doc)
            formulas = self._extract_formulas(doc, markdown)
            code_blocks = self._extract_code_blocks(doc)
            text_blocks = self._extract_text_blocks(doc)

            # 5. 元数据
            metadata = self._extract_metadata(doc)

            # 6. 页数
            page_count = len(doc.pages) if hasattr(doc, "pages") and doc.pages else 0

            return DoclingConversionResult(
                markdown=markdown,
                tables=tables,
                images=images,
                formulas=formulas,
                code_blocks=code_blocks,
                text_blocks=text_blocks,
                metadata=metadata,
                page_count=page_count,
            )
        except Exception as e:
            logger.warning("Docling 转换失败: %s", e)
            return None

    def _export_markdown_with_image_mode(
        self, doc: Any, *, embed_images: bool = False
    ) -> str:
        """根据配置选择 ImageRefMode 导出 Markdown。

        - ``embed_images=True``  → ``ImageRefMode.EMBEDDED``（base64 内联）
        - ``self._output_dir``   → ``ImageRefMode.REFERENCED``（文件路径引用）
        - 降级                   → 默认 PLACEHOLDER 模式

        当 ``docling_core`` 版本不支持 ``ImageRefMode`` 时，安全降级为
        默认导出。
        """
        try:
            from docling_core.types.doc import ImageRefMode  # type: ignore[import-untyped]

            if embed_images:
                return doc.export_to_markdown(image_mode=ImageRefMode.EMBEDDED)
            elif self._output_dir:
                return doc.export_to_markdown(image_mode=ImageRefMode.REFERENCED)
        except ImportError:
            logger.info("当前 docling_core 版本不支持 ImageRefMode，使用默认导出模式")
        except Exception as e:
            logger.warning("ImageRefMode 导出失败，降级为默认模式: %s", e)

        return doc.export_to_markdown()

    # ------------------------------------------------------------------
    # 图内文字过滤
    # ------------------------------------------------------------------

    def _filter_figure_internal_texts(self, doc: Any, markdown: str) -> str:
        """识别并移除 Markdown 中混入正文的图内文字。

        利用 ``doc.pictures`` 的边界框与 ``doc.iterate_items()`` 中各
        TEXT/PARAGRAPH 元素的边界框进行空间重叠检测，将落在图区域内的
        文本从导出的 Markdown 中移除。

        Args:
            doc: Docling ``DoclingDocument`` 实例。
            markdown: ``export_to_markdown()`` 产出的原始 Markdown。

        Returns:
            过滤后的 Markdown 文本。
        """
        from ..figure_text_filter import (
            collect_figure_internal_texts,
            remove_texts_from_markdown,
        )

        figure_regions = self._collect_figure_regions(doc)
        if not figure_regions:
            return markdown

        # 收集文档元素列表
        items: list = []
        if hasattr(doc, "iterate_items"):
            try:
                items = list(doc.iterate_items())
            except Exception as e:
                logger.debug("iterate_items() 失败: %s", e)
                return markdown

        if not items:
            return markdown

        def _get_label(item_tuple):
            item = item_tuple[0]
            return str(getattr(item, "label", "")).lower()

        def _get_text(item_tuple):
            item = item_tuple[0]
            return getattr(item, "text", "") or ""

        def _get_page_no(item_tuple):
            item = item_tuple[0]
            return self._get_page_number(item)

        def _get_bbox(item_tuple):
            item = item_tuple[0]
            prov = getattr(item, "prov", None)
            if prov and len(prov) > 0:
                raw_page = self._get_raw_page_no(item)
                return self._to_topleft_bbox(
                    getattr(prov[0], "bbox", None), doc, raw_page
                )
            return None

        texts_to_remove = collect_figure_internal_texts(
            items,
            figure_regions,
            get_label=_get_label,
            get_text=_get_text,
            get_page_no=_get_page_no,
            get_bbox=_get_bbox,
        )

        if texts_to_remove:
            logger.info(
                "检测到 %d 段图内文字，将从 Markdown 中移除", len(texts_to_remove)
            )
            markdown = remove_texts_from_markdown(markdown, texts_to_remove)

        return markdown

    def _collect_figure_regions(self, doc: Any) -> List["FigureRegion"]:
        """从文档中提取所有图片/图表的边界框（页码 0-based，bbox TopLeft）。"""
        from ..figure_text_filter import FigureRegion

        regions: List[FigureRegion] = []
        if not hasattr(doc, "pictures"):
            return regions

        for pic in doc.pictures:
            prov = getattr(pic, "prov", None)
            if not prov or len(prov) == 0:
                continue
            raw_page_no = getattr(prov[0], "page_no", None)
            normalized_page_no = self._normalize_docling_page_no(raw_page_no)
            bbox_obj = getattr(prov[0], "bbox", None)
            if normalized_page_no is None or bbox_obj is None:
                continue
            bbox = self._to_topleft_bbox(bbox_obj, doc, raw_page_no)
            if bbox:
                caption = self._safe_caption(pic, doc)
                regions.append(
                    FigureRegion(page_no=normalized_page_no, bbox=bbox, caption=caption)
                )

        return regions

    @staticmethod
    def _extract_bbox_tuple(
        bbox_obj: Any,
    ) -> Optional[Tuple[float, float, float, float]]:
        """从 Docling BoundingBox 对象中提取 (x0, y0, x1, y1) 元组。

        兼容多种属性命名：``l/t/r/b`` 或 ``x0/y0/x1/y1``。
        """
        if bbox_obj is None:
            return None

        # 尝试 Docling BoundingBox: l (left), t (top), r (right), b (bottom)
        left = getattr(bbox_obj, "l", None)
        top = getattr(bbox_obj, "t", None)
        right = getattr(bbox_obj, "r", None)
        bottom = getattr(bbox_obj, "b", None)
        if all(v is not None for v in (left, top, right, bottom)):
            return (float(left), float(top), float(right), float(bottom))  # type: ignore[arg-type]

        # 尝试 x0/y0/x1/y1
        x0 = getattr(bbox_obj, "x0", None)
        y0 = getattr(bbox_obj, "y0", None)
        x1 = getattr(bbox_obj, "x1", None)
        y1 = getattr(bbox_obj, "y1", None)
        if all(v is not None for v in (x0, y0, x1, y1)):
            return (float(x0), float(y0), float(x1), float(y1))  # type: ignore[arg-type]

        return None

    # ------------------------------------------------------------------
    # 结构化元素提取
    # ------------------------------------------------------------------

    def _extract_tables(self, doc: Any) -> List[DoclingTable]:
        """从 DoclingDocument 提取结构化表格（页码 0-based，bbox TopLeft）。"""
        tables: List[DoclingTable] = []
        if not hasattr(doc, "tables"):
            return tables

        for table_item in doc.tables:
            try:
                md = table_item.export_to_markdown(doc=doc)

                # 表格维度
                rows = 0
                cols = 0
                data = getattr(table_item, "data", None)
                if data is not None:
                    rows = getattr(data, "num_rows", 0)
                    cols = getattr(data, "num_cols", 0)

                # 标题（captions 可能是 RefItem 列表，需通过 doc 解析）
                caption = self._safe_caption(table_item, doc)

                # 页码与 bbox（在边界做归一化：0-based + TopLeft）
                page_no = self._get_page_number(table_item)
                raw_page_no = self._get_raw_page_no(table_item)
                bbox = None
                prov = getattr(table_item, "prov", None)
                if prov and len(prov) > 0:
                    bbox = self._to_topleft_bbox(
                        getattr(prov[0], "bbox", None), doc, raw_page_no
                    )

                tables.append(
                    DoclingTable(
                        markdown=md,
                        rows=rows,
                        columns=cols,
                        page_number=page_no,
                        caption=caption,
                        bbox=bbox,
                    )
                )
            except Exception as e:
                logger.warning("提取 Docling 表格失败: %s", e)

        return tables

    def _extract_images(self, doc: Any) -> List[DoclingImage]:
        """从 DoclingDocument 提取图片并保存到磁盘。

        对每个 ``PictureItem``，调用 ``pic.get_image(doc)`` 获取 PIL Image，
        保存为 PNG 文件并记录路径、尺寸和 base64 数据。当 ``get_image`` 不可用
        或失败时，降级为仅记录元数据。
        """
        images: List[DoclingImage] = []
        if not hasattr(doc, "pictures"):
            return images

        # 确保输出目录存在
        output_dir = self._output_dir
        if output_dir is None:
            import tempfile

            output_dir = Path(tempfile.mkdtemp(prefix="docling_images_"))
            self._output_dir = output_dir
        output_dir.mkdir(parents=True, exist_ok=True)

        for idx, pic in enumerate(doc.pictures):
            try:
                caption = self._safe_caption(pic, doc)
                classification = getattr(pic, "classification", None)
                page_no = self._get_page_number(pic)
                raw_page_no = self._get_raw_page_no(pic)
                image_ref = getattr(pic, "image", None)

                # bbox（TopLeft 坐标系，便于 assembly 与 PyMuPDF 数据一致排序）
                bbox = None
                prov = getattr(pic, "prov", None)
                if prov and len(prov) > 0:
                    bbox = self._to_topleft_bbox(
                        getattr(prov[0], "bbox", None), doc, raw_page_no
                    )

                filename = None
                local_path = None
                width = None
                height = None
                base64_data = None

                # 核心：获取 PIL Image 并保存到磁盘
                try:
                    get_image_fn = getattr(pic, "get_image", None)
                    pil_image = get_image_fn(doc) if callable(get_image_fn) else None
                    if pil_image is not None:
                        width, height = pil_image.size
                        filename = f"img_p{page_no or 0}_{idx}.png"
                        local_path = str(output_dir / filename)
                        pil_image.save(local_path, "PNG")

                        # 生成 base64 数据（供 embed_images 模式使用）
                        import io
                        import base64 as b64mod

                        buf = io.BytesIO()
                        pil_image.save(buf, format="PNG")
                        base64_data = b64mod.b64encode(buf.getvalue()).decode("ascii")

                        logger.info(
                            "保存 Docling 图片: %s (%dx%d)", filename, width, height
                        )
                except Exception as e:
                    logger.warning("获取/保存 Docling 图片失败 (idx=%d): %s", idx, e)

                images.append(
                    DoclingImage(
                        page_number=page_no,
                        caption=caption,
                        classification=(
                            str(classification) if classification else None
                        ),
                        bbox=bbox,
                        image_ref=image_ref,
                        filename=filename,
                        local_path=local_path,
                        width=width,
                        height=height,
                        base64_data=base64_data,
                    )
                )
            except Exception as e:
                logger.warning("提取 Docling 图片失败: %s", e)

        return images

    def _extract_formulas(self, doc: Any, markdown: str) -> List[DoclingFormula]:
        """从 Markdown 文本中提取公式。

        Docling 将公式内嵌在 Markdown 输出中，通过正则匹配提取。
        """
        formulas: List[DoclingFormula] = []

        # 块级公式: $$ ... $$
        for match in re.finditer(r"\$\$([\s\S]+?)\$\$", markdown):
            latex = match.group(1).strip()
            if latex:
                formulas.append(DoclingFormula(latex=latex, formula_type="block"))

        # 行内公式: $ ... $ (排除 $$)
        for match in re.finditer(r"(?<!\$)\$(?!\$)([^$]+?)\$(?!\$)", markdown):
            latex = match.group(1).strip()
            if latex and len(latex) > 1:
                formulas.append(DoclingFormula(latex=latex, formula_type="inline"))

        return formulas

    def _extract_code_blocks(self, doc: Any) -> List[DoclingCodeBlock]:
        """从 DoclingDocument 提取代码块。"""
        code_blocks: List[DoclingCodeBlock] = []

        try:
            if not hasattr(doc, "iterate_items"):
                return code_blocks

            for item, _level in doc.iterate_items():
                label = str(getattr(item, "label", "")).lower()
                if "code" in label:
                    code = getattr(item, "text", "")
                    lang = getattr(item, "code_language", None)
                    if code:
                        page_no = self._get_page_number(item)
                        code_blocks.append(
                            DoclingCodeBlock(
                                code=code,
                                language=str(lang) if lang else None,
                                page_number=page_no,
                            )
                        )
        except Exception as e:
            logger.warning("提取 Docling 代码块失败: %s", e)

        return code_blocks

    # 视为正文文本的 Docling label 集合。
    # 不包含 ``caption``：图/表标题由 ``ExtractedTable.caption`` /
    # ``ExtractedImage.caption`` 在 ``assembly`` 阶段统一渲染，若再作为段落输出会
    # 导致同一段标题文字在最终 Markdown 中出现两次。
    _TEXT_LABELS = frozenset(
        {
            "title",
            "section_header",
            "paragraph",
            "text",
            "list_item",
            "footnote",
        }
    )

    # 视为正文段落的 label 集合（用于「图内文字」剔除判定）。
    # 仅这些标签会与图区域做空间重叠判定；标题/列表/脚注等结构化项即使坐标
    # 落在图区域内也保留，避免误删 Docling 误标的内容。
    _BODY_TEXT_LABELS_FOR_FIGURE_FILTER = frozenset({"text", "paragraph"})

    def _extract_text_blocks(
        self,
        doc: Any,
        figure_regions: Optional[List["FigureRegion"]] = None,
    ) -> List[DoclingTextBlock]:
        """遍历 ``doc.iterate_items()`` 提取带页码与 bbox 的文本块。

        Docling 的 ``export_to_markdown()`` 是聚合输出，丢失了段落到页码的映射；
        而 ``iterate_items()`` 保留了每个 item 的 ``prov[0].page_no`` 与 ``bbox``，
        是实现「文本块按页排序」的唯一可靠路径。

        Args:
            doc: ``DoclingDocument`` 实例。
            figure_regions: 已提取的图区域列表（可选）；若未传入则内部调用
                ``_collect_figure_regions(doc)`` 计算。任何空间落在图区域内的
                ``text``/``paragraph`` 段落都会被过滤掉，避免轴标签/图例/注释
                等图内文字混入正文（与 ``_filter_figure_internal_texts`` 对
                ``markdown`` 字符串的过滤等价）。
        """
        blocks: List[DoclingTextBlock] = []
        if not hasattr(doc, "iterate_items"):
            return blocks

        from ..figure_text_filter import (
            is_caption_text,
            is_text_inside_figure,
        )

        if figure_regions is None:
            figure_regions = self._collect_figure_regions(doc)

        page_figures: Dict[int, List["FigureRegion"]] = {}
        for region in figure_regions:
            page_figures.setdefault(region.page_no, []).append(region)

        try:
            # 标题去重：跟踪已输出的标题文本，跳过跨页重复。
            # 学术论文的 "References" 在每页会被 Docling 重新检测为 title/section_header，
            # 导致最终 Markdown 出现多个 # References。使用文本指纹去重，
            # 同一标题文本在文档中只保留首次出现。
            seen_heading_texts: set[str] = set()

            for item, _level in doc.iterate_items():
                label = str(getattr(item, "label", "")).lower()
                if label not in self._TEXT_LABELS:
                    continue
                text = getattr(item, "text", "") or ""
                if not text or not text.strip():
                    continue
                page_no = self._get_page_number(item)
                raw_page_no = self._get_raw_page_no(item)
                bbox = None
                prov = getattr(item, "prov", None)
                if prov and len(prov) > 0:
                    bbox = self._to_topleft_bbox(
                        getattr(prov[0], "bbox", None), doc, raw_page_no
                    )

                # 图内文字过滤：仅对正文段落（text/paragraph）做重叠判定，
                # 标题/列表/脚注等保留；显式标题文本（Figure N / 图 N）兜底保留。
                if (
                    bbox is not None
                    and page_no is not None
                    and label in self._BODY_TEXT_LABELS_FOR_FIGURE_FILTER
                    and not is_caption_text(text)
                ):
                    regions_on_page = page_figures.get(page_no, [])
                    if any(
                        is_text_inside_figure(bbox, region.bbox)
                        for region in regions_on_page
                    ):
                        continue

                heading_level: Optional[int] = None
                if label == "title":
                    # 过滤学术论文首页的噪声标题：
                    # - 作者机构/编号行（如 "1 SJTU 2 SII 3 GAIR"）
                    # - 脚注标记（如 "0 † Corresponding author"）
                    # - URL（如 "1 https://github.com/..."）
                    stripped = text.strip()
                    is_noise_title = False
                    if len(stripped) < 60:
                        # 纯数字+空格+单词的短行且无实质标题内容
                        import re as _re

                        if _re.match(r"^[\d\s\†\*\‡\§\¶]+$", stripped):
                            is_noise_title = True
                        # 机构编号行："1 SJTU 2 SII 3 GAIR"
                        elif _re.match(r"^(?:\d+\s+\S+\s*){2,}$", stripped):
                            is_noise_title = True
                        # 脚注行："0 † Corresponding author"
                        elif "†" in stripped or "‡" in stripped or "§" in stripped:
                            is_noise_title = True
                        # URL 行："1 https://..."
                        elif _re.match(r"^\d+\s+https?://", stripped):
                            is_noise_title = True
                    if is_noise_title:
                        continue
                    heading_level = 1
                elif label == "section_header":
                    # 优先从文本编号推断层级：学术论文标题编号模式
                    # "1 Introduction" → H2, "2.1 Formal Definition" → H3,
                    # "3.1.1 Technological Landscape" → H4
                    heading_level = _infer_heading_level_from_text(text.strip())
                    if heading_level is None:
                        # 降级：使用 Docling 的 _level（通常全为 1，不可靠）
                        if isinstance(_level, int) and _level >= 1:
                            heading_level = min(1 + _level, 6)
                        else:
                            raw_level = getattr(item, "level", None)
                            try:
                                heading_level = int(raw_level) if raw_level else 2
                            except (TypeError, ValueError):
                                heading_level = 2
                    heading_level = max(1, min(6, heading_level))

                # 目录行过滤：跳过 PDF 目录页中带点号引导线的条目。
                # 特征：包含连续 3+ 个点号且以数字开头（如
                # "2 Theoretical Framework 4 2.1 Formal Definition... 4"）
                if label in ("title", "section_header") and "..." in text:
                    import re as _re

                    if _re.search(r"\.{3,}", text) and _re.search(r"\d", text):
                        continue

                # 标题去重：同一文本在整个文档中只保留首次出现
                if label in ("title", "section_header"):
                    heading_key = text.strip().lower()
                    if heading_key in seen_heading_texts:
                        continue
                    seen_heading_texts.add(heading_key)

                blocks.append(
                    DoclingTextBlock(
                        text=text.strip(),
                        page_number=page_no,
                        bbox=bbox,
                        label=label,
                        heading_level=heading_level,
                    )
                )
        except Exception as e:
            logger.warning("提取 Docling 文本块失败: %s", e)

        return blocks

    def _extract_metadata(self, doc: Any) -> Dict[str, Any]:
        """提取文档元数据。"""
        meta: Dict[str, Any] = {}
        if hasattr(doc, "name"):
            meta["title"] = doc.name

        origin = getattr(doc, "origin", None)
        if origin:
            if hasattr(origin, "filename"):
                meta["filename"] = origin.filename
            if hasattr(origin, "mimetype"):
                meta["mimetype"] = origin.mimetype

        return meta

    @staticmethod
    def _safe_caption(item: Any, doc: Any = None) -> str:
        """安全提取 Docling 元素的 caption 文本。

        优先使用 ``FloatingItem.caption_text(doc)``（Docling 推荐方式），
        降级为手动遍历 ``captions`` 列表，最后尝试通过 ``RefItem.resolve(doc)``
        解析引用。

        Args:
            item: Docling 文档元素（PictureItem / TableItem 等）。
            doc: DoclingDocument 实例，用于解析 caption 引用。
        """
        # 1. 优先：FloatingItem.caption_text(doc)
        if doc is not None:
            caption_text_fn = getattr(item, "caption_text", None)
            if callable(caption_text_fn):
                try:
                    text = caption_text_fn(doc)
                    if text:
                        return str(text)
                except Exception:
                    logger.debug(
                        "caption_text() 调用失败，降级为手动遍历", exc_info=True
                    )

        # 2. 降级：手动遍历 captions[0].text
        captions = getattr(item, "captions", None)
        if not captions:
            return ""
        first = captions[0]
        text = getattr(first, "text", None)
        if text is not None:
            return str(text)

        # 3. 降级：RefItem.resolve(doc)
        if doc is not None:
            resolve_fn = getattr(first, "resolve", None)
            if callable(resolve_fn):
                try:
                    resolved = resolve_fn(doc)
                    resolved_text = getattr(resolved, "text", None)
                    if resolved_text:
                        return str(resolved_text)
                except Exception:
                    logger.debug(
                        "RefItem.resolve() 调用失败，跳过 caption 解析", exc_info=True
                    )
        return ""

    # Docling 报告的 page_no 为 1-based（首页 page_no=1）。
    # 项目内统一使用 0-based 页码（PyMuPDF / ExtractedImage / TextBlock 等），
    # 因此在 Docling 数据进入项目域的边界统一归一化。
    _DOCLING_PAGE_OFFSET = 1

    @staticmethod
    def _normalize_docling_page_no(page_no: Optional[int]) -> Optional[int]:
        """将 Docling 1-based 页码转换为项目 0-based 约定。"""
        if page_no is None:
            return None
        try:
            return max(0, int(page_no) - DoclingEngine._DOCLING_PAGE_OFFSET)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _get_page_number(item: Any) -> Optional[int]:
        """从 Docling 元素的 prov 属性中获取 0-based 页码。"""
        prov = getattr(item, "prov", None)
        if prov and len(prov) > 0:
            return DoclingEngine._normalize_docling_page_no(
                getattr(prov[0], "page_no", None)
            )
        return None

    @staticmethod
    def _get_raw_page_no(item: Any) -> Optional[int]:
        """获取 Docling 原始 1-based 页码（用于查 ``doc.pages`` 取页面尺寸）。"""
        prov = getattr(item, "prov", None)
        if prov and len(prov) > 0:
            raw = getattr(prov[0], "page_no", None)
            if raw is None:
                return None
            try:
                return int(raw)
            except (TypeError, ValueError):
                return None
        return None

    @staticmethod
    def _get_page_height(doc: Any, raw_page_no: Optional[int]) -> Optional[float]:
        """从 ``doc.pages`` 中读取指定 1-based 页码的页高。"""
        if doc is None or raw_page_no is None:
            return None
        pages = getattr(doc, "pages", None)
        if pages is None:
            return None
        try:
            page_obj = (
                pages.get(raw_page_no) if hasattr(pages, "get") else pages[raw_page_no]
            )
        except (KeyError, IndexError, TypeError):
            return None
        if page_obj is None:
            return None
        size = getattr(page_obj, "size", None)
        if size is None:
            return None
        height = getattr(size, "height", None)
        if height is None:
            return None
        try:
            return float(height)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _to_topleft_bbox(
        bbox_obj: Any,
        doc: Any,
        raw_page_no: Optional[int],
    ) -> Optional[Tuple[float, float, float, float]]:
        """从 Docling BoundingBox 提取 (x0, y0, x1, y1) 并归一化为 TopLeft 坐标系。

        Docling 的 ``BoundingBox`` 默认 ``coord_origin=BOTTOMLEFT``（y0 = 距页底距离），
        与 PyMuPDF / 项目其余路径使用的 TopLeft（y0 = 距页顶距离）相反。直接混用会
        导致 ``assembly`` 的 ``y0`` 排序键把 Docling 元素误排到 PyMuPDF 之后。

        ``_extract_bbox_tuple`` 始终按 ``(l, t, r, b)`` 解包；BOTTOMLEFT 下 ``t > b``，
        因此输入 ``y0 = t_BL``（距页底的「上边」距离，较大）、``y1 = b_BL``（较小）。
        转换到 TopLeft 时上/下边对应 ``page_h - y0``、``page_h - y1``，保证输出
        ``y0 < y1`` 满足 ``is_text_inside_figure`` 的交集判定前提。
        """
        bbox = DoclingEngine._extract_bbox_tuple(bbox_obj)
        if bbox is None:
            return None
        coord_origin = getattr(bbox_obj, "coord_origin", None)
        if coord_origin is None:
            return bbox
        if "BOTTOMLEFT" not in str(coord_origin).upper():
            return bbox
        page_h = DoclingEngine._get_page_height(doc, raw_page_no)
        if page_h is None or page_h <= 0:
            return bbox  # 缺页高时保留原值，由 reading_order 兜底排序
        x0, y0, x1, y1 = bbox
        return (x0, page_h - y0, x1, page_h - y1)

    # ------------------------------------------------------------------
    # 缓存管理
    # ------------------------------------------------------------------

    @classmethod
    def reset_cache(cls) -> None:
        """清除 converter 缓存（主要用于测试）。"""
        cls._converters.clear()
