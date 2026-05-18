"""Pipeline 框架：Stage 化的文档处理管线。

本包提供了一套通用的 Pipeline 框架，用于将文档处理流程
（PDF 解析、网页抽取等）拆解为可组合、可竞争的 Stage。

核心组件
--------

- :class:`Stage` / :class:`StageResult` / :class:`StageTool`:
  Stage 基类、执行结果包装与工具协议
- :class:`CompetitiveStage`:
  多工具并行竞争 Stage
- :func:`register_tool` / :func:`get_tool` / :func:`list_available_tools`:
  工具注册与发现
- :class:`StageScheduler`:
  Stage 调度器（降级 / 竞争模式）
- :class:`PipelineOrchestrator`:
  Pipeline 编排器（串联多个 Stage）

数据模型
--------

所有 Stage 间传递的数据定义在 :mod:`~.models` 子模块中。
"""

from .base import Stage, StageResult, StageTool
from .scheduler import CompetitiveStage
from .models import (
    # PDF Pipeline 模型
    AssemblyOutput,
    CodeDetectionOutput,
    DocumentCharacteristics,
    ExtractedCodeBlock,
    ExtractedFormula,
    ExtractedImage,
    ExtractedTable,
    FormulaExtractionOutput,
    ImageExtractionOutput,
    LayoutAnalysisOutput,
    LayoutRegion,
    PipelineResult,
    PreprocessingInput,
    PreprocessingOutput,
    TableExtractionOutput,
    TextBlock,
    TextExtractionOutput,
    # WebPage Pipeline 模型
    StageContext,
)
from .convenience import run_pdf_pipeline, run_webpage_pipeline
from .orchestrator import PipelineOrchestrator
from .registry import get_tool, list_available_tools, register_tool
from .scheduler import StageScheduler

__all__ = [
    # 核心基类与协议
    "Stage",
    "StageResult",
    "StageTool",
    # 竞争 Stage
    "CompetitiveStage",
    # 工具注册与发现
    "register_tool",
    "get_tool",
    "list_available_tools",
    # 调度与编排
    "StageScheduler",
    "PipelineOrchestrator",
    # PDF Pipeline 数据模型
    "PreprocessingInput",
    "PreprocessingOutput",
    "DocumentCharacteristics",
    "LayoutRegion",
    "LayoutAnalysisOutput",
    "TextBlock",
    "TextExtractionOutput",
    "ExtractedTable",
    "TableExtractionOutput",
    "ExtractedFormula",
    "FormulaExtractionOutput",
    "ExtractedImage",
    "ImageExtractionOutput",
    "ExtractedCodeBlock",
    "CodeDetectionOutput",
    "AssemblyOutput",
    "PipelineResult",
    # WebPage Pipeline 数据模型
    "StageContext",
    # 高级便捷 API
    "run_pdf_pipeline",
    "run_webpage_pipeline",
]
