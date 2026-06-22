import Link from "next/link";

import {
  findFirstDocumentSlug,
  RESERVED_DOCS_HOME,
  RESERVED_DOCS_LABEL,
  RESERVED_DOCS_SLUG,
  type HeaderTopNavItem,
  type ReservedDocsTab,
  type WikiNavTreeItem,
} from "@/lib/wiki-api";

/**
 * 移动端抽屉顶部的全站一级菜单（桌面顶栏的移动等价物）。
 *
 * 桌面 ≤768px 时右区 `.wiki-header-tabs--right` 隐藏（见 header.css），一级导航改由
 * 移动抽屉承载。本组件把同一份全站稳定模型（保留 pub 二级目录 + 各动态 pub 一级菜单）
 * 纵向列出，使「Negentropy」与各动态一级菜单在移动端同样并存。
 *
 * Server Component（纯 `<Link>`，零客户端状态）。链接目标与桌面一致：DOCUMENT 直链、
 * CONTAINER → DFS 首个后代 DOCUMENT；无可达文档的条目跳过（不渲染死链）。
 */

interface WikiHeaderMobileNavProps {
  reservedTab?: ReservedDocsTab;
  topNav?: HeaderTopNavItem[];
}

/** CONTAINER → 首个后代 DOCUMENT slug；DOCUMENT → 自身 slug；无文档 → null。 */
function targetHref(pubSlug: string, item: WikiNavTreeItem): string | null {
  const target = findFirstDocumentSlug(item);
  return target ? `/${pubSlug}/${target}` : null;
}

export function WikiHeaderMobileNav({ reservedTab, topNav = [] }: WikiHeaderMobileNavProps) {
  const hasReserved = reservedTab?.show;
  if (!hasReserved && topNav.length === 0) return null;

  return (
    <nav className="wiki-mobile-topnav" aria-label="一级导航">
      {hasReserved && (
        <div className="wiki-mobile-topnav-group">
          <Link href={reservedTab.href ?? RESERVED_DOCS_HOME} className="wiki-mobile-topnav-title">
            {reservedTab.label ?? RESERVED_DOCS_LABEL}
          </Link>
          {(reservedTab.items ?? []).map((child) => {
            const href = targetHref(RESERVED_DOCS_SLUG, child);
            if (!href) return null;
            return (
              <Link
                key={`${child.entry_id ?? "c"}:${child.entry_slug}`}
                href={href}
                className="wiki-mobile-topnav-sublink"
              >
                {child.entry_title || child.entry_slug}
              </Link>
            );
          })}
        </div>
      )}

      {topNav.map(({ pubSlug, item }) => {
        const href = targetHref(pubSlug, item);
        if (!href) return null;
        return (
          <Link
            key={`${pubSlug}:${item.entry_id ?? "c"}:${item.entry_slug}`}
            href={href}
            className="wiki-mobile-topnav-link"
          >
            {item.entry_title || item.entry_slug}
          </Link>
        );
      })}
    </nav>
  );
}
