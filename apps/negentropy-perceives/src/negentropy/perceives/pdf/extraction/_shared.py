"""提取模块共享工具函数。

提供 asset ID 生成、文件名 slug 化等跨提取器通用的辅助功能，
避免 image / table / formula 各模块重复实现。
"""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime


def generate_asset_id(asset_type: str, page_num: int, index: int) -> str:
    """生成唯一的资产 ID。

    Args:
        asset_type: 资产类型标识（如 ``"img"``, ``"table"``, ``"formula"``）。
        page_num: 页码（0-based）。
        index: 同类型资产在该页内的序号。

    Returns:
        格式为 ``"{type}_{page}_{index}_{timestamp}"`` 的唯一 ID。
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{asset_type}_{page_num}_{index}_{timestamp}"


def slugify(text: str, max_length: int = 60) -> str:
    """将文本转换为文件系统安全的 slug。

    保留字母数字、空格、连字符、下划线及 CJK 字符，
    将空白替换为连字符，截断至 ``max_length``。

    Args:
        text: 原始文本。
        max_length: 最大 slug 长度（默认 60）。

    Returns:
        小写 slug 字符串。
    """
    text = unicodedata.normalize("NFKD", text)
    cleaned = []
    for ch in text:
        if ch.isalnum() or ch in (" ", "-", "_"):
            cleaned.append(ch)
        elif unicodedata.category(ch).startswith("Lo"):
            cleaned.append(ch)
    slug = "".join(cleaned).strip()
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug)
    if len(slug) > max_length:
        slug = slug[:max_length].rstrip("-")
    return slug.lower() if slug else ""
