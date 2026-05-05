"""Knowledge 搜索韧性单元测试

覆盖 Embedding 失败时各检索模式的降级行为：
- ``hybrid``：embedding 失败 → 回退到 keyword-only（不抛异常）
- ``rrf``：embedding 失败 → 回退到 keyword-only（不抛异常）
- ``semantic``：embedding 失败 → 显式传播 ``EmbeddingFailed``

以及 API 层 ``EmbeddingFailed`` 映射到 ``502 Bad Gateway`` 的契约。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from negentropy.knowledge.exceptions import EmbeddingFailed, SearchError
from negentropy.knowledge.service import KnowledgeService
from negentropy.knowledge.types import KnowledgeMatch, SearchConfig


def _build_match(*, content: str = "k", score: float = 0.5) -> KnowledgeMatch:
    return KnowledgeMatch(
        id=uuid4(),
        content=content,
        source_uri="test://uri",
        metadata={},
        semantic_score=0.0,
        keyword_score=score,
        combined_score=score,
    )


class _StubRepository:
    """最小化 KnowledgeRepository 替身，仅提供搜索方法的可断言桩。"""

    def __init__(self, keyword_results: list[KnowledgeMatch] | None = None) -> None:
        self.keyword_search = AsyncMock(return_value=keyword_results or [_build_match()])
        self.semantic_search = AsyncMock(return_value=[])
        self.rrf_search = AsyncMock(return_value=[])
        self.hybrid_search = AsyncMock(return_value=[])


@pytest.fixture
def stub_repository() -> _StubRepository:
    return _StubRepository()


@pytest.fixture
def service(stub_repository: _StubRepository) -> KnowledgeService:
    """构造一个最小可用的 KnowledgeService，桩掉所有外部依赖。"""

    async def failing_embedding(text: str) -> list[float]:
        raise EmbeddingFailed(
            text_preview=text[:50],
            model="gemini/text-embedding-004",
            reason="upstream 400 simulated",
        )

    svc = KnowledgeService(
        repository=stub_repository,  # type: ignore[arg-type]
        embedding_fn=failing_embedding,
    )
    # 桩掉与本测无关的私有 helper，避免触发 DB 调用
    svc._hydrate_match_metadata = AsyncMock(side_effect=lambda **kw: kw["matches"])  # type: ignore[method-assign]
    svc._lift_hierarchical_matches = AsyncMock(side_effect=lambda **kw: kw["matches"])  # type: ignore[method-assign]
    svc._record_match_retrievals = AsyncMock(side_effect=lambda **kw: kw["matches"])  # type: ignore[method-assign]
    # search() 现按 corpus.config.embedding_config_id 选 fn；本测固定走 service 默认 fn。
    svc._get_corpus_config = AsyncMock(return_value={})  # type: ignore[method-assign]
    return svc


class TestSearchResilience:
    @pytest.mark.asyncio
    async def test_hybrid_falls_back_to_keyword_on_embedding_failure(
        self, service: KnowledgeService, stub_repository: _StubRepository
    ) -> None:
        """hybrid 模式：embedding 失败 → 仅以 keyword 检索回退，不抛异常"""
        results = await service.search(
            corpus_id=uuid4(),
            app_name="negentropy",
            query="harness",
            config=SearchConfig(mode="hybrid", limit=10),
        )

        # 关键断言：返回 keyword 结果而不抛 EmbeddingFailed
        assert len(results) >= 1
        # semantic_search 不应被调用（query_embedding=None 时被守卫跳过）
        stub_repository.semantic_search.assert_not_called()
        # keyword_search 应被调用（hybrid 分支天然要走）
        stub_repository.keyword_search.assert_awaited()

    @pytest.mark.asyncio
    async def test_rrf_falls_back_to_keyword_on_embedding_failure(
        self, service: KnowledgeService, stub_repository: _StubRepository
    ) -> None:
        """rrf 模式：embedding 失败 → 走与 ``not embedding_fn`` 等价的 keyword 回退路径"""
        results = await service.search(
            corpus_id=uuid4(),
            app_name="negentropy",
            query="harness",
            config=SearchConfig(mode="rrf", limit=10),
        )

        assert len(results) >= 1
        stub_repository.rrf_search.assert_not_called()
        stub_repository.keyword_search.assert_awaited()

    @pytest.mark.asyncio
    async def test_semantic_propagates_embedding_failure(self, service: KnowledgeService) -> None:
        """semantic 模式：embedding 失败 → 显式传播 ``EmbeddingFailed``（无意义降级）"""
        with pytest.raises(EmbeddingFailed):
            await service.search(
                corpus_id=uuid4(),
                app_name="negentropy",
                query="harness",
                config=SearchConfig(mode="semantic", limit=10),
            )


class TestExceptionMapping:
    def test_embedding_failed_maps_to_502(self) -> None:
        """EmbeddingFailed → HTTP 502 Bad Gateway，保留 EMBEDDING_FAILED code"""
        from negentropy.knowledge.api import _map_exception_to_http

        exc = EmbeddingFailed(
            text_preview="harness",
            model="gemini/text-embedding-004",
            reason="upstream 400",
        )

        http_exc = _map_exception_to_http(exc)

        assert http_exc.status_code == 502
        detail: Any = http_exc.detail
        assert isinstance(detail, dict)
        assert detail["code"] == "EMBEDDING_FAILED"
        assert "harness" in detail["details"]["text_preview"]

    def test_search_error_remains_500(self) -> None:
        """SearchError 维持 500（与 EmbeddingFailed 区分自身错误 vs 上游错误）"""
        from negentropy.knowledge.api import _map_exception_to_http

        exc = SearchError(
            corpus_id=str(uuid4()),
            search_mode="hybrid",
            reason="internal",
        )

        http_exc = _map_exception_to_http(exc)

        assert http_exc.status_code == 500
        detail: Any = http_exc.detail
        assert isinstance(detail, dict)
        assert detail["code"] == "SEARCH_ERROR"
