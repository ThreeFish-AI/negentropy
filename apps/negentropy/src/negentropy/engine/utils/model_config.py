"""共享模型配置解析工具

将 LLM 模型配置解析逻辑收敛为单一事实源，供 LLMFactExtractor、
MemorySummarizer 等 LLM 驱动组件复用。

入口:
    ``resolve_model_config_async(task_key, *, corpus_id, explicit_model)``
    异步签名，完整解析链:
        explicit > task_model_settings (corpus) > task_model_settings (global)
        > model_configs.is_default > 硬编码 fallback。
"""

from __future__ import annotations

from typing import Any
from uuid import UUID


async def resolve_model_config_async(
    task_key: str | None,
    *,
    corpus_id: UUID | str | None = None,
    explicit_model: str | None = None,
) -> tuple[str, dict[str, Any]]:
    """解析 LLM 模型配置（异步签名，task-aware）。

    优先级:
        1. ``explicit_model``  — 调用方显式指定
        2. ``task_model_settings(corpus_id, task_key)`` — Corpus 级映射
        3. ``task_model_settings(NULL, task_key)``      — 全局映射
        4. ``model_configs.is_default``                  — 全局默认
        5. 硬编码 fallback

    Args:
        task_key: 任务标识符（见 ``negentropy.config.task_registry``）；None 表示
            调用方没有归属任务，等价于不走 task 路由直接进入全局默认链路。
        corpus_id: 可选 Corpus 范围。仅 ``scope=corpus`` 的任务槽位会消费它。
        explicit_model: 显式覆盖。命中后短路所有 DB 查询，返回 ``(name, {})``。

    Returns:
        ``(model_name, model_kwargs)``，与同步版本同形。
    """
    if explicit_model:
        return explicit_model, {}
    from negentropy.config.model_resolver import resolve_llm_config, resolve_llm_config_for_task

    if task_key:
        return await resolve_llm_config_for_task(task_key, corpus_id=corpus_id)
    return await resolve_llm_config()
