from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, Dict

from negentropy.config import settings
from negentropy.logging import get_logger

logger = get_logger("negentropy.knowledge.embedding")

EmbeddingFn = Callable[[str], Awaitable[list[float]]]


def build_embedding_fn() -> EmbeddingFn:
    async def embed(text: str) -> list[float]:
        cleaned = text.strip()
        if not cleaned:
            return []

        try:
            import litellm

            response = await litellm.aembedding(
                model=settings.llm.embedding_full_model_name,
                input=[cleaned],
                **settings.llm.to_litellm_embedding_kwargs(),
            )
        except Exception as exc:
            logger.error("embedding request failed", exc_info=exc)
            raise

        data = response.get("data") if isinstance(response, dict) else None
        if not data:
            return []
        embedding = data[0].get("embedding") if isinstance(data[0], dict) else None
        if embedding is None:
            return []
        if isinstance(embedding, list):
            return [float(x) for x in embedding]
        return []

    return embed
