/**
 * Wiki API 客户端
 *
 * 用于 SSG 构建时从后端拉取 Wiki 发布数据（Publications、Entries、NavTree、Content）。
 * 运行时通过 ISR 增量再验证保持数据新鲜度。
 */

const API_BASE =
  typeof process !== "undefined"
    ? process.env.WIKI_API_BASE || "http://localhost:3292"
    : "http://localhost:3292";

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface WikiPublication {
  id: string;
  catalog_id: string;
  app_name: string;
  publish_mode: "live" | "snapshot";
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  theme: "default" | "book" | "docs";
  version: number;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  entries_count: number;
}

export interface WikiEntry {
  id: string;
  document_id: string | null;
  entry_slug: string;
  entry_title: string | null;
  is_index_page: boolean;
  status?: "active" | "orphaned" | "hidden";
}

/**
 * Wiki 导航树 item（自后端 0011 起 CONTAINER 条目持久化）。
 *
 * - DOCUMENT 节点：`entry_kind='DOCUMENT'`、`document_id` 必非空、`catalog_node_id` 为空；
 * - CONTAINER 节点：`entry_kind='CONTAINER'`、`document_id` 为空、`catalog_node_id` 指向 Catalog 节点；
 * - 兼容路径：缺 `entry_kind` 时按 `document_id` 是否非空推导（兼容旧响应）；
 * - 历史合成容器：`entry_id=null`、`entry_kind='CONTAINER'`（仅在缺 CONTAINER 条目时回退）。
 */
export interface WikiNavTreeItem {
  /** entry UUID；仅在缺失 CONTAINER 条目的合成回退节点上为 null */
  entry_id: string | null;
  entry_slug: string;
  entry_title: string;
  is_index_page: boolean;
  /** 叶节点的源文档；容器节点为 null */
  document_id: string | null;
  /** 容器节点关联的 Catalog 节点 ID；DOCUMENT 节点为 null */
  catalog_node_id?: string | null;
  /** 条目类型；老响应缺省时按 `document_id` 是否非空推导 */
  entry_kind?: "CONTAINER" | "DOCUMENT";
  children?: WikiNavTreeItem[];
}

/**
 * 判定 item 是否为容器节点。
 * 优先用 `entry_kind`；缺省时按 `document_id` 是否为空兜底。
 */
export function isContainerItem(item: WikiNavTreeItem): boolean {
  if (item.entry_kind) return item.entry_kind === "CONTAINER";
  return item.document_id === null;
}

export interface WikiEntryContent {
  entry_id: string;
  document_id: string;
  entry_slug: string;
  entry_title: string | null;
  markdown_content: string | null;
  document_filename: string;
}

// ---------------------------------------------------------------------------
// API 客户端
// ---------------------------------------------------------------------------

class WikiApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE;
  }

  private async fetch<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}/knowledge/wiki${path}`;
    const res = await fetch(url, {
      next: { revalidate: 300 }, // ISR: 5 分钟增量再验证
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Wiki API error [${res.status}] ${url}: ${await res.text()}`);
    }
    return res.json();
  }

  /** 列出所有已发布的 Publication */
  async listPublications(): Promise<{ items: WikiPublication[]; total: number }> {
    return this.fetch("/publications?status=published");
  }

  /** 获取单个 Publication 详情 */
  async getPublication(pubId: string): Promise<WikiPublication> {
    return this.fetch(`/publications/${pubId}`);
  }

  /** 获取 Publication 的所有条目 */
  async getEntries(pubId: string): Promise<{ items: WikiEntry[]; total: number }> {
    return this.fetch(`/publications/${pubId}/entries`);
  }

  /** 获取导航树 */
  async getNavTree(pubId: string): Promise<{
    publication_id: string;
    nav_tree: { items: WikiNavTreeItem[] };
  }> {
    return this.fetch(`/publications/${pubId}/nav-tree`);
  }

  /** 获取单条条目的 Markdown 内容 */
  async getEntryContent(entryId: string): Promise<WikiEntryContent> {
    return this.fetch(`/entries/${entryId}/content`);
  }

  // -------------------------------------------------------------------------
  // 辅助查询（组合原子 API，供页面组件直接调用）
  // -------------------------------------------------------------------------

  /**
   * 通过 slug 查找已发布的 Publication
   *
   * 当前后端不支持 slug 直查，先列出再匹配。
   * 后续若后端提供 `/publications?slug=xxx` 接口可直接替换实现。
   */
  async findPublicationBySlug(slug: string): Promise<WikiPublication | null> {
    const result = await this.listPublications();
    return result.items.find((p) => p.slug === slug) ?? null;
  }

  /**
   * 通过 entry_slug 查找对应的 entry_id
   *
   * 当前后端不支持按 slug 查询 entry，先获取 entries 列表再匹配。
   */
  async findEntryId(pubId: string, entrySlug: string): Promise<string | null> {
    const result = await this.getEntries(pubId);
    const match = result.items.find((e) => e.entry_slug === entrySlug);
    return match?.id ?? null;
  }
}

export const wikiApi = new WikiApiClient();
