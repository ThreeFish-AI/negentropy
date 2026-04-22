import Link from "next/link";
import type { WikiNavTreeItem } from "@/lib/wiki-api";

interface WikiNavTreeProps {
  items: WikiNavTreeItem[];
  pubSlug: string;
  activeSlug?: string;
}

export function WikiNavTree({ items, pubSlug, activeSlug }: WikiNavTreeProps) {
  if (!items || items.length === 0) {
    return null;
  }
  return (
    <ul className="wiki-nav-list">
      {items.map((item, idx) => (
        <WikiNavNode
          key={`${item.entry_id ?? "c"}:${item.entry_slug}:${idx}`}
          item={item}
          pubSlug={pubSlug}
          activeSlug={activeSlug}
        />
      ))}
    </ul>
  );
}

interface WikiNavNodeProps {
  item: WikiNavTreeItem;
  pubSlug: string;
  activeSlug?: string;
}

function WikiNavNode({ item, pubSlug, activeSlug }: WikiNavNodeProps) {
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const isContainer = item.entry_id === null;
  const isActive = !!activeSlug && item.entry_slug === activeSlug;

  return (
    <li className="wiki-nav-item">
      {isContainer ? (
        <span className="wiki-nav-group">{item.entry_title}</span>
      ) : (
        <Link
          href={`/${pubSlug}/${item.entry_slug}`}
          className={`wiki-nav-link${isActive ? " active" : ""}`}
        >
          {item.is_index_page ? "🏠 " : ""}
          {item.entry_title || item.entry_slug}
        </Link>
      )}
      {hasChildren && (
        <ul className="wiki-nav-list wiki-nav-sublist">
          {children.map((child, idx) => (
            <WikiNavNode
              key={`${child.entry_id ?? "c"}:${child.entry_slug}:${idx}`}
              item={child}
              pubSlug={pubSlug}
              activeSlug={activeSlug}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
