"use client";

import Link from "next/link";
import { useMemo, useState, type KeyboardEvent } from "react";
import type { WikiNavTreeItem } from "@/lib/wiki-api";

/**
 * 计算「当前页祖先链」的 entry_slug 集合，用于初始化展开态。
 *
 * 仅展开包含当前页的所有上层容器节点；其余容器默认折叠（GitBook/VuePress 风格）。
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
    <ul className="wiki-nav-list">
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
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const isContainer = item.entry_id === null;
  const isActive = !!activeSlug && item.entry_slug === activeSlug;
  const isOpen = expanded.has(item.entry_slug);

  const handleToggleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(item.entry_slug);
    }
  };

  return (
    <li className="wiki-nav-item">
      <div className="wiki-nav-row">
        {hasChildren && (
          <button
            type="button"
            className={`wiki-nav-toggle${isOpen ? " open" : ""}`}
            aria-label={isOpen ? "折叠" : "展开"}
            aria-expanded={isOpen}
            onClick={() => onToggle(item.entry_slug)}
            onKeyDown={handleToggleKey}
          >
            <ChevronIcon />
          </button>
        )}
        {!hasChildren && <span className="wiki-nav-toggle wiki-nav-toggle-spacer" aria-hidden="true" />}
        {isContainer ? (
          <button
            type="button"
            className="wiki-nav-group"
            onClick={() => hasChildren && onToggle(item.entry_slug)}
          >
            {item.entry_title}
          </button>
        ) : (
          <Link
            href={`/${pubSlug}/${item.entry_slug}`}
            className={`wiki-nav-link${isActive ? " active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {item.is_index_page ? "🏠 " : ""}
            {item.entry_title || item.entry_slug}
          </Link>
        )}
      </div>
      {hasChildren && isOpen && (
        <ul className="wiki-nav-list wiki-nav-sublist">
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
      )}
    </li>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="5 3 11 8 5 13" />
    </svg>
  );
}
