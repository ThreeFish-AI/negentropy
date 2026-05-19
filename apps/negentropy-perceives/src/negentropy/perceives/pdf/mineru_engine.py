"""MinerU 引擎向后兼容层。

原始实现已迁至 ``engines/mineru.py``，
本文件保留重导出以保持向后兼容。
"""

from __future__ import annotations

import warnings

warnings.warn(
    "Importing from 'pdf.mineru_engine' is deprecated, "
    "use 'pdf.engines.mineru' instead.",
    DeprecationWarning,
    stacklevel=2,
)

from .engines.mineru import (
    MinerUConversionResult,
    MinerUEngine,
    MinerUFormula,
    MinerUImage,
    MinerUTable,
)

__all__ = [
    "MinerUEngine",
    "MinerUConversionResult",
    "MinerUTable",
    "MinerUImage",
    "MinerUFormula",
]
