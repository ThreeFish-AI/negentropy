"""
LiteLLM 官方在线价目表解析。

统一从 LiteLLM 官方在线价格目录读取模型单价，
并在缺价时回退到仓库内的本地 override 配置。
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import litellm

from negentropy.model_names import canonicalize_model_name, pricing_lookup_model_name

from .loader import get_model_pricing_usd

LITELLM_MODEL_COST_URL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"

_last_online_catalog_error: str | None = None


@lru_cache(maxsize=1)
def load_litellm_online_cost_catalog() -> dict[str, dict[str, Any]]:
    """加载 LiteLLM 官方在线价目表。"""
    global _last_online_catalog_error

    try:
        catalog = litellm.get_model_cost_map(url=LITELLM_MODEL_COST_URL)
        _last_online_catalog_error = None
        return {
            model_name: entry
            for model_name, entry in catalog.items()
            if isinstance(model_name, str) and isinstance(entry, dict)
        }
    except Exception as exc:
        _last_online_catalog_error = str(exc)
        return {}


def get_last_online_catalog_error() -> str | None:
    return _last_online_catalog_error


def clear_online_catalog_cache() -> None:
    global _last_online_catalog_error
    load_litellm_online_cost_catalog.cache_clear()
    _last_online_catalog_error = None


def get_online_model_pricing_usd(model_name: str | None) -> dict[str, float] | None:
    """从 LiteLLM 官方在线价目表获取模型价格，单位 USD / 1M tokens。"""
    if not model_name:
        return None

    catalog = load_litellm_online_cost_catalog()
    if not catalog:
        return None

    catalog_key = _resolve_catalog_key(model_name, catalog)
    if catalog_key is None:
        return None

    entry = catalog[catalog_key]
    input_cost_per_token = entry.get("input_cost_per_token")
    output_cost_per_token = entry.get("output_cost_per_token")
    if input_cost_per_token is None or output_cost_per_token is None:
        return None

    return {
        "input": round(float(input_cost_per_token) * 1_000_000, 6),
        "output": round(float(output_cost_per_token) * 1_000_000, 6),
    }


def get_effective_model_pricing_usd(model_name: str | None) -> tuple[dict[str, float] | None, str]:
    """统一解析模型价格：在线优先，本地兜底。"""
    online_pricing = get_online_model_pricing_usd(model_name)
    if online_pricing is not None:
        return online_pricing, "litellm_online_catalog"

    lookup_name = pricing_lookup_model_name(model_name)
    if lookup_name is None:
        return None, "missing"

    local_pricing = get_model_pricing_usd(lookup_name)
    if local_pricing is not None:
        return local_pricing, "local_override"

    return None, "missing"


def _resolve_catalog_key(model_name: str, catalog: dict[str, dict[str, Any]]) -> str | None:
    for candidate in _catalog_key_candidates(model_name):
        if candidate in catalog:
            return candidate
    return None


def _catalog_key_candidates(model_name: str) -> list[str]:
    normalized = canonicalize_model_name(model_name) or model_name
    candidates: list[str] = []

    def _append(candidate: str | None) -> None:
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    _append(normalized)

    try:
        model_info = litellm.get_model_info(normalized)
        _append(model_info.get("key"))
    except Exception:
        pass

    _append(pricing_lookup_model_name(normalized))
    return candidates
