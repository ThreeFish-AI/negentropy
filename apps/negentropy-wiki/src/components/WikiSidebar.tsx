import Link from "next/link";
import { WikiNavTree } from "./WikiNavTree";
import type { WikiNavTreeItem } from "@/lib/wiki-api";

/**
 * Wiki 侧边栏 — 统一 Publication 首页与文档详情页的左栏渲染。
 *
 * 根据 `activeSlug` 是否传入，自动切换两种模式：
 *   - 未传（Publication 根页）：品牌为纯文本，显示描述与首页链接
 *   - 已传（文档详情页）：品牌为返回链接（← 前缀），导航树高亮当前页
 */

interface WikiSidebarProps {
  pubSlug: string;
  publication: { name: string; description?: string | null };
  sidebarItems: WikiNavTreeItem[];
  hasActiveItem: boolean;
  activeSlug?: string;
  indexEntry?: WikiNavTreeItem | null;
}

export function WikiSidebar({
  pubSlug,
  publication,
  sidebarItems,
  hasActiveItem,
  activeSlug,
  indexEntry,
}: WikiSidebarProps) {
  const isEntryPage = activeSlug !== undefined;

  return (
    <>
      <div className="wiki-sidebar-header">
        {isEntryPage ? (
          <Link
            href={`/${pubSlug}`}
            className="wiki-sidebar-back wiki-sidebar-brand"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- next.config.ts 已设 images.unoptimized，next/image 在此无优化收益 */}
            <img
              src="/logo.png"
              alt="Negentropy"
              className="wiki-sidebar-logo"
            />
            <span className="wiki-sidebar-title">← {publication.name}</span>
          </Link>
        ) : (
          <div className="wiki-sidebar-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- next.config.ts 已设 images.unoptimized，next/image 在此无优化收益 */}
            <img
              src="/logo.png"
              alt="Negentropy"
              className="wiki-sidebar-logo"
            />
            <span className="wiki-sidebar-title">{publication.name}</span>
          </div>
        )}
      </div>
      {!isEntryPage && publication.description && (
        <p className="wiki-sidebar-desc">{publication.description}</p>
      )}
      {!isEntryPage && indexEntry && (
        <Link
          href={`/${pubSlug}/${indexEntry.entry_slug}`}
          className="wiki-nav-link active"
        >
          🏠 首页
        </Link>
      )}
      {sidebarItems.length > 0 ? (
        <nav>
          <WikiNavTree
            items={sidebarItems}
            pubSlug={pubSlug}
            activeSlug={activeSlug}
          />
        </nav>
      ) : (
        hasActiveItem && (
          <p className="wiki-text-hint wiki-empty-hint">该分组暂无文档</p>
        )
      )}
    </>
  );
}
