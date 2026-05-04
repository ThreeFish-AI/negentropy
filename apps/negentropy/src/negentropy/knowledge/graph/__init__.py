# Re-exports for backward-compatible imports
# e.g., `from negentropy.knowledge.graph_service import GraphService`
#        `from negentropy.knowledge.graph_algorithms import compute_pagerank`
from .community_summarizer import CommunitySummarizer, CommunitySummary
from .context_builder import GraphContext, GraphContextBuilder
from .entity_resolver import EntityResolver, blocking_key, normalize_label
from .entity_service import KgEntityService
from .extraction_schema import (
    AI_PAPER_SCHEMA,
    EntityTypeSpec,
    ExtractionSchema,
    RelationTypeSpec,
    get_schema,
)
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
from .quality import GraphQualityReport, validate_graph_quality
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
    RegexEntityExtractor,
    RelationExtractor,
)
from .temporal_resolver import TemporalResolver, TemporalVerdict

__all__ = [
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
    # B1: Entity Resolution
    "EntityResolver",
    "normalize_label",
    "blocking_key",
    # B2: Temporal Resolution
    "TemporalResolver",
    "TemporalVerdict",
    # B3: Community Summarization
    "CommunitySummarizer",
    "CommunitySummary",
    # B4: Context Building
    "GraphContextBuilder",
    "GraphContext",
    # Quality Validation
    "GraphQualityReport",
    "validate_graph_quality",
    # Extraction Schema
    "ExtractionSchema",
    "EntityTypeSpec",
    "RelationTypeSpec",
    "AI_PAPER_SCHEMA",
    "get_schema",
]
