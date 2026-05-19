"""LLM 编排器向后兼容层。

原始实现已迁至 ``llm/orchestrator.py``，
本文件保留重导出以保持向后兼容。
"""

from __future__ import annotations

import warnings

warnings.warn(
    "Importing from 'pdf.llm_orchestrator' is deprecated, "
    "use 'pdf.llm.orchestrator' instead.",
    DeprecationWarning,
    stacklevel=2,
)

from .llm.orchestrator import (
    EngineResult,
    EngineTask,
    LLMOrchestrator,
    OrchestrationPlan,
    OrchestrationResult,
    PDFCharacteristics,
    _DEFAULT_PLAN,  # noqa: F401
    _extract_quality_signals,  # noqa: F401
)

__all__ = [
    "LLMOrchestrator",
    "OrchestrationResult",
    "OrchestrationPlan",
    "PDFCharacteristics",
    "EngineTask",
    "EngineResult",
]
