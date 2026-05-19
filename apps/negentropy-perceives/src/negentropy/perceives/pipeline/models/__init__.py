"""Pipeline Stage 间传递的数据模型。

本模块定义了 PDF Pipeline 和 WebPage Pipeline 所有 Stage 之间
传递的输入/输出数据类。所有模型使用 ``@dataclass`` 而非 Pydantic，
因为这些是内部数据传递对象，不需要序列化验证。

数据流向
--------

**PDF Pipeline** (详见 `_pdf`)::

    PreprocessingInput
      -> PreprocessingOutput (含 DocumentCharacteristics)
      -> LayoutAnalysisOutput (含 LayoutRegion 列表)
      -> TextExtractionOutput / TableExtractionOutput / FormulaExtractionOutput
         / ImageExtractionOutput / CodeDetectionOutput  (并行)
      -> AssemblyOutput
      -> PipelineResult

**WebPage Pipeline** (详见 `_webpage`)::

    StageContext (贯穿所有 Stage 的上下文对象)

子模块
------

- :mod:`_pdf`: PDF Pipeline 数据模型
- :mod:`_webpage`: WebPage Pipeline 数据模型
"""

from __future__ import annotations

# PDF Pipeline 数据模型
from ._pdf import (
    AssemblyInput,
    AssemblyOutput,
    CodeDetectionOutput,
    DocumentCharacteristics,
    ExtractedCodeBlock,
    ExtractedFormula,
    ExtractedImage,
    ExtractedTable,
    FormulaExtractionOutput,
    ImageAsset,
    ImageExtractionInput,
    ImageExtractionOutput,
    LayoutAnalysisOutput,
    LayoutRegion,
    PipelineResult,
    PreprocessingInput,
    PreprocessingOutput,
    TableExtractionOutput,
    TextBlock,
    TextExtractionOutput,
)

# WebPage Pipeline 数据模型
from ._webpage import (
    CodeBlock,
    ImageInfo,
    MathFormula,
    StageContext,
    TableData,
)

__all__ = [
    # PDF Pipeline
    "AssemblyInput",
    "AssemblyOutput",
    "CodeDetectionOutput",
    "DocumentCharacteristics",
    "ExtractedCodeBlock",
    "ExtractedFormula",
    "ExtractedImage",
    "ExtractedTable",
    "FormulaExtractionOutput",
    "ImageAsset",
    "ImageExtractionInput",
    "ImageExtractionOutput",
    "LayoutAnalysisOutput",
    "LayoutRegion",
    "PipelineResult",
    "PreprocessingInput",
    "PreprocessingOutput",
    "TableExtractionOutput",
    "TextBlock",
    "TextExtractionOutput",
    # WebPage Pipeline
    "CodeBlock",
    "ImageInfo",
    "MathFormula",
    "StageContext",
    "TableData",
]
