import Link from "next/link";
import {
  findFirstDocumentSlug,
  isContainerItem,
  type WikiNavTreeItem,
} from "@/lib/wiki-api";

/**
 * Wiki 顶部 Header 导航 — 把 catalog 第一层提升为 tabs
 *
 * 设计参考：GitHub Docs / Stripe Docs / Docusaurus —— 顶部 tabs + 左侧 sidebar 子树。
 *
 * - Server Component（仅 `<Link>`，零客户端状态）；保持 SSG 友好。
 * - tab 跳转目标：DOCUMENT 直链；CONTAINER → DFS 找首个后代 DOCUMENT；无文档则禁用。
 * - `items` 为空时早返回 `null`，避免渲染空壳。
 */

interface WikiHeaderProps {
  pubSlug: string;
  items: WikiNavTreeItem[];
  activeTopSlug?: string;
}

export function WikiHeader({ pubSlug, items, activeTopSlug }: WikiHeaderProps) {
  if (!items.length) return null;

  return (
    <header className="wiki-header">
      <div className="wiki-header-inner">
        <Link href="/" className="wiki-header-brand" aria-label="返回 Wiki 首页">
          {/* eslint-disable-next-line @next/next/no-img-element -- next.config.ts 已设 images.unoptimized，next/image 在此无优化收益 */}
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
          {items.map((item) => (
            <WikiHeaderTab
              key={`${item.entry_id ?? "c"}:${item.entry_slug}`}
              item={item}
              pubSlug={pubSlug}
              isActive={item.entry_slug === activeTopSlug}
            />
          ))}
        </nav>
        <div className="wiki-header-slot" aria-hidden="true" />
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
  const className = `wiki-header-tab${isActive ? " active" : ""}`;
  const label = item.entry_title || item.entry_slug;

  if (!targetSlug) {
    return (
      <span
        className={`${className} disabled`}
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
      className={className}
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
