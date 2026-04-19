"""
Model Resolver — 默认模型 + vendor_configs 凭证的模型配置解析器。

遵循 Single Source of Truth 原则：
1. 默认模型名由环境变量或硬编码 fallback 决定
2. 从模型名解析 vendor，再从 vendor_configs 表读取 api_key/api_base
3. 内存缓存 + TTL 避免每次请求查 DB

公开接口:
- resolve_llm_config()            — 异步解析默认 LLM
- resolve_embedding_config()      — 异步解析默认 Embedding
- get_cached_llm_config()         — 同步缓存读取 (无法 await 的上下文)
- get_fallback_llm_config()       — 同步获取硬编码 LLM 默认值
- get_fallback_embedding_config() — 同步获取硬编码 Embedding 默认值
- invalidate_cache()              — 缓存失效 (Admin 写操作后调用)
"""

from __future__ import annotations

import os
import time
from typing import Any

# Cache TTL in seconds
_CACHE_TTL = 60.0

# 硬编码默认值 — DB 不可达时的回退配置
_DEFAULT_LLM_MODEL = "openai/gpt-5-mini"
_DEFAULT_LLM_KWARGS: dict[str, Any] = {
    "temperature": 0.7,
    "drop_params": True,
}
# gemini/text-embedding-004 与 vertex_ai/text-embedding-005 同为 768 维，
# 切换不破坏既有 HNSW 向量索引；如需恢复 vertex 模型可通过环境变量覆盖。
_DEFAULT_EMBEDDING_MODEL = os.getenv("NEGENTROPY_DEFAULT_EMBEDDING_MODEL", "gemini/text-embedding-004")
_DEFAULT_EMBEDDING_KWARGS: dict[str, Any] = {}

# In-memory cache: { model_type: (full_model_name, kwargs, timestamp) }
_cache: dict[str, tuple[str, dict[str, Any], float]] = {}


def invalidate_cache(model_type: str | None = None) -> None:
    """使缓存失效。Admin 写操作后调用。

    Args:
        model_type: 指定类型失效; None 表示全部失效。
    """
    if model_type:
        _cache.pop(model_type, None)
    else:
        _cache.clear()


def get_cached_llm_config() -> tuple[str, dict[str, Any]] | None:
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


def get_cached_embedding_config() -> tuple[str, dict[str, Any]] | None:
    """同步缓存读取 — Embedding 模型。返回 kwargs 浅拷贝。"""
    entry = _cache.get("embedding")
    if entry is not None:
        name, kwargs, ts = entry
        if time.monotonic() - ts < _CACHE_TTL:
            return name, kwargs.copy()
    return None


def get_fallback_llm_config() -> tuple[str, dict[str, Any]]:
    """同步获取硬编码 LLM 默认值 — 供消费者在无法 await 的上下文中使用。"""
    return _DEFAULT_LLM_MODEL, _DEFAULT_LLM_KWARGS.copy()


def get_fallback_embedding_config() -> tuple[str, dict[str, Any]]:
    """同步获取硬编码 Embedding 默认值。"""
    return _DEFAULT_EMBEDDING_MODEL, _DEFAULT_EMBEDDING_KWARGS.copy()


async def resolve_llm_config() -> tuple[str, dict[str, Any]]:
    """异步解析默认 LLM 模型配置。

    Returns:
        (full_model_name, litellm_kwargs)
    """
    return await _resolve("llm")


async def resolve_embedding_config() -> tuple[str, dict[str, Any]]:
    """异步解析默认 Embedding 模型配置。

    Returns:
        (full_model_name, embedding_kwargs)
    """
    return await _resolve("embedding")


async def _resolve(model_type: str) -> tuple[str, dict[str, Any]]:
    """核心解析: 缓存 → vendor_configs + 默认模型名 → 硬编码回退。"""
    now = time.monotonic()

    # 1. 检查缓存
    entry = _cache.get(model_type)
    if entry is not None:
        name, kwargs, ts = entry
        if now - ts < _CACHE_TTL:
            return name, kwargs.copy()

    # 2. 尝试 vendor_configs + 默认模型名
    try:
        result = await _resolve_from_vendor_configs(model_type)
        if result is not None:
            name, kwargs = result
            _cache[model_type] = (name, kwargs, now)
            return name, kwargs.copy()
    except Exception:
        # Lazy import to avoid circular dependency at module level
        from negentropy.logging import get_logger

        logger = get_logger("negentropy.config.model_resolver")
        logger.warning("model_resolver_db_fallback", model_type=model_type, exc_info=True)

    # 3. 回退到硬编码默认值
    name, kwargs = _resolve_defaults(model_type)
    _cache[model_type] = (name, kwargs, now)
    return name, kwargs.copy()


async def _resolve_from_vendor_configs(model_type: str) -> tuple[str, dict[str, Any]] | None:
    """根据默认模型名 + vendor_configs 凭证组合解析。

    - 默认模型名由环境变量或硬编码 fallback 决定
    - 从模型名解析 vendor (如 'gemini/text-embedding-004' → 'gemini')
    - 从 vendor_configs 表读取该 vendor 的 api_key/api_base
    """
    if model_type == "embedding":
        full_name = _DEFAULT_EMBEDDING_MODEL
    elif model_type == "llm":
        full_name = _DEFAULT_LLM_MODEL
    else:
        return None

    vendor, model_name = _split_vendor_and_model(full_name)
    vendor_config = await _get_vendor_config(vendor) if vendor else None

    if model_type == "embedding":
        kwargs = _build_embedding_kwargs({}, vendor_config)
    else:
        # LLM 默认 kwargs 由 _DEFAULT_LLM_KWARGS 提供 (temperature/drop_params/thinking)
        # vendor 特定逻辑通过 _build_llm_kwargs 适配；此处合并以保留默认行为
        kwargs = _build_llm_kwargs(vendor or "", model_name, {}, vendor_config)
        for k, v in _DEFAULT_LLM_KWARGS.items():
            kwargs.setdefault(k, v.copy() if isinstance(v, dict) else v)

    return full_name, kwargs


def _split_vendor_and_model(full_name: str) -> tuple[str | None, str]:
    """从 'vendor/model' 形式解析 (vendor, model_name)。"""
    if "/" in full_name:
        vendor, model_name = full_name.split("/", 1)
        return vendor, model_name
    return None, full_name


def _resolve_defaults(model_type: str) -> tuple[str, dict[str, Any]]:
    """返回硬编码默认值 — DB 不可达时的回退。"""
    if model_type == "embedding":
        return get_fallback_embedding_config()
    return get_fallback_llm_config()


def build_full_model_name(vendor: str, model_name: str) -> str:
    """构建 LiteLLM 兼容的 vendor/model_name 字符串。"""
    from negentropy.model_names import canonicalize_model_name

    raw = f"{vendor}/{model_name}" if "/" not in model_name else model_name
    return canonicalize_model_name(raw) or raw


async def _get_vendor_config(vendor: str) -> dict[str, str] | None:
    """从 DB 查询供应商级凭证（api_key + api_base）。查询失败时静默返回 None。"""
    try:
        from sqlalchemy import select

        from negentropy.db.session import AsyncSessionLocal
        from negentropy.models.vendor_config import VendorConfig

        async with AsyncSessionLocal() as session:
            result = await session.execute(select(VendorConfig).where(VendorConfig.vendor == vendor))
            vc = result.scalar_one_or_none()

        if vc is None:
            return None
        return {"api_key": vc.api_key, "api_base": vc.api_base}
    except Exception:
        # vendor_configs 表可能尚未迁移，或 DB 不可达 — 静默回退
        return None


def _build_llm_kwargs(
    vendor: str, model_name: str, config: dict[str, Any], vendor_config: dict[str, str] | None = None
) -> dict[str, Any]:
    """从 DB config JSONB 构建 LiteLLM kwargs。

    供应商特定的 LiteLLM kwargs 构建逻辑。
    凭证解析链: model config > vendor config > LiteLLM 环境变量回退。
    """
    kwargs: dict[str, Any] = {}

    if "temperature" in config:
        kwargs["temperature"] = config["temperature"]
    if "max_tokens" in config:
        kwargs["max_tokens"] = config["max_tokens"]
    if "top_p" in config:
        kwargs["top_p"] = config["top_p"]

    # 供应商特定的 thinking/reasoning 适配
    model_lower = model_name.lower()

    if vendor == "anthropic" or "claude" in model_lower:
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

    # 透传 API 凭证: model config > vendor config > LiteLLM 环境变量回退
    effective_api_key = config.get("api_key") or (vendor_config or {}).get("api_key")
    effective_api_base = config.get("api_base") or (vendor_config or {}).get("api_base")
    if effective_api_key:
        kwargs["api_key"] = effective_api_key
    if effective_api_base:
        kwargs["api_base"] = effective_api_base

    return kwargs


# 规则依据各 vendor 的 api_base 约定（LiteLLM 会在 base 之后自动拼接端点）：
#   - OpenAI 兼容：api_base 形如 `https://host/v1`，LiteLLM 会附加 `/chat/completions`；
#     故用户误贴的 `/chat/completions` 应被剥离，保留 `/v1`。
#   - Anthropic：api_base 形如 `https://api.anthropic.com`，LiteLLM 附加 `/v1/messages`；
#     故误贴的 `/v1/messages` 应被整体剥离，不能保留 `/v1`。
# 为避免短后缀抢先匹配（例如 `/messages` 命中 `/v1/messages` 中的尾段但留下残缺的 `/v1`），
# 长后缀位于列表前端，依赖 break-per-iteration 的策略确保长后缀优先匹配。
_API_BASE_REDUNDANT_SUFFIXES: tuple[str, ...] = (
    "/v1/messages",
    "/chat/completions",
    "/completions",
)


def normalize_api_base(api_base: str | None) -> str | None:
    """规范化 api_base — 防御性移除用户误贴的端点路径后缀。

    用户在 Admin UI 配置 Base URL 时，偶有将完整端点（如
    `http://llms.as-in.io/v1/chat/completions`）误填为 Base URL 的情况，
    导致 LiteLLM 再次拼接 `/chat/completions` 造成 404。此函数以幂等方式
    去除常见冗余后缀与尾部斜杠，不影响合法配置（形如 `https://host/v1`）。

    剥离策略：在同一循环内交错处理「尾部斜杠」与「冗余后缀」，直至稳定，
    以覆盖形如 `http://x/v1/chat/completions/` 这样「斜杠 + 后缀」交错出现
    的组合情况。
    """
    if api_base is None:
        return None
    trimmed = api_base.strip()
    if not trimmed:
        return None

    changed = True
    while changed:
        changed = False
        if trimmed.endswith("/"):
            trimmed = trimmed.rstrip("/")
            changed = True
            continue
        for suffix in _API_BASE_REDUNDANT_SUFFIXES:
            if trimmed.endswith(suffix):
                trimmed = trimmed[: -len(suffix)]
                changed = True
                break

    return trimmed or None


def build_ping_llm_kwargs(
    vendor: str,
    model_name: str,
    *,
    api_key_override: str | None = None,
    api_base_override: str | None = None,
    vendor_config: dict[str, str] | None = None,
    max_tokens: int | None = 20,
) -> dict[str, Any]:
    """构造 Admin Ping 使用的 LiteLLM kwargs，复用业务主链路的 _build_llm_kwargs。

    合并顺序：
      1) _build_llm_kwargs(vendor, model_name, config={}, vendor_config)
         — 注入 vendor 特定适配（Anthropic thinking disabled / OpenAI o-系 reasoning）
           以及 vendor_config 凭证；
      2) setdefault("drop_params", True)
         — Ping 语义的核心保护：gpt-5 / o-系等新模型对 max_tokens、temperature 有
           严格约束；drop_params=True 允许 LiteLLM 自动剔除或映射不兼容参数；
      3) 覆盖 api_key / api_base（若显式提供，normalize_api_base 已应用）；
      4) 附加 max_tokens（若非 None）。

    注意：故意不合并 _DEFAULT_LLM_KWARGS["temperature"]。temperature 与具体模型合法取值耦合
    （如 gpt-5-mini 仅接受 1），Ping 阶段不应注入默认值，交由服务端缺省处理。
    """
    kwargs = _build_llm_kwargs(vendor, model_name, {}, vendor_config)
    kwargs.setdefault("drop_params", True)

    normalized_api_base = normalize_api_base(api_base_override)
    if api_key_override:
        kwargs["api_key"] = api_key_override
    if normalized_api_base:
        kwargs["api_base"] = normalized_api_base

    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    return kwargs


def _build_embedding_kwargs(config: dict[str, Any], vendor_config: dict[str, str] | None = None) -> dict[str, Any]:
    """从 DB config JSONB 构建 Embedding kwargs。"""
    kwargs: dict[str, Any] = {}
    if "dimensions" in config and config["dimensions"] is not None:
        kwargs["dimensions"] = config["dimensions"]
    if "input_type" in config and config["input_type"]:
        kwargs["input_type"] = config["input_type"]

    # 透传 API 凭证: model config > vendor config > LiteLLM 环境变量回退
    effective_api_key = config.get("api_key") or (vendor_config or {}).get("api_key")
    effective_api_base = config.get("api_base") or (vendor_config or {}).get("api_base")
    if effective_api_key:
        kwargs["api_key"] = effective_api_key
    if effective_api_base:
        kwargs["api_base"] = effective_api_base

    return kwargs
