from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Annotated, Any, Dict, Iterable, List, Literal, Mapping, Optional, TypeAlias
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationInfo, field_validator, model_validator

from .constants import (
    DEFAULT_CHUNK_SIZE,
    DEFAULT_HIERARCHICAL_CHILD_CHUNK_SIZE,
    DEFAULT_HIERARCHICAL_CHILD_OVERLAP,
    DEFAULT_HIERARCHICAL_PARENT_CHUNK_SIZE,
    DEFAULT_OVERLAP,
    DEFAULT_RECURSIVE_SEPARATORS,
    DEFAULT_SEMANTIC_BUFFER_SIZE,
    DEFAULT_SEMANTIC_MAX_CHUNK_SIZE,
    DEFAULT_SEMANTIC_MIN_CHUNK_SIZE,
    DEFAULT_SEMANTIC_THRESHOLD,
    MAX_OVERLAP_RATIO,
    MIN_CHUNK_SIZE,
)


SearchMode = Literal["semantic", "keyword", "hybrid", "rrf"]
GraphSearchMode = Literal["semantic", "graph", "hybrid"]


class ChunkingStrategy(Enum):
    """分块策略枚举

    定义不同的文本分块策略，用于将长文本分割成适合索引的块。
    """

    FIXED = "fixed"  # 固定大小分块（字符级别）
    RECURSIVE = "recursive"  # 递归分块（段落 > 句子 > 词）
    SEMANTIC = "semantic"  # 语义分块（基于句子相似度）
    HIERARCHICAL = "hierarchical"  # 层次分块（检索子块，返回父块）


@dataclass(frozen=True)
class CorpusSpec:
    """语料库创建规范

    用于创建新的 Corpus 实例。
    """

    app_name: str
    name: str
    description: Optional[str] = None
    config: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class CorpusRecord:
    """语料库记录

    表示已创建的 Corpus 实例，包含所有持久化字段。
    """

    id: UUID
    app_name: str
    name: str
    description: Optional[str]
    config: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class KnowledgeChunk:
    """知识块

    表示待索引的文本分块，包含内容和元数据。
    """

    content: str
    source_uri: Optional[str] = None
    chunk_index: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None


@dataclass(frozen=True)
class KnowledgeRecord:
    """知识记录

    表示已持久化的 Knowledge 实例。
    """

    id: UUID
    corpus_id: UUID
    app_name: str
    content: str
    source_uri: Optional[str]
    chunk_index: int
    metadata: Dict[str, Any]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    embedding: Optional[List[float]] = None


@dataclass(frozen=True)
class SourceSummary:
    """Source 聚合摘要"""

    source_uri: Optional[str]
    display_name: Optional[str]
    count: int
    archived: bool
    source_type: Literal["file", "url", "text", "unknown"]


@dataclass(frozen=True)
class KnowledgeMatch:
    """知识匹配结果

    表示检索返回的单条匹配结果，包含各种分数。
    """

    id: UUID
    content: str
    source_uri: Optional[str]
    metadata: Dict[str, Any]
    semantic_score: float = 0.0
    keyword_score: float = 0.0
    combined_score: float = 0.0


class _ChunkingConfigBase(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class _ChunkingConfigWithOverlap(_ChunkingConfigBase):
    chunk_size: int = DEFAULT_CHUNK_SIZE
    overlap: int = DEFAULT_OVERLAP

    @field_validator("chunk_size")
    @classmethod
    def validate_chunk_size(cls, v: int) -> int:
        if v < MIN_CHUNK_SIZE:
            raise ValueError(f"chunk_size must be at least {MIN_CHUNK_SIZE}, got {v}")
        if v > 100000:
            raise ValueError(f"chunk_size must be at most 100000, got {v}")
        return v

    @field_validator("overlap")
    @classmethod
    def validate_overlap(cls, v: int, info: ValidationInfo) -> int:
        if v < 0:
            raise ValueError(f"overlap must be non-negative, got {v}")
        chunk_size = info.data.get("chunk_size", DEFAULT_CHUNK_SIZE)
        if v >= chunk_size:
            raise ValueError(f"overlap must be less than chunk_size ({chunk_size}), got {v}")
        max_overlap = int(chunk_size * MAX_OVERLAP_RATIO)
        if v > max_overlap:
            raise ValueError(f"overlap ({v}) exceeds {MAX_OVERLAP_RATIO * 100}% of chunk_size ({chunk_size})")
        return v


class _ChunkingConfigWithSeparators(_ChunkingConfigBase):
    preserve_newlines: bool = True
    separators: tuple[str, ...] = Field(default_factory=tuple)

    @field_validator("separators")
    @classmethod
    def validate_separators(cls, v: List[str] | tuple[str, ...]) -> tuple[str, ...]:
        normalized = [item for item in (s.strip() for s in v) if item]
        deduped: List[str] = []
        for item in normalized:
            if item not in deduped:
                deduped.append(item)
        return tuple(deduped)


class FixedChunkingConfig(_ChunkingConfigWithOverlap):
    strategy: Literal[ChunkingStrategy.FIXED] = ChunkingStrategy.FIXED
    preserve_newlines: bool = True


class RecursiveChunkingConfig(_ChunkingConfigWithOverlap, _ChunkingConfigWithSeparators):
    strategy: Literal[ChunkingStrategy.RECURSIVE] = ChunkingStrategy.RECURSIVE
    separators: tuple[str, ...] = DEFAULT_RECURSIVE_SEPARATORS


class SemanticChunkingConfig(_ChunkingConfigBase):
    strategy: Literal[ChunkingStrategy.SEMANTIC] = ChunkingStrategy.SEMANTIC
    semantic_threshold: float = DEFAULT_SEMANTIC_THRESHOLD
    semantic_buffer_size: int = DEFAULT_SEMANTIC_BUFFER_SIZE
    min_chunk_size: int = DEFAULT_SEMANTIC_MIN_CHUNK_SIZE
    max_chunk_size: int = DEFAULT_SEMANTIC_MAX_CHUNK_SIZE

    @field_validator("semantic_threshold")
    @classmethod
    def validate_semantic_threshold(cls, v: float) -> float:
        if not (0.0 <= v <= 1.0):
            raise ValueError(f"semantic_threshold must be between 0 and 1, got {v}")
        return v

    @field_validator("semantic_buffer_size")
    @classmethod
    def validate_semantic_buffer_size(cls, v: int) -> int:
        if v < 1:
            raise ValueError(f"semantic_buffer_size must be at least 1, got {v}")
        if v > 5:
            raise ValueError(f"semantic_buffer_size must be at most 5, got {v}")
        return v

    @field_validator("min_chunk_size")
    @classmethod
    def validate_min_chunk_size(cls, v: int) -> int:
        if v < 1:
            raise ValueError(f"min_chunk_size must be at least 1, got {v}")
        return v

    @field_validator("max_chunk_size")
    @classmethod
    def validate_max_chunk_size(cls, v: int) -> int:
        if v < 100:
            raise ValueError(f"max_chunk_size must be at least 100, got {v}")
        return v

    @model_validator(mode="after")
    def validate_semantic_relationships(self) -> "SemanticChunkingConfig":
        if self.min_chunk_size > self.max_chunk_size:
            raise ValueError(
                f"min_chunk_size ({self.min_chunk_size}) must be <= max_chunk_size ({self.max_chunk_size})"
            )
        return self


class HierarchicalChunkingConfig(_ChunkingConfigWithSeparators):
    strategy: Literal[ChunkingStrategy.HIERARCHICAL] = ChunkingStrategy.HIERARCHICAL
    separators: tuple[str, ...] = DEFAULT_RECURSIVE_SEPARATORS
    hierarchical_parent_chunk_size: int = DEFAULT_HIERARCHICAL_PARENT_CHUNK_SIZE
    hierarchical_child_chunk_size: int = DEFAULT_HIERARCHICAL_CHILD_CHUNK_SIZE
    hierarchical_child_overlap: int = DEFAULT_HIERARCHICAL_CHILD_OVERLAP

    @field_validator(
        "hierarchical_parent_chunk_size",
        "hierarchical_child_chunk_size",
        "hierarchical_child_overlap",
    )
    @classmethod
    def validate_hierarchical_sizes(cls, v: int, info: ValidationInfo) -> int:
        field_name = info.field_name or "hierarchical_size"
        if "overlap" in field_name:
            if v < 0:
                raise ValueError(f"{field_name} must be non-negative, got {v}")
            return v
        if v < 1:
            raise ValueError(f"{field_name} must be at least 1, got {v}")
        if v > 100000:
            raise ValueError(f"{field_name} must be at most 100000, got {v}")
        return v

    @model_validator(mode="after")
    def validate_hierarchical_relationships(self) -> "HierarchicalChunkingConfig":
        if self.hierarchical_parent_chunk_size < self.hierarchical_child_chunk_size:
            raise ValueError("hierarchical_parent_chunk_size must be >= hierarchical_child_chunk_size")
        if self.hierarchical_child_overlap >= self.hierarchical_child_chunk_size:
            raise ValueError("hierarchical_child_overlap must be less than hierarchical_child_chunk_size")
        max_overlap = int(self.hierarchical_child_chunk_size * MAX_OVERLAP_RATIO)
        if self.hierarchical_child_overlap > max_overlap:
            raise ValueError(
                "hierarchical_child_overlap "
                f"({self.hierarchical_child_overlap}) exceeds {MAX_OVERLAP_RATIO * 100}% "
                f"of hierarchical_child_chunk_size ({self.hierarchical_child_chunk_size})"
            )
        return self


ChunkingConfigValue: TypeAlias = Annotated[
    FixedChunkingConfig | RecursiveChunkingConfig | SemanticChunkingConfig | HierarchicalChunkingConfig,
    Field(discriminator="strategy"),
]

_CHUNKING_CONFIG_ADAPTER = TypeAdapter(ChunkingConfigValue)


def create_chunking_config(**data: Any) -> ChunkingConfigValue:
    return _CHUNKING_CONFIG_ADAPTER.validate_python(data)


def ChunkingConfig(**data: Any) -> ChunkingConfigValue:
    if not data:
        return default_chunking_config()
    strategy = data.get("strategy")
    if strategy is None:
        if any(key.startswith("hierarchical_") for key in data):
            strategy = ChunkingStrategy.HIERARCHICAL
        elif any(key in {"semantic_threshold", "semantic_buffer_size", "min_chunk_size", "max_chunk_size"} for key in data):
            strategy = ChunkingStrategy.SEMANTIC
        else:
            strategy = ChunkingStrategy.RECURSIVE
    elif not isinstance(strategy, ChunkingStrategy):
        strategy = ChunkingStrategy(strategy)

    data["strategy"] = strategy
    return create_chunking_config(**data)


def default_chunking_config() -> ChunkingConfigValue:
    return RecursiveChunkingConfig()


def serialize_chunking_config(config: ChunkingConfigValue | None) -> Dict[str, Any]:
    if config is None:
        return {}
    return config.model_dump(mode="json")


def normalize_chunking_config(
    raw: Mapping[str, Any] | ChunkingConfigValue | None,
    *,
    preserve_unknown_strategy_fields: bool = False,
) -> ChunkingConfigValue | None:
    if raw is None:
        return None
    if isinstance(
        raw,
        (FixedChunkingConfig, RecursiveChunkingConfig, SemanticChunkingConfig, HierarchicalChunkingConfig),
    ):
        return raw

    payload = dict(raw)
    strategy = payload.get("strategy", ChunkingStrategy.RECURSIVE)
    if not isinstance(strategy, ChunkingStrategy):
        strategy = ChunkingStrategy(strategy)

    strategy_fields: dict[ChunkingStrategy, set[str]] = {
        ChunkingStrategy.FIXED: {"strategy", "chunk_size", "overlap", "preserve_newlines"},
        ChunkingStrategy.RECURSIVE: {"strategy", "chunk_size", "overlap", "preserve_newlines", "separators"},
        ChunkingStrategy.SEMANTIC: {
            "strategy",
            "semantic_threshold",
            "semantic_buffer_size",
            "min_chunk_size",
            "max_chunk_size",
        },
        ChunkingStrategy.HIERARCHICAL: {
            "strategy",
            "preserve_newlines",
            "separators",
            "hierarchical_parent_chunk_size",
            "hierarchical_child_chunk_size",
            "hierarchical_child_overlap",
        },
    }

    if not preserve_unknown_strategy_fields:
        payload = {key: value for key, value in payload.items() if key in strategy_fields[strategy]}

    payload["strategy"] = strategy
    return create_chunking_config(**payload)


def chunking_config_summary(config: ChunkingConfigValue | None) -> Dict[str, Any]:
    if config is None:
        return {}

    if isinstance(config, FixedChunkingConfig):
        return {
            "strategy": config.strategy.value,
            "chunk_size": config.chunk_size,
            "overlap": config.overlap,
            "preserve_newlines": config.preserve_newlines,
        }

    if isinstance(config, RecursiveChunkingConfig):
        return {
            "strategy": config.strategy.value,
            "chunk_size": config.chunk_size,
            "overlap": config.overlap,
            "preserve_newlines": config.preserve_newlines,
            "separators": list(config.separators),
        }

    if isinstance(config, SemanticChunkingConfig):
        return {
            "strategy": config.strategy.value,
            "semantic_threshold": config.semantic_threshold,
            "semantic_buffer_size": config.semantic_buffer_size,
            "min_chunk_size": config.min_chunk_size,
            "max_chunk_size": config.max_chunk_size,
        }

    return {
        "strategy": config.strategy.value,
        "preserve_newlines": config.preserve_newlines,
        "separators": list(config.separators),
        "hierarchical_parent_chunk_size": config.hierarchical_parent_chunk_size,
        "hierarchical_child_chunk_size": config.hierarchical_child_chunk_size,
        "hierarchical_child_overlap": config.hierarchical_child_overlap,
    }


class SearchConfig(BaseModel):
    """检索配置

    控制搜索行为，包括模式、限制和权重。

    支持的检索模式:
    - "semantic": 纯语义检索 (向量相似度)
    - "keyword": 纯关键词检索 (BM25)
    - "hybrid": 加权融合检索 (semantic_weight * semantic_score + keyword_weight * keyword_score)
    - "rrf": RRF 融合检索 (Reciprocal Rank Fusion，对分数尺度不敏感)

    RRF 模式参考文献:
    [1] Y. Wang et al., "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods,"
        SIGIR'18, 2018.
    """

    model_config = ConfigDict(frozen=True)

    mode: SearchMode = "hybrid"
    limit: int = 20
    semantic_weight: float = 0.7
    keyword_weight: float = 0.3
    metadata_filter: Optional[Dict[str, Any]] = None
    rrf_k: int = 60  # RRF 平滑常数，仅用于 "rrf" 模式

    @field_validator("limit")
    @classmethod
    def validate_limit(cls, v: int) -> int:
        """验证结果限制

        确保 limit 为正数且在合理范围内。
        """
        if v < 1:
            raise ValueError(f"limit must be at least 1, got {v}")
        if v > 1000:
            raise ValueError(f"limit must be at most 1000, got {v}")
        return v

    @field_validator("semantic_weight", "keyword_weight")
    @classmethod
    def validate_weights(cls, v: float) -> float:
        """验证权重值

        确保权重在 [0, 1] 范围内。
        """
        if not (0.0 <= v <= 1.0):
            raise ValueError(f"weight must be between 0 and 1, got {v}")
        return v

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        """验证搜索模式

        确保模式为支持的值之一。
        """
        if v not in ("semantic", "keyword", "hybrid", "rrf"):
            raise ValueError(f"mode must be 'semantic', 'keyword', 'hybrid', or 'rrf', got {v}")
        return v

    @field_validator("rrf_k")
    @classmethod
    def validate_rrf_k(cls, v: int) -> int:
        """验证 RRF 平滑常数

        确保值为正数。
        """
        if v < 1:
            raise ValueError(f"rrf_k must be at least 1, got {v}")
        return v


# ============================================================================
# Search Result Merge Utilities
# ============================================================================


def merge_search_results(
    semantic_matches: "Iterable[KnowledgeMatch]",
    keyword_matches: "Iterable[KnowledgeMatch]",
    *,
    semantic_weight: float,
    keyword_weight: float,
    limit: int,
) -> "list[KnowledgeMatch]":
    """融合语义和关键词检索结果

    纯函数，供 KnowledgeService 和 KnowledgeRepository 复用。

    策略:
    1. 以 semantic_matches 为基础构建合并字典
    2. 合并 keyword_matches 的分数
    3. 重新计算 combined_score = semantic_score * w_s + keyword_score * w_k
    4. 按 combined_score 降序排列并返回前 limit 条
    """
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

    for match in keyword_matches:
        existing = merged.get(match.id)
        if existing:
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
            merged[match.id] = KnowledgeMatch(
                id=match.id,
                content=match.content,
                source_uri=match.source_uri,
                metadata=match.metadata,
                semantic_score=0.0,
                keyword_score=match.keyword_score,
                combined_score=0.0,
            )

    recomputed: list[KnowledgeMatch] = []
    for match in merged.values():
        combined_score = match.semantic_score * semantic_weight + match.keyword_score * keyword_weight
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

    ordered = sorted(recomputed, key=lambda item: item.combined_score, reverse=True)
    return ordered[:limit]


# ============================================================================
# Knowledge Graph Types
# ============================================================================


class KgEntityType(Enum):
    """知识图谱实体类型

    定义支持的实体类型，用于分类和筛选。
    """

    PERSON = "person"  # 人物
    ORGANIZATION = "organization"  # 组织/公司
    LOCATION = "location"  # 地点
    EVENT = "event"  # 事件
    CONCEPT = "concept"  # 概念/术语
    PRODUCT = "product"  # 产品
    DOCUMENT = "document"  # 文档
    OTHER = "other"  # 其他

    @classmethod
    def all_values(cls) -> List[str]:
        """获取所有实体类型值列表"""
        return [e.value for e in cls]


class KgRelationType(Enum):
    """知识图谱关系类型

    定义支持的实体间关系类型。
    """

    # 组织关系
    WORKS_FOR = "WORKS_FOR"  # 就职于
    PART_OF = "PART_OF"  # 隶属于
    LOCATED_IN = "LOCATED_IN"  # 位于

    # 语义关系
    RELATED_TO = "RELATED_TO"  # 相关
    SIMILAR_TO = "SIMILAR_TO"  # 相似
    DERIVED_FROM = "DERIVED_FROM"  # 衍生自

    # 因果关系
    CAUSES = "CAUSES"  # 导致
    PRECEDES = "PRECEDES"  # 先于
    FOLLOWS = "FOLLOWS"  # 后于

    # 引用关系
    MENTIONS = "MENTIONS"  # 提及
    CREATED_BY = "CREATED_BY"  # 创建者

    # 共现关系（回退）
    CO_OCCURS = "CO_OCCURS"  # 共现

    @classmethod
    def all_values(cls) -> List[str]:
        """获取所有关系类型值列表"""
        return [e.value for e in cls]


@dataclass(frozen=True)
class GraphNode:
    """知识图谱节点

    表示知识图谱中的一个实体节点。
    """

    id: str
    label: Optional[str] = None
    node_type: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class GraphEdge:
    """知识图谱边

    表示知识图谱中两个节点之间的关系。
    """

    source: str
    target: str
    label: Optional[str] = None
    edge_type: Optional[str] = None
    weight: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class KnowledgeGraphPayload:
    """知识图谱数据结构

    包含节点和边的完整图谱数据。
    """

    nodes: List[GraphNode]
    edges: List[GraphEdge]
    runs: Optional[List[Dict[str, Any]]] = None


@dataclass(frozen=True)
class GraphSearchMatch:
    """图谱检索结果

    包含实体信息、相似度分数和图结构分数。
    """

    entity: GraphNode
    semantic_score: float = 0.0
    graph_score: float = 0.0
    combined_score: float = 0.0
    neighbors: List[GraphNode] = field(default_factory=list)
    path: Optional[List[str]] = None


class GraphSearchConfig(BaseModel):
    """图谱检索配置

    控制图谱检索和遍历的行为。
    """

    model_config = ConfigDict(frozen=True)

    mode: GraphSearchMode = "hybrid"
    max_depth: int = 2
    limit: int = 100
    semantic_weight: float = 0.6
    graph_weight: float = 0.4
    include_neighbors: bool = True
    neighbor_limit: int = 10
    entity_type_filter: Optional[str] = None

    @field_validator("max_depth")
    @classmethod
    def validate_max_depth(cls, v: int) -> int:
        """验证最大深度"""
        if v < 1:
            raise ValueError(f"max_depth must be at least 1, got {v}")
        if v > 5:
            raise ValueError(f"max_depth must be at most 5, got {v}")
        return v

    @field_validator("limit")
    @classmethod
    def validate_limit(cls, v: int) -> int:
        """验证结果限制"""
        if v < 1:
            raise ValueError(f"limit must be at least 1, got {v}")
        if v > 1000:
            raise ValueError(f"limit must be at most 1000, got {v}")
        return v

    @field_validator("semantic_weight", "graph_weight")
    @classmethod
    def validate_weights(cls, v: float) -> float:
        """验证权重值"""
        if not (0.0 <= v <= 1.0):
            raise ValueError(f"weight must be between 0 and 1, got {v}")
        return v

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        """验证搜索模式"""
        if v not in ("semantic", "graph", "hybrid"):
            raise ValueError(f"mode must be 'semantic', 'graph', or 'hybrid', got {v}")
        return v


class GraphBuildConfigModel(BaseModel):
    """图谱构建配置

    控制实体和关系提取的行为。
    """

    model_config = ConfigDict(frozen=True)

    enable_llm_extraction: bool = True
    llm_model: Optional[str] = None
    entity_types: tuple[str, ...] = Field(default_factory=tuple)
    relation_types: tuple[str, ...] = Field(default_factory=tuple)
    min_entity_confidence: float = 0.5
    min_relation_confidence: float = 0.5
    batch_size: int = 10
    max_concurrency: int = 3

    @field_validator("min_entity_confidence", "min_relation_confidence")
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        """验证置信度阈值"""
        if not (0.0 <= v <= 1.0):
            raise ValueError(f"confidence must be between 0 and 1, got {v}")
        return v

    @field_validator("batch_size")
    @classmethod
    def validate_batch_size(cls, v: int) -> int:
        """验证批次大小"""
        if v < 1:
            raise ValueError(f"batch_size must be at least 1, got {v}")
        if v > 100:
            raise ValueError(f"batch_size must be at most 100, got {v}")
        return v

    @field_validator("max_concurrency")
    @classmethod
    def validate_max_concurrency(cls, v: int) -> int:
        """验证最大并发数"""
        if v < 1:
            raise ValueError(f"max_concurrency must be at least 1, got {v}")
        if v > 10:
            raise ValueError(f"max_concurrency must be at most 10, got {v}")
        return v

    @field_validator("entity_types", "relation_types")
    @classmethod
    def validate_graph_type_filters(cls, v: List[str] | tuple[str, ...]) -> tuple[str, ...]:
        normalized = [item for item in (s.strip() for s in v) if item]
        deduped: List[str] = []
        for item in normalized:
            if item not in deduped:
                deduped.append(item)
        return tuple(deduped)
