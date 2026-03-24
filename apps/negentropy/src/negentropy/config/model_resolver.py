"""
Model Resolver — DB 优先、.env 回退的模型配置解析器。

遵循 Single Source of Truth 原则：
1. 首先从 DB 查询 default 配置
2. 若 DB 无数据或不可达，回退到 settings.llm
3. 内存缓存 + TTL 避免每次请求查 DB

公开接口:
- resolve_llm_config()        — 异步解析默认 LLM
- resolve_embedding_config()  — 异步解析默认 Embedding
- get_cached_llm_config()     — 同步缓存读取 (无法 await 的上下文)
- invalidate_cache()          — 缓存失效 (Admin 写操作后调用)
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional, Tuple

# Cache TTL in seconds
_CACHE_TTL = 60.0

# In-memory cache: { model_type: (full_model_name, kwargs, timestamp) }
_cache: Dict[str, Tuple[str, Dict[str, Any], float]] = {}


def invalidate_cache(model_type: Optional[str] = None) -> None:
    """使缓存失效。Admin 写操作后调用。

    Args:
        model_type: 指定类型失效; None 表示全部失效。
    """
    if model_type:
        _cache.pop(model_type, None)
    else:
        _cache.clear()


def get_cached_llm_config() -> Optional[Tuple[str, Dict[str, Any]]]:
    """同步缓存读取 — 用于 create_model() 等无法 await 的上下文。

    返回 kwargs 的浅拷贝，防止调用方原地修改污染缓存。

    Returns:
        (full_model_name, litellm_kwargs) 或 None (缓存未命中/过期)。
    """
    entry = _cache.get("llm")
    if entry is not None:
        name, kwargs, ts = entry
        if time.monotonic() - ts < _CACHE_TTL:
            return name, kwargs.copy()
    return None


def get_cached_embedding_config() -> Optional[Tuple[str, Dict[str, Any]]]:
    """同步缓存读取 — Embedding 模型。返回 kwargs 浅拷贝。"""
    entry = _cache.get("embedding")
    if entry is not None:
        name, kwargs, ts = entry
        if time.monotonic() - ts < _CACHE_TTL:
            return name, kwargs.copy()
    return None


async def resolve_llm_config() -> Tuple[str, Dict[str, Any]]:
    """异步解析默认 LLM 模型配置。

    Returns:
        (full_model_name, litellm_kwargs)
    """
    return await _resolve("llm")


async def resolve_embedding_config() -> Tuple[str, Dict[str, Any]]:
    """异步解析默认 Embedding 模型配置。

    Returns:
        (full_model_name, embedding_kwargs)
    """
    return await _resolve("embedding")


async def _resolve(model_type: str) -> Tuple[str, Dict[str, Any]]:
    """核心解析: DB → 缓存 → .env 回退。"""
    now = time.monotonic()

    # 1. 检查缓存
    entry = _cache.get(model_type)
    if entry is not None:
        name, kwargs, ts = entry
        if now - ts < _CACHE_TTL:
            return name, kwargs.copy()

    # 2. 尝试 DB
    try:
        result = await _resolve_from_db(model_type)
        if result is not None:
            name, kwargs = result
            _cache[model_type] = (name, kwargs, now)
            return name, kwargs.copy()
    except Exception:
        # Lazy import to avoid circular dependency at module level
        from negentropy.logging import get_logger

        logger = get_logger("negentropy.config.model_resolver")
        logger.warning("model_resolver_db_fallback", model_type=model_type, exc_info=True)

    # 3. 回退到 settings.llm
    name, kwargs = _resolve_from_settings(model_type)
    _cache[model_type] = (name, kwargs, now)
    return name, kwargs.copy()


async def _resolve_from_db(model_type: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """从 DB 查询默认模型配置。"""
    from sqlalchemy import select

    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.model_config import ModelConfig, ModelType

    mt = ModelType(model_type)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ModelConfig).where(
                ModelConfig.model_type == mt,
                ModelConfig.is_default.is_(True),
                ModelConfig.enabled.is_(True),
            )
        )
        config = result.scalar_one_or_none()

    if config is None:
        return None

    full_name = _build_full_model_name(config.vendor, config.model_name)
    cfg = config.config or {}

    if model_type == "embedding":
        kwargs = _build_embedding_kwargs(cfg)
    else:
        kwargs = _build_llm_kwargs(config.vendor, config.model_name, cfg)

    return full_name, kwargs


def _resolve_from_settings(model_type: str) -> Tuple[str, Dict[str, Any]]:
    """从 settings.llm 回退解析。"""
    from negentropy.config import settings

    if model_type == "embedding":
        return (
            settings.llm.embedding_full_model_name,
            settings.llm.to_litellm_embedding_kwargs(),
        )
    # llm / rerank 均回退到 LLM settings
    return (
        settings.llm.full_model_name,
        settings.llm.to_litellm_kwargs(),
    )


def _build_full_model_name(vendor: str, model_name: str) -> str:
    """构建 LiteLLM 兼容的 vendor/model_name 字符串。"""
    from negentropy.model_names import canonicalize_model_name

    raw = f"{vendor}/{model_name}" if "/" not in model_name else model_name
    return canonicalize_model_name(raw) or raw


def _build_llm_kwargs(vendor: str, model_name: str, config: Dict[str, Any]) -> Dict[str, Any]:
    """从 DB config JSONB 构建 LiteLLM kwargs。

    复用 LlmSettings._apply_thinking_config 的供应商特定转译逻辑。
    """
    kwargs: Dict[str, Any] = {}

    if "temperature" in config:
        kwargs["temperature"] = config["temperature"]
    if "max_tokens" in config:
        kwargs["max_tokens"] = config["max_tokens"]
    if "top_p" in config:
        kwargs["top_p"] = config["top_p"]

    # 供应商特定的 thinking/reasoning 适配
    model_lower = model_name.lower()

    if vendor == "zai" or "glm" in model_lower:
        kwargs["drop_params"] = config.get("drop_params", True)
        thinking_mode = config.get("thinking_mode", False)
        if thinking_mode:
            thinking_config: Dict[str, Any] = {
                "type": "enabled",
                "budget_tokens": config.get("thinking_budget", 2048),
            }
            if config.get("preserve_thinking", False):
                thinking_config["clear_thinking"] = False
        else:
            thinking_config = {"type": "disabled"}
        kwargs["extra_body"] = {"thinking": thinking_config}

    elif vendor == "anthropic" or "claude" in model_lower:
        thinking_mode = config.get("thinking_mode", False)
        if thinking_mode:
            kwargs["thinking"] = {
                "type": "enabled",
                "budget_tokens": config.get("thinking_budget", 2048),
            }
        else:
            kwargs["thinking"] = {"type": "disabled"}

    elif vendor == "openai" and model_lower.startswith(("o1", "o3")):
        thinking_mode = config.get("thinking_mode", False)
        if thinking_mode:
            kwargs["reasoning_effort"] = config.get("reasoning_effort", "medium")

    if "drop_params" in config and "drop_params" not in kwargs:
        kwargs["drop_params"] = config["drop_params"]

    return kwargs


def _build_embedding_kwargs(config: Dict[str, Any]) -> Dict[str, Any]:
    """从 DB config JSONB 构建 Embedding kwargs。"""
    kwargs: Dict[str, Any] = {}
    if "dimensions" in config and config["dimensions"] is not None:
        kwargs["dimensions"] = config["dimensions"]
    if "input_type" in config and config["input_type"]:
        kwargs["input_type"] = config["input_type"]
    return kwargs
