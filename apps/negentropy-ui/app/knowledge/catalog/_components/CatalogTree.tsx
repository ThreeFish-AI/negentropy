"use client";

import { useMemo } from "react";
import { CatalogNode } from "@/features/knowledge";
import { CatalogTreeNode } from "./CatalogTreeNode";
import { FolderOpen, Plus } from "./icons";

interface CatalogTreeProps {
  nodes: CatalogNode[];
  selectedNodeId: string | null;
  expandedIds: Set<string>;
  onSelectNode: (node: CatalogNode | null) => void;
  onToggleExpand: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
}

export function CatalogTree({
  nodes,
  selectedNodeId,
  expandedIds,
  onSelectNode,
  onToggleExpand,
  onAddChild,
}: CatalogTreeProps) {
  // Build children count map
  const childrenCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of nodes) {
      if (node.parent_id) {
        map.set(node.parent_id, (map.get(node.parent_id) || 0) + 1);
      }
    }
    return map;
  }, [nodes]);

  // Visibility filter: show root nodes + children whose parent is expanded
  const visibleNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (node.parent_id === null) return true;
      return expandedIds.has(node.parent_id);
    });
  }, [nodes, expandedIds]);

  return (
    <div className="flex flex-col">
      {/* Root-level add button — always visible */}
      <button
        onClick={() => onAddChild("")}
        className="flex items-center gap-1.5 mb-2 px-2 py-1.5 text-xs text-muted hover:text-foreground transition-colors rounded-md hover:bg-muted/30"
      >
        <Plus className="h-3.5 w-3.5" />
        添加根节点
      </button>

      {nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="h-12 w-12 text-muted/30 mb-3" />
          <p className="text-sm text-muted">暂无目录节点</p>
          <p className="text-xs text-muted/60 mt-1">点击上方按钮创建根节点</p>
        </div>
      ) : (
        <div className="overflow-y-auto rounded-lg border border-border bg-card">
          {visibleNodes.map((node) => (
            <CatalogTreeNode
              key={node.id}
              node={node}
              depth={node.depth ?? 0}
              isExpanded={expandedIds.has(node.id)}
              hasChildren={(childrenCountMap.get(node.id) ?? 0) > 0}
              isSelected={selectedNodeId === node.id}
              onToggle={onToggleExpand}
              onSelect={(n) => onSelectNode(n)}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}
