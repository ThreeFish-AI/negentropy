"""Knowledge 搜索查询时使用 corpus 自配 embedding 模型的契约测试

覆盖 ISSUE-028 修复：``search()`` 必须按 ``corpus.config.models.embedding_config_id``
解析 embedding fn，使索引侧 (``_attach_embeddings``) 与查询侧契约对称：

- corpus 显式 pin → 调 corpus 专属 fn（**不**用 service 默认 fn）；
- corpus 未 pin → 退回 service 默认 fn（``self._embedding_fn``）；
- corpus pin 的 fn 失败 → hybrid 仍走 keyword 兜底（ISSUE-026 契约不被破坏）；
- rrf 模式同样 honor corpus pin；
- semantic 模式 corpus pin 失败 → ``EmbeddingFailed`` 上抛（→ api.py 映射 502）。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from negentropy.knowledge.exceptions import EmbeddingFailed
from negentropy.knowledge.service import KnowledgeService
from negentropy.knowledge.types import KnowledgeMatch, SearchConfig

_PINNED_EMBEDDING_CONFIG_ID = "00000000-0000-0000-0000-000000000aaa"
_PINNED_VECTOR = [0.11, 0.22, 0.33]


def _build_match(*, score: float = 0.5) -> KnowledgeMatch:
    return KnowledgeMatch(
        id=uuid4(),
        content="k",
        source_uri="test://uri",
        metadata={},
        semantic_score=0.0,
        keyword_score=score,
        combined_score=score,
    )


class _StubRepository:
    def __init__(self) -> None:
        self.keyword_search = AsyncMock(return_value=[_build_match()])
        self.semantic_search = AsyncMock(return_value=[_build_match(score=0.7)])
        self.rrf_search = AsyncMock(return_value=[_build_match(score=0.8)])
        self.hybrid_search = AsyncMock(return_value=[])
        self.get_corpus_by_id = AsyncMock(return_value=None)


def _make_service(
    *,
    repository: _StubRepository,
    default_embedding_fn: AsyncMock | None = None,
) -> KnowledgeService:
    """构建带桩的 KnowledgeService。"""
    svc = KnowledgeService(
        repository=repository,  # type: ignore[arg-type]
        embedding_fn=default_embedding_fn,
    )
    svc._hydrate_match_metadata = AsyncMock(side_effect=lambda **kw: kw["matches"])  # type: ignore[method-assign]
    svc._lift_hierarchical_matches = AsyncMock(side_effect=lambda **kw: kw["matches"])  # type: ignore[method-assign]
    svc._record_match_retrievals = AsyncMock(side_effect=lambda **kw: kw["matches"])  # type: ignore[method-assign]
    return svc


class TestSearchHonorsCorpusEmbeddingConfig:
    @pytest.mark.asyncio
    async def test_hybrid_uses_corpus_pinned_embedding_fn(self) -> None:
        """corpus pin embedding_config_id → 走 corpus 专属 fn，service 默认 fn 不被调用。"""
        repo = _StubRepository()
        default_fn = AsyncMock(return_value=[0.99, 0.99, 0.99])
        svc = _make_service(repository=repo, default_embedding_fn=default_fn)

        svc._get_corpus_config = AsyncMock(  # type: ignore[method-assign]
            return_value={"models": {"embedding_config_id": _PINNED_EMBEDDING_CONFIG_ID}}
        )

        pinned_fn = AsyncMock(return_value=_PINNED_VECTOR)
        with patch(
            "negentropy.knowledge.embedding.build_embedding_fn",
            return_value=pinned_fn,
        ) as build_fn:
            await svc.search(
                corpus_id=uuid4(),
                app_name="negentropy",
                query="harness",
                config=SearchConfig(mode="hybrid", limit=10),
            )

        build_fn.assert_called_once_with(_PINNED_EMBEDDING_CONFIG_ID)
        pinned_fn.assert_awaited_once_with("harness")
        default_fn.assert_not_called()
        repo.semantic_search.assert_awaited()
        # 验证传入 semantic_search 的 query_embedding 是 corpus pin fn 的产物
        called_kwargs = repo.semantic_search.await_args.kwargs
        assert called_kwargs["query_embedding"] == _PINNED_VECTOR

    @pytest.mark.asyncio
    async def test_falls_back_to_service_embedding_fn_when_no_pin(self) -> None:
        """corpus.config 无 embedding_config_id → 退回 service 默认 fn。"""
        repo = _StubRepository()
        default_fn = AsyncMock(return_value=[0.99, 0.99, 0.99])
        svc = _make_service(repository=repo, default_embedding_fn=default_fn)

        svc._get_corpus_config = AsyncMock(return_value={})  # type: ignore[method-assign]

        with patch("negentropy.knowledge.embedding.build_embedding_fn") as build_fn:
            await svc.search(
                corpus_id=uuid4(),
                app_name="negentropy",
                query="harness",
                config=SearchConfig(mode="hybrid", limit=10),
            )

        build_fn.assert_not_called()
        default_fn.assert_awaited_once_with("harness")

    @pytest.mark.asyncio
    async def test_corpus_pinned_fn_failure_keeps_hybrid_keyword_fallback(self) -> None:
        """corpus pin 的 fn 失败 → hybrid 仍走 keyword 兜底（ISSUE-026 契约不被破坏）。"""
        repo = _StubRepository()
        svc = _make_service(repository=repo, default_embedding_fn=AsyncMock())

        svc._get_corpus_config = AsyncMock(  # type: ignore[method-assign]
            return_value={"models": {"embedding_config_id": _PINNED_EMBEDDING_CONFIG_ID}}
        )

        async def failing_pinned(text: str) -> list[float]:
            raise EmbeddingFailed(
                text_preview=text[:50],
                model="openai/text-embedding-3-small",
                reason="vendor 4xx simulated",
            )

        with patch(
            "negentropy.knowledge.embedding.build_embedding_fn",
            return_value=failing_pinned,
        ):
            results = await svc.search(
                corpus_id=uuid4(),
                app_name="negentropy",
                query="harness",
                config=SearchConfig(mode="hybrid", limit=10),
            )

        assert len(results) >= 1
        repo.semantic_search.assert_not_called()
        repo.keyword_search.assert_awaited()

    @pytest.mark.asyncio
    async def test_rrf_mode_honors_corpus_pin(self) -> None:
        """rrf 分支同样调 corpus 专属 fn。"""
        repo = _StubRepository()
        default_fn = AsyncMock(return_value=[0.99, 0.99, 0.99])
        svc = _make_service(repository=repo, default_embedding_fn=default_fn)

        svc._get_corpus_config = AsyncMock(  # type: ignore[method-assign]
            return_value={"models": {"embedding_config_id": _PINNED_EMBEDDING_CONFIG_ID}}
        )

        pinned_fn = AsyncMock(return_value=_PINNED_VECTOR)
        with patch(
            "negentropy.knowledge.embedding.build_embedding_fn",
            return_value=pinned_fn,
        ):
            svc._reranker.rerank = AsyncMock(side_effect=lambda q, m: m)  # type: ignore[method-assign]
            await svc.search(
                corpus_id=uuid4(),
                app_name="negentropy",
                query="harness",
                config=SearchConfig(mode="rrf", limit=10),
            )

        pinned_fn.assert_awaited_once_with("harness")
        default_fn.assert_not_called()
        repo.rrf_search.assert_awaited()
        called_kwargs = repo.rrf_search.await_args.kwargs
        assert called_kwargs["query_embedding"] == _PINNED_VECTOR

    @pytest.mark.asyncio
    async def test_semantic_mode_propagates_pinned_fn_failure(self) -> None:
        """semantic 模式 corpus pin 失败 → EmbeddingFailed 上抛（→ api.py 映射 502）。"""
        repo = _StubRepository()
        svc = _make_service(repository=repo, default_embedding_fn=AsyncMock())

        svc._get_corpus_config = AsyncMock(  # type: ignore[method-assign]
            return_value={"models": {"embedding_config_id": _PINNED_EMBEDDING_CONFIG_ID}}
        )

        async def failing_pinned(text: str) -> list[float]:
            raise EmbeddingFailed(
                text_preview=text[:50],
                model="openai/text-embedding-3-small",
                reason="vendor 5xx simulated",
            )

        with patch(
            "negentropy.knowledge.embedding.build_embedding_fn",
            return_value=failing_pinned,
        ):
            with pytest.raises(EmbeddingFailed):
                await svc.search(
                    corpus_id=uuid4(),
                    app_name="negentropy",
                    query="harness",
                    config=SearchConfig(mode="semantic", limit=10),
                )
