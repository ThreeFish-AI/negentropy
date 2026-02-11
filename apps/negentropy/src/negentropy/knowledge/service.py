from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, Iterable, Optional
from uuid import UUID

from negentropy.logging import get_logger

from .chunking import chunk_text, semantic_chunk_async
from .constants import (
    DEFAULT_CHUNK_SIZE,
    DEFAULT_KEYWORD_WEIGHT,
    DEFAULT_OVERLAP,
    DEFAULT_SEMANTIC_WEIGHT,
    TEXT_PREVIEW_MAX_LENGTH,
)
from .exceptions import SearchError
from .content import fetch_content
from .reranking import NoopReranker, Reranker
from .repository import KnowledgeRepository
from .types import (
    ChunkingConfig,
    CorpusRecord,
    CorpusSpec,
    KnowledgeChunk,
    KnowledgeMatch,
    KnowledgeRecord,
    SearchConfig,
    merge_search_results,
)

logger = get_logger("negentropy.knowledge.service")

EmbeddingFn = Callable[[str], Awaitable[list[float]]]
BatchEmbeddingFn = Callable[[list[str]], Awaitable[list[list[float]]]]


class KnowledgeService:
    def __init__(
        self,
        repository: Optional[KnowledgeRepository] = None,
        embedding_fn: Optional[EmbeddingFn] = None,
        batch_embedding_fn: Optional[BatchEmbeddingFn] = None,
        chunking_config: Optional[ChunkingConfig] = None,
        reranker: Optional[Reranker] = None,
    ) -> None:
        self._repository = repository or KnowledgeRepository()
        self._embedding_fn = embedding_fn
        self._batch_embedding_fn = batch_embedding_fn
        self._chunking_config = chunking_config or ChunkingConfig()
        self._reranker = reranker or NoopReranker()

    async def ensure_corpus(self, spec: CorpusSpec) -> CorpusRecord:
        return await self._repository.get_or_create_corpus(spec)

    async def update_corpus(self, corpus_id: UUID, spec: Dict[str, Any]) -> CorpusRecord:
        corpus = await self._repository.update_corpus(corpus_id, spec)
        if not corpus:
            from .exceptions import CorpusNotFound

            raise CorpusNotFound(details={"corpus_id": str(corpus_id)})
        return corpus

    async def list_corpora(self, *, app_name: str) -> list[CorpusRecord]:
        return await self._repository.list_corpora(app_name=app_name)

    async def ingest_text(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        text: str,
        source_uri: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        chunking_config: Optional[ChunkingConfig] = None,
    ) -> list[KnowledgeRecord]:
        """索引文本到知识库

        流程: 文本分块 → 向量化 → 批量写入
        """
        config = chunking_config or self._chunking_config

        logger.info(
            "ingestion_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            text_length=len(text),
            source_uri=source_uri,
            chunk_size=config.chunk_size,
            overlap=config.overlap,
        )

        chunks = await self._build_chunks(
            text,
            source_uri=source_uri,
            metadata=metadata,
            chunking_config=config,
        )

        logger.debug(
            "chunks_created",
            corpus_id=str(corpus_id),
            chunk_count=len(chunks),
        )

        if self._embedding_fn:
            chunks = await self._attach_embeddings(chunks)
            logger.debug(
                "embeddings_attached",
                corpus_id=str(corpus_id),
                chunk_count=len(chunks),
            )

        records = await self._repository.add_knowledge(
            corpus_id=corpus_id,
            app_name=app_name,
            chunks=chunks,
        )

        logger.info(
            "ingestion_completed",
            corpus_id=str(corpus_id),
            record_count=len(records),
        )

        return records

    async def replace_source(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        text: str,
        source_uri: str,
        metadata: Optional[Dict[str, Any]] = None,
        chunking_config: Optional[ChunkingConfig] = None,
    ) -> list[KnowledgeRecord]:
        """替换源文本（删除旧记录 + 索引新记录）"""
        logger.info(
            "replace_source_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            source_uri=source_uri,
        )

        deleted_count = await self._repository.delete_knowledge_by_source(
            corpus_id=corpus_id,
            app_name=app_name,
            source_uri=source_uri,
        )

        logger.info(
            "old_records_deleted",
            corpus_id=str(corpus_id),
            source_uri=source_uri,
            deleted_count=deleted_count,
        )

        return await self.ingest_text(
            corpus_id=corpus_id,
            app_name=app_name,
            text=text,
            source_uri=source_uri,
            metadata=metadata,
            chunking_config=chunking_config,
        )

    async def ingest_url(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        url: str,
        metadata: Optional[Dict[str, Any]] = None,
        chunking_config: Optional[ChunkingConfig] = None,
    ) -> list[KnowledgeRecord]:
        """Fetch content from URL and ingest into knowledge base."""
        logger.info("ingest_url_started", corpus_id=str(corpus_id), url=url)

        try:
            text = await fetch_content(url)
        except ValueError as exc:
            # Wrap content fetching errors
            from .exceptions import KnowledgeError

            raise KnowledgeError(
                code="CONTENT_FETCH_FAILED", message=f"Failed to fetch content from URL: {exc}"
            ) from exc

        if not text:
            raise ValueError("No content extracted from URL")

        # Merge metadata
        meta = metadata or {}
        meta["source_url"] = url

        return await self.ingest_text(
            corpus_id=corpus_id,
            app_name=app_name,
            text=text,
            source_uri=url,
            metadata=meta,
            chunking_config=chunking_config,
        )

    async def search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query: str,
        config: Optional[SearchConfig] = None,
    ) -> list[KnowledgeMatch]:
        """搜索知识库

        支持四种检索模式:
        - "semantic": 基于向量相似度的语义检索
        - "keyword": 基于 BM25 的关键词检索
        - "hybrid": 加权融合检索 (semantic_weight * semantic_score + keyword_weight * keyword_score)
        - "rrf": RRF 融合检索 (Reciprocal Rank Fusion，对分数尺度不敏感)

        RRF 模式参考文献:
        [1] Y. Wang et al., "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods,"
            SIGIR'18, 2018.
        """
        config = config or SearchConfig()
        query_preview = query[:TEXT_PREVIEW_MAX_LENGTH] if query else ""

        if not query.strip():
            logger.debug("search_skipped_empty_query", corpus_id=str(corpus_id))
            return []

        logger.info(
            "search_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            mode=config.mode,
            limit=config.limit,
            query_preview=query_preview,
        )

        # RRF 模式: 使用专门的 RRF 检索方法
        if config.mode == "rrf":
            if not self._embedding_fn:
                logger.warning("rrf_search_failed_no_embedding", corpus_id=str(corpus_id))
                # 回退到关键词检索
                keyword_matches = await self._repository.keyword_search(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    query=query,
                    limit=config.limit,
                    metadata_filter=config.metadata_filter,
                )
                logger.info(
                    "search_completed",
                    corpus_id=str(corpus_id),
                    mode="keyword_fallback",
                    result_count=len(keyword_matches),
                )
                return keyword_matches

            query_embedding = await self._embedding_fn(query)
            results = await self._repository.rrf_search(
                corpus_id=corpus_id,
                app_name=app_name,
                query=query,
                query_embedding=query_embedding,
                limit=config.limit,
                k=config.rrf_k,
            )

            # L1 精排
            results = await self._reranker.rerank(query, results)

            logger.info(
                "search_completed",
                corpus_id=str(corpus_id),
                mode="rrf",
                rrf_k=config.rrf_k,
                result_count=len(results),
            )
            return results

        # 其他模式: semantic, keyword, hybrid
        query_embedding = None
        if config.mode in ("semantic", "hybrid") and self._embedding_fn:
            query_embedding = await self._embedding_fn(query)

        semantic_matches: list[KnowledgeMatch] = []
        keyword_matches: list[KnowledgeMatch] = []

        if config.mode in ("semantic", "hybrid") and query_embedding:
            semantic_matches = await self._repository.semantic_search(
                corpus_id=corpus_id,
                app_name=app_name,
                query_embedding=query_embedding,
                limit=config.limit,
                metadata_filter=config.metadata_filter,
            )
            logger.debug(
                "semantic_search_completed",
                corpus_id=str(corpus_id),
                result_count=len(semantic_matches),
            )

        if config.mode in ("keyword", "hybrid"):
            keyword_matches = await self._repository.keyword_search(
                corpus_id=corpus_id,
                app_name=app_name,
                query=query,
                limit=config.limit,
                metadata_filter=config.metadata_filter,
            )
            logger.debug(
                "keyword_search_completed",
                corpus_id=str(corpus_id),
                result_count=len(keyword_matches),
            )

        if config.mode == "semantic":
            # L1 精排
            semantic_matches = await self._reranker.rerank(query, semantic_matches)
            logger.info(
                "search_completed",
                corpus_id=str(corpus_id),
                mode="semantic",
                result_count=len(semantic_matches),
            )
            return semantic_matches

        if config.mode == "keyword":
            # L1 精排
            keyword_matches = await self._reranker.rerank(query, keyword_matches)
            logger.info(
                "search_completed",
                corpus_id=str(corpus_id),
                mode="keyword",
                result_count=len(keyword_matches),
            )
            return keyword_matches

        # Hybrid 模式
        results = self._merge_matches(
            semantic_matches,
            keyword_matches,
            semantic_weight=config.semantic_weight,
            keyword_weight=config.keyword_weight,
            limit=config.limit,
        )

        # L1 精排
        results = await self._reranker.rerank(query, results)

        logger.info(
            "search_completed",
            corpus_id=str(corpus_id),
            mode="hybrid",
            semantic_count=len(semantic_matches),
            keyword_count=len(keyword_matches),
            merged_count=len(results),
        )

        return results

    async def _build_chunks(
        self,
        text: str,
        *,
        source_uri: Optional[str],
        metadata: Optional[Dict[str, Any]],
        chunking_config: ChunkingConfig,
    ) -> Iterable[KnowledgeChunk]:
        metadata = metadata or {}

        # Determine strategy and call appropriate chunking function
        from .types import ChunkingStrategy

        if chunking_config.strategy == ChunkingStrategy.SEMANTIC:
            if not self._embedding_fn:
                # Fallback to recursive if no embedding function
                logger.warning("semantic_chunking_no_embedding_fn_fallback")
                raw_chunks = chunk_text(text, chunking_config)
            else:
                raw_chunks = await semantic_chunk_async(text, chunking_config, self._embedding_fn)
        else:
            raw_chunks = chunk_text(text, chunking_config)

        chunks: list[KnowledgeChunk] = []
        for index, content in enumerate(raw_chunks):
            chunks.append(
                KnowledgeChunk(
                    content=content,
                    source_uri=source_uri,
                    chunk_index=index,
                    metadata=metadata,
                    embedding=None,
                )
            )
        return chunks

    async def _attach_embeddings(self, chunks: Iterable[KnowledgeChunk]) -> list[KnowledgeChunk]:
        chunk_list = list(chunks)

        if not chunk_list:
            return []

        # 优先使用批量向量化（一次 API 调用完成所有 chunk）
        if self._batch_embedding_fn:
            texts = [c.content for c in chunk_list]
            embeddings = await self._batch_embedding_fn(texts)
            return [
                KnowledgeChunk(
                    content=c.content,
                    source_uri=c.source_uri,
                    chunk_index=c.chunk_index,
                    metadata=c.metadata,
                    embedding=emb,
                )
                for c, emb in zip(chunk_list, embeddings)
            ]

        # 回退到逐条向量化
        if not self._embedding_fn:
            return chunk_list

        enriched: list[KnowledgeChunk] = []
        for chunk in chunk_list:
            embedding = await self._embedding_fn(chunk.content)
            enriched.append(
                KnowledgeChunk(
                    content=chunk.content,
                    source_uri=chunk.source_uri,
                    chunk_index=chunk.chunk_index,
                    metadata=chunk.metadata,
                    embedding=embedding,
                )
            )
        return enriched

    def _merge_matches(
        self,
        semantic_matches: Iterable[KnowledgeMatch],
        keyword_matches: Iterable[KnowledgeMatch],
        *,
        semantic_weight: float,
        keyword_weight: float,
        limit: int,
    ) -> list[KnowledgeMatch]:
        """融合语义和关键词检索结果

        委托给 types.merge_search_results() 共享实现，
        消除与 KnowledgeRepository._fallback_hybrid_search() 的重复逻辑。
        """
        return merge_search_results(
            semantic_matches,
            keyword_matches,
            semantic_weight=semantic_weight,
            keyword_weight=keyword_weight,
            limit=limit,
        )
