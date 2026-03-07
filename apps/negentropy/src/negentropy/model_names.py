"""
LLM 模型名规范化工具。

提供全局唯一的模型名规范化与查表键转换逻辑，避免观测、日志、
持久化和定价等链路各自维护不同的命名规则。
"""

from __future__ import annotations


def canonicalize_model_name(model_name: str | None) -> str | None:
    """返回全局规范模型名。

    当前规则：
    - `glm*` 系列统一规范为 `zai/<model>`
    - 已带前缀的模型保持幂等
    - 非 GLM 模型保持原样
    """
    if not model_name:
        return model_name

    normalized = model_name.strip()
    if not normalized:
        return normalized

    if "/" in normalized:
        vendor, raw_model = normalized.split("/", 1)
        if raw_model.lower().startswith("glm"):
            return f"zai/{raw_model}"
        return normalized

    if normalized.lower().startswith("glm"):
        return f"zai/{normalized}"

    return normalized


def pricing_lookup_model_name(model_name: str | None) -> str | None:
    """返回用于定价查表的模型键。

    定价表当前以裸模型名为键，例如 `glm-5`，因此需要在查表前
    去掉供应商前缀；其它模型保持原样。
    """
    canonical = canonicalize_model_name(model_name)
    if not canonical:
        return canonical

    _, separator, raw_model = canonical.partition("/")
    return raw_model if separator else canonical
