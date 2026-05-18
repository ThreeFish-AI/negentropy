"""PDF Pipeline 各 Stage 的具体实现。

本子包包含 PDF 处理管线中 10 个 Stage 的完整实现（S0-S9）：

- S0: 预处理与源解析（PyMuPDF / pypdf）
- S1: 文档特征快速扫描（PyMuPDF 字体分析）
- S2: 版面分析与阅读顺序（Docling / MinerU / Marker / PyMuPDF）
- S3: 文本内容提取（PyMuPDF / Docling / pypdf）
- S4: 表格识别与提取（Docling / Camelot / pdfplumber / PyMuPDF）
- S5: 数学公式提取（MinerU / Docling / PyMuPDF 启发式）
- S6: 图片提取（PyMuPDF）
- S7: 代码块与算法检测（Docling / Marker / 算法检测器）
- S8: Markdown 组装（内置组装器 + 格式化管线）
- S9: 资源打包（内置打包器）
"""

from .assembly import AssemblyStage
from .asset_bundling import AssetBundlingStage
from .code_detection import CodeDetectionStage
from .formula_extraction import FormulaExtractionStage
from .image_extraction import ImageExtractionStage
from .layout_analysis import LayoutAnalysisStage
from .preprocessing import PreprocessingStage
from .quick_scan import QuickScanStage
from .table_extraction import TableExtractionStage
from .text_extraction import TextExtractionStage

__all__ = [
    "PreprocessingStage",
    "QuickScanStage",
    "LayoutAnalysisStage",
    "TextExtractionStage",
    "TableExtractionStage",
    "FormulaExtractionStage",
    "ImageExtractionStage",
    "CodeDetectionStage",
    "AssemblyStage",
    "AssetBundlingStage",
]
