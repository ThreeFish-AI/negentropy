import Link from "next/link";
import {
  findFirstDocumentSlug,
  isContainerItem,
  type HeaderTopNavItem,
  type ReservedDocsTab,
  type WikiNavTreeItem,
} from "@/lib/wiki-api";

/**
 * Wiki 顶部 Header 导航 — 把全站各 publication 的 catalog 第一层提升为 tabs
 *
 * - Server Component（仅 `<Link>`，零客户端状态）；保持 SSG 友好。
 * - 右区 `topNav` 是全站稳定模型（跨多个非保留 pub，每项带自身 pubSlug），与当前
 *   路由无关，使各动态一级菜单恒并存；左侧「Negentropy」保留标签承载保留 pub 二级目录。
 * - tab 跳转目标：DOCUMENT 直链；CONTAINER → DFS 找首个后代 DOCUMENT；无文档则禁用。
 * - 有 children 的 CONTAINER 项渲染为 CSS-only 下拉菜单。
 * - `topNav` 为空且无保留标签/图谱标签时早返回 `null`，避免渲染空壳。
 */

interface WikiHeaderGraphTab {
  show: boolean;
  active: boolean;
  label?: string;
}

interface WikiHeaderProps {
  /** 仅供 Knowledge Graph 标签构建 `/${pubSlug}/graph` 链接；右区 tab 各自带 pubSlug。 */
  pubSlug?: string;
  /** 右区一级 tabs：全站各非保留 pub 的 nav-tree 第一层（每项带自身 pubSlug）。 */
  topNav?: HeaderTopNavItem[];
  /** 当前所在的非保留 pub slug；身处保留 pub / 首页时为 undefined（右区不高亮）。 */
  activePubSlug?: string;
  /** 当前激活的第一层 slug，配合 activePubSlug 定位右区高亮项。 */
  activeTopSlug?: string;
  headerSlot?: React.ReactNode;
  /** 左侧「Negentropy」保留标签（纯链接，无下拉；二级目录由进入后的左栏全树承载）。 */
  reservedTab?: ReservedDocsTab;
  graphTab?: WikiHeaderGraphTab;
  searchBox?: React.ReactNode;
  actions?: React.ReactNode;
  userMenu?: React.ReactNode;
}

export function WikiHeader({
  pubSlug,
  topNav = [],
  activePubSlug,
  activeTopSlug,
  headerSlot,
  reservedTab,
  graphTab,
  searchBox,
  actions,
  userMenu,
}: WikiHeaderProps) {
  if (!topNav.length && !(graphTab?.show) && !(reservedTab?.show)) return null;

  return (
    <header className="wiki-header">
      <div className="wiki-header-inner">
        <Link href="/" className="wiki-header-brand" aria-label="返回 Wiki 首页">
          {/* eslint-disable-next-line @next/next/no-img-element -- next.config.ts 已设 images.unoptimized */}
          <img
            src="/logo.png"
            alt="Negentropy"
            className="wiki-header-logo"
            width={28}
            height={28}
          />
          <span className="wiki-header-name">Negentropy Wiki</span>
        </Link>
        {/* LEFT: 保留一级目录「Negentropy」（最左）+ Knowledge Graph */}
        {(reservedTab?.show || graphTab?.show) && (
          <nav className="wiki-header-tabs wiki-header-tabs--left" aria-label="特色导航">
            {reservedTab?.show && (
              <Link
                href={reservedTab.href}
                className={`wiki-header-tab${reservedTab.active ? " active" : ""}`}
                aria-current={reservedTab.active ? "page" : undefined}
              >
                {reservedTab.label ?? "Negentropy"}
              </Link>
            )}
            {graphTab?.show && (
              <Link
                href={`/${pubSlug}/graph`}
                className={`wiki-header-tab${graphTab.active ? " active" : ""}`}
                aria-current={graphTab.active ? "page" : undefined}
              >
                {graphTab.label ?? "Knowledge Graph"}
              </Link>
            )}
          </nav>
        )}

        {/* RIGHT: 全站内容一级 tabs（跨非保留 pub，每项以自身 pubSlug 渲染） */}
        {topNav.length > 0 && (
          <nav className="wiki-header-tabs wiki-header-tabs--right" aria-label="主导航">
            {topNav.map(({ pubSlug: itemPubSlug, item }) => (
              <WikiHeaderTab
                key={`${itemPubSlug}:${item.entry_id ?? "c"}:${item.entry_slug}`}
                item={item}
                pubSlug={itemPubSlug}
                isActive={
                  !graphTab?.active &&
                  activePubSlug != null &&
                  itemPubSlug === activePubSlug &&
                  item.entry_slug === activeTopSlug
                }
              />
            ))}
          </nav>
        )}
        <div className="wiki-header-slot">
          {searchBox}
          {actions}
          {headerSlot}
          {userMenu}
        </div>
      </div>
    </header>
  );
}

interface WikiHeaderTabProps {
  item: WikiNavTreeItem;
  pubSlug: string;
  isActive: boolean;
}

function WikiHeaderTab({ item, pubSlug, isActive }: WikiHeaderTabProps) {
  const targetSlug = pickTabTargetSlug(item);
  const label = item.entry_title || item.entry_slug;

  // 顶栏一级菜单恒为纯链接（无下拉箭头）：CONTAINER → DFS 首个后代 DOCUMENT 作为入口，
  // 其子项由进入后的左栏侧边导航承载。无可达文档时渲染禁用态。
  if (!targetSlug) {
    return (
      <span
        className="wiki-header-tab disabled"
        aria-disabled="true"
        tabIndex={-1}
        title="该分组暂无可用文档"
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={`/${pubSlug}/${targetSlug}`}
      className={`wiki-header-tab${isActive ? " active" : ""}`}
      aria-current={isActive ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

function pickTabTargetSlug(item: WikiNavTreeItem): string | null {
  if (!isContainerItem(item)) return item.entry_slug;
  return findFirstDocumentSlug(item);
}
