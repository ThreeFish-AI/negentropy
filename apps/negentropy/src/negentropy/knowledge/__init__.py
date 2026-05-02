from .graph import (
    AgeGraphRepository,
    BuildRunRecord,
    CompositeEntityExtractor,
    CompositeRelationExtractor,
    EntityExtractionResult,
    EntityRecord,
    GraphBuildResult,
    GraphProcessor,
    GraphQueryResult,
    GraphRepository,
    GraphSearchResult,
    GraphService,
    KgEntityService,
    LLMEntityExtractor,
    LLMRelationExtractor,
    RelationExtractionResult,
    RelationRecord,
    get_graph_repository,
    get_graph_service,
)
from .ingestion.chunking import chunk_text, semantic_chunk_async
from .retrieval.repository import KnowledgeRepository
from .retrieval.reranking import (
    APIReranker,
    CompositeReranker,
    LocalReranker,
    NoopReranker,
    RerankConfig,
    Reranker,
    create_default_reranker,
)
from .service import KnowledgeService
from .types import (
    ChunkingConfig,
    ChunkingStrategy,
    CorpusRecord,
    CorpusSpec,
    GraphBuildConfig,
    GraphEdge,
    GraphNode,
    GraphQueryConfig,
    KgEntityType,
    KgRelationType,
    KnowledgeChunk,
    KnowledgeGraphPayload,
    KnowledgeMatch,
    KnowledgeRecord,
    SearchConfig,
    infer_source_type,
    merge_search_results,
    normalize_source_metadata,
)

# Backward-compatible aliases (deprecated)
GraphBuildConfigModel = GraphBuildConfig
GraphSearchConfig = GraphQueryConfig

__all__ = [
    "chunk_text",
    "semantic_chunk_async",
    "KnowledgeRepository",
    "KnowledgeService",
    "GraphProcessor",
    "ChunkingConfig",
    "ChunkingStrategy",
    "CorpusRecord",
    "CorpusSpec",
    "KnowledgeChunk",
    "KnowledgeMatch",
    "KnowledgeRecord",
    "SearchConfig",
    "infer_source_type",
    "normalize_source_metadata",
    "merge_search_results",
    # Graph types
    "GraphNode",
    "GraphEdge",
    "KnowledgeGraphPayload",
    "KgEntityType",
    "KgRelationType",
    "GraphQueryConfig",
    "GraphBuildConfig",
    # Backward-compatible aliases (deprecated)
    "GraphSearchConfig",
    "GraphBuildConfigModel",
    # Graph repository
    "GraphRepository",
    "AgeGraphRepository",
    "get_graph_repository",
    "EntityRecord",
    "RelationRecord",
    "GraphSearchResult",
    "BuildRunRecord",
    # Graph service
    "GraphService",
    "get_graph_service",
    "GraphBuildResult",
    "GraphQueryResult",
    # LLM extractors
    "LLMEntityExtractor",
    "LLMRelationExtractor",
    "CompositeEntityExtractor",
    "CompositeRelationExtractor",
    "EntityExtractionResult",
    "RelationExtractionResult",
    # Entity service
    "KgEntityService",
    # Reranking exports
    "Reranker",
    "RerankConfig",
    "LocalReranker",
    "APIReranker",
    "NoopReranker",
    "CompositeReranker",
    "create_default_reranker",
]
