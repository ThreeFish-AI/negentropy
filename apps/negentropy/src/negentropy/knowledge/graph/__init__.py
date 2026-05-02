# Re-exports for backward-compatible imports
# e.g., `from negentropy.knowledge.graph_service import GraphService`
#        `from negentropy.knowledge.graph_algorithms import compute_pagerank`
from .entity_service import KgEntityService
from .extractors import (
    CompositeEntityExtractor,
    CompositeRelationExtractor,
    EntityExtractionResult,
    LLMEntityExtractor,
    LLMRelationExtractor,
    RelationExtractionResult,
)
from .graph_algorithms import (
    compute_louvain,
    compute_pagerank,
    export_graph_to_networkx,
)
from .repository import (
    AgeGraphRepository,
    BuildRunRecord,
    EntityRecord,
    GraphRepository,
    GraphSearchResult,
    RelationRecord,
    get_graph_repository,
)
from .service import (
    GraphBuildResult,
    GraphQueryResult,
    GraphService,
    get_graph_service,
)
from .strategy import (
    CooccurrenceRelationExtractor,
    EntityExtractor,
    GraphProcessor,
    RegexEntityExtractor,
    RelationExtractor,
)

__all__ = [
    "GraphProcessor",
    "EntityExtractor",
    "RelationExtractor",
    "RegexEntityExtractor",
    "CooccurrenceRelationExtractor",
    # Service
    "GraphService",
    "get_graph_service",
    "GraphBuildResult",
    "GraphQueryResult",
    # Repository
    "GraphRepository",
    "AgeGraphRepository",
    "get_graph_repository",
    "EntityRecord",
    "RelationRecord",
    "GraphSearchResult",
    "BuildRunRecord",
    # Extractors
    "LLMEntityExtractor",
    "LLMRelationExtractor",
    "CompositeEntityExtractor",
    "CompositeRelationExtractor",
    "EntityExtractionResult",
    "RelationExtractionResult",
    # Entity service
    "KgEntityService",
    # Algorithms
    "export_graph_to_networkx",
    "compute_pagerank",
    "compute_louvain",
]
