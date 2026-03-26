"""Knowledge API Request/Response Schemas

将 API 层的 Pydantic 模型从路由逻辑中正交分离，
使 api.py 聚焦于路由与业务编排。
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# Corpus Schemas
# ============================================================================


class CorpusCreateRequest(BaseModel):
    app_name: Optional[str] = None
    name: str
    description: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)


class CorpusUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class CorpusResponse(BaseModel):
    id: UUID
    app_name: str
    name: str
    description: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    knowledge_count: int = 0


# ============================================================================
# Chunking / Ingest Schemas
# ============================================================================


class _LegacyChunkingRequest(BaseModel):
    chunking_config: Optional[Dict[str, Any]] = None
    strategy: Optional[str] = None
    chunk_size: Optional[int] = None
    overlap: Optional[int] = None
    preserve_newlines: Optional[bool] = None
    separators: Optional[list[str]] = None
    semantic_threshold: Optional[float] = None
    semantic_buffer_size: Optional[int] = None
    min_chunk_size: Optional[int] = None
    max_chunk_size: Optional[int] = None
    hierarchical_parent_chunk_size: Optional[int] = None
    hierarchical_child_chunk_size: Optional[int] = None
    hierarchical_child_overlap: Optional[int] = None


class IngestRequest(_LegacyChunkingRequest):
    app_name: Optional[str] = None
    text: str
    source_uri: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IngestUrlRequest(_LegacyChunkingRequest):
    app_name: Optional[str] = None
    url: str
    as_document: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ReplaceSourceRequest(_LegacyChunkingRequest):
    app_name: Optional[str] = None
    text: str
    source_uri: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SyncSourceRequest(_LegacyChunkingRequest):
    app_name: Optional[str] = None
    source_uri: str


class RebuildSourceRequest(_LegacyChunkingRequest):
    app_name: Optional[str] = None
    source_uri: str


class DeleteSourceRequest(BaseModel):
    app_name: Optional[str] = None
    source_uri: str


class ArchiveSourceRequest(BaseModel):
    app_name: Optional[str] = None
    source_uri: str
    archived: bool = True


# ============================================================================
# Pipeline / Async Schemas
# ============================================================================


class AsyncPipelineResponse(BaseModel):
    """异步 Pipeline 响应模型"""

    run_id: str
    status: str = "running"
    message: str


class ArchiveSourceResponse(BaseModel):
    """归档/解档 Source 响应模型"""

    updated_count: int
    archived: bool


class DeleteSourceResponse(BaseModel):
    """删除 Source 响应模型"""

    deleted_count: int
    deleted_documents: int = 0
    deleted_gcs_objects: int = 0
    warnings: list[str] = Field(default_factory=list)


class PipelineErrorPayloadResponse(BaseModel):
    """Pipeline 错误对象。

    `failure_category` 用于稳定失败分类；`diagnostic_summary` 用于一条可直接展示的摘要；
    `diagnostics` 保留完整结构化诊断信息，供明细排障使用。
    """

    model_config = ConfigDict(extra="allow")

    failure_category: Optional[str] = Field(default=None, description="稳定失败分类。")
    diagnostic_summary: Optional[str] = Field(
        default=None,
        description="一条可直接展示的摘要，默认用于契约类失败。",
    )
    diagnostics: Dict[str, Any] = Field(
        default_factory=dict,
        description="结构化详细诊断信息，供明细排障使用。",
    )


class PipelineStageResultResponse(BaseModel):
    # Pipeline 运行态 payload 仍处于演进期，允许透传未显式建模的增量字段。
    model_config = ConfigDict(extra="allow")

    status: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_ms: Optional[int] = None
    error: Optional[PipelineErrorPayloadResponse] = None
    output: Dict[str, Any] = Field(default_factory=dict)
    reason: Optional[str] = None


class PipelineRunRecordResponse(BaseModel):
    # Pipeline run 顶层字段继续保持向后兼容，后续若 payload 收敛可再逐步收紧。
    model_config = ConfigDict(extra="allow")

    id: str
    run_id: str
    status: str
    version: Optional[int] = None
    operation: Optional[str] = None
    trigger: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_ms: Optional[int] = None
    duration: Optional[str] = None
    input: Dict[str, Any] = Field(default_factory=dict)
    output: Dict[str, Any] = Field(default_factory=dict)
    stages: Dict[str, PipelineStageResultResponse] = Field(default_factory=dict)
    error: Optional[PipelineErrorPayloadResponse] = None


class KnowledgePipelinesResponse(BaseModel):
    runs: list[PipelineRunRecordResponse] = Field(default_factory=list)
    last_updated_at: Optional[str] = None


class PipelineUpsertRecordResponse(BaseModel):
    """Pipeline upsert 结果中的记录快照。"""

    model_config = ConfigDict(extra="allow")

    id: str
    run_id: str
    status: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    version: Optional[int] = None
    updated_at: Optional[str] = None


class PipelineUpsertResponse(BaseModel):
    """Pipeline upsert 响应。"""

    status: str
    pipeline: PipelineUpsertRecordResponse


class PipelinesUpsertRequest(BaseModel):
    app_name: Optional[str] = None
    run_id: str
    status: str = "pending"
    payload: Dict[str, Any] = Field(default_factory=dict)
    idempotency_key: Optional[str] = None
    expected_version: Optional[int] = None


# ============================================================================
# Search Schemas
# ============================================================================


class SearchRequest(BaseModel):
    app_name: Optional[str] = None
    query: str
    mode: Optional[str] = None
    limit: Optional[int] = None
    semantic_weight: Optional[float] = None
    keyword_weight: Optional[float] = None
    metadata_filter: Optional[Dict[str, Any]] = None


class DashboardResponse(BaseModel):
    corpus_count: int
    knowledge_count: int
    last_build_at: Optional[str] = None
    pipeline_runs: list[Dict[str, Any]] = Field(default_factory=list)
    alerts: list[Dict[str, Any]] = Field(default_factory=list)


# ============================================================================
# Graph Schemas
# ============================================================================


class GraphPayload(BaseModel):
    nodes: list[Dict[str, Any]] = Field(default_factory=list)
    edges: list[Dict[str, Any]] = Field(default_factory=list)
    runs: list[Dict[str, Any]] = Field(default_factory=list)


class GraphUpsertRequest(BaseModel):
    app_name: Optional[str] = None
    run_id: str
    status: str = "pending"
    graph: GraphPayload
    idempotency_key: Optional[str] = None
    expected_version: Optional[int] = None


class GraphBuildRequest(BaseModel):
    """图谱构建请求"""

    app_name: Optional[str] = None
    enable_llm_extraction: bool = True
    llm_model: Optional[str] = None
    min_entity_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    min_relation_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    batch_size: int = Field(default=10, ge=1, le=100)


class GraphBuildResponse(BaseModel):
    """图谱构建响应"""

    run_id: str
    corpus_id: UUID
    status: str
    entity_count: int
    relation_count: int
    chunks_processed: int
    elapsed_seconds: float
    error_message: Optional[str] = None


class GraphSearchRequest(BaseModel):
    """图谱检索请求"""

    app_name: Optional[str] = None
    query: str
    mode: str = "hybrid"  # semantic, graph, hybrid
    limit: int = Field(default=20, ge=1, le=100)
    max_depth: int = Field(default=2, ge=1, le=5)
    semantic_weight: float = Field(default=0.6, ge=0.0, le=1.0)
    graph_weight: float = Field(default=0.4, ge=0.0, le=1.0)
    include_neighbors: bool = True
    neighbor_limit: int = Field(default=10, ge=1, le=50)


class GraphSearchResponse(BaseModel):
    """图谱检索响应"""

    count: int
    query_time_ms: float
    items: list[Dict[str, Any]] = Field(default_factory=list)


class GraphNeighborsRequest(BaseModel):
    """邻居查询请求"""

    app_name: Optional[str] = None
    entity_id: str
    max_depth: int = Field(default=2, ge=1, le=5)
    limit: int = Field(default=100, ge=1, le=500)


class GraphPathRequest(BaseModel):
    """路径查询请求"""

    app_name: Optional[str] = None
    source_id: str
    target_id: str
    max_depth: int = Field(default=5, ge=1, le=10)


# ============================================================================
# Document Schemas
# ============================================================================


class DocumentResponse(BaseModel):
    """文档元信息响应模型"""

    id: UUID
    corpus_id: UUID
    app_name: str
    file_hash: str
    original_filename: str
    gcs_uri: str
    content_type: Optional[str] = None
    file_size: int
    status: str
    created_at: Optional[str] = None
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    markdown_extract_status: str = "pending"
    markdown_extracted_at: Optional[str] = None
    markdown_extract_error: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class DocumentDetailResponse(DocumentResponse):
    """文档详情响应（含 Markdown 正文）。"""

    markdown_content: Optional[str] = None
    markdown_gcs_uri: Optional[str] = None


class DocumentMarkdownRefreshResponse(BaseModel):
    """文档 Markdown 重解析响应。"""

    document_id: UUID
    status: str
    message: str


class DocumentMarkdownRefreshRequest(BaseModel):
    """文档 Markdown 重解析请求。"""

    app_name: Optional[str] = None


class DocumentChunksResponse(BaseModel):
    count: int
    page: int = 1
    page_size: int = 50
    document_metadata: Dict[str, Any] = Field(default_factory=dict)
    items: list[Dict[str, Any]]


class DocumentChunkDetailResponse(BaseModel):
    item: Dict[str, Any]
    document_metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentChunkUpdateRequest(BaseModel):
    app_name: Optional[str] = None
    content: Optional[str] = None
    is_enabled: Optional[bool] = None


class DocumentActionRequest(_LegacyChunkingRequest):
    app_name: Optional[str] = None


class DocumentReplaceRequest(DocumentActionRequest):
    text: str


class DocumentListResponse(BaseModel):
    """文档列表响应模型"""

    count: int
    items: list[DocumentResponse]


# ============================================================================
# Stats Schemas
# ============================================================================


class ApiStatsResponse(BaseModel):
    """API 统计响应模型"""

    total_calls: int = Field(description="总调用次数")
    success_count: int = Field(description="成功调用次数")
    failed_count: int = Field(description="失败调用次数")
    avg_latency_ms: float = Field(description="平均延迟（毫秒）")
