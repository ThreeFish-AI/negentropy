/**
 * 文档库（Document Library）与 Corpus 文档、Chunk、Source 管理 API
 */
import { handleKnowledgeError } from "./errors";
import { buildJsonChunkingPayload } from "./chunking-config";
import type { ChunkingRequestFields } from "./chunking-config";
import type { AsyncPipelineResult } from "./pipelines";

/**
 * 导入 URL 至文档库（仅转换为 Markdown 并存储，不做索引）。
 * 异步管线：立即返回 run_id，可在 Pipeline 页查看 import_document 进度。
 */
export async function importDocumentUrl(params: {
  app_name?: string;
  url: string;
  metadata?: Record<string, unknown>;
}): Promise<AsyncPipelineResult> {
  const res = await fetch(`/api/knowledge/documents/import_url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

/**
 * 导入文件（PDF / Markdown）至文档库（仅转换为 Markdown 并存储，不做索引）。
 */
export async function importDocumentFile(params: {
  app_name?: string;
  file: File;
}): Promise<AsyncPipelineResult> {
  const formData = new FormData();
  if (params.app_name) formData.set("app_name", params.app_name);
  formData.set("file", params.file);

  const res = await fetch(`/api/knowledge/documents/import_file`, {
    method: "POST",
    body: formData, // 不设置 Content-Type，让浏览器自动处理 multipart/form-data
  });
  return handleKnowledgeError(res);
}
// ============================================================================
// Document Management Types
// ============================================================================

/**
 * 文档详情路由中库文档（corpus_id=null）的哨兵段：
 * `/knowledge/documents/library/{documentId}`。
 */
export const LIBRARY_CORPUS_SEGMENT = "library";

export interface KnowledgeDocument {
  id: string;
  /** 为 null 时表示独立文档库（Library）文档，不归属任何 Corpus。 */
  corpus_id: string | null;
  app_name: string;
  file_hash: string;
  original_filename: string;
  /**
   * Wiki 站点上显示的名称（用户手填覆盖）。
   * 为空 / null 时，Wiki 站点回退到 `metadata.title -> original_filename`。
   */
  display_name?: string | null;
  content_uri: string;
  content_type: string | null;
  file_size: number;
  status: string;
  created_at: string | null;
  /** 最终修改时间（后端 TimestampMixin 经 onupdate 自动维护）。 */
  updated_at: string | null;
  created_by: string | null;
  created_by_name?: string | null;
  markdown_extract_status?: "pending" | "processing" | "completed" | "failed" | string;
  markdown_extracted_at?: string | null;
  markdown_extract_error?: string | null;
  archived?: boolean;
  metadata?: Record<string, unknown>;
  /**
   * PDF Fidelity Patrol 巡检态（SSOT：knowledge_documents.patrol_status 列）。
   * - `null`/缺省 = 未巡检过
   * - `in_progress` = 正在巡检
   * - `unfixable` = 巡检失败
   * - `done` = 拟合成功
   * - `source_unavailable` = 源文件缺失（源 blob 永久丢失，patrol 跳过）
   */
  patrol_status?: "in_progress" | "done" | "unfixable" | "source_unavailable" | null;
  /** 巡检 best_score 峰值（done/unfixable 携带）。 */
  patrol_score?: number | null;
  /** 当前巡检态归属 Routine（cancelled 回退幂等守卫）。 */
  patrol_routine_id?: string | null;
  /** 巡检态最后写入时间（ISO 字符串）。 */
  patrol_updated_at?: string | null;
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  markdown_content: string | null;
  markdown_uri: string | null;
}

/**
 * 文件列表语境下的「有效名称」：`display_name`（用户重命名覆盖）→ `original_filename`。
 *
 * 注意：与 Wiki 目录语境的 {@link effectiveDisplayName}（含 `metadata.title` 三段回退）
 * **刻意分离** ——「File Name」列只应显示用户填的名或源文件名，不该把 PDF 自动抽取的
 * title 污染进来；`metadata.title` 回退是 Wiki 发布语境（后端 `_resolve_doc_display_title`）的职责。
 */
export function effectiveDocumentName(
  doc: Pick<KnowledgeDocument, "display_name" | "original_filename">,
): string {
  const displayName = (doc.display_name ?? "").trim();
  return displayName || doc.original_filename;
}

/**
 * Wiki 目录语境下的「有效展示名」：`display_name`（用户手填）→ `metadata.title`
 * （PDF/抓取自动抽取）→ `original_filename`（兜底）。
 *
 * 优先级与后端 `_resolve_doc_display_title`、目录树 CTE（`catalog_node_dao`）一致，
 * 保证「候选列表 → 归属列表 → 目录树节点名」三处同屏展示名完全一致。原本内联于
 * `DocumentAssignmentSection`，现上移为唯一事实源供 `AddDocumentsDialog` 复用。
 */
export function effectiveDisplayName(
  doc: Pick<KnowledgeDocument, "display_name" | "original_filename" | "metadata">,
): string {
  const displayName = (doc.display_name || "").trim();
  if (displayName) return displayName;
  const metaTitle = typeof doc.metadata?.title === "string" ? doc.metadata.title.trim() : "";
  if (metaTitle) return metaTitle;
  return doc.original_filename;
}

/**
 * 判定源文档是否为 PDF —— 决定文档详情页是否展示「Markdown | PDF」切换标签。
 *
 * 双重判据（任一命中即视为 PDF），覆盖 MIME 缺失但扩展名为 .pdf 的历史数据：
 *  - `content_type` 含 "pdf"（如 `application/pdf`，大小写不敏感）；
 *  - `original_filename` 以 `.pdf` 结尾。
 *
 * URL / Markdown / 其他类型文档均返回 false，从而不显示 PDF 预览入口。
 */
export function isPdfDocument(
  doc: Pick<KnowledgeDocument, "content_type" | "original_filename">,
): boolean {
  const contentType = (doc.content_type ?? "").toLowerCase();
  if (contentType.includes("pdf")) return true;
  return /\.pdf$/i.test(doc.original_filename ?? "");
}

export interface DocumentMarkdownRefreshResponse {
  document_id: string;
  status: string;
  message: string;
}

/**
 * 文档翻译进度（源文档 `metadata.translation`，由后端翻译服务维护）。
 */
export interface DocumentTranslationMeta {
  status?: "processing" | "completed" | "failed" | string;
  target_document_id?: string | null;
  target_language?: string;
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  warnings?: string[];
}

export interface DocumentTranslateSkipped {
  document_id: string;
  reason: string;
}

export interface DocumentTranslateResponse {
  accepted: string[];
  skipped: DocumentTranslateSkipped[];
  status: string;
}

export interface DocumentListResponse {
  count: number;
  items: KnowledgeDocument[];
}

export interface DocumentChunkItem {
  id: string;
  content: string;
  source_uri: string | null;
  created_at: string | null;
  updated_at?: string | null;
  chunk_index: number;
  character_count: number;
  retrieval_count: number;
  display_retrieval_count: number;
  is_enabled: boolean;
  chunk_role: "parent" | "child" | "leaf" | string;
  parent_chunk_index?: number | null;
  child_chunk_index?: number | null;
  chunk_family_id?: string | null;
  child_chunks: DocumentChunkItem[];
  metadata: Record<string, unknown>;
}

export interface DocumentChunksMetadata {
  original_filename?: string | null;
  file_size?: number | null;
  upload_date?: string | null;
  last_update_date?: string | null;
  source?: string | null;
  chunk_specification?: string | null;
  chunk_length?: number | null;
  avg_paragraph_length?: number | null;
  paragraph_count?: number | null;
  retrieval_count?: number | null;
  embedding_time_ms?: number | null;
  embedded_tokens?: number | null;
}

export interface DocumentChunksResponse {
  count: number;
  page: number;
  page_size: number;
  document_metadata: DocumentChunksMetadata;
  items: DocumentChunkItem[];
}

export interface DocumentChunkDetailResponse {
  item: DocumentChunkItem;
  document_metadata: DocumentChunksMetadata;
}

// ============================================================================
// Document Management API Functions
// ============================================================================

const DOCUMENTS_PAGE_LIMIT_MAX = 100;
const DOCUMENTS_PAGE_LIMIT_DEFAULT = 50;
const DOCUMENT_CHUNKS_PAGE_LIMIT_MAX = 200;
const DOCUMENT_CHUNKS_PAGE_LIMIT_DEFAULT = 50;

function clampPositiveInt(
  value: number | undefined,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.min(Math.trunc(value), max);
}

export async function fetchDocuments(
  corpusId: string,
  params?: {
    appName?: string;
    limit?: number;
    offset?: number;
  },
): Promise<DocumentListResponse> {
  const query = new URLSearchParams();
  const limit = clampPositiveInt(
    params?.limit,
    DOCUMENTS_PAGE_LIMIT_MAX,
    DOCUMENTS_PAGE_LIMIT_DEFAULT,
  );
  if (params?.appName) query.set("app_name", params.appName);
  query.set("limit", String(limit));
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
    /** 按 文件名/显示名/作者姓名 模糊搜索（大小写不敏感）。 */
    search?: string;
  },
): Promise<DocumentListResponse> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  if (params?.search) query.set("search", params.search);

  const res = await fetch(
    `/api/knowledge/documents?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

/**
 * 文档操作 API 路径：库文档（corpusId=null）走无 corpus 平行路由，
 * 其余走 corpus 作用域路由。库文档分支收敛于此单一函数。
 */
function documentApiBase(corpusId: string | null, documentId: string): string {
  return corpusId
    ? `/api/knowledge/base/${corpusId}/documents/${documentId}`
    : `/api/knowledge/documents/${documentId}`;
}

/**
 * 文档原文「内联预览」URL（PDF 原文视图的 `<object>`/`<iframe>` src）。
 *
 * 走 BFF `/preview` 路由：复用后端 `/download` 字节、仅把 `Content-Disposition`
 * 改写为 `inline`。库文档（corpusId=null）与 corpus 文档的路径分支由
 * {@link documentApiBase} 统一收敛。同源请求自动携带 cookie 完成鉴权，故此处
 * 仅需返回 URL 字符串，无需手工拼接鉴权头。
 */
export function documentPreviewUrl(
  corpusId: string | null,
  documentId: string,
  params?: { appName?: string },
): string {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);
  const qs = query.toString();
  const base = `${documentApiBase(corpusId, documentId)}/preview`;
  return qs ? `${base}?${qs}` : base;
}

export async function deleteDocument(
  corpusId: string | null,
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
    `${documentApiBase(corpusId, documentId)}?${query.toString()}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    throw new Error(`Failed to delete document: ${res.statusText}`);
  }
}

export async function fetchDocumentDetail(
  corpusId: string | null,
  documentId: string,
  params?: {
    appName?: string;
  },
): Promise<KnowledgeDocumentDetail> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);

  const res = await fetch(
    `${documentApiBase(corpusId, documentId)}?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

/**
 * 更新文档元信息（display_name + Wiki 文章元数据）。
 *
 * - `display_name`: 传入 `null` 或仅空白字符串 → 清除覆盖；Wiki 站点回退到
 *   `metadata.title -> original_filename`。长度上限 255。
 * - `author` / `author_url` / `source_url` / `published_at`: 合并写入
 *   `metadata` JSONB；传空字符串清除对应键。
 */
export async function updateDocument(
  corpusId: string | null,
  documentId: string,
  patch: {
    display_name?: string | null;
    author?: string | null;
    author_url?: string | null;
    source_url?: string | null;
    published_at?: string | null;
  },
  params?: { appName?: string },
): Promise<KnowledgeDocument> {
  const body: Record<string, unknown> = { ...patch };
  if (params?.appName) body.app_name = params.appName;

  const res = await fetch(documentApiBase(corpusId, documentId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleKnowledgeError(res);
}

export async function refreshDocumentMarkdown(
  corpusId: string | null,
  documentId: string,
  params?: {
    appName?: string;
    /**
     * perceives auto_batch checkpoint 复用语义（与后端 DocumentMarkdownRefreshRequest.resume 对齐）：
     * - true = 断点续传（从最后完成切片继续，失败/partial 态的「Continue (resume)」）；
     * - false（默认）= 全量重跑（清 .batch_state checkpoint，契合「Re-Parse / 彻底重走」）。
     */
    resume?: boolean;
  },
): Promise<DocumentMarkdownRefreshResponse> {
  const payload = JSON.stringify({
    app_name: params?.appName,
    resume: params?.resume ?? false,
  });
  const requestInit: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  };

  const base = documentApiBase(corpusId, documentId);
  let res = await fetch(`${base}/refresh_markdown`, requestInit);
  if (res.status === 404 && corpusId) {
    // Backward-compatible fallback for deployments using kebab-case route naming.
    res = await fetch(`${base}/refresh-markdown`, requestInit);
  }

  return handleKnowledgeError(res);
}

/**
 * 重置文档 PDF 巡检态为「未巡检」（Documents 页「重置为未拟合」按钮）。
 *
 * 后端清 ``patrol_status`` 列 + 取消该 doc 的终态巡检 Routine（解除 selector 门）+
 * 清 Memory TAG_STATUS/TAG_UNFIXABLE；成功返回更新后的文档。在跑（running/paused）巡检
 * 时后端返回 409（``code=PATROL_IN_PROGRESS``）——调用方应捕获并提示用户先取消在跑巡检。
 */
export async function resetDocumentPatrol(
  corpusId: string | null,
  documentId: string,
  params?: { appName?: string },
): Promise<KnowledgeDocument> {
  const base = documentApiBase(corpusId, documentId);
  const res = await fetch(`${base}/reset-patrol`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_name: params?.appName }),
  });
  return handleKnowledgeError<KnowledgeDocument>(res);
}

/**
 * 批量翻译文档（Documents 页 Translate 按钮）。
 *
 * 后端由 InfluenceFaculty（装配 document-translate 技能 + Claude Code 工具）异步执行；
 * 进度经源文档 `metadata.translation` 状态机轮询，译文以新文档分录落库。
 */
export async function translateDocuments(
  documentIds: string[],
  params?: {
    appName?: string;
    /** 当前仅支持 "zh"（中文）翻译 */
    targetLanguage?: "zh";
    force?: boolean;
  },
): Promise<DocumentTranslateResponse> {
  const res = await fetch(`/api/knowledge/documents/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_ids: documentIds,
      app_name: params?.appName,
      target_language: params?.targetLanguage ?? "zh",
      force: params?.force ?? false,
    }),
  });
  return handleKnowledgeError(res);
}

export async function downloadDocument(
  corpusId: string | null,
  documentId: string,
  params?: {
    appName?: string;
  },
): Promise<void> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);

  const res = await fetch(
    `${documentApiBase(corpusId, documentId)}/download?${query.toString()}`,
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

export async function fetchDocumentChunks(
  corpusId: string,
  documentId: string,
  params?: {
    appName?: string;
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
  },
): Promise<DocumentChunksResponse> {
  const query = new URLSearchParams();
  const limit = clampPositiveInt(
    params?.limit,
    DOCUMENT_CHUNKS_PAGE_LIMIT_MAX,
    DOCUMENT_CHUNKS_PAGE_LIMIT_DEFAULT,
  );
  if (params?.appName) query.set("app_name", params.appName);
  query.set("limit", String(limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  if (params?.includeArchived !== undefined) {
    query.set("include_archived", String(params.includeArchived));
  }

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/chunks?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

export async function fetchDocumentChunkDetail(
  corpusId: string,
  documentId: string,
  chunkId: string,
  params?: { appName?: string },
): Promise<DocumentChunkDetailResponse> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/chunks/${chunkId}?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

export async function updateDocumentChunk(
  corpusId: string,
  documentId: string,
  chunkId: string,
  params: { appName?: string; content?: string; is_enabled?: boolean },
): Promise<DocumentChunkDetailResponse> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/chunks/${chunkId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: params.appName,
        content: params.content,
        is_enabled: params.is_enabled,
      }),
    },
  );
  return handleKnowledgeError(res);
}

export async function regenerateDocumentChunkFamily(
  corpusId: string,
  documentId: string,
  chunkId: string,
  params: { appName?: string; content?: string; is_enabled?: boolean },
): Promise<DocumentChunkDetailResponse> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/chunks/${chunkId}/regenerate-family`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: params.appName,
        content: params.content,
        is_enabled: params.is_enabled,
      }),
    },
  );
  return handleKnowledgeError(res);
}

async function postDocumentAction(
  corpusId: string,
  documentId: string,
  action: "sync" | "rebuild" | "replace" | "archive" | "unarchive",
  params: Record<string, unknown>,
): Promise<AsyncPipelineResult | ArchiveSourceResult> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
  );
  return handleKnowledgeError(res);
}

export async function syncDocument(
  corpusId: string,
  documentId: string,
  params: {
    app_name?: string;
  } & ChunkingRequestFields = {},
): Promise<AsyncPipelineResult> {
  const { app_name, ...chunkingParams } = params;
  return postDocumentAction(corpusId, documentId, "sync", {
    app_name,
    ...buildJsonChunkingPayload(chunkingParams),
  }) as Promise<AsyncPipelineResult>;
}

export async function rebuildDocument(
  corpusId: string,
  documentId: string,
  params: {
    app_name?: string;
  } & ChunkingRequestFields = {},
): Promise<AsyncPipelineResult> {
  const { app_name, ...chunkingParams } = params;
  return postDocumentAction(corpusId, documentId, "rebuild", {
    app_name,
    ...buildJsonChunkingPayload(chunkingParams),
  }) as Promise<AsyncPipelineResult>;
}

export async function replaceDocument(
  corpusId: string,
  documentId: string,
  params: {
    app_name?: string;
    text: string;
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const { app_name, text, ...chunkingParams } = params;
  return postDocumentAction(corpusId, documentId, "replace", {
    app_name,
    text,
    ...buildJsonChunkingPayload(chunkingParams),
  }) as Promise<AsyncPipelineResult>;
}

export async function archiveDocument(
  corpusId: string,
  documentId: string,
  params: {
    app_name?: string;
  } = {},
): Promise<ArchiveSourceResult> {
  return postDocumentAction(corpusId, documentId, "archive", params) as Promise<ArchiveSourceResult>;
}

export async function unarchiveDocument(
  corpusId: string,
  documentId: string,
  params: {
    app_name?: string;
  } = {},
): Promise<ArchiveSourceResult> {
  return postDocumentAction(corpusId, documentId, "unarchive", params) as Promise<ArchiveSourceResult>;
}

export async function replaceSource(
  id: string,
  params: {
    app_name?: string;
    text: string;
    source_uri: string;
    metadata?: Record<string, unknown>;
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const { app_name, text, source_uri, metadata, ...chunkingParams } = params;
  const res = await fetch(`/api/knowledge/base/${id}/replace_source`, {
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

export async function syncSource(
  id: string,
  params: {
    app_name?: string;
    source_uri: string;
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const { app_name, source_uri, ...chunkingParams } = params;
  const res = await fetch(`/api/knowledge/base/${id}/sync_source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_name,
      source_uri,
      ...buildJsonChunkingPayload(chunkingParams),
    }),
  });
  return handleKnowledgeError(res);
}

export async function rebuildSource(
  id: string,
  params: {
    app_name?: string;
    source_uri: string;
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const { app_name, source_uri, ...chunkingParams } = params;
  const res = await fetch(`/api/knowledge/base/${id}/rebuild_source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_name,
      source_uri,
      ...buildJsonChunkingPayload(chunkingParams),
    }),
  });
  return handleKnowledgeError(res);
}

// ============================================================================
// Source Management API
// ============================================================================

export interface DeleteSourceResult {
  deleted_count: number;
  deleted_documents?: number;
  deleted_gcs_objects?: number;
  warnings?: string[];
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
