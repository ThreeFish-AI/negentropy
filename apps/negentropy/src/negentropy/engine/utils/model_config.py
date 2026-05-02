"""共享模型配置解析工具

将 LLM 模型配置解析逻辑收敛为单一事实源，供 LLMFactExtractor、
MemorySummarizer 等 LLM 驱动组件复用。
"""

from __future__ import annotations


def resolve_model_config(explicit_model: str | None) -> tuple[str, dict]:
    """解析 LLM 模型配置

    优先级: 显式指定 > DB 缓存配置 > 硬编码默认值

    Args:
        explicit_model: 调用方显式指定的模型名称

    Returns:
        (model_name, model_kwargs) 二元组
    """
    if explicit_model:
        return explicit_model, {}
    from negentropy.config.model_resolver import get_cached_llm_config, get_fallback_llm_config

    cached = get_cached_llm_config()
    if cached is not None:
        return cached[0], cached[1]
    return get_fallback_llm_config()
