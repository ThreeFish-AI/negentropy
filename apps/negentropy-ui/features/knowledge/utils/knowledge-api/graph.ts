/**
 * 知识图谱：构建、检索、实体、时态与 GraphRAG 高级查询 API
 */
import { handleKnowledgeError } from "./errors";

export interface KnowledgeGraphPayload {
  nodes: Array<{
    id: string;
    label?: string;
    type?: string;
    [key: string]: unknown;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label?: string;
    [key: string]: unknown;
  }>;
  runs?: Array<{
    run_id?: string;
    status?: string;
    version?: number;
    updated_at?: string;
  }>;
}
export interface GraphUpsertResult {
  status: string;
  graph?: unknown;
}
// ============================================================================
// Knowledge Graph
// ============================================================================

export async function fetchGraph(
  appName?: string,
): Promise<KnowledgeGraphPayload> {
  const params = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(`/api/knowledge/graph${params}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch graph: ${res.statusText}`);
  }
  return res.json();
}

export async function upsertGraph(params: {
  app_name?: string;
  run_id: string;
  status?: string;
  graph: KnowledgeGraphPayload;
  expected_version?: number;
  idempotency_key?: string;
}): Promise<GraphUpsertResult> {
  const res = await fetch("/api/knowledge/graph", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to upsert graph: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Knowledge Graph Enhanced API (Phase 1)
// ============================================================================

export type GraphSearchMode = "semantic" | "graph" | "hybrid";

export interface GraphBuildParams {
  app_name?: string;
  enable_llm_extraction?: boolean;
  llm_model?: string;
  min_entity_confidence?: number;
  min_relation_confidence?: number;
  batch_size?: number;
  incremental?: boolean;
}

export interface GraphBuildResult {
  run_id: string;
  corpus_id: string;
  status: string;
  entity_count: number;
  relation_count: number;
  chunks_processed: number;
  elapsed_seconds: number;
  error_message?: string;
  warnings?: { algorithm: string; error: string }[];
  failed_chunk_count?: number;
}

export interface GraphSearchParams {
  app_name?: string;
  query: string;
  mode?: GraphSearchMode;
  limit?: number;
  max_depth?: number;
  semantic_weight?: number;
  graph_weight?: number;
  include_neighbors?: boolean;
  neighbor_limit?: number;
  /** ISO-8601 时态快照时刻；提供时仅纳入在该时刻仍有效的关系（G3 时间穿梭）。 */
  as_of?: string;
}

export interface GraphSearchResultItem {
  entity: {
    id: string;
    label?: string;
    type?: string;
    metadata?: Record<string, unknown>;
  };
  semantic_score: number;
  graph_score: number;
  combined_score: number;
  neighbors: Array<{
    id: string;
    label?: string;
    type?: string;
  }>;
}

export interface GraphSearchResults {
  count: number;
  query_time_ms: number;
  items: GraphSearchResultItem[];
}

export interface GraphNeighborsParams {
  app_name?: string;
  entity_id: string;
  max_depth?: number;
  limit?: number;
  /** ISO-8601 时态快照时刻（G3）。 */
  as_of?: string;
}

export interface GraphNeighborsResult {
  entity_id: string;
  count: number;
  neighbors: Array<{
    id: string;
    label?: string;
    type?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface GraphPathParams {
  app_name?: string;
  source_id: string;
  target_id: string;
  max_depth?: number;
  /** ISO-8601 时态快照时刻（G3）。 */
  as_of?: string;
}

export interface GraphTimelineBucket {
  date: string;
  active_count: number;
  expired_count: number;
}

export interface GraphTimelineResult {
  corpus_id: string;
  bucket: "day" | "week" | "month";
  points: GraphTimelineBucket[];
}

export interface GraphPathResult {
  source_id: string;
  target_id: string;
  found: boolean;
  path?: string[];
  length: number;
}

export interface GraphBuildRunRecord {
  id: string;
  run_id: string;
  status: string;
  entity_count: number;
  relation_count: number;
  extractor_config?: Record<string, unknown>;
  model_name?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
  progress_percent?: number;
  warnings?: { algorithm: string; error: string }[];
}

export interface GraphBuildHistoryResult {
  corpus_id: string;
  count: number;
  runs: GraphBuildRunRecord[];
}

// ============================================================================
// Graph Entity Types
// ============================================================================

export interface GraphEntityItem {
  id: string;
  name: string;
  entity_type: string;
  confidence: number;
  mention_count: number;
  importance_score?: number | null;
  community_id?: number | null;
  description?: string;
  is_active: boolean;
}

export interface GraphEntityListResponse {
  count: number;
  items: GraphEntityItem[];
}

export interface GraphEntityRelationItem {
  id: string;
  direction: "outgoing" | "incoming";
  relation_type: string;
  weight: number;
  confidence: number;
  evidence_text?: string;
  peer_entity_id: string;
  peer_entity_name: string;
  peer_entity_type: string;
}

export interface GraphEntityDetailResponse {
  id: string;
  name: string;
  entity_type: string;
  confidence: number;
  mention_count: number;
  description?: string;
  aliases?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  is_active: boolean;
  relations: GraphEntityRelationItem[];
}

export interface GraphStatsResponse {
  total_entities: number;
  edge_count: number;
  by_type: Record<string, number>;
  avg_confidence: number;
  density: number;
  avg_degree: number;
  community_count: number;
  community_distribution: Record<string, number>;
}

/**
 * 构建知识图谱
 * 从语料库的知识块中提取实体和关系，构建知识图谱。
 */
export async function buildKnowledgeGraph(
  corpusId: string,
  params: GraphBuildParams = {},
): Promise<GraphBuildResult> {
  const res = await fetch(`/api/knowledge/base/${corpusId}/graph/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

/**
 * 获取语料库的知识图谱
 */
export async function fetchCorpusGraph(
  corpusId: string,
  appName?: string,
  includeRuns = false,
  asOf?: string,
): Promise<KnowledgeGraphPayload> {
  const query = new URLSearchParams();
  if (appName) query.set("app_name", appName);
  if (includeRuns) query.set("include_runs", "true");
  if (asOf) query.set("as_of", asOf);

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

export interface GlobalSearchEvidenceItem {
  community_id: number;
  partial_answer: string;
  similarity: number;
  top_entities: string[];
}

export interface GlobalSearchResult {
  query: string;
  answer: string;
  evidence: GlobalSearchEvidenceItem[];
  candidates_total: number;
  latency_ms: number;
  summaries_dirty: boolean;
}

export interface MultiHopEvidenceEdge {
  source_id: string;
  target_id: string;
  source_label: string;
  target_label: string;
  relation: string;
  evidence_text: string;
  weight: number;
}

export interface MultiHopEvidenceChain {
  target_entity_id: string;
  target_label: string;
  score: number;
  seed_entity_id?: string | null;
  path: string[];
  edges: MultiHopEvidenceEdge[];
}

export interface MultiHopReasonResult {
  query: string;
  seeds: string[];
  answer_entities: string[];
  evidence_chain: MultiHopEvidenceChain[];
  latency_ms: number;
}

/**
 * 多跳推理 + Provenance 证据链（G4 PPR + HippoRAG）
 */
export async function multiHopReasonKnowledgeGraph(
  corpusId: string,
  params: {
    query: string;
    seedEntities?: string[];
    topK?: number;
    maxHops?: number;
  },
): Promise<MultiHopReasonResult> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/multi_hop_reason`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: params.query,
        seed_entities: params.seedEntities ?? [],
        top_k: params.topK ?? 10,
        max_hops: params.maxHops ?? 3,
      }),
    },
  );
  return handleKnowledgeError(res);
}

/**
 * GraphRAG Global Search Map-Reduce（G1）
 */
export async function globalSearchKnowledgeGraph(
  corpusId: string,
  params: { query: string; maxCommunities?: number },
): Promise<GlobalSearchResult> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/global_search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: params.query,
        max_communities: params.maxCommunities ?? 10,
      }),
    },
  );
  return handleKnowledgeError(res);
}

/**
 * 获取以指定实体为锚点的子图（G2 Cytoscape 增量加载）
 */
export async function fetchGraphSubgraph(
  corpusId: string,
  params: {
    centerId: string;
    radius?: 1 | 2 | 3;
    limit?: number;
    appName?: string;
    asOf?: string;
  },
): Promise<{
  center_id: string;
  radius: number;
  nodes: Array<{
    id: string;
    label?: string;
    type?: string;
    importance?: number | null;
    community_id?: number | null;
    metadata?: Record<string, unknown>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label?: string;
    type?: string;
    weight?: number;
    metadata?: Record<string, unknown>;
  }>;
}> {
  const query = new URLSearchParams();
  query.set("center_id", params.centerId);
  // 数值用 != null 显式判空；后端目前 ge=1 拒绝 0，但放开下界后 truthy 判断会
  // 静默丢失 radius=0 / limit=0 的语义（隐性 bug）。
  if (params.radius != null) query.set("radius", String(params.radius));
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.appName) query.set("app_name", params.appName);
  if (params.asOf) query.set("as_of", params.asOf);

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/subgraph?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

/**
 * 获取关系时间轴密度直方图（G3 时间穿梭检索）
 */
export async function fetchGraphTimeline(
  corpusId: string,
  bucket: "day" | "week" | "month" = "day",
): Promise<GraphTimelineResult> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/timeline?bucket=${bucket}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

/**
 * 图谱混合检索
 * 结合向量相似度和图结构分数进行检索。
 */
export async function searchKnowledgeGraph(
  corpusId: string,
  params: GraphSearchParams,
): Promise<GraphSearchResults> {
  const res = await fetch(`/api/knowledge/base/${corpusId}/graph/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

/**
 * 查询实体邻居
 */
export async function findGraphNeighbors(
  params: GraphNeighborsParams,
): Promise<GraphNeighborsResult> {
  const res = await fetch("/api/knowledge/graph/neighbors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

/**
 * 查询两点间最短路径
 */
export async function findGraphPath(
  params: GraphPathParams,
): Promise<GraphPathResult> {
  const res = await fetch("/api/knowledge/graph/path", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

/**
 * 清除语料库的图谱数据
 */
export async function clearCorpusGraph(
  corpusId: string,
  appName?: string,
): Promise<void> {
  const query = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(`/api/knowledge/base/${corpusId}/graph${query}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to clear graph: ${res.statusText}`);
  }
}

/**
 * 获取图谱构建历史
 */
export async function fetchGraphBuildHistory(
  corpusId: string,
  appName?: string,
  limit = 20,
): Promise<GraphBuildHistoryResult> {
  const query = new URLSearchParams();
  if (appName) query.set("app_name", appName);
  query.set("limit", String(limit));

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/history?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

/**
 * 获取语料库的实体列表
 */
export async function fetchGraphEntities(
  corpusId: string,
  params?: {
    entity_type?: string;
    search?: string;
    sort_by?: string;
    limit?: number;
    offset?: number;
  },
): Promise<GraphEntityListResponse> {
  const query = new URLSearchParams();
  if (params?.entity_type) query.set("entity_type", params.entity_type);
  if (params?.search) query.set("search", params.search);
  if (params?.sort_by) query.set("sort_by", params.sort_by);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/entities?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

/**
 * 获取实体详情（含关系列表）
 */
export async function fetchGraphEntityDetail(
  corpusId: string,
  entityId: string,
): Promise<GraphEntityDetailResponse> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/entities/${entityId}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

/**
 * 获取图谱统计信息
 */
export async function fetchGraphStats(
  corpusId: string,
  appName?: string,
): Promise<GraphStatsResponse> {
  const query = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/stats${query}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}
