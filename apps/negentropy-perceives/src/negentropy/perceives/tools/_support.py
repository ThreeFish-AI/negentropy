"""工具层共享类型别名、输入校验与计时工具。

本模块已迁移至 ``core/`` 子包，此处保留 re-export 以保持向后兼容。
"""

from ..core.pipeline_support import try_pipeline  # noqa: F401
from ..core.types import (  # noqa: F401
    PDFMethod,
    PDFOutputFormat,
    ScrapeMethod,
    elapsed_ms,
    normalize_extract_config,
    validate_page_range,
    validate_url,
)

__all__ = [
    "ScrapeMethod",
    "PDFMethod",
    "PDFOutputFormat",
    "validate_url",
    "validate_page_range",
    "normalize_extract_config",
    "elapsed_ms",
    "try_pipeline",
]
