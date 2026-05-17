"use client";

import { useMemo } from "react";
import { CatalogNode } from "@/features/knowledge";
import { CatalogTreeNode } from "./CatalogTreeNode";
import { EmptyCatalogState } from "./EmptyCatalogState";

interface CatalogTreeProps {
  nodes: CatalogNode[];
  selectedNodeId: string | null;
  expandedIds: Set<string>;
  searchQuery: string;
  editingNodeId: string | null;
  onSelectNode: (node: CatalogNode | null) => void;
  onToggleExpand: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
  onContextMenu: (node: CatalogNode | null, e: React.MouseEvent) => void;
  onRename: (nodeId: string, newName: string) => void;
  onCancelEdit: () => void;
  dragState: { draggedId: string | null; targetId: string | null; position: "before" | "inside" | "after" | null } | null;
  onDragStart: (nodeId: string) => void;
  onDragOver: (nodeId: string, e: React.DragEvent) => void;
  onDrop: (nodeId: string) => void;
  onDragEnd: () => void;
}

export function CatalogTree({
  nodes,
  selectedNodeId,
  expandedIds,
  searchQuery,
  editingNodeId,
  onSelectNode,
  onToggleExpand,
  onAddChild,
  onContextMenu,
  onRename,
  onCancelEdit,
  dragState,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
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

  // Search filtering: match nodes + their ancestors
  const filteredNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const matched = new Set<string>();
    for (const node of nodes) {
      if (node.name.toLowerCase().includes(q)) {
        matched.add(node.id);
        // Include ancestors
        for (const ancestorId of node.path ?? []) {
          matched.add(ancestorId);
        }
      }
    }
    return matched;
  }, [nodes, searchQuery]);

  // Visibility filter: show root nodes + children whose parent is expanded
  // When searching, auto-expand matched ancestors
  const visibleNodes = useMemo(() => {
    const effectiveExpanded = new Set(expandedIds);
    // Auto-expand ancestors of search matches
    if (filteredNodeIds) {
      for (const node of nodes) {
        if (filteredNodeIds.has(node.id) && node.parent_id) {
          effectiveExpanded.add(node.parent_id);
        }
      }
    }

    return nodes.filter((node) => {
      // Apply search filter
      if (filteredNodeIds && !filteredNodeIds.has(node.id)) return false;
      if (node.parent_id === null) return true;
      return effectiveExpanded.has(node.parent_id);
    });
  }, [nodes, expandedIds, filteredNodeIds]);

  // Highlight matching text
  const highlightMatch = (text: string) => {
    if (!searchQuery.trim()) return text;
    const q = searchQuery.toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-primary/20 text-foreground rounded-sm px-0.5">
          {text.slice(idx, idx + searchQuery.length)}
        </mark>
        {text.slice(idx + searchQuery.length)}
      </>
    );
  };

  if (nodes.length === 0) {
    return <EmptyCatalogState onAddRoot={() => onAddChild("")} />;
  }

  return (
    <div className="overflow-y-auto rounded-lg border border-border bg-card flex-1 min-h-0">
      {visibleNodes.map((node) => (
        <CatalogTreeNode
          key={node.id}
          node={node}
          depth={node.depth ?? 0}
          isExpanded={expandedIds.has(node.id)}
          hasChildren={(childrenCountMap.get(node.id) ?? 0) > 0}
          isSelected={selectedNodeId === node.id}
          isEditing={editingNodeId === node.id}
          searchQuery={searchQuery}
          onToggle={onToggleExpand}
          onSelect={(n) => onSelectNode(n)}
          onAddChild={onAddChild}
          onContextMenu={onContextMenu}
          onRename={onRename}
          onCancelEdit={onCancelEdit}
          highlightMatch={highlightMatch}
          isDragging={dragState?.draggedId === node.id}
          dropTarget={dragState?.targetId === node.id ? dragState.position : null}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
        />
      ))}
    </div>
  );
}
