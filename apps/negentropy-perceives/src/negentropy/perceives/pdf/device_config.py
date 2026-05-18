"""设备感知的 Docling 配置策略模块 — 向后兼容层。

原始实现已迁至 ``hardware/device_config.py``，
本文件保留重导出以保持向后兼容。
"""

from __future__ import annotations

import warnings

warnings.warn(
    "Importing from 'pdf.device_config' is deprecated, "
    "use 'pdf.hardware.device_config' instead.",
    DeprecationWarning,
    stacklevel=2,
)

from .hardware.device_config import (  # noqa: F401
    DoclingDeviceConfig,
    resolve_device_config,
)

__all__ = [
    "DoclingDeviceConfig",
    "resolve_device_config",
]
