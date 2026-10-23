/**
 * 目录编册（Catalog）：目录树、节点与文档分配 API
 */
import type { KnowledgeDocument } from "./documents";

// ============================================================================
// Catalog Types (目录编册 — 对齐后端 catalog_dao.py)
// ============================================================================

/**
 * 目录节点类型（对齐后端 0010 收敛）：
 *   - `folder`：用户可见的目录容器（合并自历史 CATEGORY + COLLECTION）；
 *   - `document_ref`：系统内部软引用，仅由 `assign_document` 自动创建，UI 不暴露创建入口。
 *
 * 历史值 `category` / `collection` 仍可能从老 API 响应中返回，前端按 `folder` 兜底渲染。
 */
export type CatalogNodeType =
  | "folder"
  | "document_ref"
  | "category" // legacy
  | "collection"; // legacy

/** 全局 Catalog 元数据 — 对齐后端 DocCatalog ORM */
export interface DocCatalog {
  id: string;
  name: string;
  slug: string;
  app_name: string;
  description: string | null;
  visibility: "private" | "internal" | "public";
  is_archived: boolean;
  version: number;
  owner_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DocCatalogListResponse {
  items: DocCatalog[];
  total: number;
}

export interface DocCatalogDocumentsResponse {
  items: KnowledgeDocument[];
  total: number;
}

/** 目录节点 — 对齐后端 DocCatalogEntry + CTE 扩展字段 */
export interface CatalogNode {
  id: string;
  catalog_id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  node_type: CatalogNodeType;
  description: string | null;
  sort_order: number;
  config: Record<string, unknown>;
  /** DOCUMENT_REF 叶子节点关联的文档 ID（FOLDER 等结构节点为 null） */
  document_id?: string | null;
  /** DOCUMENT_REF 关联文档所属 corpus（左栏重命名文档节点时据此直连 document API 改 display_name） */
  source_corpus_id?: string | null;
  /** CTE 计算字段：层级深度（根节点为 0） */
  depth?: number;
  /** CTE 计算字段：从根到当前节点的 ID 路径数组 */
  path?: string[];
  /** 前端派生：子节点数量 */
  children_count?: number;
  /** 前端派生：关联文档数量 */
  document_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCatalogNodeParams {
  catalog_id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
  node_type?: CatalogNodeType;
  description?: string;
  sort_order?: number;
  config?: Record<string, unknown>;
}

export interface UpdateCatalogNodeParams {
  name?: string;
  slug?: string;
  parent_id?: string | null;
  node_type?: CatalogNodeType;
  description?: string;
  sort_order?: number;
  config?: Record<string, unknown>;
}

export interface CatalogTreeResponse {
  tree: CatalogNode[];
}

export interface CatalogNodesResponse {
  nodes: CatalogNode[];
  total: number;
}

export interface CatalogNodeDocumentsResponse {
  documents: KnowledgeDocument[];
  total: number;
}

// ============================================================================
// Catalog API Functions
// ============================================================================

/** 获取目录树（CTE 扁平化列表，含 depth/path） */
export async function fetchCatalogTree(catalogId: string): Promise<CatalogNode[]> {
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/tree`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch catalog tree: ${res.statusText}`);
  const data = await res.json();
  return data.tree ?? data;
}

/** 获取目录节点列表（分页） */
export async function fetchCatalogNodes(params: {
  catalog_id: string;
  limit?: number;
  offset?: number;
}): Promise<CatalogNodesResponse> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();
  const res = await fetch(`/api/knowledge/catalogs/${params.catalog_id}/entries${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch catalog nodes: ${res.statusText}`);
  return res.json();
}

/** 创建目录节点
 *
 * 后端契约（knowledge/api.py POST /catalogs/{catalog_id}/entries）：
 *   catalog_id 作为路径参数；body 中其他字段。
 */
export async function createCatalogNode(params: CreateCatalogNodeParams): Promise<CatalogNode> {
  const { catalog_id, ...body } = params;
  // 防御性校验：catalog_id 若为空字符串，模板字符串会降级出 `/api/knowledge/catalogs//entries`，
  // 经 Next.js URL 归一化后等效命中 `[catalogId]/route.ts`（catalogId="entries"），该路由无 POST 导致 405。
  // 在此前置显式报错，避免低可观测性的静默漂移。
  if (!catalog_id) {
    throw new Error("catalog_id is required to create a catalog node");
  }
  const res = await fetch(`/api/knowledge/catalogs/${catalog_id}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to create catalog node: ${res.statusText}`);
  return res.json();
}

/** 获取单个目录节点详情 */
export async function fetchCatalogNode(catalogId: string, nodeId: string): Promise<CatalogNode> {
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/entries/${nodeId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch catalog node: ${res.statusText}`);
  return res.json();
}

/** 更新目录节点 */
export async function updateCatalogNode(
  catalogId: string,
  nodeId: string,
  params: UpdateCatalogNodeParams,
): Promise<CatalogNode> {
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/entries/${nodeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to update catalog node: ${res.statusText}`);
  return res.json();
}

/** 删除目录节点 */
export async function deleteCatalogNode(catalogId: string, nodeId: string): Promise<void> {
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/entries/${nodeId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete catalog node: ${res.statusText}`);
}

/** 获取目录节点下的文档列表（分页） */
export async function fetchCatalogNodeDocuments(
  catalogId: string,
  nodeId: string,
  options?: { limit?: number; offset?: number },
): Promise<CatalogNodeDocumentsResponse> {
  const query = new URLSearchParams();
  if (options?.limit != null) query.set("limit", String(options.limit));
  if (options?.offset != null) query.set("offset", String(options.offset));
  const qs = query.toString();
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/entries/${nodeId}/documents${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch node documents: ${res.statusText}`);
  return res.json();
}

/** 将文档分配到目录节点（通过批量端点） */
export async function assignDocumentToNode(
  catalogId: string,
  nodeId: string,
  docId: string,
): Promise<void> {
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/entries/${nodeId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_ids: [docId] }),
  });
  if (!res.ok) throw new Error(`Failed to assign document: ${res.statusText}`);
}

/** 从目录节点移除文档 */
export async function unassignDocumentFromNode(
  catalogId: string,
  nodeId: string,
  docId: string,
): Promise<void> {
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/entries/${nodeId}/documents/${docId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to unassign document: ${res.statusText}`);
}

/** 列出全局 Catalog（按 app_name 过滤） */
export async function fetchCatalogs(params?: {
  appName?: string;
  limit?: number;
  offset?: number;
}): Promise<DocCatalogListResponse> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();
  const res = await fetch(`/api/knowledge/catalogs${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch catalogs: ${res.statusText}`);
  return res.json();
}

/** 创建全局 Catalog */
export async function createCatalog(params: {
  app_name: string;
  name: string;
  slug: string;
  visibility?: string;
}): Promise<DocCatalog> {
  const res = await fetch("/api/knowledge/catalogs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to create catalog: ${res.statusText}`);
  return res.json();
}

/** 获取 Catalog 下可用文档（跨 corpus，用于 AddDocumentsDialog） */
export async function fetchCatalogDocuments(
  catalogId: string,
  params?: { limit?: number; offset?: number; markdownStatus?: string },
): Promise<DocCatalogDocumentsResponse> {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  if (params?.markdownStatus) query.set("markdown_status", params.markdownStatus);
  const qs = query.toString();
  const res = await fetch(
    `/api/knowledge/catalogs/${catalogId}/documents${qs ? `?${qs}` : ""}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to fetch catalog documents: ${res.statusText}`);
  return res.json();
}

/**
 * 拉取 Catalog 下「全部」候选文档——以 200/页循环递增 offset 直至累计达到 total，
 * 突破后端单次 `le=200` 上限，保证「添加文档节点」候选集不被截断。
 *
 * @param markdownStatus 透传 `markdown_status` 过滤（UI 默认 "completed"：仅已转换为
 *   Markdown 的文档才可渲染为 Wiki 节点）；省略则不过滤。
 * 上限 100 页（20000 条）兜底，防异常 total 导致死循环。
 */
export async function fetchAllCatalogDocuments(
  catalogId: string,
  opts?: { markdownStatus?: string },
): Promise<KnowledgeDocument[]> {
  const PAGE = 200;
  const MAX_PAGES = 100;
  const acc: KnowledgeDocument[] = [];
  let offset = 0;
  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await fetchCatalogDocuments(catalogId, {
      limit: PAGE,
      offset,
      markdownStatus: opts?.markdownStatus,
    });
    const items = res.items ?? [];
    acc.push(...items);
    const total = res.total ?? acc.length;
    if (acc.length >= total || items.length < PAGE) break;
    offset += PAGE;
  }
  return acc;
}
