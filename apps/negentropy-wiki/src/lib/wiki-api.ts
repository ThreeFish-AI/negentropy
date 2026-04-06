/**
 * Wiki API 客户端
 *
 * 用于 SSG 构建时从后端拉取 Wiki 发布数据（Publications、Entries、NavTree、Content）。
 * 运行时通过 ISR 增量再验证保持数据新鲜度。
 */

const API_BASE =
  typeof process !== "undefined"
    ? process.env.WIKI_API_BASE || "http://localhost:8000"
    : "http://localhost:8000";

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface WikiPublication {
  id: string;
  corpus_id: string;
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
  document_id: string;
  entry_slug: string;
  entry_title: string | null;
  is_index_page: boolean;
}

export interface WikiNavTreeItem {
  entry_id: string;
  entry_slug: string;
  entry_title: string;
  is_index_page: boolean;
  document_id: string;
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
}

export const wikiApi = new WikiApiClient();
