"""
LLM 模型名规范化工具。

提供全局唯一的模型名规范化与查表键转换逻辑，避免观测、日志、
持久化和定价等链路各自维护不同的命名规则。

当前语义：
- `canonicalize_model_name()` 为通用幂等实现（仅 strip），不做供应商特化；
- `pricing_lookup_model_name()` 剥离供应商前缀，返回裸模型名用于定价查表。

历史上 GLM 系列曾在此被强制规范为 `zai/<model>`；该专属链路已随
ZAI/LiteLLM 整合下线。上游调用点（观测、定价、日志）保持接口不变以
维持正交性，若未来需要引入新的供应商规范化规则，可在此处扩展。
"""

from __future__ import annotations


def canonicalize_model_name(model_name: str | None) -> str | None:
    """返回全局规范模型名。

    当前实现为幂等 no-op：仅剔除首尾空白，保留原始供应商前缀与模型名。
    """
    if not model_name:
        return model_name

    normalized = model_name.strip()
    return normalized or model_name


def pricing_lookup_model_name(model_name: str | None) -> str | None:
    """返回用于定价查表的模型键。

    定价表以裸模型名为键（例如 `gpt-5-mini`），因此需要在查表前
    去掉供应商前缀。
    """
    canonical = canonicalize_model_name(model_name)
    if not canonical:
        return canonical

    _, separator, raw_model = canonical.partition("/")
    return raw_model if separator else canonical
