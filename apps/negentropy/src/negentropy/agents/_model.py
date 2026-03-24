"""
LLM 模型工厂 — 单一事实源 (Single Source of Truth)

集中管理 LiteLlm 实例的构造逻辑，避免 6 个 Agent 文件中重复
``LiteLlm(settings.llm.full_model_name, **settings.llm.to_litellm_kwargs())``。

遵循 AGENTS.md 的「复用驱动」与「单一事实源」原则。
"""

from google.adk.models.lite_llm import LiteLlm

from negentropy.config import settings


def create_model() -> LiteLlm:
    """创建 LiteLlm 实例。

    优先使用缓存的 DB 配置，回退到 .env。
    缓存由 engine/bootstrap.py 的 startup 事件预热。
    """
    from negentropy.config.model_resolver import get_cached_llm_config

    cached = get_cached_llm_config()
    if cached:
        name, kwargs = cached
        return LiteLlm(name, **kwargs)
    return LiteLlm(settings.llm.full_model_name, **settings.llm.to_litellm_kwargs())
