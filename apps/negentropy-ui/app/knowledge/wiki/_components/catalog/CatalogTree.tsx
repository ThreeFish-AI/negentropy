"use client";

import { useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CatalogNode, CatalogNodeType } from "@/features/knowledge";
import { CatalogTreeNode } from "./CatalogTreeNode";
import { DndTreeNode } from "./DndTreeNode";
import { EmptyCatalogState } from "./EmptyCatalogState";
import {
  Folder,
  FileText,
} from "./icons";

import type { DropTarget } from "../../_hooks/useCatalogTreeDnd";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

  /* @dnd-kit DnD */
  dndSensors: ReturnType<typeof import("@dnd-kit/core").useSensors>;
  dndCollisionDetection: typeof import("@dnd-kit/core").closestCenter;
  onDndDragStart: (event: DragStartEvent) => void;
  onDndDragMove: (event: DragMoveEvent) => void;
  onDndDragEnd: (event: DragEndEvent) => void;
  onDndDragCancel: () => void;
  activeId: import("@dnd-kit/core").UniqueIdentifier | null;
  activeNode: CatalogNode | null;
  dropTarget: DropTarget | null;
  isMoving: boolean;
}

// ---------------------------------------------------------------------------
// Drag overlay preview
// ---------------------------------------------------------------------------

const NODE_TYPE_OVERLAY_ICONS: Record<CatalogNodeType, typeof Folder> = {
  folder: Folder,
  document_ref: FileText,
  category: Folder,
  collection: Folder,
};

const NODE_TYPE_OVERLAY_COLORS: Record<CatalogNodeType, string> = {
  folder: "text-amber-500",
  document_ref: "text-text-muted",
  category: "text-amber-500",
  collection: "text-amber-500",
};

function DragOverlayPreview({ node }: { node: CatalogNode }) {
  const Icon = NODE_TYPE_OVERLAY_ICONS[node.node_type] || Folder;
  const color = NODE_TYPE_OVERLAY_COLORS[node.node_type] || "text-text-muted";

  return (
    <div className="flex items-center gap-2 rounded-lg bg-card border border-primary/20 shadow-lg px-3 py-1.5 text-sm opacity-90">
      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
      <span className="font-medium truncate max-w-[200px]">{node.name}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CatalogTree
// ---------------------------------------------------------------------------

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

  dndSensors,
  dndCollisionDetection,
  onDndDragStart,
  onDndDragMove,
  onDndDragEnd,
  onDndDragCancel,
  activeId,
  activeNode,
  dropTarget,
  isMoving,
}: CatalogTreeProps) {
  // Reorder flat list into DFS traversal order (same as before)
  const dfsOrderedNodes = useMemo(() => {
    const childrenMap = new Map<string, CatalogNode[]>();
    const roots: CatalogNode[] = [];

    for (const node of nodes) {
      if (node.parent_id) {
        const siblings = childrenMap.get(node.parent_id) ?? [];
        siblings.push(node);
        childrenMap.set(node.parent_id, siblings);
      } else {
        roots.push(node);
      }
    }

    const sortByOrder = (a: CatalogNode, b: CatalogNode) =>
      a.sort_order - b.sort_order;
    roots.sort(sortByOrder);
    for (const siblings of childrenMap.values()) {
      siblings.sort(sortByOrder);
    }

    const result: CatalogNode[] = [];
    const visit = (node: CatalogNode) => {
      result.push(node);
      for (const child of childrenMap.get(node.id) ?? []) visit(child);
    };
    for (const root of roots) visit(root);
    return result;
  }, [nodes]);

  // Build children count map
  const childrenCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of dfsOrderedNodes) {
      if (node.parent_id) {
        map.set(node.parent_id, (map.get(node.parent_id) || 0) + 1);
      }
    }
    return map;
  }, [dfsOrderedNodes]);

  // Search filtering: match nodes + their ancestors
  const filteredNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const matched = new Set<string>();
    for (const node of dfsOrderedNodes) {
      if (node.name.toLowerCase().includes(q)) {
        matched.add(node.id);
        for (const ancestorId of node.path ?? []) {
          matched.add(ancestorId);
        }
      }
    }
    return matched;
  }, [dfsOrderedNodes, searchQuery]);

  // Visibility filter
  const visibleNodes = useMemo(() => {
    const effectiveExpanded = new Set(expandedIds);
    if (filteredNodeIds) {
      for (const node of dfsOrderedNodes) {
        if (filteredNodeIds.has(node.id) && node.parent_id) {
          effectiveExpanded.add(node.parent_id);
        }
      }
    }

    return dfsOrderedNodes.filter((node) => {
      if (filteredNodeIds && !filteredNodeIds.has(node.id)) return false;
      if (node.parent_id === null) return true;
      return effectiveExpanded.has(node.parent_id);
    });
  }, [dfsOrderedNodes, expandedIds, filteredNodeIds]);

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
    <DndContext
      sensors={dndSensors}
      collisionDetection={dndCollisionDetection}
      onDragStart={onDndDragStart}
      onDragMove={onDndDragMove}
      onDragEnd={onDndDragEnd}
      onDragCancel={onDndDragCancel}
    >
      <div className="overflow-y-auto rounded-lg border border-border bg-card flex-1 min-h-0">
        {visibleNodes.map((node) => {
          const nodeDropTarget =
            dropTarget?.overId === node.id ? dropTarget.position : null;

          return (
            <DndTreeNode
              key={node.id}
              node={node}
              isEditing={editingNodeId === node.id}
              isMoving={isMoving}
            >
              <CatalogTreeNode
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
                dropTarget={nodeDropTarget}
              />
            </DndTreeNode>
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeNode ? <DragOverlayPreview node={activeNode} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
