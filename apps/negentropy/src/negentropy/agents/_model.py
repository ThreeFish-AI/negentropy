"""
LLM 模型工厂 — 单一事实源 (Single Source of Truth)

集中管理 LiteLlm 实例的构造逻辑，基于 DB model_configs 配置。

遵循 AGENTS.md 的「复用驱动」与「单一事实源」原则。
"""

from google.adk.models.lite_llm import LiteLlm


def create_model() -> LiteLlm:
    """创建 LiteLlm 实例。

    优先使用缓存的 DB 配置，回退到硬编码默认值。
    缓存由 engine/bootstrap.py 的 startup 事件预热。
    """
    from negentropy.config.model_resolver import get_cached_llm_config, get_fallback_llm_config

    cached = get_cached_llm_config()
    if cached:
        name, kwargs = cached
        return LiteLlm(name, **kwargs)
    name, kwargs = get_fallback_llm_config()
    return LiteLlm(name, **kwargs)
