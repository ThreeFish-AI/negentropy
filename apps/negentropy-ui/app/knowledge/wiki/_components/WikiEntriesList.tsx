"use client";

import { useMemo } from "react";
import { WikiNavTreeItem } from "@/features/knowledge";

interface WikiEntriesListProps {
  navTree: WikiNavTreeItem[];
  loading: boolean;
  emptyHint?: string;
}

interface FlatItem {
  key: string;
  depth: number;
  title: string;
  slug: string;
  isContainer: boolean;
}

function flattenNavTree(
  items: WikiNavTreeItem[],
  depth: number,
  pathPrefix: string,
  out: FlatItem[],
): void {
  for (const item of items) {
    const slugPath = pathPrefix
      ? `${pathPrefix}/${item.slug}`
      : item.slug;
    out.push({
      key: `${item.entry_id ?? "container"}:${slugPath}:${depth}`,
      depth,
      title: item.title,
      slug: slugPath,
      isContainer: item.entry_id === null,
    });
    if (item.children.length > 0) {
      flattenNavTree(item.children, depth + 1, slugPath, out);
    }
  }
}

export function WikiEntriesList({
  navTree,
  loading,
  emptyHint = "暂无条目，点击「从 Catalog 同步」拉取",
}: WikiEntriesListProps) {
  const flat = useMemo(() => {
    const out: FlatItem[] = [];
    flattenNavTree(navTree, 0, "", out);
    return out;
  }, [navTree]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted">加载中...</p>
      </div>
    );
  }

  if (flat.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background divide-y divide-border max-h-[420px] overflow-y-auto">
      {flat.map((item) => (
        <div
          key={item.key}
          className="flex items-center gap-2 px-3 py-1.5 text-sm"
          style={{ paddingLeft: `${item.depth * 16 + 12}px` }}
        >
          <span className="text-muted text-xs">
            {item.isContainer ? "📁" : "📄"}
          </span>
          <span
            className={`truncate ${
              item.isContainer
                ? "font-medium text-foreground"
                : "text-foreground"
            }`}
          >
            {item.title}
          </span>
          <span className="ml-auto text-[10px] text-muted font-mono truncate max-w-[50%]">
            /{item.slug}
          </span>
        </div>
      ))}
    </div>
  );
}
