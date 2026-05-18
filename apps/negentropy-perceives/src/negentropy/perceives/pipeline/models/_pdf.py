"""PDF Pipeline 数据模型。

本模块定义了 PDF Pipeline 所有 Stage 之间传递的输入/输出数据类。

数据流向
--------

::

    PreprocessingInput
      -> PreprocessingOutput (含 DocumentCharacteristics)
      -> LayoutAnalysisOutput (含 LayoutRegion 列表)
      -> TextExtractionOutput / TableExtractionOutput / FormulaExtractionOutput
         / ImageExtractionOutput / CodeDetectionOutput  (并行)
      -> AssemblyOutput
      -> PipelineResult
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Stage 1: 预处理 (Preprocessing)
# ---------------------------------------------------------------------------


@dataclass
class PreprocessingInput:
    """PDF 预处理 Stage 的输入。"""

    source: str
    """PDF 来源：本地文件路径或 URL。"""

    page_range: Optional[Tuple[int, int]] = None
    """可选的页码范围（从 0 开始，左闭右开）。"""

    password: Optional[str] = None
    """PDF 解密密码（如有）。"""

    config: Dict[str, Any] = field(default_factory=dict)
    """额外配置参数（传递到下游 Stage）。"""


@dataclass
class DocumentCharacteristics:
    """PDF 文档特征分析结果（预处理阶段产物）。

    用于指导后续 Stage 的引擎选择与竞争策略。
    """

    page_count: int = 0
    """文档总页数。"""

    has_tables: bool = False
    """是否包含表格内容。"""

    has_formulas: bool = False
    """是否包含数学公式。"""

    has_code_blocks: bool = False
    """是否包含代码块。"""

    has_images: bool = False
    """是否包含图片。"""

    has_complex_layout: bool = False
    """是否具有复杂版面（多栏、混排等）。"""

    is_scanned: bool = False
    """是否为扫描件（需要 OCR）。"""

    text_density: str = "normal"
    """文本密度：``"sparse"`` | ``"normal"`` | ``"dense"``。"""

    estimated_content_types: List[str] = field(default_factory=list)
    """预估内容类型列表（如 ``["text", "table", "formula"]``）。"""

    language_hint: Optional[str] = None
    """检测到的主要语言提示（如 ``"zh-CN"``、``"en"``）。"""

    sample_text: str = ""
    """前 500 字符用于下游 LLM 分析。"""


@dataclass
class PreprocessingOutput:
    """PDF 预处理 Stage 的输出。"""

    local_path: Path
    """PDF 本地文件路径（URL 源会先下载到临时文件）。"""

    page_count: int
    """文档总页数。"""

    characteristics: DocumentCharacteristics
    """文档特征分析结果。"""

    metadata: Dict[str, Any] = field(default_factory=dict)
    """PDF 元数据（标题、作者、创建时间等）。"""

    page_range: Optional[Tuple[int, int]] = None
    """实际处理的页码范围。"""


# ---------------------------------------------------------------------------
# Stage 2: 版面分析 (Layout Analysis)
# ---------------------------------------------------------------------------


@dataclass
class LayoutRegion:
    """版面分析检测到的单个区域。"""

    region_type: str
    """区域类型：``"text"`` | ``"table"`` | ``"figure"`` | ``"formula"``
    | ``"code"`` | ``"header"`` | ``"footer"`` | ``"caption"``。"""

    bbox: Tuple[float, float, float, float]
    """边界框坐标 ``(x0, y0, x1, y1)``，单位为 PDF 点。"""

    page_number: int
    """所在页码（从 0 开始）。"""

    reading_order: int = 0
    """阅读顺序索引。"""

    confidence: float = 1.0
    """检测置信度（0.0 ~ 1.0）。"""

    metadata: Dict[str, Any] = field(default_factory=dict)
    """额外元数据（如区域内的文本摘要）。"""


@dataclass
class LayoutAnalysisOutput:
    """版面分析 Stage 的输出。"""

    regions: List[LayoutRegion]
    """按阅读顺序排列的区域列表。"""

    page_count: int = 0
    """处理的页数。"""

    metadata: Dict[str, Any] = field(default_factory=dict)
    """版面分析元数据（引擎信息、耗时等）。"""


# ---------------------------------------------------------------------------
# Stage 3a: 文本提取 (Text Extraction)
# ---------------------------------------------------------------------------


@dataclass
class TextBlock:
    """提取的文本块。"""

    text: str
    """文本内容。"""

    page_number: int
    """所在页码（从 0 开始）。"""

    bbox: Optional[Tuple[float, float, float, float]] = None
    """边界框坐标 ``(x0, y0, x1, y1)``。"""

    block_type: str = "paragraph"
    """块类型：``"paragraph"`` | ``"heading"`` | ``"list_item"``
    | ``"footnote"``。"""

    heading_level: Optional[int] = None
    """标题级别（1-6），仅当 ``block_type="heading"`` 时有效。"""

    reading_order: int = 0
    """阅读顺序索引。"""

    confidence: float = 1.0
    """提取置信度（OCR 场景下尤为重要）。"""


@dataclass
class TextExtractionOutput:
    """文本提取 Stage 的输出。"""

    blocks: List[TextBlock]
    """按阅读顺序排列的文本块列表。"""

    full_text: str = ""
    """合并后的全文文本。"""

    word_count: int = 0
    """总字数。"""

    metadata: Dict[str, Any] = field(default_factory=dict)
    """提取元数据。"""


# ---------------------------------------------------------------------------
# Stage 3b: 表格提取 (Table Extraction)
# ---------------------------------------------------------------------------


@dataclass
class ExtractedTable:
    """提取的表格数据（V2 版本，面向 Pipeline）。"""

    table_id: str
    """表格唯一标识。"""

    markdown: str
    """表格的 Markdown 表示。"""

    rows: int
    """行数。"""

    columns: int
    """列数。"""

    page_number: int = 0
    """所在页码（从 0 开始）。"""

    bbox: Optional[Tuple[float, float, float, float]] = None
    """边界框坐标。"""

    caption: Optional[str] = None
    """表格标题/说明文字。"""

    headers: Optional[List[str]] = None
    """表头列名列表。"""

    html: Optional[str] = None
    """表格的 HTML 表示（可选，部分引擎可提供）。"""

    confidence: float = 1.0
    """提取置信度。"""

    reading_order: int = 0
    """在文档中的阅读顺序索引。"""


@dataclass
class TableExtractionOutput:
    """表格提取 Stage 的输出。"""

    tables: List[ExtractedTable]
    """提取的表格列表。"""

    total_count: int = 0
    """表格总数。"""

    metadata: Dict[str, Any] = field(default_factory=dict)
    """提取元数据。"""


# ---------------------------------------------------------------------------
# Stage 3c: 公式提取 (Formula Extraction)
# ---------------------------------------------------------------------------


@dataclass
class ExtractedFormula:
    """提取的数学公式（V2 版本，面向 Pipeline）。"""

    formula_id: str
    """公式唯一标识。"""

    latex: str
    """LaTeX 表示。"""

    formula_type: str = "block"
    """公式类型：``"inline"`` | ``"block"``。"""

    page_number: int = 0
    """所在页码（从 0 开始）。"""

    bbox: Optional[Tuple[float, float, float, float]] = None
    """边界框坐标。"""

    original_text: str = ""
    """原始文本（OCR 识别的原始字符）。"""

    confidence: float = 1.0
    """识别置信度。"""

    reading_order: int = 0
    """在文档中的阅读顺序索引。"""


@dataclass
class FormulaExtractionOutput:
    """公式提取 Stage 的输出。"""

    formulas: List[ExtractedFormula]
    """提取的公式列表。"""

    inline_count: int = 0
    """行内公式数量。"""

    block_count: int = 0
    """独立公式数量。"""

    metadata: Dict[str, Any] = field(default_factory=dict)
    """提取元数据。"""


# ---------------------------------------------------------------------------
# Stage 3d: 图片提取 (Image Extraction)
# ---------------------------------------------------------------------------


@dataclass
class ExtractedImage:
    """提取的图片（V2 版本，面向 Pipeline）。"""

    image_id: str
    """图片唯一标识。"""

    filename: str
    """文件名（如 ``"img_p1_0.png"``）。"""

    local_path: Optional[str] = None
    """磁盘绝对路径。"""

    base64_data: Optional[str] = None
    """Base64 编码数据（嵌入模式）。"""

    mime_type: str = "image/png"
    """MIME 类型。"""

    width: Optional[int] = None
    """图片宽度（像素）。"""

    height: Optional[int] = None
    """图片高度（像素）。"""

    page_number: int = 0
    """所在页码（从 0 开始）。"""

    bbox: Optional[Tuple[float, float, float, float]] = None
    """边界框坐标。"""

    caption: Optional[str] = None
    """图片说明文字。"""

    classification: Optional[str] = None
    """图片分类（如 ``"chart"``、``"photo"``、``"diagram"``）。"""

    reading_order: int = 0
    """在文档中的阅读顺序索引。"""


@dataclass
class ImageExtractionInput:
    """图片提取 Stage 的复合输入。

    汇聚 ``preprocessing``（PDF 路径）与 ``layout_analysis``（figure 区域 bbox），
    使图片提取能同时处理光栅图和矢量图形（通过 bbox 渲染）。
    """

    preprocessing: "PreprocessingOutput"
    """PDF 路径和页码范围。"""

    layout: Optional["LayoutAnalysisOutput"] = None
    """版面分析结果（含 figure 区域 bbox）。

    为 ``None`` 时退化为纯 PyMuPDF 光栅图提取（兼容 layout_analysis 失败场景）。
    """


@dataclass
class ImageExtractionOutput:
    """图片提取 Stage 的输出。"""

    images: List[ExtractedImage]
    """提取的图片列表。"""

    total_count: int = 0
    """图片总数。"""

    metadata: Dict[str, Any] = field(default_factory=dict)
    """提取元数据。"""


# ---------------------------------------------------------------------------
# Stage 3e: 代码检测 (Code Detection)
# ---------------------------------------------------------------------------


@dataclass
class ExtractedCodeBlock:
    """提取的代码块。"""

    code_id: str
    """代码块唯一标识。"""

    code: str
    """代码内容。"""

    language: Optional[str] = None
    """编程语言（如 ``"python"``、``"java"``）。"""

    page_number: int = 0
    """所在页码（从 0 开始）。"""

    bbox: Optional[Tuple[float, float, float, float]] = None
    """边界框坐标。"""

    is_algorithm: bool = False
    """是否为算法/伪代码块。"""

    confidence: float = 1.0
    """检测置信度。"""

    reading_order: int = 0
    """在文档中的阅读顺序索引。"""


@dataclass
class CodeDetectionOutput:
    """代码检测 Stage 的输出。"""

    code_blocks: List[ExtractedCodeBlock]
    """检测到的代码块列表。"""

    total_count: int = 0
    """代码块总数。"""

    metadata: Dict[str, Any] = field(default_factory=dict)
    """检测元数据。"""


# ---------------------------------------------------------------------------
# Stage 4: 组装 (Assembly)
# ---------------------------------------------------------------------------


@dataclass
class AssemblyInput:
    """组装 Stage 的输入：汇聚所有并行 Stage 的输出。"""

    preprocessing: PreprocessingOutput
    """预处理结果。"""

    layout: Optional[LayoutAnalysisOutput] = None
    """版面分析结果。"""

    text: Optional[TextExtractionOutput] = None
    """文本提取结果。"""

    tables: Optional[TableExtractionOutput] = None
    """表格提取结果。"""

    formulas: Optional[FormulaExtractionOutput] = None
    """公式提取结果。"""

    images: Optional[ImageExtractionOutput] = None
    """图片提取结果。"""

    code: Optional[CodeDetectionOutput] = None
    """代码检测结果。"""


@dataclass
class AssemblyOutput:
    """组装 Stage 的输出：最终 Markdown 文档。"""

    markdown: str
    """组装后的完整 Markdown 内容。"""

    word_count: int = 0
    """总字数。"""

    metadata: Dict[str, Any] = field(default_factory=dict)
    """组装元数据（各 Stage 贡献统计等）。"""


# ---------------------------------------------------------------------------
# MCP 响应资产：图片落盘路径 + Resource URI 指针
# ---------------------------------------------------------------------------


@dataclass
class ImageAsset:
    """随 MCP 响应返回的图片资产指针。

    与 :class:`ExtractedImage` 的差别在于：``ExtractedImage`` 是 Stage 间流
    转的富数据对象（含分类、阅读顺序等），而 ``ImageAsset`` 是面向 MCP 客户
    端的轻量序列化视图，仅保留客户端定位/拉取图片所需字段。

    传输策略：图片原字节由 :func:`_build_image_assets` 落盘到 ``image_path``；
    Tool 层（``tools/pdf.py``）将其动态注册为 MCP Resource，``resource_uri``
    用于跨主机客户端经 ``resources/read`` 拉取。响应体不再携带 base64 字节。
    """

    filename: str
    """文件名（如 ``img_p1_0.png``）。"""

    mime_type: str = "image/png"
    """MIME 类型。"""

    image_path: str = ""
    """图片落盘后的绝对路径。"""

    resource_uri: Optional[str] = None
    """MCP Resource URI；由 tool 层动态注册后填回，未注册时为 None。"""

    width: Optional[int] = None
    """图片宽度（像素）。"""

    height: Optional[int] = None
    """图片高度（像素）。"""

    caption: Optional[str] = None
    """图片说明文字（若 Stage 上游提取到）。"""

    page_number: Optional[int] = None
    """所在页码（从 0 开始）。"""


# ---------------------------------------------------------------------------
# Pipeline 最终结果
# ---------------------------------------------------------------------------


@dataclass
class PipelineResult:
    """PDF Pipeline 的最终输出结果。"""

    success: bool
    """管线是否执行成功。"""

    markdown: str = ""
    """最终的 Markdown 内容。"""

    page_count: int = 0
    """文档总页数。"""

    word_count: int = 0
    """总字数。"""

    characteristics: Optional[DocumentCharacteristics] = None
    """文档特征分析结果。"""

    tables_count: int = 0
    """提取的表格数量。"""

    formulas_count: int = 0
    """提取的公式数量。"""

    images_count: int = 0
    """提取的图片数量。"""

    code_blocks_count: int = 0
    """检测到的代码块数量。"""

    engines_used: List[str] = field(default_factory=list)
    """各 Stage 使用的引擎列表。"""

    stage_results: Dict[str, Any] = field(default_factory=dict)
    """各 Stage 的详细执行结果（可选，用于调试）。"""

    total_elapsed_ms: float = 0.0
    """管线总耗时（毫秒）。"""

    error: Optional[str] = None
    """错误信息（仅当 ``success=False`` 时有值）。"""

    metadata: Dict[str, Any] = field(default_factory=dict)
    """额外元数据。"""

    image_assets: List[ImageAsset] = field(default_factory=list)
    """图片资产指针列表（落盘路径 + 可选 MCP Resource URI），随 MCP 响应透出。
    图片原字节由 ``_build_image_assets`` 落盘到 ``<output_dir>/images/``，
    ``ImageAsset.image_path`` 即落盘绝对路径；``resource_uri`` 由 tool 层
    动态注册 MCP Resource 后回填。"""
