from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, Iterable, Optional
from uuid import UUID

from negentropy.logging import get_logger

from .chunking import chunk_text
from .constants import (
    DEFAULT_CHUNK_SIZE,
    DEFAULT_KEYWORD_WEIGHT,
    DEFAULT_OVERLAP,
    DEFAULT_SEMANTIC_WEIGHT,
    TEXT_PREVIEW_MAX_LENGTH,
)
from .exceptions import SearchError
from .repository import KnowledgeRepository
from .types import (
    ChunkingConfig,
    CorpusRecord,
    CorpusSpec,
    KnowledgeChunk,
    KnowledgeMatch,
    KnowledgeRecord,
    SearchConfig,
)

logger = get_logger("negentropy.knowledge.service")

EmbeddingFn = Callable[[str], Awaitable[list[float]]]


class KnowledgeService:
    def __init__(
        self,
        repository: Optional[KnowledgeRepository] = None,
        embedding_fn: Optional[EmbeddingFn] = None,
        chunking_config: Optional[ChunkingConfig] = None,
    ) -> None:
        self._repository = repository or KnowledgeRepository()
        self._embedding_fn = embedding_fn
        self._chunking_config = chunking_config or ChunkingConfig()

    async def ensure_corpus(self, spec: CorpusSpec) -> CorpusRecord:
        return await self._repository.get_or_create_corpus(spec)

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

        chunks = self._build_chunks(
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

    async def search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query: str,
        config: Optional[SearchConfig] = None,
    ) -> list[KnowledgeMatch]:
        """搜索知识库

        支持三种模式: semantic、keyword、hybrid
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
            logger.info(
                "search_completed",
                corpus_id=str(corpus_id),
                mode="semantic",
                result_count=len(semantic_matches),
            )
            return semantic_matches

        if config.mode == "keyword":
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

        logger.info(
            "search_completed",
            corpus_id=str(corpus_id),
            mode="hybrid",
            semantic_count=len(semantic_matches),
            keyword_count=len(keyword_matches),
            merged_count=len(results),
        )

        return results

    def _build_chunks(
        self,
        text: str,
        *,
        source_uri: Optional[str],
        metadata: Optional[Dict[str, Any]],
        chunking_config: ChunkingConfig,
    ) -> Iterable[KnowledgeChunk]:
        metadata = metadata or {}
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
        if not self._embedding_fn:
            return list(chunks)

        enriched: list[KnowledgeChunk] = []
        for chunk in chunks:
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

        策略:
        1. 以 semantic_matches 为基础
        2. 合并 keyword_matches 的分数
        3. 重新计算 combined_score
        4. 按分数排序并返回前 limit 条
        """
        # 第一步: 初始化合并字典
        merged = self._initialize_merged_dict(semantic_matches)

        # 第二步: 合并关键词结果
        merged = self._merge_keyword_results(merged, keyword_matches)

        # 第三步: 重新计算融合分数
        recomputed = self._recompute_combined_scores(
            merged,
            semantic_weight=semantic_weight,
            keyword_weight=keyword_weight,
        )

        # 第四步: 排序并限制数量
        return self._sort_and_limit(recomputed, limit=limit)

    @staticmethod
    def _initialize_merged_dict(
        semantic_matches: Iterable[KnowledgeMatch],
    ) -> Dict[UUID, KnowledgeMatch]:
        """初始化合并字典，以语义检索结果为基础"""
        merged: Dict[UUID, KnowledgeMatch] = {}
        for match in semantic_matches:
            merged[match.id] = KnowledgeMatch(
                id=match.id,
                content=match.content,
                source_uri=match.source_uri,
                metadata=match.metadata,
                semantic_score=match.semantic_score,
                keyword_score=0.0,
                combined_score=0.0,
            )
        return merged

    @staticmethod
    def _merge_keyword_results(
        merged: Dict[UUID, KnowledgeMatch],
        keyword_matches: Iterable[KnowledgeMatch],
    ) -> Dict[UUID, KnowledgeMatch]:
        """合并关键词检索结果到字典"""
        for match in keyword_matches:
            existing = merged.get(match.id)
            if existing:
                # 已存在，更新 keyword_score
                merged[match.id] = KnowledgeMatch(
                    id=existing.id,
                    content=existing.content,
                    source_uri=existing.source_uri,
                    metadata=existing.metadata,
                    semantic_score=existing.semantic_score,
                    keyword_score=match.keyword_score,
                    combined_score=0.0,
                )
            else:
                # 不存在，新增纯关键词结果
                merged[match.id] = KnowledgeMatch(
                    id=match.id,
                    content=match.content,
                    source_uri=match.source_uri,
                    metadata=match.metadata,
                    semantic_score=0.0,
                    keyword_score=match.keyword_score,
                    combined_score=0.0,
                )
        return merged

    @staticmethod
    def _recompute_combined_scores(
        merged: Dict[UUID, KnowledgeMatch],
        *,
        semantic_weight: float,
        keyword_weight: float,
    ) -> list[KnowledgeMatch]:
        """重新计算所有结果的融合分数"""
        recomputed: list[KnowledgeMatch] = []
        for match in merged.values():
            combined_score = (
                match.semantic_score * semantic_weight + match.keyword_score * keyword_weight
            )
            recomputed.append(
                KnowledgeMatch(
                    id=match.id,
                    content=match.content,
                    source_uri=match.source_uri,
                    metadata=match.metadata,
                    semantic_score=match.semantic_score,
                    keyword_score=match.keyword_score,
                    combined_score=combined_score,
                )
            )
        return recomputed

    @staticmethod
    def _sort_and_limit(
        matches: list[KnowledgeMatch],
        *,
        limit: int,
    ) -> list[KnowledgeMatch]:
        """按融合分数排序并限制返回数量"""
        ordered = sorted(matches, key=lambda item: item.combined_score, reverse=True)
        return ordered[:limit]
