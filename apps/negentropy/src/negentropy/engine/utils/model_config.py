"""共享模型配置解析工具

将 LLM 模型配置解析逻辑收敛为单一事实源，供 LLMFactExtractor、
MemorySummarizer 等 LLM 驱动组件复用。

提供两类入口:
    - ``resolve_model_config(explicit_model)`` — 同步签名，遗留调用方使用。
      仅消费同步缓存与硬编码 fallback，不查 DB。
    - ``resolve_model_config_async(task_key, *, corpus_id, explicit_model)`` — 异步签名，
      新代码使用。完整解析链:
        explicit > task_model_settings (corpus) > task_model_settings (global)
        > model_configs.is_default > 硬编码 fallback。
"""

from __future__ import annotations

from typing import Any
from uuid import UUID


def resolve_model_config(explicit_model: str | None) -> tuple[str, dict[str, Any]]:
    """解析 LLM 模型配置（同步签名，遗留入口）。

    优先级: 显式指定 > DB 缓存配置 > 硬编码默认值

    Args:
        explicit_model: 调用方显式指定的模型名称

    Returns:
        (model_name, model_kwargs) 二元组

    Note:
        新代码应改用 ``resolve_model_config_async`` 以接入 task_model_settings 路由。
        该同步入口仅检查内存缓存（由其他 await 调用预填）+ 硬编码 fallback。
    """
    if explicit_model:
        return explicit_model, {}
    from negentropy.config.model_resolver import get_cached_llm_config, get_fallback_llm_config

    cached = get_cached_llm_config()
    if cached is not None:
        return cached[0], cached[1]
    return get_fallback_llm_config()


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
        explicit_model: 显式覆盖（如 ``vendor/model_name``）。优先按名解析 DB ``model_configs`` +
            ``vendor_configs`` 以获取 ``api_key``/``api_base`` 等 litellm_kwargs（经代理路由必需）；
            DB 无此模型时回退 ``(name, {})``（适用自带环境凭证的全限定模型）。

    Returns:
        ``(model_name, model_kwargs)``，与同步版本同形。
    """
    from negentropy.config.model_resolver import (
        resolve_llm_config,
        resolve_llm_config_by_model_name,
        resolve_llm_config_for_task,
    )

    if explicit_model:
        # 按名解析以携带凭证 kwargs（api_key/api_base）——否则裸 explicit_model + {} kwargs
        # 会丢失代理路由，导致 Judge/Reviewer 的 litellm 调用因缺凭证失败（per-routine
        # evaluator_model 覆盖即走此路，ISSUE-121 修复的端到端正确性依赖于此）。
        resolved = await resolve_llm_config_by_model_name(explicit_model)
        if resolved is not None:
            return resolved
        return explicit_model, {}

    if task_key:
        return await resolve_llm_config_for_task(task_key, corpus_id=corpus_id)
    return await resolve_llm_config()
