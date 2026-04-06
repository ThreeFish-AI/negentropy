"""
文档生命周期管理 — Pydantic API Schema 定义

定义所有新增模块的请求/响应模型，遵循现有 schemas.py 的设计模式。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# =============================================================================
# Phase 2: 来源追踪 Schemas
# =============================================================================


class DocSourceResponse(BaseModel):
    """来源记录响应"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID
    source_type: str
    source_url: Optional[str] = None
    original_url: Optional[str] = None
    title: Optional[str] = None
    author: Optional[str] = None
    extracted_summary: Optional[str] = None
    extraction_duration_ms: Optional[int] = None
    extracted_at: Optional[datetime] = None
    extractor_tool_name: Optional[str] = None
    extractor_server_id: Optional[str] = None
    raw_metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DocSourceListResponse(BaseModel):
    """来源列表响应"""

    items: List[DocSourceResponse]
    total: int
    offset: int
    limit: int


class DocumentProvenanceResponse(BaseModel):
    """文档溯源响应（文档 + 来源信息聚合）"""

    document_id: UUID
    filename: str
    file_hash: str
    content_type: Optional[str] = None
    status: str
    markdown_extract_status: str
    # 来源信息
    source: Optional[DocSourceResponse] = None


# =============================================================================
# Phase 3: 目录编目 Schemas
# =============================================================================


class CatalogNodeCreateRequest(BaseModel):
    """创建目录节点请求"""

    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    parent_id: Optional[UUID] = None
    node_type: str = "category"  # category | collection | document_ref
    description: Optional[str] = None
    sort_order: int = 0
    config: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("node_type")
    @classmethod
    def validate_node_type(cls, v: str) -> str:
        allowed = {"category", "collection", "document_ref"}
        if v not in allowed:
            raise ValueError(f"node_type must be one of {allowed}, got '{v}'")
        return v


class CatalogNodeUpdateRequest(BaseModel):
    """更新目录节点请求"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    parent_id: Optional[UUID] = None
    node_type: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    config: Optional[Dict[str, Any]] = None


class CatalogNodeResponse(BaseModel):
    """目录节点响应"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    corpus_id: UUID
    parent_id: Optional[UUID]
    name: str
    slug: str
    node_type: str
    description: Optional[str] = None
    sort_order: int
    config: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # 展开字段
    depth: int = 0
    children_count: int = 0
    document_count: int = 0


class CatalogTreeResponse(BaseModel):
    """目录树响应（扁平化列表）"""

    tree: List[CatalogNodeResponse]
    total_nodes: int
    max_depth: int


class AssignDocumentRequest(BaseModel):
    """归类文档请求"""

    document_ids: List[UUID] = Field(..., min_length=1)


class CategorySuggestionResponse(BaseModel):
    """分类建议响应"""

    document_id: UUID
    suggestions: List[Dict[str, Any]] = Field(default_factory=list)
    # [{"node_id": uuid, "node_name": str, "confidence": float, "reason": str}]


# =============================================================================
# Phase 4: Wiki 发布 Schemas
# =============================================================================


class WikiPublicationCreateRequest(BaseModel):
    """创建 Wiki 发布请求"""

    corpus_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    theme: str = "default"  # default | book | docs

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, v: str) -> str:
        allowed = {"default", "book", "docs"}
        if v not in allowed:
            raise ValueError(f"theme must be one of {allowed}, got '{v}'")
        return v


class WikiPublicationUpdateRequest(BaseModel):
    """更新 Wiki 发布请求"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    theme: Optional[str] = None
    navigation_config: Optional[Dict[str, Any]] = None
    custom_css: Optional[str] = None
    custom_js: Optional[str] = None


class WikiPublicationResponse(BaseModel):
    """Wiki 发布响应"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    corpus_id: UUID
    name: str
    slug: str
    description: Optional[str]
    status: str
    theme: str
    navigation_config: Dict[str, Any] = Field(default_factory=dict)
    version: int
    published_at: Optional[datetime]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    # 展开字段
    entries_count: int = 0


class WikiPublicationListResponse(BaseModel):
    """Wiki 发布列表响应"""

    items: List[WikiPublicationResponse]
    total: int


class WikiEntryResponse(BaseModel):
    """Wiki 条目响应"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    publication_id: UUID
    document_id: UUID
    entry_slug: str
    entry_title: Optional[str]
    is_index_page: bool
    entry_order: Optional[str]
    created_at: Optional[datetime]


class WikiEntryContentResponse(BaseModel):
    """Wiki 条目内容响应（含 Markdown）"""

    entry_id: UUID
    document_id: UUID
    entry_slug: str
    entry_title: Optional[str]
    markdown_content: Optional[str] = None
    document_filename: str = ""


class WikiNavTreeResponse(BaseModel):
    """Wiki 导航树响应"""

    publication_id: UUID
    nav_tree: Dict[str, Any]  # 嵌套树结构


class WikiPublishActionResponse(BaseModel):
    """发布操作响应"""

    publication_id: UUID
    status: str
    version: int
    published_at: Optional[datetime]
    entries_count: int
    message: str


# =============================================================================
# Phase 5: 统一检索 Schemas
# =============================================================================


class UnifiedSearchRequest(BaseModel):
    """通用检索请求"""

    app_name: Optional[str] = None
    query: str = Field(..., min_length=1, max_length=1000)
    mode: str = "auto"  # auto | semantic | keyword | hybrid | rrf | graph_hybrid
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)

    # 分面过滤
    corpus_ids: Optional[List[UUID]] = None
    corpus_names: Optional[List[str]] = None
    source_types: Optional[List[str]] = None
    entity_types: Optional[List[str]] = None
    date_range: Optional[List[str]] = None  # [from_date, to_date] ISO format
    tags: Optional[List[str]] = None
    min_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    custom_metadata_filter: Optional[Dict[str, Any]] = None

    # 搜索调优
    semantic_weight: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    keyword_weight: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    rerank_enabled: bool = True
    rerank_top_k: int = Field(default=10, ge=1, le=50)

    # 上下文感知
    conversation_history: Optional[List[Dict[str, Any]]] = None
    session_id: Optional[str] = None
    agent_id: Optional[str] = None

    # 扩展选项
    include_citations: bool = False
    include_related_entities: bool = False

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        allowed = {"auto", "semantic", "keyword", "hybrid", "rrf", "graph_hybrid"}
        if v not in allowed:
            raise ValueError(f"mode must be one of {allowed}, got '{v}'")
        return v


class UnifiedSearchResponse(BaseModel):
    """通用检索响应"""

    query: str
    mode_used: str
    total_matches: int
    total_estimated: int
    facets: Dict[str, Dict[str, int]] = Field(default_factory=dict)
    results: List[Dict[str, Any]] = Field(default_factory=list)  # UnifiedSearchResultItem dict
    query_time_ms: float = 0.0
    suggestions: Optional[List[str]] = None


class FacetValue(BaseModel):
    """分面值"""

    value: str
    count: int
    selected: bool = False


class FacetResponse(BaseModel):
    """分面可用值响应"""

    facets: Dict[str, List[FacetValue]]


class TrendingRequest(BaseModel):
    """趋势查询请求"""

    app_name: Optional[str] = None
    corpus_ids: Optional[List[UUID]] = None
    period: str = "7d"  # 24h | 7d | 30d | 90d
    limit: int = Field(default=10, ge=1, le=50)
    metric: str = "retrieval_count"  # retrieval_count | feedback_positive | click_through


class TrendingItem(BaseModel):
    """趋势条目"""

    knowledge_id: UUID
    content_preview: str
    corpus_name: str
    metric_value: float
    trend_direction: str  # up | down | stable


# =============================================================================
# Phase 5: 语料质量与版本 Schemas
# =============================================================================


class CorpusQualityResponse(BaseModel):
    """语料质量评估响应"""

    corpus_id: UUID
    score: float
    coverage_score: float
    freshness_score: float
    diversity_score: float
    density_score: float
    embedding_coverage: float
    entity_density: float
    detail: Dict[str, Any] = Field(default_factory=dict)
    assessed_at: Optional[datetime] = None


class CorpusVersionResponse(BaseModel):
    """语料版本响应"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    corpus_id: UUID
    version_number: int
    document_count: int
    chunk_count: int
    quality_score: Optional[float]
    trigger_type: str
    status: str
    diff_summary: Optional[Dict[str, Any]]
    build_run_id: Optional[str]
    created_at: Optional[datetime]


class CorpusVersionListResponse(BaseModel):
    """语料版本列表响应"""

    items: List[CorpusVersionResponse]
    total: int
    current_version: int = 0
