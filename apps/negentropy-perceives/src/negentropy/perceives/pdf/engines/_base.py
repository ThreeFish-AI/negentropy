"""PDF 引擎基类与通用数据结构。

定义 PDF 转换引擎的标准化协议（Strategy Pattern）和引擎间共享的
结果数据类。所有引擎（Docling / MinerU / Marker）均需实现
``PDFEngine`` 协议，返回 ``EngineConversionResult`` 统一结果。

设计参考：
    - Strategy Pattern (GoF): 将算法族（引擎实现）与使用算法的客户端
      （PDFProcessor）解耦，允许算法独立变化
    - Protocol (PEP 544): 结构化子类型，无需强制继承，兼顾灵活性与类型安全

References:
    [1] E. Gamma et al., "Design Patterns: Elements of Reusable
        Object-Oriented Software," Addison-Wesley, 1994, pp. 315-323.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol, Tuple, runtime_checkable

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 通用资源数据类（引擎间共享）
# ---------------------------------------------------------------------------


@dataclass
class EngineImage:
    """引擎提取的图片标准化结构。"""

    page_number: Optional[int] = None
    caption: Optional[str] = None
    classification: Optional[str] = None  # Docling 专有，其他引擎为 None
    bbox: Optional[Tuple[float, float, float, float]] = None
    image_ref: Any = None
    filename: Optional[str] = None
    local_path: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    mime_type: str = "image/png"
    base64_data: Optional[str] = None


@dataclass
class EngineTable:
    """引擎提取的表格标准化结构。"""

    markdown: str = ""
    rows: int = 0
    columns: int = 0
    page_number: Optional[int] = None
    caption: Optional[str] = None
    bbox: Optional[Tuple[float, float, float, float]] = None
    html: Optional[str] = None  # MinerU 专有


@dataclass
class EngineFormula:
    """引擎提取的公式标准化结构。"""

    latex: str = ""
    formula_type: str = "block"  # "inline" | "block"
    page_number: Optional[int] = None
    original_text: str = ""


@dataclass
class EngineCodeBlock:
    """引擎提取的代码块标准化结构。"""

    code: str = ""
    language: Optional[str] = None
    page_number: Optional[int] = None


@dataclass
class EngineConversionResult:
    """PDF 引擎转换结果的统一数据结构。

    所有引擎（Docling / MinerU / Marker）的转换结果均需映射到此结构，
    消除上层 ``PDFProcessor`` 为每个引擎编写独立构建方法的重复代码。
    """

    markdown: str = ""
    tables: List[EngineTable] = field(default_factory=list)
    images: List[EngineImage] = field(default_factory=list)
    formulas: List[EngineFormula] = field(default_factory=list)
    code_blocks: List[EngineCodeBlock] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    page_count: int = 0
    engine_name: str = ""  # 标识产出引擎："docling" / "mineru" / "marker"
    output_dir: Optional[str] = None  # 引擎输出目录（图片等资源存放路径）


# ---------------------------------------------------------------------------
# 引擎协议（Strategy Pattern 核心接口）
# ---------------------------------------------------------------------------


@runtime_checkable
class PDFEngine(Protocol):
    """PDF 转换引擎的标准化协议。

    所有 PDF 引擎实现必须满足此协议，提供统一的可用性检测与转换接口。
    使用 ``runtime_checkable`` 支持 ``isinstance`` 检查，便于引擎注册
    时的合规性验证。

    引擎能力差异通过 ``capabilities`` 属性声明，调用方据此动态适配参数。

    Example::

        class MyEngine:
            @staticmethod
            def is_available() -> bool:
                return True

            @property
            def capabilities(self) -> EngineCapabilities:
                return EngineCapabilities(supports_page_range=True)

            def convert(self, pdf_path, **kwargs) -> Optional[EngineConversionResult]:
                ...
    """

    @staticmethod
    def is_available() -> bool:
        """检测引擎依赖是否已安装且可用。"""
        ...

    @property
    def capabilities(self) -> EngineCapabilities:
        """声明引擎的功能能力。"""
        ...

    def convert(
        self,
        pdf_path: str,
        *,
        page_range: Optional[Tuple[int, int]] = None,
        embed_images: bool = False,
    ) -> Optional[EngineConversionResult]:
        """执行 PDF 转换，返回统一结果。

        Args:
            pdf_path: PDF 文件本地路径。
            page_range: 可选页码范围 (0-based start, exclusive end)。
            embed_images: 是否将图片以 base64 嵌入 Markdown。

        Returns:
            ``EngineConversionResult`` 转换成功时返回统一结果，失败返回 ``None``。
        """
        ...


# ---------------------------------------------------------------------------
# 引擎能力声明
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class EngineCapabilities:
    """引擎功能能力声明。

    用于描述各引擎支持的特性差异，调用方可据此动态调整参数传递。
    例如：Marker 不支持 ``page_range``，MinerU 不支持 ``code_blocks``。
    """

    supports_page_range: bool = True
    supports_embed_images: bool = True
    supports_code_blocks: bool = True
    supports_table_structure: bool = True
    supports_formula_extraction: bool = True
    supports_gpu_acceleration: bool = True


# ---------------------------------------------------------------------------
# 结果构建辅助函数（消除 processor.py 中三处重复的 _build_result_from_* ）
# ---------------------------------------------------------------------------


def build_enhanced_assets(result: EngineConversionResult) -> Dict[str, Any]:
    """将 ``EngineConversionResult`` 转换为 ``enhanced_assets`` 摘要字典。

    此函数统一了 ``_build_result_from_docling``、``_build_result_from_mineru``
    和 ``_build_result_from_marker`` 中完全重复的 enhanced_assets 构建逻辑。

    Args:
        result: 引擎统一转换结果。

    Returns:
        符合项目标准输出格式的 enhanced_assets 字典。
    """
    enhanced_assets: Dict[str, Any] = {}

    if result.images:
        items = []
        for img in result.images:
            item: Dict[str, Any] = {
                "caption": img.caption or "",
                "page": img.page_number,
                "filename": img.filename,
                "local_path": img.local_path,
                "width": img.width,
                "height": img.height,
                "mime_type": img.mime_type,
            }
            # Docling 专有字段：classification
            if img.classification is not None:
                item["classification"] = img.classification
            items.append(item)

        enhanced_assets["images"] = {
            "count": len(result.images),
            "items": items,
            "files": [img.filename for img in result.images if img.filename],
        }

    if result.tables:
        enhanced_assets["tables"] = {
            "count": len(result.tables),
            "items": [
                {
                    "rows": t.rows,
                    "columns": t.columns,
                    "caption": t.caption or "",
                    "page": t.page_number,
                    "markdown": t.markdown,
                }
                for t in result.tables
            ],
        }

    if result.formulas:
        enhanced_assets["formulas"] = {
            "count": len(result.formulas),
            "block_count": sum(1 for f in result.formulas if f.formula_type == "block"),
            "inline_count": sum(
                1 for f in result.formulas if f.formula_type == "inline"
            ),
        }

    if result.code_blocks:
        enhanced_assets["code_blocks"] = {
            "count": len(result.code_blocks),
            "languages": list(
                {cb.language for cb in result.code_blocks if cb.language}
            ),
        }

    if result.output_dir:
        enhanced_assets["output_directory"] = result.output_dir

    return enhanced_assets


def build_standard_result(
    result: EngineConversionResult,
    pdf_source: str,
    output_format: str,
    include_metadata: bool,
    content: Optional[str] = None,
) -> Dict[str, Any]:
    """将 ``EngineConversionResult`` 转换为项目标准输出字典。

    此函数统一了 ``processor.py`` 中 ``_build_result_from_docling``、
    ``_build_result_from_mineru`` 和 ``_build_result_from_marker`` 的
    公共逻辑，消除 ~300 行重复代码。

    Args:
        result: 引擎统一转换结果。
        pdf_source: PDF 源路径或 URL。
        output_format: 输出格式 ``"text"`` 或 ``"markdown"``。
        include_metadata: 是否包含文档元数据。
        content: 可选的经后处理的内容文本。若为 ``None``，使用
                 ``result.markdown``。

    Returns:
        符合项目标准输出格式的结果字典。
    """
    text = content if content is not None else result.markdown

    standard: Dict[str, Any] = {
        "success": True,
        "text": text,
        "source": pdf_source,
        "method_used": result.engine_name,
        "output_format": output_format,
        "pages_processed": result.page_count,
        "word_count": len(text.split()),
        "character_count": len(text),
        "enhanced_assets": build_enhanced_assets(result),
    }

    if output_format == "markdown":
        standard["markdown"] = text

    if include_metadata:
        standard["metadata"] = result.metadata

    return standard
