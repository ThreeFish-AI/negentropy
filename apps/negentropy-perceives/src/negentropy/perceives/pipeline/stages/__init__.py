"""Pipeline Stage 具体实现子包。

按文档类型组织：
- ``pdf``: PDF 处理管线各 Stage
- ``webpage``: 网页处理管线各 Stage
"""

from . import pdf, webpage

__all__ = ["pdf", "webpage"]
