"""
搜索性能基准测试

建立 Knowledge 模块的搜索性能基准，用于验证优化效果。
"""

from __future__ import annotations

import asyncio
import time
import warnings
from typing import Any
from uuid import UUID, uuid4

import pytest

from negentropy.knowledge.service import KnowledgeService
from negentropy.knowledge.types import ChunkingConfig, CorpusSpec, SearchConfig


class TestSearchPerformance:
    """搜索性能基准测试

    性能目标（参考 docs/knowledges.md）:
    - 搜索延迟: P95 < 100ms
    - 索引速度: > 1000 chunks/秒
    """

    @pytest.fixture
    async def sample_corpus(self) -> UUID:
        """创建测试用语料库"""
        # 注意：此测试需要真实的数据库连接
        # 在 CI/CD 环境中应使用测试数据库
        corpus_id = uuid4()
        return corpus_id

    async def _benchmark_search(
        self,
        service: KnowledgeService,
        corpus_id: UUID,
        query: str,
        mode: str = "hybrid",
    ) -> float:
        """执行搜索并返回耗时（毫秒）"""
        config = SearchConfig(mode=mode, limit=20)
        start = time.perf_counter()
        await service.search(
            corpus_id=corpus_id,
            app_name="test",
            query=query,
            config=config,
        )
        end = time.perf_counter()
        return (end - start) * 1000

    @pytest.mark.asyncio
    async def test_semantic_search_latency(self, sample_corpus: UUID) -> None:
        """语义搜索延迟基准测试

        目标: P95 < 100ms
        """

        # 使用模拟 embedding 函数避免外部调用
        async def mock_embedding(text: str) -> list[float]:
            return [0.0] * 1536

        service = KnowledgeService(embedding_fn=mock_embedding)

        # 执行多次测量
        latencies: list[float] = []
        for _ in range(10):
            latency = await self._benchmark_search(
                service,
                sample_corpus,
                "test query",
                "semantic",
            )
            latencies.append(latency)

        # 计算 P95
        latencies.sort()
        p95 = latencies[int(len(latencies) * 0.95)]

        print(f"Semantic Search Latencies: {latencies}")
        print(f"P95: {p95:.2f}ms")

        # 警告而非断言，因为测试环境可能不稳定
        if p95 > 100:
            warnings.warn(f"P95 latency {p95:.2f}ms exceeds 100ms target", UserWarning, stacklevel=1)

    @pytest.mark.asyncio
    async def test_keyword_search_latency(self, sample_corpus: UUID) -> None:
        """关键词搜索延迟基准测试"""
        service = KnowledgeService()

        latencies: list[float] = []
        for _ in range(10):
            latency = await self._benchmark_search(
                service,
                sample_corpus,
                "test query",
                "keyword",
            )
            latencies.append(latency)

        latencies.sort()
        p95 = latencies[int(len(latencies) * 0.95)]

        print(f"Keyword Search Latencies: {latencies}")
        print(f"P95: {p95:.2f}ms")

    @pytest.mark.asyncio
    async def test_hybrid_search_latency(self, sample_corpus: UUID) -> None:
        """混合搜索延迟基准测试

        比较数据库端混合 vs Python 端混合的性能差异
        """

        async def mock_embedding(text: str) -> list[float]:
            return [0.0] * 1536

        service = KnowledgeService(embedding_fn=mock_embedding)

        latencies: list[float] = []
        for _ in range(10):
            latency = await self._benchmark_search(
                service,
                sample_corpus,
                "test query",
                "hybrid",
            )
            latencies.append(latency)

        latencies.sort()
        p95 = latencies[int(len(latencies) * 0.95)]
        avg = sum(latencies) / len(latencies)

        print(f"Hybrid Search Latencies: {latencies}")
        print(f"Average: {avg:.2f}ms, P95: {p95:.2f}ms")


class TestIngestionPerformance:
    """索引性能基准测试"""

    @pytest.mark.asyncio
    async def test_ingion_throughput(self) -> None:
        """索引吞吐量测试

        目标: > 1000 chunks/秒
        """

        async def mock_embedding(text: str) -> list[float]:
            return [0.0] * 1536

        service = KnowledgeService(embedding_fn=mock_embedding)

        # 先创建 corpus，避免触发 knowledge.corpus_id 外键约束
        corpus = await service.ensure_corpus(
            CorpusSpec(
                app_name="test",
                name=f"perf-ingest-{uuid4()}",
            )
        )
        corpus_id = corpus.id
        chunk_count = 100
        text = "word " * 100  # 约 500 字符

        start = time.perf_counter()

        # 批量索引（模拟）
        for _ in range(chunk_count):
            await service.ingest_text(
                corpus_id=corpus_id,
                app_name="test",
                text=text,
                chunking_config=ChunkingConfig(chunk_size=50, overlap=0),
            )

        end = time.perf_counter()
        duration = end - start

        # 计算吞吐量
        total_chunks = chunk_count * 2  # 每次约产生 2 个 chunk
        throughput = total_chunks / duration

        print(f"Ingested {total_chunks} chunks in {duration:.2f}s")
        print(f"Throughput: {throughput:.2f} chunks/s")

        # 警告而非断言
        if throughput < 1000:
            warnings.warn(
                f"Throughput {throughput:.2f} chunks/s below 1000 target",
                UserWarning,
                stacklevel=1,
            )


@pytest.mark.skip(reason="Integration test - requires database")
class TestDatabaseFunctionPerformance:
    """数据库函数性能测试"""

    @pytest.mark.asyncio
    async def test_kb_hybrid_search_vs_python(self) -> None:
        """对比 kb_hybrid_search 函数与 Python 端混合的性能

        此测试验证利用数据库原生函数的性能提升。
        """
        # TODO: 实现数据库函数调用并对比性能
        pass
