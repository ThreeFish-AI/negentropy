"""硬件检测与设备配置子路径。"""

from __future__ import annotations

from .detection import (
    DeviceType,
    HardwareInfo,
    detect_device,
    get_cached_hardware_info,
    get_device_for_docling,
    get_hardware_info,
)
from .device_config import (  # noqa: F401
    DoclingDeviceConfig,
    resolve_device_config,
)

__all__ = [
    "DeviceType",
    "HardwareInfo",
    "detect_device",
    "get_cached_hardware_info",
    "get_device_for_docling",
    "get_hardware_info",
    "DoclingDeviceConfig",
    "resolve_device_config",
]
