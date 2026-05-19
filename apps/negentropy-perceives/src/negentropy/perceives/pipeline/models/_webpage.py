"""WebPage Pipeline 数据模型。

本模块定义了 WebPage Pipeline 所有 Stage 之间传递的数据类。

数据流向
--------

::

    StageContext (贯穿所有 Stage 的上下文对象)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class MathFormula:
    """网页中提取的数学公式。"""

    latex: str
    """LaTeX 表示。"""

    formula_type: str = "inline"
    """公式类型：``"inline"`` | ``"block"``。"""

    original_html: str = ""
    """原始 HTML 片段。"""

    source_format: str = ""
    """来源格式（如 ``"mathjax"``、``"katex"``、``"latex"``）。"""


@dataclass
class CodeBlock:
    """网页中提取的代码块。"""

    code: str
    """代码内容。"""

    language: Optional[str] = None
    """编程语言。"""

    original_html: str = ""
    """原始 HTML 片段。"""


@dataclass
class TableData:
    """网页中提取的表格数据。"""

    markdown: str
    """表格的 Markdown 表示。"""

    rows: int = 0
    """行数。"""

    columns: int = 0
    """列数。"""

    headers: Optional[List[str]] = None
    """表头列名。"""

    caption: Optional[str] = None
    """表格标题。"""

    original_html: str = ""
    """原始 HTML 片段。"""


@dataclass
class ImageInfo:
    """网页中提取的图片信息。"""

    src: str
    """图片 URL 或 data URI。"""

    alt: str = ""
    """替代文本。"""

    title: str = ""
    """图片标题。"""

    width: Optional[int] = None
    """宽度（像素）。"""

    height: Optional[int] = None
    """高度（像素）。"""

    base64_data: Optional[str] = None
    """Base64 编码数据（嵌入模式）。"""

    mime_type: Optional[str] = None
    """MIME 类型。"""


@dataclass
class StageContext:
    """WebPage Pipeline 贯穿所有 Stage 的上下文对象。

    在 WebPage Pipeline 中，各 Stage 通过共享同一个 ``StageContext``
    实例来传递和累积数据，而非像 PDF Pipeline 那样使用独立的
    Input/Output 对象。
    """

    url: str
    """目标网页 URL。"""

    raw_html: str = ""
    """原始 HTML 内容。"""

    cleaned_html: str = ""
    """清理后的 HTML 内容（去广告、去导航等）。"""

    title: str = ""
    """页面标题。"""

    markdown: str = ""
    """转换后的 Markdown 内容。"""

    formulas: List[MathFormula] = field(default_factory=list)
    """提取的数学公式列表。"""

    code_blocks: List[CodeBlock] = field(default_factory=list)
    """提取的代码块列表。"""

    tables: List[TableData] = field(default_factory=list)
    """提取的表格列表。"""

    images: List[ImageInfo] = field(default_factory=list)
    """提取的图片列表。"""

    metadata: Dict[str, Any] = field(default_factory=dict)
    """页面元数据（description、keywords 等）。"""

    config: Dict[str, Any] = field(default_factory=dict)
    """Pipeline 配置参数。"""

    errors: List[str] = field(default_factory=list)
    """各 Stage 遇到的非致命错误收集。"""
