/**
 * 本地静态内容源（LocalContentClient）
 *
 * 纯静态化后，wiki 站点不再在运行时/构建时调用主站后端 API，而是直接读取
 * 仓库内 `content/` 目录下由主站 publish 流程导出、并由 CI 提交的静态内容包。
 *
 * 设计要点（Orthogonal Decomposition）：
 *   - 本类与历史 `WikiApiClient`（HTTP）**接口完全一致**，故 `wiki-api.ts`
 *     导出的 `wikiApi` 单例从 HTTP 客户端切到本类后，所有页面/组件零改动。
 *   - 内容包 schema 见 `content/` 根的 README 与主站 `WikiExportService`，
 *     字段形状与原后端 API 响应逐字段对齐（DRY：导出端复用了路由层序列化）。
 *   - 仅在 Node.js（SSG 构建期）执行；`import "server-only"` 杜绝被打进
 *     客户端 bundle。
 *
 * 内容包布局（与后端导出对齐）：
 *   content/index.json                                   顶层索引（slug/id/版本 + 倒排）
 *   content/publications.json                            listPublications()
 *   content/publications/[pubSlug]/publication.json      getPublication()
 *   content/publications/[pubSlug]/nav-tree.json         getNavTree()
 *   content/publications/[pubSlug]/entries-index.json    getEntries() + slug_to_id 倒排
 *   content/publications/[pubSlug]/entries/[entryId].json getEntryContent()
 *   content/publications/[pubSlug]/graph.json            getPublicationGraph()
 */

import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  WikiEntry,
  WikiEntryContent,
  WikiNavTreeItem,
  WikiPublication,
} from "./wiki-api";
import type {
  WikiEntryGraphResponse,
  WikiGraphEntityDetailResponse,
  WikiGraphEntityListResponse,
  WikiGraphResponse,
} from "./wiki-graph-types";

/**
 * 内容包根目录。
 *
 * 默认基于 `process.cwd()`（`next build` / `next dev` 均以 wiki app 目录为
 * cwd）；可通过 `WIKI_CONTENT_DIR` 覆盖，便于单测注入 fixtures。
 */
const CONTENT_DIR = process.env.WIKI_CONTENT_DIR
  ? path.resolve(process.env.WIKI_CONTENT_DIR)
  : path.join(process.cwd(), "content");

/** 顶层索引结构（与后端导出 `index.json` 对齐）。 */
interface ContentIndex {
  schema_version: number;
  generated_at: string;
  publications: Array<{ slug: string; id: string; version: number }>;
  pubs: Record<
    string,
    {
      id: string;
      version: number;
      entry_slug_to_id: Record<string, string>;
      entry_ids: string[];
    }
  >;
}

// ---------------------------------------------------------------------------
// 文件读取 + 进程内缓存
//
// SSG 构建期为单进程多次读取同一文件，模块级 Map 缓存避免重复 IO。
// `next build` 进程内缓存即足够；运行时纯静态产物不再进入本模块。
// ---------------------------------------------------------------------------

const fileCache = new Map<string, unknown>();
let indexCache: ContentIndex | null = null;
let idToSlugCache: Map<string, string> | null = null;

async function readJson<T>(relativePath: string): Promise<T> {
  const abs = path.join(CONTENT_DIR, relativePath);
  const cached = fileCache.get(abs);
  if (cached !== undefined) return cached as T;
  const raw = await fs.readFile(abs, "utf8");
  const parsed = JSON.parse(raw) as T;
  fileCache.set(abs, parsed);
  return parsed;
}

async function getIndex(): Promise<ContentIndex> {
  if (indexCache) return indexCache;
  const idx = await readJson<ContentIndex>("index.json");
  indexCache = idx;
  return idx;
}

/** entry 文件存在性预检：缺失的 entry 跳过而非整体报错（容忍导出部分缺失）。 */
async function exists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(path.join(CONTENT_DIR, relativePath));
    return true;
  } catch {
    return false;
  }
}

/** pubId(UUID) → pubSlug 解析，基于 index.json 反查（O(1)，懒构建倒排）。 */
async function resolveSlugById(pubId: string): Promise<string | null> {
  const idx = await getIndex();
  if (idToSlugCache === null) {
    idToSlugCache = new Map();
    for (const [slug, meta] of Object.entries(idx.pubs)) {
      idToSlugCache.set(meta.id, slug);
    }
  }
  return idToSlugCache.get(pubId) ?? null;
}

// ---------------------------------------------------------------------------
// 本地内容客户端 —— 与历史 WikiApiClient 接口一一对应
// ---------------------------------------------------------------------------

export class LocalContentClient {
  /** 列出所有已发布的 Publication */
  async listPublications(): Promise<{ items: WikiPublication[]; total: number }> {
    return readJson("publications.json");
  }

  /** 获取单个 Publication 详情 */
  async getPublication(pubId: string): Promise<WikiPublication> {
    const slug = await resolveSlugById(pubId);
    if (!slug) throw new Error(`[content] publication not found by id: ${pubId}`);
    return readJson(`publications/${slug}/publication.json`);
  }

  /** 获取 Publication 的所有条目 */
  async getEntries(pubId: string): Promise<{ items: WikiEntry[]; total: number }> {
    const slug = await resolveSlugById(pubId);
    if (!slug) throw new Error(`[content] publication not found by id: ${pubId}`);
    const data = await readJson<{ items: WikiEntry[]; total: number; slug_to_id?: Record<string, string> }>(
      `publications/${slug}/entries-index.json`,
    );
    return { items: data.items, total: data.total };
  }

  /** 获取导航树 */
  async getNavTree(
    pubId: string,
  ): Promise<{ publication_id: string; nav_tree: { items: WikiNavTreeItem[] } }> {
    const slug = await resolveSlugById(pubId);
    if (!slug) throw new Error(`[content] publication not found by id: ${pubId}`);
    return readJson(`publications/${slug}/nav-tree.json`);
  }

  /** 获取单条条目的 Markdown 内容（entry 文件以全局唯一 entryId 扁平存储） */
  async getEntryContent(entryId: string): Promise<WikiEntryContent> {
    // entry 文件以 entryId（UUID，全局唯一）命名；缺失时抛错由页面层捕获渲染 pending/missing。
    return readJson(`entries/${entryId}.json`);
  }

  /** 通过 slug 查找已发布的 Publication（O(1) 经 publications.json 单次读取） */
  async findPublicationBySlug(slug: string): Promise<WikiPublication | null> {
    const { items } = await this.listPublications();
    return items.find((p) => p.slug === slug) ?? null;
  }

  /** 通过 entry_slug 查找对应的 entry_id（经 entries-index 倒排表 O(1)） */
  async findEntryId(pubId: string, entrySlug: string): Promise<string | null> {
    const slug = await resolveSlugById(pubId);
    if (!slug) return null;
    const data = await readJson<{ slug_to_id?: Record<string, string> }>(
      `publications/${slug}/entries-index.json`,
    );
    return data.slug_to_id?.[entrySlug] ?? null;
  }

  // -------------------------------------------------------------------------
  // 知识图谱（数据已在构建期烘焙为静态 JSON）
  // -------------------------------------------------------------------------

  /** 获取 Publication 整体切片图谱 */
  async getPublicationGraph(
    pubId: string,
    _opts?: { tag?: string },
  ): Promise<WikiGraphResponse> {
    const slug = await resolveSlugById(pubId);
    if (!slug) throw new Error(`[content] publication not found by id: ${pubId}`);
    const existsGraph = await exists(`publications/${slug}/graph.json`);
    if (!existsGraph) {
      // 该 publication 未烘焙图谱：返回 no_kg 空图，与后端"KG 未构建"语义一致。
      return {
        publication_id: pubId,
        version: 0,
        status: "no_kg",
        nodes: [],
        edges: [],
        truncated: false,
        total_entities: 0,
        corpus_ids: [],
      };
    }
    return readJson(`publications/${slug}/graph.json`);
  }

  /** 获取 Publication 实体扁平列表（当前页面无调用方；返回空保持契约） */
  async getPublicationEntities(
    pubId: string,
    _opts?: { tag?: string },
  ): Promise<WikiGraphEntityListResponse> {
    return {
      publication_id: pubId,
      version: 0,
      total: 0,
      offset: 0,
      limit: 0,
      items: [],
    };
  }

  /** 获取单实体详情（当前页面无调用方；返回空保持契约） */
  async getPublicationEntityDetail(
    _pubId: string,
    _entityId: string,
  ): Promise<WikiGraphEntityDetailResponse> {
    return {
      publication_id: _pubId,
      version: 0,
      entity: {
        id: "",
        name: "",
        entity_type: "",
        importance: null,
        community_id: null,
        mention_count_in_pub: 0,
        entry_slugs: [],
        corpus_id: null,
      },
      neighbors: [],
      mentioning_entries: [],
    };
  }

  /** 获取单 entry 的局部图（当前页面无调用方；返回空保持契约） */
  async getEntryGraph(
    entryId: string,
    _opts?: { maxNodes?: number },
  ): Promise<WikiEntryGraphResponse> {
    return {
      entry_id: entryId,
      publication_id: "",
      version: 0,
      status: "no_kg",
      nodes: [],
      edges: [],
      center_entity_ids: [],
    };
  }
}

// ---------------------------------------------------------------------------
// 数据访问单例
//
// 服务端页面与 generate.ts 经此单例读取静态内容包。与历史 HTTP `WikiApiClient`
// 接口一致，调用方零改动。本模块 `import "server-only"`，杜绝进入客户端 bundle。
// ---------------------------------------------------------------------------

export const wikiApi = new LocalContentClient();
