"""LLM 客户端向后兼容层。

原始实现已迁至 ``llm/client.py``，
本文件保留重导出以保持向后兼容。
"""

from __future__ import annotations

import warnings

warnings.warn(
    "Importing from 'pdf.llm_client' is deprecated, use 'pdf.llm.client' instead.",
    DeprecationWarning,
    stacklevel=2,
)

from .llm.client import LLMClient, LLMResponse

__all__ = [
    "LLMClient",
    "LLMResponse",
]
