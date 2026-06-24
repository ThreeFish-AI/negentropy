"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { entryHref, isContainerItem, type WikiNavTreeItem } from "@/lib/wiki-api";

/**
 * 计算「当前页祖先链」的 entry_slug 集合，用于初始化展开态。
 *
 * 仅展开包含当前页的所有上层容器节点；其余容器默认折叠（GitBook/VuePress 风格）。
 * 保留 pub 的左栏渲染完整文档树（README + 各二级目录恒可见），当前页所在路径自动展开，
 * 其余二级目录点击展开。
 */
export function computeAncestorSlugs(
  items: WikiNavTreeItem[],
  activeSlug: string | undefined,
): Set<string> {
  const result = new Set<string>();
  if (!activeSlug) return result;

  const dfs = (nodes: WikiNavTreeItem[], trail: string[]): boolean => {
    for (const node of nodes) {
      const nextTrail = [...trail, node.entry_slug];
      if (node.entry_slug === activeSlug) {
        for (const slug of trail) result.add(slug);
        return true;
      }
      if (node.children && node.children.length > 0) {
        if (dfs(node.children, nextTrail)) return true;
      }
    }
    return false;
  };

  dfs(items, []);
  return result;
}

interface WikiNavTreeProps {
  items: WikiNavTreeItem[];
  pubSlug: string;
  activeSlug?: string;
}

export function WikiNavTree({ items, pubSlug, activeSlug }: WikiNavTreeProps) {
  const initialExpanded = useMemo(
    () => computeAncestorSlugs(items, activeSlug),
    [items, activeSlug],
  );
  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);

  const toggle = (slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <ul className="wiki-nav-list" role="tree">
      {items.map((item, idx) => (
        <WikiNavNode
          key={`${item.entry_id ?? "c"}:${item.entry_slug}:${idx}`}
          item={item}
          pubSlug={pubSlug}
          activeSlug={activeSlug}
          expanded={expanded}
          onToggle={toggle}
        />
      ))}
    </ul>
  );
}

interface WikiNavNodeProps {
  item: WikiNavTreeItem;
  pubSlug: string;
  activeSlug?: string;
  expanded: Set<string>;
  onToggle: (slug: string) => void;
}

function WikiNavNode({
  item,
  pubSlug,
  activeSlug,
  expanded,
  onToggle,
}: WikiNavNodeProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const isContainer = isContainerItem(item);
  const isActive = !!activeSlug && item.entry_slug === activeSlug;
  const isOpen = expanded.has(item.entry_slug);

  useEffect(() => {
    if (isActive && linkRef.current) {
      linkRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isActive]);

  return (
    <li className="wiki-nav-item" role="treeitem">
      <div className="wiki-nav-row">
        {isContainer ? (
          <button
            type="button"
            className="wiki-nav-group"
            aria-expanded={hasChildren ? isOpen : undefined}
            onClick={() => hasChildren && onToggle(item.entry_slug)}
          >
            {item.entry_title}
          </button>
        ) : (
          <Link
            ref={linkRef}
            href={entryHref(pubSlug, item.entry_slug)}
            className={`wiki-nav-link${isActive ? " active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {item.is_index_page ? "🏠 " : ""}
            {item.entry_title || item.entry_slug}
          </Link>
        )}
      </div>
      {hasChildren && (
        <div className={`wiki-nav-children${isOpen ? " open" : ""}`}>
          <ul className="wiki-nav-list wiki-nav-sublist" role="group">
            {children.map((child, idx) => (
              <WikiNavNode
                key={`${child.entry_id ?? "c"}:${child.entry_slug}:${idx}`}
                item={child}
                pubSlug={pubSlug}
                activeSlug={activeSlug}
                expanded={expanded}
                onToggle={onToggle}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
