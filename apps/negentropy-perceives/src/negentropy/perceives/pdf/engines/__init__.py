"""PDF 转换引擎子路径。

提供统一的引擎协议（``PDFEngine``）、通用数据结构（``EngineConversionResult``）
和结果构建辅助函数（``build_standard_result``），消除 ``processor.py`` 中
为每个引擎编写独立构建方法的重复代码。

引擎实现：
- ``docling``：Docling 引擎（MIT 许可证）
- ``mineru``：MinerU 引擎（LaTeX 公式提取最优）
- ``marker``：Marker 引擎（综合准确率最高，GPL-3.0）
- ``opendataloader``：OpenDataLoader 引擎（Apache-2.0 / CPU-only / 全元素 bbox）
"""

from __future__ import annotations

from ._base import (
    EngineCapabilities,
    EngineCodeBlock,
    EngineConversionResult,
    EngineFormula,
    EngineImage,
    EngineTable,
    PDFEngine,
    build_enhanced_assets,
    build_standard_result,
)
from .docling import (
    DoclingCodeBlock,
    DoclingConversionResult,
    DoclingEngine,
    DoclingFormula,
    DoclingImage,
    DoclingTable,
)
from .marker import (
    MarkerCodeBlock,
    MarkerConversionResult,
    MarkerEngine,
    MarkerFormula,
    MarkerImage,
    MarkerTable,
)
from .mineru import (
    MinerUConversionResult,
    MinerUEngine,
    MinerUFormula,
    MinerUImage,
    MinerUTable,
)
from .opendataloader import OpenDataLoaderEngine

__all__ = [
    # 协议与基类
    "PDFEngine",
    "EngineCapabilities",
    # 统一数据结构
    "EngineConversionResult",
    "EngineImage",
    "EngineTable",
    "EngineFormula",
    "EngineCodeBlock",
    # 辅助函数
    "build_enhanced_assets",
    "build_standard_result",
    # Docling 引擎
    "DoclingEngine",
    "DoclingConversionResult",
    "DoclingTable",
    "DoclingImage",
    "DoclingFormula",
    "DoclingCodeBlock",
    # MinerU 引擎
    "MinerUEngine",
    "MinerUConversionResult",
    "MinerUTable",
    "MinerUImage",
    "MinerUFormula",
    # Marker 引擎
    "MarkerEngine",
    "MarkerConversionResult",
    "MarkerTable",
    "MarkerImage",
    "MarkerFormula",
    "MarkerCodeBlock",
    # OpenDataLoader 引擎
    "OpenDataLoaderEngine",
]
