"""
LiteLLM 官方在线价目表同步。

仅用于补齐 LiteLLM 当前进程尚未加载的 GLM-5 系列价格，
避免在仓库内继续维护这两个模型的硬编码价格副本。
"""

from __future__ import annotations

from threading import Lock
from typing import Any

import httpx
import litellm

GLM5_MODELS = frozenset({"zai/glm-5", "zai/glm-5-code"})
LITELLM_MODEL_COST_URL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"

_refresh_lock = Lock()
_loaded_entries: dict[str, dict[str, Any]] | None = None
_refresh_error: str | None = None
_refresh_attempted = False


def is_glm5_family_model(model_name: str | None) -> bool:
    return model_name in GLM5_MODELS


def get_last_refresh_error() -> str | None:
    return _refresh_error


def ensure_glm5_online_pricing(model_name: str | None) -> bool:
    """确保指定 GLM-5 模型的官方在线价格已注册到 LiteLLM。"""
    if not is_glm5_family_model(model_name):
        return False

    if model_name in litellm.model_cost:
        return True

    with _refresh_lock:
        if model_name in litellm.model_cost:
            return True

        entries = _load_glm5_entries()
        if not entries:
            return False

        litellm.register_model(model_cost=entries)
        return model_name in litellm.model_cost


def _load_glm5_entries() -> dict[str, dict[str, Any]] | None:
    global _loaded_entries, _refresh_error, _refresh_attempted

    if _loaded_entries is not None:
        return _loaded_entries
    if _refresh_attempted:
        return None

    _refresh_attempted = True
    try:
        response = httpx.get(LITELLM_MODEL_COST_URL, timeout=5.0)
        response.raise_for_status()
        payload = response.json()

        entries = {
            model_name: model_config
            for model_name, model_config in payload.items()
            if model_name in GLM5_MODELS and isinstance(model_config, dict)
        }
        if len(entries) != len(GLM5_MODELS):
            missing = ", ".join(sorted(GLM5_MODELS - set(entries)))
            raise ValueError(f"LiteLLM 官方价目表缺少条目: {missing}")

        _loaded_entries = entries
        _refresh_error = None
        return _loaded_entries
    except Exception as exc:
        _refresh_error = str(exc)
        return None
