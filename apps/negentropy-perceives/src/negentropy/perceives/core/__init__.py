"""共享基础层。

提供跨层（ops / tools / sdk / cli / skills）共用的类型、服务单例和工具函数，
作为唯一的共享依赖基座，避免各层之间的直接耦合。
"""

from .types import (  # noqa: F401
    PDFMethod,
    PDFOutputFormat,
    ScrapeMethod,
    elapsed_ms,
    normalize_extract_config,
    validate_page_range,
    validate_url,
)
from .services import (  # noqa: F401
    create_pdf_processor,
    markdown_converter,
    web_scraper,
)
from .pipeline_support import attempt_pipeline  # noqa: F401

# pipeline_config 和 logging 不在此处重导出，
# 以避免 config → core.pipeline_config → core.services → config 的循环引用。
# 消费方请直接导入：from negentropy.perceives.core.pipeline_config import ...

__all__ = [
    # 类型别名
    "ScrapeMethod",
    "PDFMethod",
    "PDFOutputFormat",
    # 共享服务实例
    "web_scraper",
    "markdown_converter",
    # 工厂函数
    "create_pdf_processor",
    # 辅助函数
    "validate_url",
    "validate_page_range",
    "normalize_extract_config",
    "elapsed_ms",
    # Pipeline 工具
    "attempt_pipeline",
]
