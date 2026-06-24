import Link from "next/link";

import {
  entryHref,
  findFirstDocumentSlug,
  RESERVED_DOCS_HOME,
  RESERVED_DOCS_LABEL,
  type HeaderTopNavItem,
  type ReservedDocsTab,
  type WikiNavTreeItem,
} from "@/lib/wiki-api";

/**
 * 移动端抽屉顶部的全站一级菜单（桌面顶栏的移动等价物）。
 *
 * 桌面 ≤768px 时右区 `.wiki-header-tabs--right` 隐藏（见 header.css），一级导航改由
 * 移动抽屉承载。本组件把全站稳定模型纵向列出，使「Negentropy」（纯链接）与各动态 pub
 * 一级菜单在移动端同样并存。保留 pub 的二级目录由抽屉下半部的页面 sidebar（全树）承载，
 * 与桌面对称、不在此重复列出。
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
  return target ? entryHref(pubSlug, target) : null;
}

export function WikiHeaderMobileNav({ reservedTab, topNav = [] }: WikiHeaderMobileNavProps) {
  const hasReserved = reservedTab?.show;
  if (!hasReserved && topNav.length === 0) return null;

  return (
    <nav className="wiki-mobile-topnav" aria-label="一级导航">
      {hasReserved && (
        <Link href={reservedTab.href ?? RESERVED_DOCS_HOME} className="wiki-mobile-topnav-link">
          {reservedTab.label ?? RESERVED_DOCS_LABEL}
        </Link>
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
