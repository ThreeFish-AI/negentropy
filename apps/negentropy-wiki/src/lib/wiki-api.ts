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
// 内链 href 规范化（单一事实源）
//
// `next.config.ts` 设 `trailingSlash: true`，静态导出为每个路由产出目录式 HTML
// （`/pub/entry/` → `out/pub/entry/index.html`）。故全站内链须统一带尾斜杠，
// 方能在 nginx / static-web-server / GitHub Pages 等任意静态托管下稳定命中目录 index
// （无尾斜杠的目录型 URL 在部分 nginx 配置——如 SPA fallback 或缺 `$uri/`——下会 404）。
// 所有内链 href 须经此处的 helper 构造，杜绝散落的 `` `/${...}` `` 内联拼装漂移。
// ---------------------------------------------------------------------------

/**
 * 为站内绝对路径补尾斜杠；外部 URL、同页 hash、根路径原样返回。
 *
 * - 空 / `http(s)://` / `#` 开头 → 原样（外部链接 / 同页锚点，非路由）；
 * - 根 `/` → 原样（避免产出 `//`，顺带保护 `/#anchor`、`/?q`）；
 * - 其余站内路径 → 保证以 `/` 结尾（幂等），并把 query / hash 移到尾斜杠之后。
 */
export function ensureTrailingSlash(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("#")) return path;
  // 仅对核心路径补斜杠，query / hash 原样后置
  const queryIdx = path.indexOf("?");
  const hashIdx = path.indexOf("#");
  let end = path.length;
  if (queryIdx !== -1) end = Math.min(end, queryIdx);
  if (hashIdx !== -1) end = Math.min(end, hashIdx);
  const core = path.slice(0, end);
  if (core === "/" || core === "") return path;
  const suffix = path.slice(end);
  return core.endsWith("/") ? path : `${core}/${suffix}`;
}

/** entry 文档页 href：`/{pubSlug}/{entrySlug}/`（entrySlug 可含 Materialized Path `/`）。 */
export function entryHref(pubSlug: string, entrySlug: string): string {
  return ensureTrailingSlash(`/${pubSlug}/${entrySlug}`);
}

/** publication 根页 href：`/{pubSlug}/`。 */
export function pubHref(pubSlug: string): string {
  return ensureTrailingSlash(`/${pubSlug}`);
}

/** 知识图谱页 href：`/{pubSlug}/graph/`。 */
export function graphHref(pubSlug: string): string {
  return ensureTrailingSlash(`/${pubSlug}/graph`);
}

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

/** 保留一级目录首页 href（Header 左侧标签 / 首页卡片跳转目标，目录式带尾斜杠）。 */
export const RESERVED_DOCS_HOME = entryHref(RESERVED_DOCS_SLUG, RESERVED_DOCS_INDEX_SLUG);

/** 保留一级目录的头部标签文案。 */
export const RESERVED_DOCS_LABEL = "Negentropy";

/** 判定某 publication slug 是否为保留 docs 目录（用于首页右区过滤等）。 */
export function isReservedDocsSlug(slug: string | null | undefined): boolean {
  return slug === RESERVED_DOCS_SLUG;
}

/**
 * WikiHeader 左侧「Negentropy」保留标签的渲染输入。
 *
 * 始终为**纯链接**（无下拉）：点击直达保留 docs 首页（`/negentropy/readme`），
 * 其二级目录由进入后的左栏完整文档树承载，而非顶栏下拉。
 */
export interface ReservedDocsTab {
  show: boolean;
  active?: boolean;
  label?: string;
  href: string;
}

/**
 * 派生左侧「Negentropy」保留标签的 Header 渲染输入（单一事实源）。
 *
 * - `reservedExists=false` → `undefined`（保留 pub 不存在，不渲染标签）；
 * - 否则恒纯链接，`active = isReserved`（身处保留 pub 时标签高亮）。
 *
 * 保留 pub 第一层只进左栏全树侧栏、不进顶栏右区/下拉；右区只含非保留 pub
 * （见 `buildHeaderNav` 分区），故三个一级菜单全页并存且互不重复。
 */
export function buildReservedDocsTab(opts: {
  reservedExists: boolean;
  isReserved: boolean;
}): ReservedDocsTab | undefined {
  if (!opts.reservedExists) return undefined;
  return {
    show: true,
    active: opts.isReserved,
    label: RESERVED_DOCS_LABEL,
    href: RESERVED_DOCS_HOME,
  };
}

/**
 * Header 右区一级 tab 项：携带自身所属 publication 的 slug。
 *
 * 顶级菜单跨多个 publication（每个非保留 pub 的 nav-tree 第一层各贡献若干项），
 * 故每项需自带 `pubSlug` 以正确构建链接与判定激活，而非共享单一 pubSlug。
 */
export interface HeaderTopNavItem {
  pubSlug: string;
  item: WikiNavTreeItem;
}

/**
 * 全站稳定的顶栏导航模型（单一事实源）。
 *
 * - `reservedExists`：保留 pub（slug=`negentropy`）是否存在 → 决定是否渲染左侧纯链接标签；
 * - `topNav`：其余（非保留）pub 的 nav-tree 第一层 → 右区一级 tabs（每项带自身 pubSlug）；
 * - `graphPubSlug`：首个非保留 pub 的 slug（其知识图谱可作为全站顶栏「Knowledge Graph」
 *   入口；保留 pub 由 docs/ 合成、无 KG）。
 *
 * 保留 pub 第一层不进顶栏（改由左栏全树侧栏承载），与右区在 publication 维度互斥，
 * 故同一节点不会重复出现。
 */
export interface HeaderNav {
  reservedExists: boolean;
  topNav: HeaderTopNavItem[];
  graphPubSlug?: string;
}

/**
 * 从所有 publication 的 nav-tree 第一层派生全站稳定的顶栏模型（client-safe 纯函数）。
 *
 * 遍历入参（顺序即 `listPublications` 顺序，确定性稳定）按 `isReservedDocsSlug` 分区：
 * 命中保留 pub 仅置 `reservedExists=true`（其第一层交左栏全树渲染，不入顶栏）；
 * 其余 pub 第一层逐项归 `topNav`（携带 pubSlug）。
 *
 * 该模型与当前路由无关，使顶栏在任意页面呈现一致的一级菜单集合：
 * 「Negentropy」（左，纯链接）与各动态 pub 的一级菜单恒并存。
 */
export function buildHeaderNav(
  pubNavTrees: { slug: string; items: WikiNavTreeItem[] }[],
): HeaderNav {
  let reservedExists = false;
  let graphPubSlug: string | undefined;
  const topNav: HeaderTopNavItem[] = [];

  for (const { slug, items } of pubNavTrees) {
    if (isReservedDocsSlug(slug)) {
      reservedExists = true;
    } else {
      // 首个非保留 pub 作为知识图谱入口（保留 pub 由 docs/ 合成、无 KG）。
      if (!graphPubSlug) graphPubSlug = slug;
      for (const item of items) {
        topNav.push({ pubSlug: slug, item });
      }
    }
  }

  return { reservedExists, topNav, graphPubSlug };
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

/** 左栏侧边导航的渲染输入（供 `WikiSidebar` 消费）。 */
export interface WikiSidebarView {
  /** 待渲染的导航树 */
  sidebarItems: WikiNavTreeItem[];
  /** 是否存在激活分组（决定「该分组暂无文档」空态提示） */
  hasActiveItem: boolean;
  /** 侧栏品牌头显示名（null → 调用方回退 publication.name） */
  catalogName: string | null;
  /** 品牌头跳转目标 slug（null → 不可点击） */
  catalogTargetSlug: string | null;
  /** 落地页「🏠 首页」入口条目（null → 不单独渲染，由全树索引页节点承载） */
  indexEntry: WikiNavTreeItem | null;
}

/**
 * 单一事实源：按 `fullTree` 派生左栏侧边导航视图。
 *
 * - `fullTree=true`（保留 pub「Negentropy」）：采用**经典文档全树侧栏**——左栏渲染
 *   整棵 nav 树（README + 各二级目录容器），不切片到「当前 section」；品牌头回退
 *   publication.name（`catalogName=null`），落地页不另渲染独立「🏠 首页」
 *   （`indexEntry=null`，由全树中的索引页节点承载，杜绝重复）。
 * - `fullTree=false`（动态 pub）：沿用既有 section 视图——侧栏=激活第一层 section 的
 *   子树，品牌头=激活 section 名，落地页渲染索引页入口。
 *
 * 与 `resolveSectionView` 正交：后者仍单独服务顶栏右区高亮（`activeTopSlug`），
 * 其 `activeItem.children` 切片语义不被全树场景污染。
 */
export function resolveSidebarView(
  items: WikiNavTreeItem[],
  opts: { fullTree: boolean; currentSlug?: string },
): WikiSidebarView {
  if (opts.fullTree) {
    return {
      sidebarItems: items,
      hasActiveItem: items.length > 0,
      catalogName: null,
      catalogTargetSlug: null,
      indexEntry: null,
    };
  }
  const section = resolveSectionView(items, opts.currentSlug);
  const activeItem = section.activeItem;
  return {
    sidebarItems: section.sidebarItems,
    hasActiveItem: !!activeItem,
    catalogName: activeItem ? activeItem.entry_title || activeItem.entry_slug : null,
    catalogTargetSlug: activeItem ? findFirstDocumentSlug(activeItem) : null,
    indexEntry: findIndexEntry(items),
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
