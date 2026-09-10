/**
 * Corpus（Knowledge Base）CRUD、知识块检索与 ingest API
 */
import { handleKnowledgeError } from "./errors";
import {
  appendChunkingConfigToFormData,
  buildJsonChunkingPayload,
} from "./chunking-config";
import type { ChunkingRequestFields } from "./chunking-config";
import type { AsyncPipelineResult } from "./pipelines";

export interface CorpusRecord {
  id: string;
  name: string;
  app_name: string;
  description?: string;
  knowledge_count: number;
  chunk_count_total?: number | null;
  config?: Record<string, unknown>;
  rebuild_triggered?: { count: number; run_ids: string[] } | null;
}
export interface IngestResult {
  count: number;
  items: string[];
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
  return handleKnowledgeError(res);
}

export interface KnowledgeItem {
  id: string;
  content: string;
  source_uri: string | null;
  created_at: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
}

export interface SourceSummary {
  source_uri: string | null;
  display_name?: string | null;
  count: number;
  archived: boolean;
  source_type: "file" | "url" | "text" | "unknown";
}

export interface KnowledgeListResponse {
  count: number;
  items: KnowledgeItem[];
  source_stats?: Record<string, number>;
  source_summaries?: SourceSummary[];
}

export async function fetchKnowledgeItems(
  corpusId: string,
  params: {
    appName?: string;
    sourceUri?: string | null;
    includeArchived?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<KnowledgeListResponse> {
  const query = new URLSearchParams();
  if (params.appName) query.set("app_name", params.appName);
  if (params.sourceUri !== undefined) {
    query.set("source_uri", params.sourceUri ?? "__null__");
  }
  if (params.includeArchived !== undefined) {
    query.set("include_archived", String(params.includeArchived));
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
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const { app_name, text, source_uri, metadata, ...chunkingParams } = params;
  const res = await fetch(`/api/knowledge/base/${id}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_name,
      text,
      source_uri,
      metadata,
      ...buildJsonChunkingPayload(chunkingParams),
    }),
  });
  return handleKnowledgeError(res);
}

export async function ingestUrl(
  id: string,
  params: {
    app_name?: string;
    url: string;
    as_document?: boolean;
    metadata?: Record<string, unknown>;
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const { app_name, url, as_document, metadata, ...chunkingParams } = params;
  const res = await fetch(`/api/knowledge/base/${id}/ingest_url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_name,
      url,
      as_document,
      metadata,
      ...buildJsonChunkingPayload(chunkingParams),
    }),
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
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const formData = new FormData();

  if (params.app_name) formData.set("app_name", params.app_name);
  formData.set("file", params.file);
  if (params.source_uri) formData.set("source_uri", params.source_uri);
  if (params.metadata) formData.set("metadata", JSON.stringify(params.metadata));
  appendChunkingConfigToFormData(formData, params);

  const res = await fetch(`/api/knowledge/base/${id}/ingest_file`, {
    method: "POST",
    body: formData, // 不设置 Content-Type，让浏览器自动处理 multipart/form-data
  });
  return handleKnowledgeError(res);
}
/**
 * 将既有 Document（库文档或任意 Corpus 文档）的 Markdown 索引进目标 Corpus。
 * chunks 建在目标 Corpus，文档本体不动；replace 模式幂等重摄入。
 */
export async function ingestDocument(
  corpusId: string,
  params: {
    app_name?: string;
    document_id: string;
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const { app_name, document_id, ...chunkingParams } = params;
  const res = await fetch(`/api/knowledge/base/${corpusId}/ingest_document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_name,
      document_id,
      ...buildJsonChunkingPayload(chunkingParams),
    }),
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
