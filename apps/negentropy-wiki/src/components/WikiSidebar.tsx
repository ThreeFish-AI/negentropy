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
  /** 当前激活的一级 Catalog 首篇文档 slug，用于替换 publication.name 显示 */
  catalogTargetSlug?: string | null;
  /** 当前激活的一级 Catalog 显示名 */
  catalogName?: string | null;
}

export function WikiSidebar({
  pubSlug,
  publication,
  sidebarItems,
  hasActiveItem,
  activeSlug,
  indexEntry,
  catalogTargetSlug,
  catalogName,
}: WikiSidebarProps) {
  const isEntryPage = activeSlug !== undefined;

  const renderBrand = (href: string, title: string, className: string) => (
    <Link href={href} className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next.config.ts 已设 images.unoptimized，next/image 在此无优化收益 */}
      <img
        src="/logo.png"
        alt="Negentropy"
        className="wiki-sidebar-logo"
      />
      <span className="wiki-sidebar-title">{title}</span>
    </Link>
  );

  return (
    <>
      {!isEntryPage && (
        <div className="wiki-sidebar-header">
          {catalogName ? (
            catalogTargetSlug ? (
              renderBrand(
                `/${pubSlug}/${catalogTargetSlug}`,
                catalogName,
                "wiki-sidebar-brand",
              )
            ) : (
              <div className="wiki-sidebar-brand">
                {/* eslint-disable-next-line @next/next/no-img-element -- next.config.ts 已设 images.unoptimized，next/image 在此无优化收益 */}
                <img
                  src="/logo.png"
                  alt="Negentropy"
                  className="wiki-sidebar-logo"
                />
                <span className="wiki-sidebar-title">{catalogName}</span>
              </div>
            )
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
      )}
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
