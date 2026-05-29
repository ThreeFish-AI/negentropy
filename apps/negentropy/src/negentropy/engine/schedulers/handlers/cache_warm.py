"""``cache_warm`` handler — 预热 LLM/Embedding 模型配置缓存。

从 ``bootstrap.py:425-434`` 的 startup hook 平移为 oneshot 任务。
"""

from __future__ import annotations

from negentropy.logging import get_logger

from . import HandlerDescriptor, HandlerResult, register_descriptor, register_handler

logger = get_logger("negentropy.engine.schedulers.handlers.cache_warm")

register_descriptor(
    HandlerDescriptor(
        handler_kind="cache_warm",
        label="Model Config Cache Warm",
        description="启动时预热 LLM/Embedding 配置缓存",
        supported_trigger_types=("oneshot",),
        default_trigger_type="oneshot",
    ),
)


@register_handler("cache_warm")
async def cache_warm_handler(task) -> HandlerResult:
    try:
        from negentropy.config.model_resolver import resolve_embedding_config, resolve_llm_config

        await resolve_llm_config()
        await resolve_embedding_config()
        logger.info("model_config_cache_warmed")
        return HandlerResult(status="ok", output_summary="LLM + Embedding configs warmed")
    except Exception as exc:
        logger.warning("model_config_cache_warm_failed", error=str(exc))
        return HandlerResult(status="failed", error=str(exc))
