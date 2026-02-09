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

    若未来需要为模型添加 retry、fallback 或其他配置，只需修改此处。
    """
    return LiteLlm(settings.llm.full_model_name, **settings.llm.to_litellm_kwargs())
