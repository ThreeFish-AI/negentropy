"""响应数据模型 — 向后兼容层。

原始实现已重命名为 ``models.py``，
本文件保留重导出以保持向后兼容。
"""

import warnings

warnings.warn(
    "Importing from 'schemas' is deprecated, use 'models' instead.",
    DeprecationWarning,
    stacklevel=2,
)

from .models import *  # noqa: F401, F403
