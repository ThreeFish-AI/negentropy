/**
 * Wiki 类型与导航纯函数（client-safe）
 *
 * 本模块**不**导入任何 Node 专属 API（`node:fs` / `server-only`），故可被客户端
 * 组件安全引用（类型 + 导航派生纯函数）。
 *
 * 数据访问单例 `wikiApi`（读取本地静态内容包的 `LocalContentClient`）定义在
 * `./content-source`（server-only）；服务端页面/generate 从那里导入。
 * 两者解耦是为了避免 `node:fs` 经本模块泄漏进客户端 bundle。
 *
 * wiki 站点纯静态化后不再直接或间接依赖主站数据库：构建期只读本地文件。
 */

// ---------------------------------------------------------------------------
// 保留一级目录「Negentropy」（来自仓库 docs/，由后端导出器合成进内容包）
//
// 单一事实源：slug / 首页 / 标签文案集中于此，供 Header 左侧保留标签与首页卡片
// 共享，避免散落的字符串字面量漂移。与后端 ``WikiDocsSyncSettings.reserved_slug``
// 保持一致（默认 "negentropy"）。
// ---------------------------------------------------------------------------

/** 保留 docs 一级目录的 publication slug（与后端 reserved_slug 对齐）。 */
export const RESERVED_DOCS_SLUG = "negentropy";

/** 保留 docs 一级目录首页 entry slug（docs/README.md → "readme"）。 */
export const RESERVED_DOCS_INDEX_SLUG = "readme";

/** 保留一级目录首页 href（Header 左侧标签 / 首页卡片跳转目标）。 */
export const RESERVED_DOCS_HOME = `/${RESERVED_DOCS_SLUG}/${RESERVED_DOCS_INDEX_SLUG}`;

/** 保留一级目录的头部标签文案。 */
export const RESERVED_DOCS_LABEL = "Negentropy";

/** 判定某 publication slug 是否为保留 docs 目录（用于首页右区过滤等）。 */
export function isReservedDocsSlug(slug: string | null | undefined): boolean {
  return slug === RESERVED_DOCS_SLUG;
}

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
  /** 容器节点从 Catalog 节点同步而来的描述；DOCUMENT / 历史合成节点为 null */
  entry_description?: string | null;
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
  author_name?: string | null;
  author_url?: string | null;
  source_url?: string | null;
  published_at?: string | null;
}

// ---------------------------------------------------------------------------
// 导航视图派生（供 Header tabs / Sidebar 子树切片复用）
// ---------------------------------------------------------------------------

/**
 * DFS 找首个可达 DOCUMENT 节点的 entry_slug。
 *
 * 用于 Header CONTAINER tab 的跳转目标——把第一篇文档作为该 section 的"封面"。
 * `null` 表示该子树整体没有任何 DOCUMENT，调用方应渲染为禁用 tab。
 */
export function findFirstDocumentSlug(item: WikiNavTreeItem): string | null {
  if (!isContainerItem(item)) return item.entry_slug;
  for (const child of item.children ?? []) {
    const slug = findFirstDocumentSlug(child);
    if (slug) return slug;
  }
  return null;
}

/**
 * 反查包含 `currentSlug` 的第一层节点 slug。
 *
 * - `currentSlug` 为空（如 `/{pubSlug}` 根页）→ 返回首项 slug，落实"默认首项激活"语义；
 * - `currentSlug` 非空但树中找不到（异常路径）→ 返回首项 slug 兜底；
 * - 树为空 → `undefined`。
 */
export function findActiveTopLevelSlug(
  items: WikiNavTreeItem[],
  currentSlug?: string,
): string | undefined {
  if (!items.length) return undefined;
  if (!currentSlug) return items[0].entry_slug;

  const hits = (node: WikiNavTreeItem): boolean => {
    if (node.entry_slug === currentSlug) return true;
    return (node.children ?? []).some(hits);
  };
  for (const top of items) {
    if (hits(top)) return top.entry_slug;
  }
  return items[0].entry_slug;
}

export interface WikiSectionView {
  /** Header tabs 数据源（即原始第一层） */
  headerItems: WikiNavTreeItem[];
  /** 当前激活的第一层节点 slug */
  activeTopSlug: string | undefined;
  /** 当前激活的第一层节点对象（便于上层取 children / 渲染禁用态） */
  activeItem: WikiNavTreeItem | undefined;
  /** Sidebar 待渲染子树（即激活节点的 children；原第二层及以下） */
  sidebarItems: WikiNavTreeItem[];
}

/**
 * 单一事实源：从 navItems 与 currentSlug 派生 Header / Sidebar 视图。
 *
 * 用于 `/{pubSlug}` 与 `/{pubSlug}/{...entrySlug}` 两条路由共享视图切片，
 * 杜绝两端各自重复实现 active 反查与子树切片。
 */
export function resolveSectionView(
  items: WikiNavTreeItem[],
  currentSlug?: string,
): WikiSectionView {
  const activeTopSlug = findActiveTopLevelSlug(items, currentSlug);
  const activeItem = activeTopSlug
    ? items.find((it) => it.entry_slug === activeTopSlug)
    : undefined;
  return {
    headerItems: items,
    activeTopSlug,
    activeItem,
    sidebarItems: activeItem?.children ?? [],
  };
}

// ---------------------------------------------------------------------------
// 辅助遍历（DFS 查找 / 计数 / 路径合并）
// ---------------------------------------------------------------------------

/**
 * DFS 查找导航树中标记为 `is_index_page` 的首个有效条目。
 *
 * 用于 Publication 首页渲染「🏠 首页」链接。
 */
export function findIndexEntry(items: WikiNavTreeItem[]): WikiNavTreeItem | null {
  for (const item of items) {
    if (item.is_index_page && item.entry_id) return item;
    if (item.children && item.children.length > 0) {
      const nested = findIndexEntry(item.children);
      if (nested) return nested;
    }
  }
  return null;
}

/**
 * 递归统计导航树中 DOCUMENT 类型条目的数量。
 *
 * 通过 `isContainerItem()` 排除 CONTAINER 节点，仅计实际文档。
 */
export function countLeafEntries(items: WikiNavTreeItem[]): number {
  let total = 0;
  for (const item of items) {
    if (!isContainerItem(item) && item.entry_id) total += 1;
    if (item.children && item.children.length > 0) {
      total += countLeafEntries(item.children);
    }
  }
  return total;
}

/**
 * DFS 搜索导航树，构建从根到目标 slug 的面包屑路径。
 *
 * 返回 `{ label, slug | null }[]`，CONTAINER 节点 slug 为 null（不可点击）。
 */
export function buildBreadcrumbPath(
  items: WikiNavTreeItem[],
  activeSlug: string,
): { label: string; slug: string | null }[] {
  for (const item of items) {
    if (item.entry_slug === activeSlug) {
      return [{ label: item.entry_title || item.entry_slug, slug: item.entry_slug }];
    }
    if (item.children && item.children.length > 0) {
      const nested = buildBreadcrumbPath(item.children, activeSlug);
      if (nested.length > 0) {
        return [
          { label: item.entry_title || item.entry_slug, slug: isContainerItem(item) ? null : item.entry_slug },
          ...nested,
        ];
      }
    }
  }
  return [];
}

/**
 * 将 catch-all 路由参数合并为完整 entry slug。
 *
 * entry_slug 使用 Materialized Path（可能包含 `/`），
 * Next.js catch-all 路由将其拆为数组；此函数还原为原始 slug。
 */
export function joinEntrySlug(segments: string[] | string): string {
  return Array.isArray(segments) ? segments.join("/") : segments;
}
