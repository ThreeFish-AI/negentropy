"""
RAG Pipeline for Knowledge Base Retrieval.

This module provides the complete RAG (Retrieval-Augmented Generation) pipeline:
- Document ingestion and indexing
- Hybrid search (semantic + keyword)
- LLM-based answer generation with citations

Usage:
    from cognizes.engine.perception.rag_pipeline import RAGPipeline

    pipeline = RAGPipeline(db_pool=pool)
    answer = await pipeline.query("What is machine learning?")

Task ID: P3-5-4
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Union, Callable
import asyncio
import time


@dataclass
class RetrievalResult:
    """Result from retrieval step."""

    id: str
    content: str
    score: float
    source_uri: Optional[str] = None
    chunk_index: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RAGResponse:
    """Response from RAG pipeline."""

    query: str
    answer: str
    sources: List[RetrievalResult]
    retrieval_time_ms: float = 0
    generation_time_ms: float = 0
    total_time_ms: float = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class IndexingResult:
    """Result from document indexing."""

    doc_id: str
    source_uri: str
    chunks_indexed: int
    total_tokens: int
    processing_time_ms: float


class RAGPipeline:
    """
    Complete RAG Pipeline.

    Orchestrates:
    1. Document Ingestion & Indexing
    2. Hybrid Retrieval (Semantic + Keyword)
    3. LLM Answer Generation
    """

    def __init__(
        self,
        db_pool=None,
        ingester=None,
        embedder=None,
        llm_client=None,
        corpus_id: Optional[str] = None,
        app_name: str = "default",
        use_knowledge_base: bool = True,
    ):
        """
        Initialize RAG Pipeline.

        Args:
            db_pool: asyncpg connection pool
            ingester: DocumentIngester instance
            embedder: Embedder instance
            llm_client: LLM client for generation
            corpus_id: Default corpus ID for knowledge base
            app_name: Application name
            use_knowledge_base: Whether to use knowledge_base table (vs memories)
        """
        self.db_pool = db_pool
        self.ingester = ingester
        self.embedder = embedder
        self.llm_client = llm_client
        self.corpus_id = corpus_id
        self.app_name = app_name
        self.use_knowledge_base = use_knowledge_base

    def _get_ingester(self):
        """Get or create ingester."""
        if self.ingester is None:
            from cognizes.engine.perception.ingestion import get_ingester

            self.ingester = get_ingester()
        return self.ingester

    def _get_embedder(self):
        """Get or create embedder."""
        if self.embedder is None:
            from cognizes.engine.perception.embedder import get_embedder

            self.embedder = get_embedder(provider_type="mock")
        return self.embedder

    # ============================================
    # Indexing Methods
    # ============================================

    async def index_document(
        self,
        content: str,
        source_uri: str = "inline.txt",
        corpus_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> IndexingResult:
        """
        Index a document into the knowledge base.

        Args:
            content: Document content
            source_uri: Source identifier
            corpus_id: Corpus ID (uses default if not provided)
            metadata: Additional metadata

        Returns:
            IndexingResult with indexing stats
        """
        start_time = time.perf_counter()

        # Ingest document (parse, chunk, embed)
        ingester = self._get_ingester()
        ingested = await ingester.ingest_text(
            content=content,
            source_uri=source_uri,
            generate_embeddings=True,
        )

        # Store chunks in database
        corpus_id = corpus_id or self.corpus_id
        chunks_indexed = 0

        if self.db_pool is not None:
            for chunk in ingested.chunks:
                await self._store_chunk(chunk, corpus_id, metadata)
                chunks_indexed += 1

        processing_time = (time.perf_counter() - start_time) * 1000

        return IndexingResult(
            doc_id=ingested.document.doc_id,
            source_uri=source_uri,
            chunks_indexed=chunks_indexed,
            total_tokens=ingested.total_tokens,
            processing_time_ms=processing_time,
        )

    async def _store_chunk(
        self,
        chunk: Dict[str, Any],
        corpus_id: Optional[str],
        metadata: Optional[Dict[str, Any]],
    ):
        """Store a chunk in the database."""
        import json

        if self.db_pool is None:
            return

        combined_metadata = {
            **(chunk.get("metadata", {})),
            **(metadata or {}),
        }

        embedding = chunk.get("embedding", [])
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

        if self.use_knowledge_base:
            await self.db_pool.execute(
                """
                INSERT INTO knowledge_base
                    (corpus_id, app_name, content, embedding, source_uri, chunk_index, metadata)
                VALUES
                    ($1, $2, $3, $4::vector, $5, $6, $7)
                """,
                corpus_id,
                self.app_name,
                chunk["content"],
                embedding_str,
                chunk.get("source_uri"),
                chunk.get("chunk_index", 0),
                json.dumps(combined_metadata),
            )
        else:
            # Use memories table for backward compatibility
            await self.db_pool.execute(
                """
                INSERT INTO memories
                    (user_id, app_name, content, embedding, metadata)
                VALUES
                    ($1, $2, $3, $4::vector, $5)
                """,
                "system",  # System user for knowledge base content
                self.app_name,
                chunk["content"],
                embedding_str,
                json.dumps(combined_metadata),
            )

    # ============================================
    # Retrieval Methods
    # ============================================

    async def retrieve(
        self,
        query: str,
        top_k: int = 10,
        corpus_id: Optional[str] = None,
        semantic_weight: float = 0.7,
        keyword_weight: float = 0.3,
    ) -> List[RetrievalResult]:
        """
        Retrieve relevant chunks for a query.

        Args:
            query: Query string
            top_k: Number of results to return
            corpus_id: Corpus ID (uses default if not provided)
            semantic_weight: Weight for semantic search
            keyword_weight: Weight for keyword search

        Returns:
            List of RetrievalResult
        """
        # Generate query embedding
        embedder = self._get_embedder()
        query_embedding = await embedder.embed_query(query)

        if self.db_pool is None:
            # Return mock results for testing
            return self._mock_retrieve(query, top_k)

        corpus_id = corpus_id or self.corpus_id

        # Call hybrid search function
        embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

        if self.use_knowledge_base:
            rows = await self.db_pool.fetch(
                """
                SELECT * FROM kb_hybrid_search($1, $2, $3, $4::vector, $5, $6, $7)
                """,
                corpus_id,
                self.app_name,
                query,
                embedding_str,
                top_k,
                semantic_weight,
                keyword_weight,
            )
        else:
            rows = await self.db_pool.fetch(
                """
                SELECT * FROM hybrid_search($1, $2, $3, $4::vector, $5, $6, $7)
                """,
                "system",
                self.app_name,
                query,
                embedding_str,
                top_k,
                semantic_weight,
                keyword_weight,
            )

        results = []
        for row in rows:
            results.append(
                RetrievalResult(
                    id=str(row["id"]),
                    content=row["content"],
                    score=float(row.get("combined_score", 0)),
                    source_uri=row.get("source_uri"),
                    metadata=row.get("metadata", {}),
                )
            )

        return results

    def _mock_retrieve(self, query: str, top_k: int) -> List[RetrievalResult]:
        """Return mock results for testing without database."""
        return [
            RetrievalResult(
                id=f"mock_{i}",
                content=f"Mock content for query: {query} (result {i})",
                score=1.0 - (i * 0.1),
                source_uri=f"mock_doc_{i}.txt",
            )
            for i in range(min(top_k, 5))
        ]

    # ============================================
    # Generation Methods
    # ============================================

    async def generate(
        self,
        query: str,
        context: List[RetrievalResult],
        system_prompt: Optional[str] = None,
    ) -> str:
        """
        Generate answer using LLM with retrieved context.

        Args:
            query: User query
            context: Retrieved context chunks
            system_prompt: Custom system prompt

        Returns:
            Generated answer string
        """
        if self.llm_client is None:
            # Return mock response for testing
            return self._mock_generate(query, context)

        # Build context string
        context_text = "\n\n".join(f"[Source: {c.source_uri or 'unknown'}]\n{c.content}" for c in context)

        # Default system prompt
        if system_prompt is None:
            system_prompt = """You are a helpful assistant that answers questions based on the provided context.
Always cite your sources using [Source: filename] format.
If the context doesn't contain relevant information, say so honestly."""

        # Build messages
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Context:\n{context_text}\n\nQuestion: {query}",
            },
        ]

        # Call LLM
        response = await self.llm_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
        )

        return response.choices[0].message.content

    def _mock_generate(self, query: str, context: List[RetrievalResult]) -> str:
        """Return mock generation for testing without LLM."""
        sources = ", ".join(c.source_uri or "unknown" for c in context[:3])
        return f"Mock answer for '{query}' based on sources: {sources}"

    # ============================================
    # End-to-End Query
    # ============================================

    async def query(
        self,
        query: str,
        top_k: int = 5,
        corpus_id: Optional[str] = None,
        semantic_weight: float = 0.7,
        keyword_weight: float = 0.3,
        system_prompt: Optional[str] = None,
    ) -> RAGResponse:
        """
        Execute complete RAG query (retrieve + generate).

        Args:
            query: User query
            top_k: Number of context chunks
            corpus_id: Corpus ID
            semantic_weight: Semantic search weight
            keyword_weight: Keyword search weight
            system_prompt: Custom system prompt

        Returns:
            RAGResponse with answer and sources
        """
        start_time = time.perf_counter()

        # Retrieval
        retrieval_start = time.perf_counter()
        sources = await self.retrieve(
            query=query,
            top_k=top_k,
            corpus_id=corpus_id,
            semantic_weight=semantic_weight,
            keyword_weight=keyword_weight,
        )
        retrieval_time = (time.perf_counter() - retrieval_start) * 1000

        # Generation
        generation_start = time.perf_counter()
        answer = await self.generate(
            query=query,
            context=sources,
            system_prompt=system_prompt,
        )
        generation_time = (time.perf_counter() - generation_start) * 1000

        total_time = (time.perf_counter() - start_time) * 1000

        return RAGResponse(
            query=query,
            answer=answer,
            sources=sources,
            retrieval_time_ms=retrieval_time,
            generation_time_ms=generation_time,
            total_time_ms=total_time,
        )


# ============================================
# Factory function
# ============================================


def get_rag_pipeline(
    db_pool=None,
    app_name: str = "default",
    corpus_id: Optional[str] = None,
    embedding_provider: str = "mock",
    use_knowledge_base: bool = True,
    **kwargs,
) -> RAGPipeline:
    """
    Factory function to create a RAGPipeline.

    Args:
        db_pool: Database connection pool
        app_name: Application name
        corpus_id: Default corpus ID
        embedding_provider: Embedding provider type
        use_knowledge_base: Use knowledge_base table
        **kwargs: Additional arguments

    Returns:
        RAGPipeline instance
    """
    from cognizes.engine.perception.ingestion import get_ingester
    from cognizes.engine.perception.embedder import get_embedder

    ingester = get_ingester(embedding_provider=embedding_provider)
    embedder = get_embedder(provider_type=embedding_provider)

    return RAGPipeline(
        db_pool=db_pool,
        ingester=ingester,
        embedder=embedder,
        corpus_id=corpus_id,
        app_name=app_name,
        use_knowledge_base=use_knowledge_base,
    )
