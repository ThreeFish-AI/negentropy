"""LLM 客户端与编排子路径。

提供 LLM 集成能力：
- ``client``：LLM 客户端封装（基于 LiteLLM）
- ``orchestrator``：多引擎 PDF 转换编排器
"""

from __future__ import annotations

from .client import LLMClient, LLMResponse
from .orchestrator import (
    EngineResult,
    EngineTask,
    LLMOrchestrator,
    OrchestrationPlan,
    OrchestrationResult,
    PDFCharacteristics,
)

__all__ = [
    "LLMClient",
    "LLMResponse",
    "LLMOrchestrator",
    "OrchestrationResult",
    "OrchestrationPlan",
    "PDFCharacteristics",
    "EngineTask",
    "EngineResult",
]
