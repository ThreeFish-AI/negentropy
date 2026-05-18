"""共享类型别名、输入校验与计时工具。

本模块提供跨层（ops / tools / sdk / cli / skills）共用的基础类型与工具函数，
避免上层模块反向依赖 MCP 工具层（tools/_support.py）。
"""

import time
from typing import Any, Dict, List, Literal, Optional

from ..infra.parsing import validate_url as validate_url  # noqa: F401 – re-exported


def elapsed_ms(start_time: float) -> int:
    """计算开始时间到当前的毫秒耗时。"""
    return int((time.time() - start_time) * 1000)


ScrapeMethod = Literal[
    "auto", "simple", "selenium", "stealth_selenium", "stealth_playwright"
]
PDFMethod = Literal["auto", "pymupdf", "pypdf", "docling", "smart", "mineru", "marker"]
PDFOutputFormat = Literal["markdown", "text"]


def validate_page_range(
    page_range: Optional[List[int]],
) -> tuple[Optional[tuple], Optional[str]]:
    """校验并转换 page_range。"""
    if not page_range:
        return None, None
    if len(page_range) != 2:
        return None, "Page range must contain exactly 2 elements: [start, end]"
    if page_range[0] < 0 or page_range[1] < 0:
        return None, "Page numbers must be non-negative"
    if page_range[0] >= page_range[1]:
        return None, "Start page must be less than end page"
    return tuple(page_range), None


def normalize_extract_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """规范化提取配置字典。"""
    if not isinstance(config, dict):
        raise ValueError("Extract config must be a dictionary")

    normalized: Dict[str, Any] = {}
    for key, value in config.items():
        if isinstance(value, str):
            normalized[key] = {"selector": value, "multiple": True}
            continue

        if not isinstance(value, dict):
            raise ValueError(f"Invalid config value for key '{key}'")
        if "selector" not in value:
            raise ValueError(f"Missing 'selector' for key '{key}'")

        normalized[key] = {
            "selector": value["selector"],
            "attr": value.get("attr", "text"),
            "multiple": value.get("multiple", False),
            "type": value.get("type", "css"),
        }

    return normalized
