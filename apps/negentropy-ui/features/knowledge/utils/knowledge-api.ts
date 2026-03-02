/**
 * Knowledge 模块 API 客户端
 *
 * 通过 Next.js API Routes 代理到后端 Knowledge 服务
 * 对齐后端异常体系与配置验证规则
 */

// ============================================================================
// Types (对齐后端 types.py)
// ============================================================================

export type SearchMode = "semantic" | "keyword" | "hybrid";

export type ChunkingStrategy = "fixed" | "recursive" | "semantic";

export interface ChunkingConfig {
  strategy?: ChunkingStrategy;
  chunk_size?: number;
  overlap?: number;
  preserve_newlines?: boolean;
  // Semantic chunking specific
  semantic_threshold?: number;
  min_chunk_size?: number;
  max_chunk_size?: number;
}

export interface SearchConfig {
  mode?: SearchMode;
  limit?: number;
  semantic_weight?: number;
  keyword_weight?: number;
  metadata_filter?: Record<string, unknown>;
}

// 错误响应类型（对齐后端异常体系）
export interface KnowledgeErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Knowledge 异常类型
export class KnowledgeError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "KnowledgeError";
    this.code = code;
    this.details = details;
  }
}

// 领域异常
export class CorpusNotFoundError extends KnowledgeError {
  constructor(details?: Record<string, unknown>) {
    super("CORPUS_NOT_FOUND", "Corpus not found", details);
    this.name = "CorpusNotFoundError";
  }
}

export class VersionConflictError extends KnowledgeError {
  constructor(details?: Record<string, unknown>) {
    super("VERSION_CONFLICT", "Version conflict", details);
    this.name = "VersionConflictError";
  }
}

// 验证异常
export class ValidationError extends KnowledgeError {
  constructor(details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", "Validation error", details);
    this.name = "ValidationError";
  }
}

export class InvalidChunkSizeError extends ValidationError {
  constructor(details?: Record<string, unknown>) {
    super({ ...details, field: "chunk_size" });
    this.name = "InvalidChunkSizeError";
  }
}

export class InvalidSearchConfigError extends ValidationError {
  constructor(details?: Record<string, unknown>) {
    super({ ...details, field: "search_config" });
    this.name = "InvalidSearchConfigError";
  }
}

// 基础设施异常
export class InfrastructureError extends KnowledgeError {
  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(code, message, details);
    this.name = "InfrastructureError";
  }
}

export interface KnowledgeDashboard {
  corpus_count: number;
  knowledge_count: number;
  last_build_at?: string;
  pipeline_runs?: Array<{
    run_id: string;
    status: string;
    version: number;
    updated_at?: string;
    [key: string]: unknown;
  }>;
  alerts?: Array<unknown>;
}

export interface CorpusRecord {
  id: string;
  name: string;
  app_name: string;
  description?: string;
  knowledge_count: number;
  config?: {
    chunk_size?: number;
    overlap?: number;
    embedding_model?: string;
    [key: string]: unknown;
  };
}

export interface KnowledgeMatch {
  id: string;
  content: string;
  source_uri?: string;
  metadata?: Record<string, unknown>;
  semantic_score?: number;
  keyword_score?: number;
  combined_score: number;
}

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

// Pipeline 阶段状态
export type PipelineStageStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

// Pipeline 操作类型
export type PipelineOperation =
  | "ingest_text"
  | "ingest_url"
  | "replace_source";

// Pipeline 阶段结果
export interface PipelineStageResult {
  status: PipelineStageStatus;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  error?: Record<string, unknown>;
  output?: Record<string, unknown>;
  reason?: string; // for skipped status
}

// Pipeline Run 记录
export interface PipelineRunRecord {
  id: string;
  run_id: string;
  status: string;
  operation?: PipelineOperation;
  trigger?: "api" | "ui" | "schedule";
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  duration?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  stages?: Record<string, PipelineStageResult>;
  error?: Record<string, unknown>;
  version?: number;
}

export interface KnowledgePipelinesPayload {
  last_updated_at?: string;
  runs?: PipelineRunRecord[];
}

export interface IngestResult {
  count: number;
  items: string[];
}

// 异步 Pipeline 响应类型
export interface AsyncPipelineResult {
  run_id: string;
  status: "running";
  message: string;
}

export interface SearchResults {
  count: number;
  items: KnowledgeMatch[];
}

export interface GraphUpsertResult {
  status: string;
  graph?: unknown;
}

export interface PipelineUpsertResult {
  status: string;
  pipeline?: unknown;
}

// ============================================================================
// 错误处理工具函数
// ============================================================================

/**
 * 从响应中解析错误并映射到对应的异常类型
 */
async function parseKnowledgeError(res: Response): Promise<KnowledgeError> {
  let errorData: unknown;
  try {
    errorData = await res.json();
  } catch {
    errorData = null;
  }

  const errorResponse = errorData as KnowledgeErrorResponse | null;
  const code = errorResponse?.code || "UNKNOWN_ERROR";
  const message = errorResponse?.message || res.statusText;
  const details = errorResponse?.details;

  switch (code) {
    case "CORPUS_NOT_FOUND":
      return new CorpusNotFoundError(details);
    case "VERSION_CONFLICT":
      return new VersionConflictError(details);
    case "INVALID_CHUNK_SIZE":
      return new InvalidChunkSizeError(details);
    case "INVALID_SEARCH_CONFIG":
      return new InvalidSearchConfigError(details);
    default:
      return new KnowledgeError(code, message, details);
  }
}

/**
 * 统一的错误处理包装器
 */
async function handleKnowledgeError<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await parseKnowledgeError(res);
    throw error;
  }
  return res.json() as Promise<T>;
}

// ============================================================================
// Dashboard
// ============================================================================

export async function fetchDashboard(
  appName?: string,
): Promise<KnowledgeDashboard> {
  const params = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(`/api/knowledge/dashboard${params}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Corpus (Knowledge Base)
// ============================================================================

export async function fetchCorpora(appName?: string): Promise<CorpusRecord[]> {
  const params = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(`/api/knowledge/base${params}`, {
    cache: "no-store",
  });
  return handleKnowledgeError(res);
}

export async function createCorpus(params: {
  app_name?: string;
  name: string;
  description?: string;
  config?: Record<string, unknown>;
}): Promise<CorpusRecord> {
  const res = await fetch("/api/knowledge/base", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to create corpus: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchCorpus(
  id: string,
  appName?: string,
): Promise<CorpusRecord | null> {
  const params = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(`/api/knowledge/base/${id}${params}`, {
    cache: "no-store",
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch corpus: ${res.statusText}`);
  }
  return res.json();
}

export interface KnowledgeItem {
  id: string;
  content: string;
  source_uri: string | null;
  created_at: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
}

export interface KnowledgeListResponse {
  count: number;
  items: KnowledgeItem[];
  source_stats?: Record<string, number>;
}

export async function fetchKnowledgeItems(
  corpusId: string,
  params: {
    appName?: string;
    sourceUri?: string | null;
    limit?: number;
    offset?: number;
  },
): Promise<KnowledgeListResponse> {
  const query = new URLSearchParams();
  if (params.appName) query.set("app_name", params.appName);
  if (params.sourceUri !== undefined) {
    query.set("source_uri", params.sourceUri ?? "__null__");
  }
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/knowledge?${query.toString()}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch knowledge items: ${res.statusText}`);
  }
  return res.json();
}

export async function ingestText(
  id: string,
  params: {
    app_name?: string;
    text: string;
    source_uri?: string;
    metadata?: Record<string, unknown>;
    chunk_size?: number;
    overlap?: number;
    preserve_newlines?: boolean;
  },
): Promise<AsyncPipelineResult> {
  // 前端配置验证（对齐后端 types.py）
  const { chunk_size, overlap } = params;
  if (chunk_size !== undefined && (chunk_size < 1 || chunk_size > 100000)) {
    throw new InvalidChunkSizeError({ chunk_size });
  }
  if (overlap !== undefined) {
    const maxSize = chunk_size || 800;
    if (overlap < 0 || overlap >= maxSize) {
      throw new InvalidChunkSizeError({ overlap, max_overlap: maxSize - 1 });
    }
  }

  const res = await fetch(`/api/knowledge/base/${id}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

export async function ingestUrl(
  id: string,
  params: {
    app_name?: string;
    url: string;
    metadata?: Record<string, unknown>;
    chunk_size?: number;
    overlap?: number;
    preserve_newlines?: boolean;
  },
): Promise<AsyncPipelineResult> {
  const res = await fetch(`/api/knowledge/base/${id}/ingest_url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

export async function ingestFile(
  id: string,
  params: {
    app_name?: string;
    file: File;
    source_uri?: string;
    metadata?: Record<string, unknown>;
    chunk_size?: number;
    overlap?: number;
    preserve_newlines?: boolean;
  },
): Promise<IngestResult> {
  const formData = new FormData();

  if (params.app_name) formData.set("app_name", params.app_name);
  formData.set("file", params.file);
  if (params.source_uri) formData.set("source_uri", params.source_uri);
  if (params.metadata) formData.set("metadata", JSON.stringify(params.metadata));
  if (params.chunk_size) formData.set("chunk_size", String(params.chunk_size));
  if (params.overlap) formData.set("overlap", String(params.overlap));
  if (params.preserve_newlines !== undefined) {
    formData.set("preserve_newlines", String(params.preserve_newlines));
  }

  const res = await fetch(`/api/knowledge/base/${id}/ingest_file`, {
    method: "POST",
    body: formData, // 不设置 Content-Type，让浏览器自动处理 multipart/form-data
  });
  return handleKnowledgeError(res);
}

// ============================================================================
// Document Management Types
// ============================================================================

export interface KnowledgeDocument {
  id: string;
  corpus_id: string;
  app_name: string;
  file_hash: string;
  original_filename: string;
  gcs_uri: string;
  content_type: string | null;
  file_size: number;
  status: string;
  created_at: string | null;
  created_by: string | null;
  markdown_extract_status?: "pending" | "processing" | "completed" | "failed" | string;
  markdown_extracted_at?: string | null;
  markdown_extract_error?: string | null;
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  markdown_content: string | null;
  markdown_gcs_uri: string | null;
}

export interface DocumentMarkdownRefreshResponse {
  document_id: string;
  status: string;
  message: string;
}

export interface DocumentListResponse {
  count: number;
  items: KnowledgeDocument[];
}

// ============================================================================
// Document Management API Functions
// ============================================================================

export async function fetchDocuments(
  corpusId: string,
  params?: {
    appName?: string;
    limit?: number;
    offset?: number;
  },
): Promise<DocumentListResponse> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

export async function fetchAllDocuments(
  params?: {
    appName?: string;
    limit?: number;
    offset?: number;
  },
): Promise<DocumentListResponse> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const res = await fetch(
    `/api/knowledge/documents?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

export async function deleteDocument(
  corpusId: string,
  documentId: string,
  params?: {
    appName?: string;
    hardDelete?: boolean;
  },
): Promise<void> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);
  if (params?.hardDelete) query.set("hard_delete", "true");

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}?${query.toString()}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    throw new Error(`Failed to delete document: ${res.statusText}`);
  }
}

export async function fetchDocumentDetail(
  corpusId: string,
  documentId: string,
  params?: {
    appName?: string;
  },
): Promise<KnowledgeDocumentDetail> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

export async function refreshDocumentMarkdown(
  corpusId: string,
  documentId: string,
  params?: {
    appName?: string;
  },
): Promise<DocumentMarkdownRefreshResponse> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/refresh_markdown`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: params?.appName,
      }),
    },
  );
  return handleKnowledgeError(res);
}

export async function downloadDocument(
  corpusId: string,
  documentId: string,
  params?: {
    appName?: string;
  },
): Promise<void> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/download?${query.toString()}`,
  );

  if (!res.ok) {
    let errorMessage = `Failed to download document: ${res.statusText}`;
    try {
      const errorData = await res.json();
      if (errorData?.detail?.message) {
        errorMessage = errorData.detail.message;
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  // 获取文件名
  const contentDisposition = res.headers.get("Content-Disposition");
  let filename = "document";
  if (contentDisposition) {
    // Try UTF-8 encoded filename first
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/);
    if (utf8Match) {
      filename = decodeURIComponent(utf8Match[1]);
    } else {
      // Fallback to standard filename
      const standardMatch = contentDisposition.match(/filename="?(.+?)"?(?:;|$)/);
      if (standardMatch) {
        filename = standardMatch[1];
      }
    }
  }

  // 下载并触发浏览器保存
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

export async function replaceSource(
  id: string,
  params: {
    app_name?: string;
    text: string;
    source_uri: string;
    metadata?: Record<string, unknown>;
    chunk_size?: number;
    overlap?: number;
    preserve_newlines?: boolean;
  },
): Promise<AsyncPipelineResult> {
  const res = await fetch(`/api/knowledge/base/${id}/replace_source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

export async function syncSource(
  id: string,
  params: {
    app_name?: string;
    source_uri: string;
    chunk_size?: number;
    overlap?: number;
    preserve_newlines?: boolean;
  },
): Promise<AsyncPipelineResult> {
  const res = await fetch(`/api/knowledge/base/${id}/sync_source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

export async function rebuildSource(
  id: string,
  params: {
    app_name?: string;
    source_uri: string;
    chunk_size?: number;
    overlap?: number;
    preserve_newlines?: boolean;
  },
): Promise<AsyncPipelineResult> {
  const res = await fetch(`/api/knowledge/base/${id}/rebuild_source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

// ============================================================================
// Source Management API
// ============================================================================

export interface DeleteSourceResult {
  deleted_count: number;
}

export interface ArchiveSourceResult {
  updated_count: number;
  archived: boolean;
}

/**
 * 删除指定 source_uri 的所有知识块
 */
export async function deleteSource(
  id: string,
  params: {
    app_name?: string;
    source_uri: string;
  },
): Promise<DeleteSourceResult> {
  const res = await fetch(`/api/knowledge/base/${id}/delete_source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

/**
 * 归档或解档指定 source_uri
 */
export async function archiveSource(
  id: string,
  params: {
    app_name?: string;
    source_uri: string;
    archived?: boolean;
  },
): Promise<ArchiveSourceResult> {
  const res = await fetch(`/api/knowledge/base/${id}/archive_source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

export async function updateCorpus(
  id: string,
  params: {
    name?: string;
    description?: string;
    config?: Record<string, unknown>;
  },
): Promise<CorpusRecord> {
  const res = await fetch(`/api/knowledge/base/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to update corpus: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteCorpus(id: string): Promise<void> {
  const res = await fetch(`/api/knowledge/base/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete corpus: ${res.statusText}`);
  }
}

export async function searchKnowledge(
  id: string,
  params: {
    app_name?: string;
    query: string;
    mode?: SearchMode;
    limit?: number;
    semantic_weight?: number;
    keyword_weight?: number;
    metadata_filter?: Record<string, unknown>;
  },
): Promise<SearchResults> {
  // 前端配置验证（对齐后端 types.py）
  const { limit, semantic_weight, keyword_weight, mode } = params;

  if (limit !== undefined && (limit < 1 || limit > 1000)) {
    throw new InvalidSearchConfigError({ limit, min: 1, max: 1000 });
  }

  if (
    semantic_weight !== undefined &&
    (semantic_weight < 0 || semantic_weight > 1)
  ) {
    throw new InvalidSearchConfigError({ semantic_weight, min: 0, max: 1 });
  }

  if (
    keyword_weight !== undefined &&
    (keyword_weight < 0 || keyword_weight > 1)
  ) {
    throw new InvalidSearchConfigError({ keyword_weight, min: 0, max: 1 });
  }

  if (mode !== undefined && !["semantic", "keyword", "hybrid"].includes(mode)) {
    throw new InvalidSearchConfigError({
      mode,
      allowed: ["semantic", "keyword", "hybrid"],
    });
  }

  const res = await fetch(`/api/knowledge/base/${id}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
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
}

export interface GraphBuildHistoryResult {
  corpus_id: string;
  count: number;
  runs: GraphBuildRunRecord[];
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
): Promise<KnowledgeGraphPayload> {
  const query = new URLSearchParams();
  if (appName) query.set("app_name", appName);
  if (includeRuns) query.set("include_runs", "true");

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph?${query.toString()}`,
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

// ============================================================================
// Pipelines
// ============================================================================

export async function fetchPipelines(
  appName?: string,
): Promise<KnowledgePipelinesPayload> {
  const params = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(`/api/knowledge/pipelines${params}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch pipelines: ${res.statusText}`);
  }
  return res.json();
}

export async function upsertPipelines(params: {
  app_name?: string;
  run_id: string;
  status?: string;
  payload?: Record<string, unknown>;
  expected_version?: number;
  idempotency_key?: string;
}): Promise<PipelineUpsertResult> {
  const res = await fetch("/api/knowledge/pipelines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to upsert pipelines: ${res.statusText}`);
  }
  return res.json();
}
