/**
 * Knowledge 模块 API 客户端
 *
 * 通过 Next.js API Routes 代理到后端 Knowledge 服务
 */

// ============================================================================
// Types
// ============================================================================

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
  nodes: Array<{ id: string; label?: string; type?: string; [key: string]: unknown }>;
  edges: Array<{ source: string; target: string; label?: string; [key: string]: unknown }>;
  runs?: Array<{
    run_id?: string;
    status?: string;
    version?: number;
    updated_at?: string;
  }>;
}

export interface KnowledgeMemoryPayload {
  users?: Array<{ id: string; label?: string }>;
  timeline?: Array<{
    id: string;
    user_id: string;
    summary: string;
    source?: string;
    timestamp?: string;
  }>;
  policies?: Record<string, unknown>;
  audits?: Array<{
    memory_id: string;
    decision: string;
    note?: string;
    version: number;
    created_at?: string;
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

export interface MemoryAuditResult {
  status: string;
  audits?: Array<{
    memory_id: string;
    decision: string;
    version: number;
    created_at?: string;
  }>;
}

export interface PipelineUpsertResult {
  status: string;
  pipeline?: unknown;
}

// ============================================================================
// Dashboard
// ============================================================================

export async function fetchDashboard(appName?: string): Promise<KnowledgeDashboard> {
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
  if (!res.ok) {
    throw new Error(`Failed to fetch corpora: ${res.statusText}`);
  }
  return res.json();
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
  const res = await fetch(`/api/knowledge/base/${id}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to ingest text: ${res.statusText}`);
  }
  return res.json();
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

export async function searchKnowledge(
  id: string,
  params: {
    app_name?: string;
    query: string;
    mode?: "semantic" | "keyword" | "hybrid";
    limit?: number;
    semantic_weight?: number;
    keyword_weight?: number;
    metadata_filter?: Record<string, unknown>;
  },
): Promise<SearchResults> {
  const res = await fetch(`/api/knowledge/base/${id}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to search knowledge: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Knowledge Graph
// ============================================================================

export async function fetchGraph(appName?: string): Promise<KnowledgeGraphPayload> {
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
// User Memory
// ============================================================================

export async function fetchMemory(appName?: string): Promise<KnowledgeMemoryPayload> {
  const params = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(`/api/knowledge/memory${params}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch memory: ${res.statusText}`);
  }
  return res.json();
}

export async function submitMemoryAudit(params: {
  app_name?: string;
  user_id: string;
  decisions: Record<string, string>;
  note?: string;
  expected_versions?: Record<string, number>;
  idempotency_key?: string;
}): Promise<MemoryAuditResult> {
  const res = await fetch("/api/knowledge/memory/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to submit memory audit: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Pipelines
// ============================================================================

export async function fetchPipelines(appName?: string): Promise<KnowledgePipelinesPayload> {
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
