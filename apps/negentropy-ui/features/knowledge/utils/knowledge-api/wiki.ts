/**
 * Wiki 发布：发布记录、导航树、条目内容与 Catalog 同步 API
 */
import { handleKnowledgeError } from "./errors";

// ============================================================================
// Wiki Publishing Types
// ============================================================================

export type WikiPublicationStatus = "draft" | "published" | "archived";
export type WikiTheme = "default" | "book" | "docs";

export type WikiPublishMode = "live" | "snapshot";

export interface WikiPublication {
  id: string;
  catalog_id: string;
  app_name: string;
  publish_mode: WikiPublishMode;
  name: string;
  slug: string;
  description: string | null;
  status: WikiPublicationStatus;
  theme: WikiTheme;
  version: number;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  entries_count: number;
}

export interface WikiPublicationListResponse {
  items: WikiPublication[];
  total: number;
}

export interface CreateWikiPublicationParams {
  catalog_id: string;
  name: string;
  slug?: string;
  description?: string;
  theme?: WikiTheme;
  publish_mode?: WikiPublishMode;
}

export interface UpdateWikiPublicationParams {
  name?: string;
  description?: string;
  theme?: WikiTheme;
}

export interface WikiEntry {
  id: string;
  publication_id: string;
  document_id: string;
  entry_slug: string;
  entry_title: string | null;
  is_index_page: boolean;
  /** Materialized Path（list[str] 序列化为 JSON 字符串）。后端列名 entry_path（migration 0009）。 */
  entry_path: string | null;
  created_at: string | null;
}

export interface WikiEntryContent {
  entry_id: string;
  document_id: string;
  entry_slug: string;
  entry_title: string | null;
  markdown_content: string | null;
  document_filename: string;
}

/**
 * Wiki 导航树 item（自 0011 起）。
 *
 * 历史「容器节点 entry_id=null」语义现仅在缺失 CONTAINER 条目时回退；
 * 正常路径下 CONTAINER 条目持有真实 entry_id 与 catalog_node_id。
 */
export interface WikiNavTreeItem {
  /** 叶/容器条目的 entry UUID；仅在缺 CONTAINER 时回退为 null */
  entry_id: string | null;
  /** 叶节点的源文档；容器节点为 null */
  document_id: string | null;
  /** 容器节点关联的 Catalog 节点 ID；DOCUMENT 节点为 null */
  catalog_node_id?: string | null;
  /** 条目类型；老响应缺省时按 `document_id` 是否非空推导 */
  entry_kind?: "CONTAINER" | "DOCUMENT";
  entry_slug: string;
  entry_title: string;
  is_index_page: boolean;
  children?: WikiNavTreeItem[];
}

export interface WikiNavTreeResponse {
  publication_id: string;
  nav_tree: { items: WikiNavTreeItem[] };
}

export type WikiRevalidationStatus = "dispatched" | "failed" | "not_configured";

/**
 * Wiki 发布目标环境：
 * - `local`（测试环境）：重建本地 negentropy-wiki 站点（:3092）。
 * - `production`（生产环境）：推送到 threefish-ai.github.io master，
 *   直接更新 https://threefish-ai.github.io/。
 */
export type WikiPublishTarget = "local" | "production";

export interface WikiPublishActionResponse {
  publication_id: string;
  status: WikiPublicationStatus;
  version: number;
  published_at: string | null;
  entries_count: number;
  message: string;
  revalidation?: WikiRevalidationStatus;
  /** 本次发布的目标环境（local/production） */
  target?: WikiPublishTarget;
  /** 上线站点 base URL（供「查看站点」跳转） */
  site_url?: string | null;
}

export interface SyncFromCatalogParams {
  catalog_node_ids: string[];
}

export interface SyncFromCatalogResponse {
  synced_count: number;
  errors: string[];
  removed_count: number;
}

// ============================================================================
// Wiki Publishing API Functions
// ============================================================================

/** 列出 Wiki 发布记录 */
export async function fetchWikiPublications(params?: {
  catalogId?: string;
  status?: WikiPublicationStatus;
  offset?: number;
  limit?: number;
}): Promise<WikiPublicationListResponse> {
  const query = new URLSearchParams();
  if (params?.catalogId) query.set("catalog_id", params.catalogId);
  if (params?.status) query.set("status", params.status);
  if (params?.offset != null) query.set("offset", String(params.offset));
  if (params?.limit != null) query.set("limit", String(params.limit));
  const qs = query.toString();
  const res = await fetch(`/api/knowledge/wiki/publications${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch wiki publications: ${res.statusText}`);
  return res.json();
}

/** 获取单个 Wiki 发布 */
export async function fetchWikiPublication(pubId: string): Promise<WikiPublication> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch wiki publication: ${res.statusText}`);
  return res.json();
}

/** 创建 Wiki 发布
 *
 * 错误体由 `parseKnowledgeError` 解析后端 `{code, message, details}` 结构，
 * 例如 409 `WIKI_PUB_CATALOG_LIVE_CONFLICT` / `WIKI_PUB_SLUG_CONFLICT` 会带上
 * 中文 message 透传到上层 toast。 */
export async function createWikiPublication(
  params: CreateWikiPublicationParams,
): Promise<WikiPublication> {
  const res = await fetch(`/api/knowledge/wiki/publications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError<WikiPublication>(res);
}

/** 更新 Wiki 发布 */
export async function updateWikiPublication(
  pubId: string,
  params: UpdateWikiPublicationParams,
): Promise<WikiPublication> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to update wiki publication: ${res.statusText}`);
  return res.json();
}

/** 删除 Wiki 发布 */
export async function deleteWikiPublication(pubId: string): Promise<void> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete wiki publication: ${res.statusText}`);
}

/**
 * 发布 Wiki（draft/published → published，递增版本号）。
 * @param target 发布目标环境，缺省 `local`（测试环境，安全侧默认）。
 */
export async function publishWiki(
  pubId: string,
  target: WikiPublishTarget = "local",
): Promise<WikiPublishActionResponse> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
  });
  if (!res.ok) throw new Error(`Failed to publish wiki: ${res.statusText}`);
  return res.json();
}

/** 取消发布（published → draft） */
export async function unpublishWiki(pubId: string): Promise<WikiPublishActionResponse> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}/unpublish`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to unpublish wiki: ${res.statusText}`);
  return res.json();
}

/** 列出 Wiki 发布的条目 */
export async function fetchWikiEntries(pubId: string): Promise<WikiEntry[]> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}/entries`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch wiki entries: ${res.statusText}`);
  return res.json();
}

/** 获取 Wiki 导航树 */
export async function fetchWikiNavTree(pubId: string): Promise<WikiNavTreeResponse> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}/nav-tree`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch wiki nav tree: ${res.statusText}`);
  return res.json();
}

/** 获取 Wiki 条目内容（含 Markdown） */
export async function fetchWikiEntryContent(entryId: string): Promise<WikiEntryContent> {
  const res = await fetch(`/api/knowledge/wiki/entries/${entryId}/content`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch wiki entry content: ${res.statusText}`);
  return res.json();
}

/** 从 Catalog 全量同步文档到 Wiki（幂等：未覆盖条目会被删除） */
export async function syncWikiEntriesFromCatalog(
  pubId: string,
  params: SyncFromCatalogParams,
): Promise<SyncFromCatalogResponse> {
  const res = await fetch(
    `/api/knowledge/wiki/publications/${pubId}/sync-from-catalog`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
  );
  if (!res.ok) throw new Error(`Failed to sync wiki from catalog: ${res.statusText}`);
  return res.json();
}
