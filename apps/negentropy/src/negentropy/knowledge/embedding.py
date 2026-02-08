"""
Embedding 向量化模块

提供文本向量化能力，支持单条和批量向量化。

参考文献:
[1] P. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks,"
    *Adv. Neural Inf. Process. Syst.*, vol. 33, pp. 9459-9474, 2020.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, Dict, List

from negentropy.config import settings
from negentropy.logging import get_logger

from .exceptions import EmbeddingFailed

logger = get_logger("negentropy.knowledge.embedding")

EmbeddingFn = Callable[[str], Awaitable[list[float]]]
BatchEmbeddingFn = Callable[[list[str]], Awaitable[list[list[float]]]]


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


def build_embedding_fn() -> EmbeddingFn:
    """构建单条文本向量化函数

    Returns:
        异步 embedding 函数

    Raises:
        EmbeddingFailed: 当向量化请求失败或响应格式异常时
    """
    model_name = settings.llm.embedding_full_model_name

    async def embed(text: str) -> list[float]:
        cleaned = text.strip()
        if not cleaned:
            return []

        try:
            import litellm

            response = await litellm.aembedding(
                model=model_name,
                input=[cleaned],
                **settings.llm.to_litellm_embedding_kwargs(),
            )
        except Exception as exc:
            logger.error("embedding_request_failed", model=model_name, exc_info=exc)
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


def build_batch_embedding_fn() -> BatchEmbeddingFn:
    """构建批量文本向量化函数

    利用 litellm.aembedding 的 input 列表参数，
    一次 API 调用完成多条文本的向量化。

    Returns:
        异步批量 embedding 函数

    Raises:
        EmbeddingFailed: 当向量化请求失败或响应格式异常时
    """
    model_name = settings.llm.embedding_full_model_name

    async def batch_embed(texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        cleaned = [t.strip() for t in texts]
        # 过滤空文本，但保留索引映射
        non_empty_indices = [i for i, t in enumerate(cleaned) if t]
        non_empty_texts = [cleaned[i] for i in non_empty_indices]

        if not non_empty_texts:
            return [[] for _ in texts]

        try:
            import litellm

            response = await litellm.aembedding(
                model=model_name,
                input=non_empty_texts,
                **settings.llm.to_litellm_embedding_kwargs(),
            )
        except Exception as exc:
            logger.error(
                "batch_embedding_request_failed",
                model=model_name,
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

        # 提取 embeddings 并映射回原始位置
        result: list[list[float]] = [[] for _ in texts]
        for idx, data_item in zip(non_empty_indices, data):
            embedding = _extract_embedding_from_item(data_item)
            if embedding is None:
                raise EmbeddingFailed(
                    text_preview=cleaned[idx][:100],
                    model=model_name,
                    reason=f"No embedding vector found for item at index {idx}",
                )
            result[idx] = embedding

        return result

    return batch_embed
