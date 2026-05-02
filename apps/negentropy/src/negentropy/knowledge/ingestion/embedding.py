"""
Embedding 向量化模块

提供文本向量化能力，支持单条和批量向量化。
内置指数退避重试机制，应对外部 API 的不稳定性。

参考文献:
[1] P. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks,"
    *Adv. Neural Inf. Process. Syst.*, vol. 33, pp. 9459-9474, 2020.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any
from urllib.parse import urlparse
from uuid import UUID

from negentropy.logging import get_logger

from ..exceptions import EmbeddingFailed

logger = get_logger("negentropy.knowledge.embedding")


def _api_base_host(api_base: Any) -> str:
    """从 api_base 提取 host 用于日志（脱敏 path/query/credentials）。"""
    if not isinstance(api_base, str) or not api_base:
        return ""
    try:
        parsed = urlparse(api_base)
        return parsed.netloc or parsed.path or ""
    except Exception:
        return ""


def _extract_upstream_text(exc: BaseException) -> str:
    """从 litellm 抛出的异常链中提取上游原始响应文本（已被 litellm 脱敏 URL）。"""
    cur: BaseException | None = exc
    seen: set[int] = set()
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))
        text = getattr(cur, "text", None) or getattr(cur, "message", None)
        if isinstance(text, str) and text:
            return text[:500]
        if isinstance(text, (bytes, bytearray)):
            return text.decode("utf-8", errors="replace")[:500]
        cur = cur.__cause__ or cur.__context__
    return ""


EmbeddingFn = Callable[[str], Awaitable[list[float]]]
BatchEmbeddingFn = Callable[[list[str]], Awaitable[list[list[float]]]]

# 重试配置
_MAX_RETRIES = 3
_BASE_BACKOFF_SECONDS = 1.0
_TIMEOUT_SECONDS = 30.0


def _extract_embedding_from_item(item: Any) -> list[float] | None:
    """从 litellm 返回的单个 data item 中提取 embedding 向量

    兼容 dict 和对象属性两种返回格式。

    Args:
        item: litellm 返回的 data 列表中的单个元素

    Returns:
        embedding 向量列表，提取失败返回 None
    """
    # 尝试对象属性访问
    embedding = getattr(item, "embedding", None)
    # 回退到 dict 访问
    if embedding is None and isinstance(item, dict):
        embedding = item.get("embedding")
    if embedding is None:
        return None
    if isinstance(embedding, list):
        return [float(x) for x in embedding]
    return None


def _extract_data_from_response(response: Any) -> list[Any] | None:
    """从 litellm 返回的 response 中提取 data 列表

    兼容 dict 和对象属性两种返回格式。

    Args:
        response: litellm 的完整响应

    Returns:
        data 列表，提取失败返回 None
    """
    # 尝试对象属性访问
    data = getattr(response, "data", None)
    # 回退到 dict 访问
    if data is None and isinstance(response, dict):
        data = response.get("data")
    return data if data else None


async def _call_with_retry(
    coro_factory,
    *,
    max_retries: int = _MAX_RETRIES,
    base_backoff: float = _BASE_BACKOFF_SECONDS,
    timeout: float = _TIMEOUT_SECONDS,
    context: str = "",
) -> Any:
    """带指数退避重试和超时的异步调用

    Args:
        coro_factory: 返回协程的工厂函数（每次重试创建新协程）
        max_retries: 最大重试次数
        base_backoff: 基础退避秒数
        timeout: 单次调用超时秒数
        context: 上下文描述（用于日志）

    Returns:
        协程返回值

    Raises:
        最后一次重试的异常
    """
    last_exc = None
    for attempt in range(1, max_retries + 1):
        try:
            return await asyncio.wait_for(coro_factory(), timeout=timeout)
        except TimeoutError:
            last_exc = TimeoutError(f"Embedding API timed out after {timeout}s")
            logger.warning(
                "embedding_timeout",
                attempt=attempt,
                max_retries=max_retries,
                timeout=timeout,
                context=context,
            )
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "embedding_retry",
                attempt=attempt,
                max_retries=max_retries,
                error=str(exc),
                context=context,
            )

        if attempt < max_retries:
            backoff = base_backoff * (2 ** (attempt - 1))
            await asyncio.sleep(backoff)

    raise last_exc


async def _resolve_embedding(embedding_config_id: UUID | str | None = None) -> tuple[str, dict]:
    """解析 Embedding 模型配置。

    优先按 `embedding_config_id` 从 model_configs 表解析；行不可用时回退到默认解析。
    """
    from negentropy.config.model_resolver import (
        resolve_embedding_config,
        resolve_embedding_config_by_id,
    )

    if embedding_config_id is not None:
        return await resolve_embedding_config_by_id(embedding_config_id)
    return await resolve_embedding_config()


def build_embedding_fn(embedding_config_id: UUID | str | None = None) -> EmbeddingFn:
    """构建单条文本向量化函数

    Args:
        embedding_config_id: 可选 model_configs.id；None 表示使用全局默认 embedding 模型。

    Returns:
        异步 embedding 函数

    Raises:
        EmbeddingFailed: 当向量化请求失败或响应格式异常时
    """

    async def embed(text: str) -> list[float]:
        cleaned = text.strip()
        if not cleaned:
            return []

        model_name, extra_kwargs = await _resolve_embedding(embedding_config_id)

        logger.debug(
            "embedding_request",
            model=model_name,
            api_base_host=_api_base_host(extra_kwargs.get("api_base")),
            input_count=1,
            text_preview=cleaned[:50],
            kwargs_keys=sorted(k for k in extra_kwargs.keys() if k != "api_key"),
        )

        try:
            import litellm

            async def _call():
                return await litellm.aembedding(
                    model=model_name,
                    input=[cleaned],
                    **extra_kwargs,
                )

            response = await _call_with_retry(
                _call,
                context=f"embed({cleaned[:50]}...)",
            )
        except (TimeoutError, Exception) as exc:
            upstream_text = _extract_upstream_text(exc)
            logger.error(
                "embedding_request_failed",
                model=model_name,
                api_base_host=_api_base_host(extra_kwargs.get("api_base")),
                upstream_response_text=upstream_text,
                exc_info=exc,
            )
            raise EmbeddingFailed(
                text_preview=cleaned[:100],
                model=model_name,
                reason=str(exc),
            ) from exc

        data = _extract_data_from_response(response)
        if not data:
            raise EmbeddingFailed(
                text_preview=cleaned[:100],
                model=model_name,
                reason="Empty response data from embedding API",
            )

        embedding = _extract_embedding_from_item(data[0])
        if embedding is None:
            raise EmbeddingFailed(
                text_preview=cleaned[:100],
                model=model_name,
                reason="No embedding vector found in response data",
            )

        return embedding

    return embed


def build_batch_embedding_fn(embedding_config_id: UUID | str | None = None) -> BatchEmbeddingFn:
    """构建批量文本向量化函数

    利用 litellm.aembedding 的 input 列表参数，
    一次 API 调用完成多条文本的向量化。

    Args:
        embedding_config_id: 可选 model_configs.id；None 表示使用全局默认 embedding 模型。

    Returns:
        异步批量 embedding 函数

    Raises:
        EmbeddingFailed: 当向量化请求失败或响应格式异常时
    """

    MAX_BATCH_SIZE = 10  # Conservative batch size to avoid token limits (20k)

    async def batch_embed(texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        model_name, extra_kwargs = await _resolve_embedding(embedding_config_id)

        # Split texts into batches
        batches = [texts[i : i + MAX_BATCH_SIZE] for i in range(0, len(texts), MAX_BATCH_SIZE)]
        results: list[list[float]] = []

        for batch_texts in batches:
            cleaned = [t.strip() for t in batch_texts]
            # Filter empty texts but keep index mapping
            non_empty_indices = [i for i, t in enumerate(cleaned) if t]
            non_empty_texts = [cleaned[i] for i in non_empty_indices]

            batch_results: list[list[float]] = [[] for _ in batch_texts]

            if non_empty_texts:
                logger.debug(
                    "batch_embedding_request",
                    model=model_name,
                    api_base_host=_api_base_host(extra_kwargs.get("api_base")),
                    input_count=len(non_empty_texts),
                    text_preview=non_empty_texts[0][:50],
                    kwargs_keys=sorted(k for k in extra_kwargs.keys() if k != "api_key"),
                )
                try:
                    import litellm

                    async def _call(
                        _texts=non_empty_texts,
                        _model=model_name,
                        _kwargs=extra_kwargs,
                    ):
                        return await litellm.aembedding(
                            model=_model,
                            input=_texts,
                            **_kwargs,
                        )

                    response = await _call_with_retry(
                        _call,
                        context=f"batch_embed({len(non_empty_texts)} texts)",
                    )
                except (TimeoutError, Exception) as exc:
                    upstream_text = _extract_upstream_text(exc)
                    logger.error(
                        "batch_embedding_request_failed",
                        model=model_name,
                        api_base_host=_api_base_host(extra_kwargs.get("api_base")),
                        upstream_response_text=upstream_text,
                        batch_size=len(non_empty_texts),
                        exc_info=exc,
                    )
                    raise EmbeddingFailed(
                        text_preview=f"batch({len(non_empty_texts)} texts)",
                        model=model_name,
                        reason=str(exc),
                    ) from exc

                data = _extract_data_from_response(response)
                if not data:
                    raise EmbeddingFailed(
                        text_preview=f"batch({len(non_empty_texts)} texts)",
                        model=model_name,
                        reason="Empty response data from batch embedding API",
                    )

                if len(data) != len(non_empty_texts):
                    raise EmbeddingFailed(
                        text_preview=f"batch({len(non_empty_texts)} texts)",
                        model=model_name,
                        reason=f"Response count mismatch: expected {len(non_empty_texts)}, got {len(data)}",
                    )

                # Extract embeddings and map back to original positions in batch
                for idx, data_item in zip(non_empty_indices, data, strict=True):
                    embedding = _extract_embedding_from_item(data_item)
                    if embedding is None:
                        raise EmbeddingFailed(
                            text_preview=cleaned[idx][:100],
                            model=model_name,
                            reason=f"No embedding vector found for item at index {idx}",
                        )
                    batch_results[idx] = embedding

            results.extend(batch_results)

        return results

    return batch_embed
