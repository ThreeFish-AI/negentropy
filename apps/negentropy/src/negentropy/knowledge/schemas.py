"""Knowledge API Request/Response Schemas

将 API 层的 Pydantic 模型从路由逻辑中正交分离，
使 api.py 聚焦于路由与业务编排。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# ============================================================================
# Corpus Schemas
# ============================================================================


class CorpusCreateRequest(BaseModel):
    app_name: str | None = None
    name: str
    description: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)


class CorpusUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    config: dict[str, Any] | None = None


class CorpusResponse(BaseModel):
    id: UUID
    app_name: str
    name: str
    description: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    knowledge_count: int = 0
    chunk_count_total: int | None = Field(
        default=None,
        description=(
            "全量 Knowledge 行数（含 hierarchical child 子块），即实际参与检索的 vectors 总数。"
            "仅当与 knowledge_count 不同时返回（非 hierarchical 策略下两者相等）。"
        ),
    )
    rebuild_triggered: dict[str, Any] | None = Field(
        default=None,
        description=(
            "Embedding 模型变更时自动触发的 rebuild_source 概要；未触发时为 null。"
            "结构: {count: int, run_ids: list[str]}"
        ),
    )


# ============================================================================
# Chunking / Ingest Schemas
# ============================================================================


class _LegacyChunkingRequest(BaseModel):
    chunking_config: dict[str, Any] | None = None
    strategy: str | None = None
    chunk_size: int | None = None
    overlap: int | None = None
    preserve_newlines: bool | None = None
    separators: list[str] | None = None
    semantic_threshold: float | None = None
    semantic_buffer_size: int | None = None
    min_chunk_size: int | None = None
    max_chunk_size: int | None = None
    hierarchical_parent_chunk_size: int | None = None
    hierarchical_child_chunk_size: int | None = None
    hierarchical_child_overlap: int | None = None


class IngestRequest(_LegacyChunkingRequest):
    app_name: str | None = None
    text: str
    source_uri: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class IngestUrlRequest(_LegacyChunkingRequest):
    app_name: str | None = None
    url: str
    as_document: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


class ReplaceSourceRequest(_LegacyChunkingRequest):
    app_name: str | None = None
    text: str
    source_uri: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class SyncSourceRequest(_LegacyChunkingRequest):
    app_name: str | None = None
    source_uri: str


class RebuildSourceRequest(_LegacyChunkingRequest):
    app_name: str | None = None
    source_uri: str


class DeleteSourceRequest(BaseModel):
    app_name: str | None = None
    source_uri: str


class ArchiveSourceRequest(BaseModel):
    app_name: str | None = None
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

    failure_category: str | None = Field(default=None, description="稳定失败分类。")
    diagnostic_summary: str | None = Field(
        default=None,
        description="一条可直接展示的摘要，默认用于契约类失败。",
    )
    diagnostics: dict[str, Any] = Field(
        default_factory=dict,
        description="结构化详细诊断信息，供明细排障使用。",
    )


class PipelineStageResultResponse(BaseModel):
    # Pipeline 运行态 payload 仍处于演进期，允许透传未显式建模的增量字段。
    model_config = ConfigDict(extra="allow")

    status: str
    started_at: str | None = None
    completed_at: str | None = None
    duration_ms: int | None = None
    error: PipelineErrorPayloadResponse | None = None
    output: dict[str, Any] = Field(default_factory=dict)
    reason: str | None = None


class PipelineRunRecordResponse(BaseModel):
    # Pipeline run 顶层字段继续保持向后兼容，后续若 payload 收敛可再逐步收紧。
    model_config = ConfigDict(extra="allow")

    id: str
    run_id: str
    status: str
    version: int | None = None
    operation: str | None = None
    trigger: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    duration_ms: int | None = None
    duration: str | None = None
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    stages: dict[str, PipelineStageResultResponse] = Field(default_factory=dict)
    error: PipelineErrorPayloadResponse | None = None


class KnowledgePipelinesResponse(BaseModel):
    count: int = 0
    runs: list[PipelineRunRecordResponse] = Field(default_factory=list)
    last_updated_at: str | None = None


class PipelineUpsertRecordResponse(BaseModel):
    """Pipeline upsert 结果中的记录快照。"""

    model_config = ConfigDict(extra="allow")

    id: str
    run_id: str
    status: str
    payload: dict[str, Any] = Field(default_factory=dict)
    version: int | None = None
    updated_at: str | None = None


class PipelineUpsertResponse(BaseModel):
    """Pipeline upsert 响应。"""

    status: str
    pipeline: PipelineUpsertRecordResponse


class PipelinesUpsertRequest(BaseModel):
    app_name: str | None = None
    run_id: str
    status: str = "pending"
    payload: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = None
    expected_version: int | None = None


class PipelineCancelRequest(BaseModel):
    """Pipeline Run 取消请求体（KB & KG 共用）。"""

    app_name: str | None = None
    reason: str | None = Field(
        default=None,
        description="可选取消原因，落盘到 payload.cancellation.reason；默认 'user_cancel'。",
    )


class PipelineCancelResponse(BaseModel):
    """Pipeline Run 取消响应体。

    `status` 语义：
    - `cancelled`：pending → 直接转 cancelled（task 尚未启动）；
    - `cancelling`：running → 转 cancelling（信号已发，task 在下个检查点退出）；
    - `noop`：已是 cancelling/cancelled（幂等命中）。
    """

    model_config = ConfigDict(extra="allow")

    status: str
    run_id: str
    in_process: bool = Field(
        description="True 表示进程内 fast-path 信号已送达；False 表示仅 DB 信号（依赖检查点轮询兜底）。",
    )
    record: dict[str, Any] = Field(default_factory=dict, description="最新 run 记录快照。")


# ============================================================================
# Search Schemas
# ============================================================================


class SearchRequest(BaseModel):
    app_name: str | None = None
    query: str
    mode: str | None = None
    limit: int | None = None
    semantic_weight: float | None = None
    keyword_weight: float | None = None
    metadata_filter: dict[str, Any] | None = None


class PipelinesResponse(BaseModel):
    corpus_count: int
    knowledge_count: int
    last_build_at: str | None = None
    pipeline_runs: list[dict[str, Any]] = Field(default_factory=list)
    alerts: list[dict[str, Any]] = Field(default_factory=list)


# ============================================================================
# Graph Schemas
# ============================================================================


class GraphPayload(BaseModel):
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)
    runs: list[dict[str, Any]] = Field(default_factory=list)


class GraphUpsertRequest(BaseModel):
    app_name: str | None = None
    run_id: str
    status: str = "pending"
    graph: GraphPayload
    idempotency_key: str | None = None
    expected_version: int | None = None


class GraphBuildRequest(BaseModel):
    """图谱构建请求"""

    app_name: str | None = None
    enable_llm_extraction: bool = True
    llm_model: str | None = None
    min_entity_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    min_relation_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    batch_size: int = Field(default=10, ge=1, le=100)
    incremental: bool = False
    extraction_schema: str | None = None


class GraphBuildResponse(BaseModel):
    """图谱构建响应"""

    run_id: str
    corpus_id: UUID
    status: str
    entity_count: int
    relation_count: int
    chunks_processed: int
    elapsed_seconds: float
    error_message: str | None = None
    warnings: list[dict[str, Any]] = Field(default_factory=list)
    failed_chunk_count: int = 0


class GraphSearchRequest(BaseModel):
    """图谱检索请求"""

    app_name: str | None = None
    query: str
    mode: str = "hybrid"  # semantic, graph, hybrid
    limit: int = Field(default=20, ge=1, le=100)
    max_depth: int = Field(default=2, ge=1, le=5)
    semantic_weight: float = Field(default=0.6, ge=0.0, le=1.0)
    graph_weight: float = Field(default=0.4, ge=0.0, le=1.0)
    include_neighbors: bool = True
    neighbor_limit: int = Field(default=10, ge=1, le=50)
    as_of: datetime | None = Field(
        default=None,
        description=(
            "可选时态快照时刻 (ISO-8601)；提供时仅纳入在该时刻仍有效的关系。"
            "用于双时态时间穿梭检索 (Snodgrass & Ahn, 1985)。"
        ),
    )


class GraphSearchResponse(BaseModel):
    """图谱检索响应"""

    count: int
    query_time_ms: float
    items: list[dict[str, Any]] = Field(default_factory=list)


class GraphNeighborsRequest(BaseModel):
    """邻居查询请求"""

    app_name: str | None = None
    entity_id: str
    max_depth: int = Field(default=2, ge=1, le=5)
    limit: int = Field(default=100, ge=1, le=500)
    as_of: datetime | None = Field(
        default=None,
        description="可选时态快照时刻 (ISO-8601)；详见 GraphSearchRequest.as_of。",
    )


class GraphPathRequest(BaseModel):
    """路径查询请求"""

    app_name: str | None = None
    source_id: str
    target_id: str
    max_depth: int = Field(default=5, ge=1, le=10)
    as_of: datetime | None = Field(
        default=None,
        description="可选时态快照时刻 (ISO-8601)；详见 GraphSearchRequest.as_of。",
    )


class GlobalSearchRequest(BaseModel):
    """GraphRAG Global Search 请求"""

    query: str = Field(min_length=1, description="用户查询文本")
    max_communities: int = Field(default=10, ge=1, le=50, description="候选社区数上限")


class GlobalSearchEvidenceItem(BaseModel):
    """单个社区贡献的部分答案（Map 阶段产物）"""

    community_id: int
    partial_answer: str
    similarity: float
    top_entities: list[str] = Field(default_factory=list)


class GlobalSearchResponse(BaseModel):
    """GraphRAG Global Search 响应"""

    query: str
    answer: str
    evidence: list[GlobalSearchEvidenceItem] = Field(default_factory=list)
    candidates_total: int
    latency_ms: float
    summaries_dirty: bool = Field(
        default=False,
        description="社区摘要是否在最近的实体更新之后未刷新；UI 需提示用户重跑摘要流程。",
    )


class MultiHopReasonRequest(BaseModel):
    """多跳推理请求（G4 PPR + Provenance）"""

    query: str = Field(min_length=1)
    seed_entities: list[str] = Field(
        default_factory=list,
        description="可选 seed 实体 ID 列表；为空时由后端按命名实体抽取自动推断",
    )
    top_k: int = Field(default=10, ge=1, le=50)
    max_hops: int = Field(default=3, ge=1, le=5)


class MultiHopEvidenceEdgeItem(BaseModel):
    source_id: str
    target_id: str
    source_label: str = ""
    target_label: str = ""
    relation: str
    evidence_text: str
    weight: float = 1.0


class MultiHopEvidenceChainItem(BaseModel):
    target_entity_id: str
    target_label: str
    score: float
    seed_entity_id: str | None = None
    path: list[str] = Field(default_factory=list)
    edges: list[MultiHopEvidenceEdgeItem] = Field(default_factory=list)


class MultiHopReasonResponse(BaseModel):
    """多跳推理响应"""

    query: str
    seeds: list[str] = Field(default_factory=list)
    answer_entities: list[str] = Field(default_factory=list)
    evidence_chain: list[MultiHopEvidenceChainItem] = Field(default_factory=list)
    latency_ms: float


class GraphTimelineBucket(BaseModel):
    """关系时间轴密度直方图单点"""

    date: datetime
    active_count: int = Field(ge=0, description="该桶内 valid_from 落入的关系数")
    expired_count: int = Field(ge=0, description="该桶内 valid_to 落入的关系数")


class GraphTimelineResponse(BaseModel):
    """关系时间轴密度直方图响应"""

    corpus_id: UUID
    bucket: str = Field(description="day | week | month")
    points: list[GraphTimelineBucket] = Field(default_factory=list)


# ============================================================================
# Graph Entity Schemas
# ============================================================================


class GraphEntityItem(BaseModel):
    """实体列表条目"""

    id: UUID
    name: str
    entity_type: str
    confidence: float = 0.0
    mention_count: int = 0
    importance_score: float | None = None
    community_id: int | None = None
    description: str | None = None
    is_active: bool = True


class GraphEntityListResponse(BaseModel):
    """实体列表响应"""

    count: int
    items: list[GraphEntityItem] = Field(default_factory=list)


class GraphEntityRelationItem(BaseModel):
    """实体关系条目"""

    id: UUID
    direction: str  # "outgoing" | "incoming"
    relation_type: str
    weight: float = 1.0
    confidence: float = 1.0
    evidence_text: str | None = None
    peer_entity_id: UUID
    peer_entity_name: str
    peer_entity_type: str


class GraphEntityDetailResponse(BaseModel):
    """实体详情响应"""

    id: UUID
    name: str
    entity_type: str
    confidence: float = 0.0
    mention_count: int = 0
    description: str | None = None
    aliases: dict[str, Any] | None = None
    properties: dict[str, Any] | None = None
    is_active: bool = True
    relations: list[GraphEntityRelationItem] = Field(default_factory=list)


class GraphStatsResponse(BaseModel):
    """图谱统计响应"""

    total_entities: int = 0
    edge_count: int = 0
    by_type: dict[str, int] = Field(default_factory=dict)
    avg_confidence: float = 0.0
    density: float = 0.0
    avg_degree: float = 0.0
    top_entities: list[dict[str, Any]] = Field(default_factory=list)
    community_count: int = 0
    community_distribution: dict[str, int] = Field(default_factory=dict)


class GraphMetricsResponse(BaseModel):
    """图谱构建指标趋势"""

    builds: list[dict[str, Any]] = Field(default_factory=list)


class GraphQualityResponse(BaseModel):
    """图谱质量报告 (Paulheim, 2017)"""

    total_entities: int
    total_relations: int
    dangling_edges: int
    orphan_entities: int
    community_coverage: float
    entity_confidence_avg: float
    relation_evidence_ratio: float
    type_distribution: dict[str, int] = Field(default_factory=dict)
    quality_score: float


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
    display_name: str | None = None
    gcs_uri: str
    content_type: str | None = None
    file_size: int
    status: str
    created_at: str | None = None
    created_by: str | None = None
    created_by_name: str | None = None
    markdown_extract_status: str = "pending"
    markdown_extracted_at: str | None = None
    markdown_extract_error: str | None = None
    archived: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class DocumentUpdateRequest(BaseModel):
    """文档元信息更新请求（目前仅支持 ``display_name``）。"""

    display_name: str | None = Field(default=None, max_length=255)
    app_name: str | None = None


class DocumentDetailResponse(DocumentResponse):
    """文档详情响应（含 Markdown 正文）。"""

    markdown_content: str | None = None
    markdown_gcs_uri: str | None = None


class DocumentMarkdownRefreshResponse(BaseModel):
    """文档 Markdown 重解析响应。"""

    document_id: UUID
    status: str
    message: str


class DocumentMarkdownRefreshRequest(BaseModel):
    """文档 Markdown 重解析请求。"""

    app_name: str | None = None


class DocumentChunksResponse(BaseModel):
    count: int
    page: int = 1
    page_size: int = 50
    document_metadata: dict[str, Any] = Field(default_factory=dict)
    items: list[dict[str, Any]]


class DocumentChunkDetailResponse(BaseModel):
    item: dict[str, Any]
    document_metadata: dict[str, Any] = Field(default_factory=dict)


class DocumentChunkUpdateRequest(BaseModel):
    app_name: str | None = None
    content: str | None = None
    is_enabled: bool | None = None


class DocumentActionRequest(_LegacyChunkingRequest):
    app_name: str | None = None


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


# ============================================================================
# Wiki Knowledge Graph Schemas
# ----------------------------------------------------------------------------
# 用于 ``apps/negentropy-wiki`` SSG 站点按 Publication 维度拉取知识图谱切片。
#
# 设计要点：
#   - 字段命名与主站 ``apps/negentropy-ui`` GraphCanvas 同名（id/label/type/
#     importance/community_id + source/target/label/type/weight），便于未来抽
#     共享类型。
#   - 节点新增 ``entry_slugs``（Wiki 内首批 ≤3 个引用本实体的文档 slug，供
#     点击跳转）与 ``mention_count_in_pub``（仅 publication 内提及计数，区
#     别于全语料 mention_count）。
#   - Envelope 携带 ``publication_id`` + ``version`` + ``truncated`` +
#     ``total_entities`` + ``status``（"ok" / "no_kg" / "empty"）。
#   - 跨 corpus publication 阶段一按 corpus_id 各自保留（不做 canonical 合
#     并），通过节点 ``metadata.corpus_id`` 区分。
# ============================================================================


class WikiGraphNode(BaseModel):
    """Wiki 切片图谱节点"""

    id: str = Field(description="实体节点 ID（沿用后端 GraphService 输出格式）")
    label: str = Field(description="节点显示名（canonical_name 或 name）")
    type: str = Field(description="节点类型（entity_type，如 PERSON/ORGANIZATION/CONCEPT）")
    importance: float | None = Field(default=None, description="重要性得分（用于按 top-N 截断）")
    community_id: int | None = Field(default=None, description="Louvain 社区 ID")
    entry_slugs: list[str] = Field(
        default_factory=list,
        description="Publication 内提及本实体的前 N 个 entry slug（默认 N=3，供节点点击跳转）",
    )
    mention_count_in_pub: int = Field(
        default=0,
        ge=0,
        description="Publication 内文档对本实体的提及总次数（区别于全语料 mention_count）",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "节点附加元数据：corpus_id（跨 corpus publication 着色用）、entity_type、confidence、is_active 等。"
        ),
    )


class WikiGraphEdge(BaseModel):
    """Wiki 切片图谱边"""

    source: str = Field(description="起点节点 ID")
    target: str = Field(description="终点节点 ID")
    label: str = Field(description="关系标签（relation_type）")
    type: str = Field(description="边类型（与 label 同源；保留字段供未来精细化）")
    weight: float = Field(default=1.0, description="边权重")
    metadata: dict[str, Any] = Field(default_factory=dict, description="confidence / evidence 等可选元数据")


class WikiGraphResponse(BaseModel):
    """Wiki Publication 整体图谱切片响应

    ``status`` 语义：
        - ``ok``     ：正常返回非空图；
        - ``no_kg``  ：Publication 关联的 corpus 上 KG 未构建（nodes/edges 必为空）；
        - ``empty``  ：KG 已构建但该 Publication 文档未涉及任何实体（如全 mention 被过滤）。
    """

    model_config = ConfigDict(from_attributes=True)

    publication_id: UUID
    version: int = Field(ge=0, description="Publication 版本号；作为客户端缓存键的一部分")
    status: str = Field(default="ok", description="ok | no_kg | empty")
    nodes: list[WikiGraphNode] = Field(default_factory=list)
    edges: list[WikiGraphEdge] = Field(default_factory=list)
    truncated: bool = Field(
        default=False,
        description="True 表示节点数超过 max_nodes 被截断，悬挂边已剔除",
    )
    total_entities: int = Field(
        default=0,
        ge=0,
        description="截断前的实体总数（即满足 min_importance 的实体数）",
    )
    corpus_ids: list[UUID] = Field(
        default_factory=list,
        description="Publication 实际覆盖的 corpus_id 集合",
    )


class WikiGraphEntityItem(BaseModel):
    """Wiki 实体扁平列表条目"""

    id: str
    name: str
    entity_type: str
    importance: float | None = None
    community_id: int | None = None
    mention_count_in_pub: int = Field(default=0, ge=0)
    entry_slugs: list[str] = Field(default_factory=list)
    corpus_id: UUID | None = None


class WikiGraphEntityListResponse(BaseModel):
    """Wiki 实体列表响应"""

    publication_id: UUID
    version: int
    total: int = Field(ge=0)
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=500)
    items: list[WikiGraphEntityItem] = Field(default_factory=list)


class WikiGraphNeighborItem(BaseModel):
    """实体邻居（限定在 publication 节点集合内）"""

    id: str
    name: str
    entity_type: str
    relation_type: str
    direction: str = Field(description="outgoing | incoming")
    weight: float = 1.0
    entry_slugs: list[str] = Field(default_factory=list)


class WikiGraphEntityDetailResponse(BaseModel):
    """Wiki 实体详情响应：实体属性 + 邻居 + 提及 entries"""

    publication_id: UUID
    version: int
    entity: WikiGraphEntityItem
    neighbors: list[WikiGraphNeighborItem] = Field(
        default_factory=list,
        description="邻居仅限制在 publication 节点集合内（未越过本发布边界）",
    )
    mentioning_entries: list[dict[str, Any]] = Field(
        default_factory=list,
        description="提及该实体的 Wiki entries：[{entry_id, entry_slug, entry_title, document_id, mention_count}]",
    )


class WikiEntryGraphResponse(BaseModel):
    """单 entry 的局部图（该文档涉及的实体 + 一跳邻居）"""

    model_config = ConfigDict(from_attributes=True)

    entry_id: UUID
    publication_id: UUID
    version: int
    status: str = Field(default="ok", description="ok | no_kg | empty")
    nodes: list[WikiGraphNode] = Field(default_factory=list)
    edges: list[WikiGraphEdge] = Field(default_factory=list)
    center_entity_ids: list[str] = Field(
        default_factory=list,
        description="该 entry 直接涉及的实体 ID（用作前端高亮中心节点）",
    )
