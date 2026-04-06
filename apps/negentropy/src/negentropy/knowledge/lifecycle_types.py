"""
文档生命周期管理 — 类型定义

定义文档来源追踪、目录编目、Wiki 发布、知识图谱增强等模块
使用的 frozen dataclass 类型，遵循现有 types.py 的设计模式。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID


# =============================================================================
# Phase 2: 来源追踪类型
# =============================================================================


class SourceKind(Enum):
    """文档来源类型枚举（与 extraction.py 的 SourceKind 对齐）"""

    URL = "url"
    FILE_PDF = "file_pdf"
    FILE_GENERIC = "file_generic"
    TEXT_INPUT = "text_input"


@dataclass(frozen=True)
class DocSourceRecord:
    """文档来源记录"""

    id: UUID
    document_id: UUID
    source_type: str  # SourceKind value
    source_url: Optional[str] = None
    original_url: Optional[str] = None
    title: Optional[str] = None
    author: Optional[str] = None
    extracted_summary: Optional[str] = None
    extraction_duration_ms: Optional[int] = None
    extracted_at: Optional[datetime] = None
    extractor_tool_name: Optional[str] = None
    extractor_server_id: Optional[str] = None
    raw_metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# =============================================================================
# Phase 3: 目录编目类型
# =============================================================================


class CatalogNodeType(Enum):
    """目录节点类型"""

    CATEGORY = "category"       # 纯分类容器
    COLLECTION = "collection"   # 有序集合
    DOCUMENT_REF = "document_ref"  # 文档引用叶子节点


@dataclass(frozen=True)
class CatalogNodeRecord:
    """目录节点记录"""

    id: UUID
    corpus_id: UUID
    parent_id: Optional[UUID]
    name: str
    slug: str
    node_type: str  # CatalogNodeType value
    description: Optional[str] = None
    sort_order: int = 0
    config: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # 展开字段（非 DB 列）
    depth: int = 0
    children_count: int = 0
    document_count: int = 0


@dataclass(frozen=True)
class CatalogTreeItem:
    """目录树扁平化项（用于前端树形组件）"""

    id: UUID
    parent_id: Optional[UUID]
    name: str
    slug: str
    node_type: str
    sort_order: int
    depth: int
    path: str = ""  # 完整路径 /parent/child/current
    has_children: bool = False
    document_count: int = 0


@dataclass(frozen=True)
class CategorySuggestion:
    """LLM 自动分类建议"""

    node_id: Optional[UUID]
    node_name: str
    confidence: float
    reason: str = ""


# =============================================================================
# Phase 4: Wiki 发布类型
# =============================================================================


class WikiStatus(Enum):
    """Wiki 发布状态"""

    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class WikiTheme(Enum):
    """Wiki 主题"""

    DEFAULT = "default"   # Notion/Vercel 风格
    BOOK = "book"         # GitBook 风格
    DOCS = "docs"         # Docusaurus 风格


@dataclass(frozen=True)
class WikiPublicationRecord:
    """Wiki 发布记录"""

    id: UUID
    corpus_id: UUID
    name: str
    slug: str
    description: Optional[str]
    status: str  # WikiStatus value
    theme: str   # WikiTheme value
    navigation_config: Dict[str, Any] = field(default_factory=dict)
    version: int = 1
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass(frozen=True)
class WikiEntryRecord:
    """Wiki 条目记录"""

    id: UUID
    publication_id: UUID
    document_id: UUID
    entry_slug: str
    entry_title: Optional[str]
    is_index_page: bool = False
    entry_order: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass(frozen=True)
class WikiNavTreeNode:
    """Wiki 导航树节点"""

    slug: str
    title: str
    entries: List[WikiNavTreeNode] = field(default_factory=list)


@dataclass(frozen=True)
class WikiPageData:
    """Wiki 页面渲染数据"""

    publication: WikiPublicationRecord
    entry: WikiEntryRecord
    markdown_content: str
    nav_tree: List[WikiNavTreeNode] = field(default_factory=list)
    toc_items: List[Dict[str, Any]] = field(default_factory=list)  # [{id, title, level}]


# =============================================================================
# Phase 5: 知识图谱增强类型
# =============================================================================


@dataclass(frozen=True)
class EntityTimelineEvent:
    """实体时间线事件"""

    timestamp: datetime
    event_type: str  # first_seen | mention_count_increase | relation_added | relation_removed
    source_document: Optional[str] = None
    context: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class RelationSnapshot:
    """关系快照（用于演化追踪）"""

    observed_at: datetime
    confidence: float
    observation_count: int
    evidence_texts: List[str] = field(default_factory=list)
    weight: float = 1.0


@dataclass(frozen=True)
class EnhancedGraphNode:
    """增强的图谱节点（继承 GraphNode + 扩展字段）"""

    id: str
    label: Optional[str] = None
    node_type: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    # 扩展字段
    mention_count: int = 0
    source_count: int = 0
    description: Optional[str] = None
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    aliases: List[str] = field(default_factory=list)
    confidence: float = 1.0


@dataclass(frozen=True)
class EnhancedGraphEdge:
    """增强的图谱边"""

    source: str
    target: str
    label: Optional[str] = None
    edge_type: Optional[str] = None
    weight: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    # 扩展字段
    observation_count: int = 0
    first_observed: Optional[datetime] = None
    last_observed: Optional[datetime] = None
    evidence_texts: List[str] = field(default_factory=list)
    confidence: float = 1.0


# =============================================================================
# Phase 5: 统一检索类型
# =============================================================================


class QueryIntent(Enum):
    """查询意图分类"""

    FACTUAL = "factual"           # "What is X?" → semantic preferred
    EXPLORATORY = "exploratory"     # "Tell me about Y" → hybrid broad
    COMPARATIVE = "comparative"     # "X vs Y" → keyword + semantic
    NAVIGATIONAL = "navigational"   # "Find doc about Z" → keyword exact
    OPERATIONAL = "operational"     # Code/config lookup → keyword strict
    GRAPH_QUERY = "graph_query"     # "Who works for X?" → graph_hybrid


@dataclass(frozen=True)
class CitationInfo:
    """引用信息"""

    document_title: str
    document_filename: Optional[str] = None
    source_url: Optional[str] = None
    page_range: Optional[str] = None
    published_date: Optional[str] = None
    authors: List[str] = field(default_factory=list)
    access_path: str = ""  # URL or GCS URI to original


@dataclass(frozen=True)
class UnifiedSearchResultItem:
    """统一检索结果条目"""

    id: UUID
    content: str
    snippet: str  # 高亮摘要
    corpus_id: UUID
    corpus_name: str
    source_uri: Optional[str] = None
    source_type: Optional[str] = None
    document_id: Optional[UUID] = None
    document_title: Optional[str] = None
    # 排名可解释性
    scores: Dict[str, float] = field(default_factory=dict)
    score_explanation: Optional[str] = None
    # 引用与图谱
    citation: Optional[CitationInfo] = None
    related_entities: Optional[List[Dict[str, Any]]] = None
    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    matched_fields: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class CorpusQualityMetrics:
    """语料库质量评估结果"""

    score: float                          # 总分 0-1
    coverage_score: float                 # 域覆盖广度
    freshness_score: float                 # 内容新鲜度
    diversity_score: float                # 来源多样性
    density_score: float                  # 信息密度
    embedding_coverage: float             # 嵌入覆盖率
    entity_density: float                 # 实体密度（图谱丰富度）
    detail: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class CorpusVersionRecord:
    """语料版本记录"""

    id: UUID
    corpus_id: UUID
    version_number: int
    document_count: int
    chunk_count: int
    quality_score: Optional[float]
    trigger_type: str
    status: str
    diff_summary: Optional[Dict[str, Any]]
    created_at: Optional[datetime] = None
