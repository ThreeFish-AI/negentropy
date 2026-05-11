"""工具配置解析器。

从 builtin_tools 表读取工具配置，提供带缓存的解析能力。
当 DB 中无对应工具时，返回 None（调用方回退到环境变量/YAML 配置）。
"""

import time
from typing import Any

from sqlalchemy import select

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.builtin_tool import BuiltinTool

logger = get_logger("negentropy.interface.tool_resolver")

# 简易内存缓存：{tool_name: (config_dict, expire_timestamp)}
_cache: dict[str, tuple[dict[str, Any], float]] = {}
_CACHE_TTL_SECONDS = 60.0


async def resolve_tool_config(tool_name: str) -> dict[str, Any] | None:
    """从 builtin_tools 表读取工具配置。

    返回合并后的 config + credentials 字典；不存在或已禁用时返回 None。
    带 60s TTL 内存缓存，避免每次工具调用都查 DB。

    Args:
        tool_name: 工具名称，如 "google_search"

    Returns:
        合并后的配置字典（含 config 和 credentials 中的所有字段），或 None
    """
    # 检查缓存
    now = time.monotonic()
    cached = _cache.get(tool_name)
    if cached:
        config, expire_at = cached
        if now < expire_at:
            return config

    # 查询 DB
    try:
        async with AsyncSessionLocal() as db:
            stmt = select(BuiltinTool).where(
                BuiltinTool.name == tool_name,
                BuiltinTool.is_enabled.is_(True),
            )
            result = await db.execute(stmt)
            tool = result.scalar_one_or_none()

        if tool is None:
            return None

        # 合并 config 和 credentials
        merged: dict[str, Any] = {}
        merged.update(tool.config or {})
        merged["credentials"] = tool.credentials or {}

        # 更新缓存
        _cache[tool_name] = (merged, now + _CACHE_TTL_SECONDS)
        return merged

    except Exception as exc:
        logger.warning("tool_resolver_db_error", tool_name=tool_name, error=str(exc))
        return None


def invalidate_tool_cache(tool_name: str | None = None) -> None:
    """清除工具配置缓存。

    Args:
        tool_name: 清除特定工具缓存；None 则清除全部
    """
    if tool_name:
        _cache.pop(tool_name, None)
    else:
        _cache.clear()
