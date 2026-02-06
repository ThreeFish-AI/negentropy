from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import FieldValidationInfo, field_validator

from .constants import (
    MAX_OVERLAP_RATIO,
    MIN_CHUNK_SIZE,
)


SearchMode = Literal["semantic", "keyword", "hybrid", "rrf"]


class ChunkingStrategy(Enum):
    """分块策略枚举

    定义不同的文本分块策略，用于将长文本分割成适合索引的块。
    """
    FIXED = "fixed"         # 固定大小分块（字符级别）
    RECURSIVE = "recursive" # 递归分块（段落 > 句子 > 词）
    SEMANTIC = "semantic"   # 语义分块（基于句子相似度）


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


@dataclass(frozen=True)
class ChunkingConfig:
    """分块配置

    控制文本如何被分割成可索引的块。

    支持三种分块策略:
    - "fixed": 固定大小分块（字符级别），简单高效
    - "recursive": 递归分块（段落 > 句子 > 词），保持结构
    - "semantic": 语义分块（基于句子相似度），保持语义完整性

    语义分块参考文献:
    [1] G. Kamalloo and A. K. G., "Semantic Chunking for RAG Applications," 2024.
    [2] LlamaIndex, "Semantic Chunking," GitHub, 2024.
    """
    strategy: ChunkingStrategy = ChunkingStrategy.RECURSIVE
    chunk_size: int = 800
    overlap: int = 100
    preserve_newlines: bool = True
    # 语义分块专用参数
    semantic_threshold: float = 0.85  # 相似度阈值，低于此值时切分
    min_chunk_size: int = 50          # 最小块大小（字符数）
    max_chunk_size: int = 2000        # 最大块大小（字符数），用于滑动窗口合并

    @field_validator("strategy")
    @classmethod
    def validate_strategy(cls, v: ChunkingStrategy | str) -> ChunkingStrategy:
        """验证分块策略"""
        if isinstance(v, ChunkingStrategy):
            return v
        try:
            return ChunkingStrategy(v)
        except ValueError:
            raise ValueError(
                f"strategy must be one of {[s.value for s in ChunkingStrategy]}, got {v}"
            )

    @field_validator("chunk_size")
    @classmethod
    def validate_chunk_size(cls, v: int) -> int:
        """验证分块大小

        确保 chunk_size 为正数且在合理范围内。
        """
        if v < MIN_CHUNK_SIZE:
            raise ValueError(f"chunk_size must be at least {MIN_CHUNK_SIZE}, got {v}")
        if v > 100000:  # 100K 字符上限
            raise ValueError(f"chunk_size must be at most 100000, got {v}")
        return v

    @field_validator("overlap")
    @classmethod
    def validate_overlap(cls, v: int, info: FieldValidationInfo) -> int:
        """验证重叠大小

        确保 overlap 为非负数且小于 chunk_size。
        """
        if v < 0:
            raise ValueError(f"overlap must be non-negative, got {v}")

        # 获取 chunk_size 的值（如果可用）
        chunk_size = info.data.get("chunk_size", 800)
        if v >= chunk_size:
            raise ValueError(
                f"overlap must be less than chunk_size ({chunk_size}), got {v}"
            )

        # 验证重叠比例
        max_overlap = int(chunk_size * MAX_OVERLAP_RATIO)
        if v > max_overlap:
            raise ValueError(
                f"overlap ({v}) exceeds {MAX_OVERLAP_RATIO * 100}% of chunk_size ({chunk_size})"
            )

        return v

    @field_validator("semantic_threshold")
    @classmethod
    def validate_semantic_threshold(cls, v: float) -> float:
        """验证语义相似度阈值"""
        if not (0.0 <= v <= 1.0):
            raise ValueError(f"semantic_threshold must be between 0 and 1, got {v}")
        return v

    @field_validator("min_chunk_size")
    @classmethod
    def validate_min_chunk_size(cls, v: int) -> int:
        """验证最小块大小"""
        if v < 1:
            raise ValueError(f"min_chunk_size must be at least 1, got {v}")
        return v

    @field_validator("max_chunk_size")
    @classmethod
    def validate_max_chunk_size(cls, v: int) -> int:
        """验证最大块大小"""
        if v < 100:
            raise ValueError(f"max_chunk_size must be at least 100, got {v}")
        return v


@dataclass(frozen=True)
class SearchConfig:
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
# Knowledge Graph Types
# ============================================================================

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
