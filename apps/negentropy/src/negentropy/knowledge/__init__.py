from .chunking import chunk_text, semantic_chunk_async
from .graph import GraphProcessor
from .graph_repository import (
    AgeGraphRepository,
    BuildRunRecord,
    EntityRecord,
    GraphRepository,
    GraphSearchResult,
    RelationRecord,
    get_graph_repository,
)
from .graph_service import (
    GraphBuildResult,
    GraphService,
    GraphQueryResult,
    get_graph_service,
)
from .llm_extractors import (
    CompositeEntityExtractor,
    CompositeRelationExtractor,
    EntityExtractionResult,
    LLMEntityExtractor,
    LLMRelationExtractor,
    RelationExtractionResult,
)
from .reranking import (
    APIReranker,
    CompositeReranker,
    LocalReranker,
    NoopReranker,
    Reranker,
    RerankConfig,
    create_default_reranker,
)
from .repository import KnowledgeRepository
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
    KnowledgeChunk,
    KnowledgeGraphPayload,
    KnowledgeMatch,
    KnowledgeRecord,
    KgEntityType,
    KgRelationType,
    SearchConfig,
    infer_source_type,
    normalize_source_metadata,
    merge_search_results,
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
    # Reranking exports
    "Reranker",
    "RerankConfig",
    "LocalReranker",
    "APIReranker",
    "NoopReranker",
    "CompositeReranker",
    "create_default_reranker",
]
