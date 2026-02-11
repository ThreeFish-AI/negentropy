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

export interface KnowledgePipelinesPayload {
  last_updated_at?: string;
  runs?: Array<{
    id: string;
    run_id: string;
    status: string;
    started_at?: string;
    completed_at?: string;
    duration_ms?: number;
    duration?: string;
    trigger?: string;
    input?: unknown;
    output?: unknown;
    error?: unknown;
    version?: number;
  }>;
}

export interface IngestResult {
  count: number;
  items: string[];
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
}

export async function fetchKnowledgeItems(
  corpusId: string,
  params: { limit?: number; offset?: number },
): Promise<KnowledgeListResponse> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));

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
): Promise<IngestResult> {
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
): Promise<IngestResult> {
  const res = await fetch(`/api/knowledge/base/${id}/ingest_url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
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
): Promise<IngestResult> {
  const res = await fetch(`/api/knowledge/base/${id}/replace_source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to replace source: ${res.statusText}`);
  }
  return res.json();
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
