"""Marker 文档转换引擎封装。

**GPL-3.0 许可证警告**: Marker 使用 GPL-3.0 许可证。在本项目中使用 Marker
引擎意味着您的项目也需要遵循 GPL-3.0 许可证条款。如果这不适用于您的场景，
请使用 Docling 引擎（MIT 许可证）或 PyMuPDF 路径作为替代。

当 ``marker`` 或 ``marker_pdf`` 可选依赖已安装时，提供基于 Marker PdfConverter
的全功能 PDF→Markdown 转换路径，包括布局分析、表格结构识别、公式提取
（LaTeX）、代码块检测与图片处理。

降级策略：当 ``marker`` / ``marker_pdf`` 未安装时，``is_available()`` 返回
``False``，``convert()`` 安全返回 ``None``，由上层 ``PDFProcessor`` 自动切换至
PyMuPDF 路径。
"""

import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 数据类：标准化 Marker 输出
# ---------------------------------------------------------------------------


@dataclass
class MarkerTable:
    """Marker 提取的表格。"""

    markdown: str
    rows: int = 0
    columns: int = 0
    page_number: Optional[int] = None
    caption: Optional[str] = None


@dataclass
class MarkerImage:
    """Marker 提取的图片。"""

    page_number: Optional[int] = None
    caption: Optional[str] = None
    filename: Optional[str] = None  # 磁盘文件名（如 "img_p1_0.png"）
    local_path: Optional[str] = None  # 磁盘绝对路径
    width: Optional[int] = None  # 图片宽度（像素）
    height: Optional[int] = None  # 图片高度（像素）
    mime_type: str = "image/png"
    base64_data: Optional[str] = None  # base64 编码（embed_images 模式用）


@dataclass
class MarkerFormula:
    """Marker 提取的数学公式。"""

    latex: str
    formula_type: str = "block"  # "inline" or "block"
    page_number: Optional[int] = None
    original_text: str = ""


@dataclass
class MarkerCodeBlock:
    """Marker 提取的代码块。"""

    code: str
    language: Optional[str] = None
    page_number: Optional[int] = None


@dataclass
class MarkerConversionResult:
    """Marker 转换结果的标准化数据结构。"""

    markdown: str
    tables: List[MarkerTable] = field(default_factory=list)
    images: List[MarkerImage] = field(default_factory=list)
    formulas: List[MarkerFormula] = field(default_factory=list)
    code_blocks: List[MarkerCodeBlock] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    page_count: int = 0


# ---------------------------------------------------------------------------
# Marker 引擎
# ---------------------------------------------------------------------------


class MarkerEngine:
    """Marker 文档转换引擎。

    封装 Marker ``PdfConverter`` 的完整能力：

    * 全文档 Markdown 转换（含布局分析与阅读顺序保持）
    * 结构化表格提取（Markdown 表格格式）
    * 数学公式 LaTeX 提取（$$...$$ 格式）
    * 代码块检测与语言识别（```...``` 格式）
    * 图片提取与保存

    Converter 实例在首次调用时延迟初始化并**类级缓存**，
    避免重复加载 AI 模型（首次约 10-30 秒）。

    **设备策略**:
        - 默认仍强制 ``TORCH_DEVICE=cpu`` 以兼容 Marker 上游 text detection
          在 MPS 上的已知问题（``marker.settings.Settings`` 自身注释亦提示）；
        - 用户可通过 ``device='mps'`` 显式 opt-in（自担风险，建议先在样本 PDF
          上验证 detection 输出无丢字）；
        - ``device='mps' + half_precision=True``：通过 monkey-patch
          ``settings.MODEL_DTYPE`` 启用 fp16，配合 Apple Silicon 统一内存
          可降低内存占用并提升吞吐；
        - ``inference_ram_gb`` / ``num_workers`` > 0 时透传环境变量。

    References:
        - VikParuchuri/marker README：``TORCH_DEVICE`` / ``INFERENCE_RAM`` /
          ``NUM_WORKERS`` 配置项说明。
    """

    # 类级缓存：不同配置签名 → converter 实例
    _converters: Dict[str, Any] = {}

    # 模块级标记：是否已设置 TORCH_DEVICE 环境变量
    _torch_device_set: bool = False
    _last_torch_device_value: Optional[str] = None

    def __init__(
        self,
        output_dir: Optional[str] = None,
        llm_enhanced: bool = False,
        device: Optional[str] = None,
        inference_ram_gb: int = 0,
        num_workers: int = 0,
        half_precision: bool = False,
    ) -> None:
        """初始化 Marker 引擎。

        Args:
            output_dir: 图片输出目录。为 None 时使用临时目录。
            llm_enhanced: 是否启用 LLM 增强模式（需额外配置 LLM 服务）。
            device: ``TORCH_DEVICE`` 透传值（``None`` / ``"cpu"`` / ``"mps"`` /
                ``"cuda"``）。``None`` 时维持默认 CPU 强制；``"mps"`` 自担
                text detection 风险。
            inference_ram_gb: ``INFERENCE_RAM`` 环境变量（GB），``0`` 表示不设置。
            num_workers: ``NUM_WORKERS`` 环境变量，``0`` 表示不设置。
            half_precision: ``device='mps'`` 时启用 fp16
                （monkey-patch ``MODEL_DTYPE``），减半显存占用。
        """
        self._output_dir = Path(output_dir) if output_dir else None
        self._llm_enhanced = llm_enhanced
        self._device = device
        self._inference_ram_gb = inference_ram_gb
        self._num_workers = num_workers
        self._half_precision = half_precision

    # ------------------------------------------------------------------
    # Torch 设备强制设置
    # ------------------------------------------------------------------

    @classmethod
    def _ensure_torch_device(
        cls,
        device: Optional[str],
        *,
        inference_ram_gb: int = 0,
        num_workers: int = 0,
    ) -> None:
        """在导入 marker 之前应用 TORCH_DEVICE / INFERENCE_RAM / NUM_WORKERS。

        - ``device=None``：维持默认 CPU 强制（向后兼容，确保 text detection 稳定）。
        - ``device``={cpu,mps,cuda}：透传到环境变量。
        - ``inference_ram_gb>0`` / ``num_workers>0``：透传以利用统一内存与并行度。

        必须在任何 ``torch``/``marker`` 模块**导入之前**调用，避免上游单次
        ``settings`` 实例化锁死配置。
        """
        target = (device or "cpu").lower()
        # 仅在值变化时写入，减少重复日志
        if not cls._torch_device_set or cls._last_torch_device_value != target:
            os.environ["TORCH_DEVICE"] = target
            cls._torch_device_set = True
            cls._last_torch_device_value = target
            if target == "cpu":
                logger.info("Marker 引擎: TORCH_DEVICE=cpu（默认稳定路径）")
            else:
                logger.warning(
                    "Marker 引擎: TORCH_DEVICE=%s（用户显式 opt-in；"
                    "Marker 上游警告 MPS text detection 可能不可靠，建议样本验证）",
                    target,
                )

        if inference_ram_gb > 0:
            os.environ["INFERENCE_RAM"] = str(inference_ram_gb)
            logger.info("Marker 引擎: INFERENCE_RAM=%dGB", inference_ram_gb)
        if num_workers > 0:
            os.environ["NUM_WORKERS"] = str(num_workers)
            logger.info("Marker 引擎: NUM_WORKERS=%d", num_workers)

    @classmethod
    def _ensure_cpu_device(cls) -> None:
        """兼容旧调用路径：等价于 ``_ensure_torch_device(None)``。"""
        cls._ensure_torch_device(None)

    @staticmethod
    def _maybe_enable_fp16_on_mps() -> None:
        """在 ``device=mps`` 时把 Marker ``MODEL_DTYPE`` patch 为 ``torch.float16``。

        Marker 原生 ``MODEL_DTYPE`` computed property 在非 CUDA 设备上恒返回
        ``torch.float32``，无法利用 Apple Silicon 的 fp16 throughput。本方法
        通过 monkey-patch ``Settings`` 类一次性切换返回值，覆盖所有现有/新建
        ``settings`` 单例（pydantic ``BaseSettings`` 子类的 computed_field
        在 class 层级解析）。

        失败时（marker 上游结构变更等）静默吞下，不破坏主流程。
        """
        try:
            import torch  # type: ignore[import-not-found]
            from marker.settings import Settings  # type: ignore[import-untyped]
        except ImportError as e:
            logger.warning("Marker FP16 patch 跳过：依赖不可用 %s", e)
            return

        # 已 patch 过则不再重复
        if getattr(Settings, "_negentropy_fp16_patched", False):
            return

        try:
            # computed_field 的属性以 fget 形式存在；将其替换为返回 float16 的属性
            original = Settings.MODEL_DTYPE  # noqa: F841 (保留供未来回滚)

            def _model_dtype_fp16(self):  # type: ignore[no-untyped-def]
                # CUDA 仍保留 bfloat16；MPS/CPU 改为 float16
                if getattr(self, "TORCH_DEVICE_MODEL", "cpu") == "cuda":
                    return torch.bfloat16
                return torch.float16

            # 直接覆盖 property 描述符，pydantic computed_field 兼容
            Settings.MODEL_DTYPE = property(_model_dtype_fp16)  # type: ignore[assignment]
            Settings._negentropy_fp16_patched = True  # type: ignore[attr-defined]
            logger.info("Marker 引擎: MODEL_DTYPE → torch.float16 (MPS fp16 已启用)")
        except Exception as e:  # noqa: BLE001
            logger.warning("Marker FP16 patch 失败，保留 float32: %s", e)

    # ------------------------------------------------------------------
    # 可用性检测
    # ------------------------------------------------------------------

    @staticmethod
    def is_available() -> bool:
        """检测 ``marker`` 或 ``marker_pdf`` 是否已安装且可用。"""
        try:
            import marker_pdf  # noqa: F401

            return True
        except ImportError:
            pass
        try:
            import marker  # noqa: F401

            return True
        except ImportError:
            return False

    # ------------------------------------------------------------------
    # 配置签名（用于 converter 缓存键）
    # ------------------------------------------------------------------

    def _config_key(self) -> str:
        """生成当前配置的缓存键签名。"""
        return (
            f"llm={self._llm_enhanced}|dev={self._device or 'cpu'}"
            f"|ram={self._inference_ram_gb}|nw={self._num_workers}"
            f"|fp16={self._half_precision}"
        )

    # ------------------------------------------------------------------
    # Converter 延迟初始化
    # ------------------------------------------------------------------

    def _get_converter(self) -> Any:
        """延迟初始化并返回 PdfConverter 实例。

        首次调用时加载 AI 模型（create_model_dict），后续调用返回缓存实例。
        设备/批处理参数通过环境变量在 marker 导入前设置；半精度通过
        ``MODEL_DTYPE`` monkey-patch 启用。
        """
        key = self._config_key()
        if key in MarkerEngine._converters:
            return MarkerEngine._converters[key]

        # 透传设备 / 内存 / 并行度环境变量（必须在 marker 导入之前）
        MarkerEngine._ensure_torch_device(
            self._device,
            inference_ram_gb=self._inference_ram_gb,
            num_workers=self._num_workers,
        )

        # 半精度 monkey-patch：仅在 mps 上有意义（cuda 上 Marker 已默认 bfloat16）
        if self._half_precision and (self._device or "").lower() == "mps":
            self._maybe_enable_fp16_on_mps()

        from marker.converters.pdf import PdfConverter  # type: ignore[import-untyped]
        from marker.models import create_model_dict  # type: ignore[import-untyped]

        model_dict = create_model_dict()

        converter_kwargs: Dict[str, Any] = {
            "artifact_dict": model_dict,
        }

        # LLM 增强模式：传递 LLM 服务配置
        if self._llm_enhanced:
            try:
                from marker.services.gemini import GeminiService  # type: ignore[import-untyped]

                converter_kwargs["llm_service"] = GeminiService()
                logger.info("Marker 引擎: LLM 增强模式已启用（GeminiService）")
            except ImportError:
                logger.warning("Marker 引擎: LLM 增强模式依赖不可用，降级为基础模式")
            except Exception as e:
                logger.warning(
                    "Marker 引擎: LLM 服务初始化失败 (%s)，降级为基础模式", e
                )

        converter = PdfConverter(**converter_kwargs)
        MarkerEngine._converters[key] = converter
        logger.info("Marker PdfConverter 初始化完成 (config=%s)", key)
        return converter

    # ------------------------------------------------------------------
    # 核心转换
    # ------------------------------------------------------------------

    def convert(
        self,
        pdf_path: str,
        embed_images: bool = False,
    ) -> Optional[MarkerConversionResult]:
        """执行完整文档转换。

        Args:
            pdf_path: PDF 文件本地路径。
            embed_images: 是否将图片以 base64 嵌入 Markdown（默认 False，
                使用文件引用模式）。

        Returns:
            ``MarkerConversionResult`` 或 ``None``（当 Marker 不可用或转换失败时）。
        """
        if not self.is_available():
            return None

        # 强制设置 CPU 设备
        MarkerEngine._ensure_cpu_device()

        try:
            converter = self._get_converter()

            # Marker 核心转换
            rendered = converter(pdf_path)

            # 提取 Markdown 文本与图片
            from marker.output import text_from_rendered  # type: ignore[import-untyped]

            text, _, images = text_from_rendered(rendered)
            markdown = text if text else ""

            # 若 rendered 有 .markdown 属性，优先使用
            if hasattr(rendered, "markdown") and rendered.markdown:
                markdown = rendered.markdown

            # 1. 提取图片并保存到磁盘
            extracted_images = self._extract_images(images)

            # 2. LaTeX 后处理（复用现有清洗逻辑）
            from ..math_formula import DoclingFormulaEnricher

            markdown = DoclingFormulaEnricher.postprocess_latex(markdown)

            # 3. 提取结构化元素
            tables = self._extract_tables(rendered, markdown)
            formulas = self._extract_formulas(markdown)
            code_blocks = self._extract_code_blocks(markdown)

            # 4. 元数据
            metadata = self._extract_metadata(rendered)

            # 5. 页数
            page_count = self._extract_page_count(rendered)

            # 6. embed_images 模式：生成 base64 数据
            if embed_images:
                extracted_images = self._embed_images(extracted_images)
                markdown = self._embed_images_in_markdown(markdown, extracted_images)

            # 7. 图片引用规范化：替换占位符、统一路径格式
            if not embed_images:
                from ...markdown.image_ref_normalizer import normalize_image_references

                markdown = normalize_image_references(markdown, extracted_images)

            return MarkerConversionResult(
                markdown=markdown,
                tables=tables,
                images=extracted_images,
                formulas=formulas,
                code_blocks=code_blocks,
                metadata=metadata,
                page_count=page_count,
            )
        except Exception as e:
            logger.warning("Marker 转换失败: %s", e)
            return None

    # ------------------------------------------------------------------
    # 结构化元素提取
    # ------------------------------------------------------------------

    def _extract_tables(self, rendered: Any, markdown: str) -> List[MarkerTable]:
        """从 Marker 渲染结果中提取表格。

        Marker 将表格以 Markdown 表格语法输出。通过正则匹配从 Markdown
        文本中提取表格块，同时尝试从 rendered.children 中获取页码信息。
        """
        tables: List[MarkerTable] = []

        # 从 Markdown 中匹配 Markdown 表格块
        # 匹配模式：连续的 | ... | 行，以 |---| 分隔线开头
        table_pattern = re.compile(
            r"(?:^|\n)(\|[^\n]+\|\n\|[-:| ]+\|\n(?:\|[^\n]+\|\n)*)",
            re.MULTILINE,
        )

        for match in table_pattern.finditer(markdown):
            table_md = match.group(1).strip()
            if not table_md:
                continue

            lines = [line for line in table_md.split("\n") if line.strip()]
            # 数据行数 = 总行数 - 表头行 - 分隔行
            rows = max(0, len(lines) - 2)
            # 列数 = 第一行的 | 数量 - 1
            cols = lines[0].count("|") - 1 if lines else 0

            tables.append(
                MarkerTable(
                    markdown=table_md,
                    rows=rows,
                    columns=cols,
                )
            )

        # 尝试从 rendered.children 中补充页码信息
        self._enrich_table_page_numbers(tables, rendered)

        return tables

    def _enrich_table_page_numbers(
        self, tables: List[MarkerTable], rendered: Any
    ) -> None:
        """尝试从 rendered.children 中补充表格页码。"""
        if not hasattr(rendered, "children") or not rendered.children:
            return

        try:
            table_idx = 0
            for block in rendered.children:
                block_type = getattr(block, "block_type", None) or ""
                if "table" in str(block_type).lower():
                    if table_idx < len(tables):
                        page_no = self._get_block_page_number(block)
                        if page_no is not None:
                            tables[table_idx].page_number = page_no
                        # 尝试提取 caption
                        caption = self._get_block_caption(block)
                        if caption:
                            tables[table_idx].caption = caption
                    table_idx += 1
        except Exception as e:
            logger.debug("补充表格页码失败: %s", e)

    def _extract_formulas(self, markdown: str) -> List[MarkerFormula]:
        """从 Markdown 文本中提取公式。

        Marker 将公式以 LaTeX 格式嵌入 Markdown 输出（$$...$$ 块级，
        $...$ 行内），通过正则匹配提取。
        """
        formulas: List[MarkerFormula] = []

        # 块级公式: $$ ... $$
        for match in re.finditer(r"\$\$([\s\S]+?)\$\$", markdown):
            latex = match.group(1).strip()
            if latex:
                formulas.append(MarkerFormula(latex=latex, formula_type="block"))

        # 行内公式: $ ... $ (排除 $$)
        for match in re.finditer(r"(?<!\$)\$(?!\$)([^$]+?)\$(?!\$)", markdown):
            latex = match.group(1).strip()
            if latex and len(latex) > 1:
                formulas.append(MarkerFormula(latex=latex, formula_type="inline"))

        return formulas

    def _extract_images(self, images: Dict[str, Any]) -> List[MarkerImage]:
        """从 Marker 输出的 images 字典中提取图片并保存到磁盘。

        Marker 的 ``text_from_rendered()`` 返回一个 dict，键为文件名，
        值为 PIL Image 对象。本方法将每个图片保存为 PNG 文件并记录路径、
        尺寸和 base64 数据。

        Args:
            images: Marker 返回的 {filename: PIL.Image} 字典。

        Returns:
            提取的 ``MarkerImage`` 列表。
        """
        extracted: List[MarkerImage] = []
        if not images:
            return extracted

        # 确保输出目录存在
        output_dir = self._output_dir
        if output_dir is None:
            import tempfile

            output_dir = Path(tempfile.mkdtemp(prefix="marker_images_"))
            self._output_dir = output_dir
        output_dir.mkdir(parents=True, exist_ok=True)

        for idx, (name, pil_image) in enumerate(images.items()):
            try:
                width = None
                height = None
                filename = None
                local_path = None

                if pil_image is not None:
                    # 获取图片尺寸
                    try:
                        width, height = pil_image.size
                    except Exception:  # nosec B110  # 获取图片尺寸非关键路径，静默跳过
                        pass

                    # 保存到磁盘
                    safe_name = re.sub(r"[^\w\-.]", "_", name)
                    if not safe_name.endswith(".png"):
                        safe_name += ".png"
                    filename = safe_name
                    local_path = str(output_dir / filename)

                    try:
                        pil_image.save(local_path, "PNG")
                        logger.info(
                            "保存 Marker 图片: %s (%dx%d)",
                            filename,
                            width or 0,
                            height or 0,
                        )
                    except Exception as e:
                        logger.warning("保存 Marker 图片失败 (%s): %s", name, e)

                extracted.append(
                    MarkerImage(
                        filename=filename,
                        local_path=local_path,
                        width=width,
                        height=height,
                    )
                )
            except Exception as e:
                logger.warning("提取 Marker 图片失败 (%s): %s", name, e)

        return extracted

    def _extract_code_blocks(self, markdown: str) -> List[MarkerCodeBlock]:
        """从 Markdown 文本中提取代码块。

        Marker 将代码以标准 Markdown 围栏格式（```lang ... ```）输出，
        通过正则匹配提取代码内容与语言标识。
        """
        code_blocks: List[MarkerCodeBlock] = []

        # 匹配围栏代码块: ```lang\n...\n```
        pattern = re.compile(r"```(\w*)\n([\s\S]*?)```", re.MULTILINE)
        for match in pattern.finditer(markdown):
            lang = match.group(1).strip() or None
            code = match.group(2)
            if code:
                code_blocks.append(
                    MarkerCodeBlock(
                        code=code,
                        language=lang,
                    )
                )

        return code_blocks

    # ------------------------------------------------------------------
    # 辅助方法
    # ------------------------------------------------------------------

    def _extract_metadata(self, rendered: Any) -> Dict[str, Any]:
        """从 Marker 渲染结果中提取文档元数据。"""
        meta: Dict[str, Any] = {}

        # Marker 的 rendered 对象可能包含 metadata 属性
        rendered_meta = getattr(rendered, "metadata", None)
        if rendered_meta and isinstance(rendered_meta, dict):
            meta.update(rendered_meta)
        elif rendered_meta:
            # 尝试转换为字典
            try:
                meta.update(dict(rendered_meta))
            except (TypeError, ValueError):
                pass

        # 标记来源引擎
        meta["engine"] = "marker"

        return meta

    def _extract_page_count(self, rendered: Any) -> int:
        """从 Marker 渲染结果中提取页数。"""
        # 尝试从 metadata 获取
        rendered_meta = getattr(rendered, "metadata", None)
        if rendered_meta:
            for key in ("pages", "page_count", "total_pages"):
                val = (
                    rendered_meta.get(key)
                    if isinstance(rendered_meta, dict)
                    else getattr(rendered_meta, key, None)
                )
                if val is not None:
                    try:
                        return int(val)
                    except (TypeError, ValueError):
                        pass

        # 尝试从 children 中估算
        if hasattr(rendered, "children") and rendered.children:
            max_page = 0
            for block in rendered.children:
                page_no = self._get_block_page_number(block)
                if page_no is not None and page_no > max_page:
                    max_page = page_no
            if max_page > 0:
                return max_page

        return 0

    @staticmethod
    def _get_block_page_number(block: Any) -> Optional[int]:
        """从 Marker block 中获取页码。

        Marker block 可能在不同层级存储页码信息，依次尝试多种属性。
        """
        # 尝试 page 属性
        page = getattr(block, "page", None)
        if page is not None:
            try:
                return int(page)
            except (TypeError, ValueError):
                pass

        # 尝试 polygon 属性中的页码
        polygon = getattr(block, "polygon", None)
        if polygon is not None:
            page = getattr(polygon, "page", None)
            if page is not None:
                try:
                    return int(page)
                except (TypeError, ValueError):
                    pass

        # 尝试 bbox 属性
        bbox = getattr(block, "bbox", None)
        if bbox is not None:
            page = getattr(bbox, "page", None)
            if page is not None:
                try:
                    return int(page)
                except (TypeError, ValueError):
                    pass

        return None

    @staticmethod
    def _get_block_caption(block: Any) -> Optional[str]:
        """从 Marker block 中获取标题/说明。"""
        caption = getattr(block, "caption", None)
        if caption is not None:
            if isinstance(caption, str):
                return caption
            return str(caption)

        # 尝试 html 属性（某些 block 类型将 caption 放在 html 中）
        html = getattr(block, "html", None)
        if html and isinstance(html, str):
            # 尝试从 HTML 中提取 <caption> 或 <figcaption> 标签
            cap_match = re.search(
                r"<(?:caption|figcaption)>(.*?)</(?:caption|figcaption)>",
                html,
                re.DOTALL,
            )
            if cap_match:
                return cap_match.group(1).strip()

        return None

    def _embed_images(self, images: List[MarkerImage]) -> List[MarkerImage]:
        """为图片列表生成 base64 编码数据。"""
        import base64 as b64mod

        for img in images:
            if img.local_path and Path(img.local_path).exists():
                try:
                    with open(img.local_path, "rb") as f:
                        img.base64_data = b64mod.b64encode(f.read()).decode("ascii")
                except Exception as e:
                    logger.warning("生成 base64 失败 (%s): %s", img.filename, e)
        return images

    @staticmethod
    def _embed_images_in_markdown(markdown: str, images: List[MarkerImage]) -> str:
        """将 Markdown 中的图片引用替换为 base64 内联格式。"""
        for img in images:
            if img.filename and img.base64_data:
                # 替换 Markdown 图片引用为 base64 内联
                old_ref = f"]({img.filename})"
                new_ref = f"](data:{img.mime_type};base64,{img.base64_data})"
                markdown = markdown.replace(old_ref, new_ref)
        return markdown

    # ------------------------------------------------------------------
    # 缓存管理
    # ------------------------------------------------------------------

    @classmethod
    def reset_cache(cls) -> None:
        """清除 converter 缓存（主要用于测试）。"""
        cls._converters.clear()
