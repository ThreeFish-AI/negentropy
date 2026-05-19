"""Marker 引擎向后兼容层。

原始实现已迁至 ``engines/marker.py``，
本文件保留重导出以保持向后兼容。
"""

from __future__ import annotations

import warnings

warnings.warn(
    "Importing from 'pdf.marker_engine' is deprecated, "
    "use 'pdf.engines.marker' instead.",
    DeprecationWarning,
    stacklevel=2,
)

from .engines.marker import (
    MarkerCodeBlock,
    MarkerConversionResult,
    MarkerEngine,
    MarkerFormula,
    MarkerImage,
    MarkerTable,
)

__all__ = [
    "MarkerEngine",
    "MarkerConversionResult",
    "MarkerTable",
    "MarkerImage",
    "MarkerFormula",
    "MarkerCodeBlock",
]
