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
        kwargs = _build_embedding_kwargs({}, vendor_config, full_model_name=full_name)
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


# Google AI Studio 默认域名常量（litellm 内置默认指向同一地址）。
_GEMINI_DEFAULT_API_HOST = "https://generativelanguage.googleapis.com"
# 用户常误粘的路径后缀（来自 curl 示例或 OpenAI 兼容文档），归一化时需剥离。
_GEMINI_API_BASE_STRIP_SUFFIXES: tuple[str, ...] = (
    "/v1beta/openai/chat/completions",
    "/v1beta/openai",
    "/chat/completions",
    "/generateContent",
    "/v1beta",
)

# OpenAI 官方 host（litellm 内置默认 = 此 host + "/v1"）。
_OPENAI_DEFAULT_API_HOST = "https://api.openai.com"
# 用户易误粘的 curl 路径后缀（覆盖 chat/completions/embeddings/responses 四链路，含 /v1 前缀变体，长串优先）。
_OPENAI_API_BASE_STRIP_SUFFIXES: tuple[str, ...] = (
    "/v1/chat/completions",
    "/v1/completions",
    "/v1/embeddings",
    "/v1/responses",
    "/chat/completions",
    "/completions",
    "/embeddings",
    "/responses",
)


def normalize_api_base_for_litellm(model: str, api_base: str | None) -> str | None:
    """为 LiteLLM 规范化 Gemini 与 OpenAI 的 api_base，抵消其 URL 拼接对版本段的丢弃。

    **Gemini**：litellm 1.83.x 的 `_check_custom_proxy` 在 `custom_llm_provider=="gemini"` 且
    `api_base` 非空时，以 `{api_base}/models/{model}:{endpoint}` 拼接目标 URL
    (参见 `.venv/.../vertex_ai/vertex_llm_base.py:_check_custom_proxy`)，该格式
    丢失了 Google 要求的 `/v1beta/` 版本段。直接透传 `api_base` 会让请求落到错误
    路径，Google 边缘以 HTML 兜底页响应，进而触发 `GeminiException - Received=<!DOCTYPE html>`。

    **OpenAI**：litellm 将用户 `api_base` 原样作为 `AsyncOpenAI(base_url=...)`，而 OpenAI
    Python SDK 仅以相对路径 `chat/completions` 拼接最终 URL（见
    `site-packages/openai/resources/chat/completions/completions.py::create`），与 litellm 内置
    默认 `https://api.openai.com/v1` 的 `/v1` 版本段不对齐。用户按官网 placeholder 风格填入裸 host
    时请求落到根路径 `chat/completions`，网关以 catchall 40x/429 响应。

    规则：
    1. `api_base` 为空/None → 返回 None，交给 litellm 默认链路。
    2. 清洗尾斜杠 + 与 vendor 无关的 Anthropic 及其它前缀 → 清洗后恒等返回。
    3. **Gemini** 分支：剥离常见误粘后缀；官方域名 → None 放行 litellm 内置 URL；自建代理补齐 `/v1beta`。
    4. **OpenAI** 分支：剥离常见误粘后缀；官方域名（含 `/v1` 写法）→ None；URL 已显式带 `/v1` 结尾或
       中段含 `/v1/` → 恒等透传；其余自建代理末尾无 `/v1` → 补齐 `/v1`。
    """
    if api_base is None:
        return None
    stripped = api_base.strip().rstrip("/")
    if not stripped:
        return None

    if model.startswith("gemini/"):
        # 迭代剥离末尾噪声后缀（用户在 Base URL 字段粘贴了 curl 完整路径时尤其常见）。
        changed = True
        while changed:
            changed = False
            for suffix in _GEMINI_API_BASE_STRIP_SUFFIXES:
                if stripped.endswith(suffix):
                    stripped = stripped[: -len(suffix)].rstrip("/")
                    changed = True
                    break

        if not stripped:
            return None
        if stripped == _GEMINI_DEFAULT_API_HOST:
            return None
        if stripped.endswith("/v1beta"):
            return stripped
        return f"{stripped}/v1beta"

    if model.startswith("openai/"):
        # 迭代剥离常见 curl 完整路径误粘（长串后缀已按优先级排序）。
        changed = True
        while changed:
            changed = False
            for suffix in _OPENAI_API_BASE_STRIP_SUFFIXES:
                if stripped.endswith(suffix):
                    stripped = stripped[: -len(suffix)].rstrip("/")
                    changed = True
                    break

        if not stripped:
            return None
        # 官方域名（含裸 host 与 host/v1 两种写法）→ None 放行 litellm 内置 URL。
        if stripped in (_OPENAI_DEFAULT_API_HOST, f"{_OPENAI_DEFAULT_API_HOST}/v1"):
            return None
        # 已显式带 /v1 结尾 → 不重复追加（含 https://gateway/v1、https://gateway/openai/v1 等）。
        if stripped.endswith("/v1"):
            return stripped
        # URL 中段已含 /v1/（如 https://gateway/v1/custom）→ 恒等透传，避免双重 /v1。
        if "/v1/" in stripped:
            return stripped
        # 默认：补齐 /v1，抵消 OpenAI SDK 仅拼 /chat/completions 的缺陷。
        return f"{stripped}/v1"

    return stripped


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
    full_model = f"{vendor}/{model_name}" if vendor else model_name
    normalized_api_base = normalize_api_base_for_litellm(full_model, effective_api_base)
    if normalized_api_base:
        kwargs["api_base"] = normalized_api_base

    return kwargs


def _build_embedding_kwargs(
    config: dict[str, Any],
    vendor_config: dict[str, str] | None = None,
    full_model_name: str | None = None,
) -> dict[str, Any]:
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
    normalized_api_base = normalize_api_base_for_litellm(full_model_name or "", effective_api_base)
    if normalized_api_base:
        kwargs["api_base"] = normalized_api_base

    return kwargs
