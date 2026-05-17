"use client";

import { Search, ChevronsDownUp, FolderPlus } from "lucide-react";

interface CatalogTreeToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCollapseAll: () => void;
  onAddRoot: () => void;
  nodeCount: number;
}

export function CatalogTreeToolbar({
  searchQuery,
  onSearchChange,
  onCollapseAll,
  onAddRoot,
  nodeCount,
}: CatalogTreeToolbarProps) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-card rounded-t-lg">
      {/* Search */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索节点..."
          className="w-full rounded-md border border-border bg-background pl-7 pr-2 py-1 text-xs text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* Collapse All */}
      <button
        onClick={onCollapseAll}
        title="全部折叠"
        className="shrink-0 p-1.5 rounded-md text-muted hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <ChevronsDownUp className="h-3.5 w-3.5" />
      </button>

      {/* Add Root Node */}
      <button
        onClick={onAddRoot}
        title="添加根节点"
        className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      >
        <FolderPlus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">添加</span>
      </button>

      {/* Node count */}
      {nodeCount > 0 && (
        <span className="shrink-0 text-[10px] text-muted tabular-nums">
          {nodeCount}
        </span>
      )}
    </div>
  );
}
