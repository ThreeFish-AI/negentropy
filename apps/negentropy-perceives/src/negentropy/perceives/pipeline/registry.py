"""Pipeline 工具注册与发现机制。

提供基于装饰器的全局工具注册表，支持按名称注册、获取和列举工具。

Usage::

    @register_tool("pymupdf")
    class PyMuPDFTextExtractor:
        ...

    tool = get_tool("pymupdf")
"""

from __future__ import annotations

import logging
from typing import Callable, Dict, Type

from .base import StageTool

logger = logging.getLogger(__name__)

# 全局工具注册表：{tool_name: tool_class}
_TOOL_REGISTRY: Dict[str, Type[StageTool]] = {}


def register_tool(name: str) -> Callable:
    """装饰器：将工具类注册到全局注册表。

    Usage::

        @register_tool("pymupdf")
        class PyMuPDFTextExtractor:
            ...
    """

    def decorator(cls: Type[StageTool]) -> Type[StageTool]:
        if name in _TOOL_REGISTRY:
            logger.warning(
                "工具 '%s' 已注册，将被覆盖: %s -> %s",
                name,
                _TOOL_REGISTRY[name],
                cls,
            )
        _TOOL_REGISTRY[name] = cls
        return cls

    return decorator


def get_tool(name: str) -> StageTool:
    """根据名称从注册表中获取并实例化工具。

    Args:
        name: 工具注册名称

    Returns:
        工具实例

    Raises:
        ValueError: 工具未注册
    """
    if name not in _TOOL_REGISTRY:
        raise ValueError(
            f"未知工具: '{name}'. 可用工具: {sorted(_TOOL_REGISTRY.keys())}"
        )
    return _TOOL_REGISTRY[name]()


def list_available_tools() -> Dict[str, bool]:
    """列出所有已注册工具及其可用性。

    Returns:
        ``{tool_name: is_available}`` 字典
    """
    result = {}
    for name, cls in sorted(_TOOL_REGISTRY.items()):
        try:
            instance = cls()
            result[name] = instance.is_available()
        except Exception:
            result[name] = False
    return result
