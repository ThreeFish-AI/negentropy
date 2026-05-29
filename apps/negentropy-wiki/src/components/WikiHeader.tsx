import Link from "next/link";
import {
  findFirstDocumentSlug,
  isContainerItem,
  type WikiNavTreeItem,
} from "@/lib/wiki-api";

/**
 * Wiki 顶部 Header 导航 — 把 catalog 第一层提升为 tabs
 *
 * - Server Component（仅 `<Link>`，零客户端状态）；保持 SSG 友好。
 * - tab 跳转目标：DOCUMENT 直链；CONTAINER → DFS 找首个后代 DOCUMENT；无文档则禁用。
 * - 有 children 的 CONTAINER 项渲染为 CSS-only 下拉菜单。
 * - `items` 为空时早返回 `null`，避免渲染空壳。
 */

interface WikiHeaderGraphTab {
  show: boolean;
  active: boolean;
  label?: string;
}

interface HomeLink {
  label: string;
  href: string;
}

interface WikiHeaderProps {
  pubSlug?: string;
  items?: WikiNavTreeItem[];
  activeTopSlug?: string;
  headerSlot?: React.ReactNode;
  graphTab?: WikiHeaderGraphTab;
  searchBox?: React.ReactNode;
  actions?: React.ReactNode;
  homeLinks?: HomeLink[];
}

export function WikiHeader({
  pubSlug,
  items = [],
  activeTopSlug,
  headerSlot,
  graphTab,
  searchBox,
  actions,
  homeLinks,
}: WikiHeaderProps) {
  if (!items.length && !homeLinks?.length && !(graphTab?.show)) return null;

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
        <nav className="wiki-header-tabs" aria-label="主导航">
          {homeLinks
            ? homeLinks.map((link) => (
                <Link key={link.href} href={link.href} className="wiki-header-tab">
                  {link.label}
                </Link>
              ))
            : items.map((item) => (
                <WikiHeaderTab
                  key={`${item.entry_id ?? "c"}:${item.entry_slug}`}
                  item={item}
                  pubSlug={pubSlug!}
                  isActive={!graphTab?.active && item.entry_slug === activeTopSlug}
                />
              ))}
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
        <div className="wiki-header-slot">
          {searchBox}
          {actions}
          {headerSlot}
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
  const hasChildren =
    isContainerItem(item) &&
    item.children &&
    item.children.length > 0 &&
    item.children.some((child) => pickTabTargetSlug(child) !== null);

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

  // Container with children → render dropdown
  if (hasChildren) {
    return (
      <div className={`wiki-header-dropdown${isActive ? " active" : ""}`}>
        <Link
          href={`/${pubSlug}/${targetSlug}`}
          className="wiki-header-dropdown-trigger"
          aria-current={isActive ? "page" : undefined}
        >
          {label}
          <span className="wiki-header-dropdown-arrow">▼</span>
        </Link>
        <div className="wiki-header-dropdown-panel">
          {item.children!.map((child) => {
            const childTarget = pickTabTargetSlug(child);
            const childLabel = child.entry_title || child.entry_slug;
            if (!childTarget) return null;
            return (
              <Link
                key={`${child.entry_id ?? "c"}:${child.entry_slug}`}
                href={`/${pubSlug}/${childTarget}`}
                className="wiki-header-dropdown-item"
              >
                {childLabel}
              </Link>
            );
          })}
        </div>
      </div>
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
