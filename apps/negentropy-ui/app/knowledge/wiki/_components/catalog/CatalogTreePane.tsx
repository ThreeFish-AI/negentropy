"use client";

import {
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { CatalogNode } from "@/features/knowledge";
import { CatalogTree } from "./CatalogTree";
import { CatalogTreeToolbar } from "./CatalogTreeToolbar";
import { CatalogContextMenu } from "./CatalogContextMenu";

import type { DropTarget } from "../../_hooks/useCatalogTreeDnd";

interface CatalogTreePaneProps {
  catalogLoading: boolean;
  catalogError: string | null;
  treeLoading: boolean;
  nodes: CatalogNode[];
  selectedNodeId: string | null;
  expandedIds: Set<string>;
  searchQuery: string;
  editingNodeId: string | null;
  contextMenu: { x: number; y: number; node: CatalogNode | null } | null;

  /* Tree actions */
  onSearchChange: (q: string) => void;
  onSelectNode: (node: CatalogNode | null) => void;
  onToggleExpand: (id: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onAddChild: (parentId: string) => void;
  onContextMenu: (node: CatalogNode | null, e: React.MouseEvent) => void;
  onRename: (nodeId: string, newName: string) => void;
  onCancelEdit: () => void;

  /* @dnd-kit DnD — consolidated API */
  dndSensors: ReturnType<typeof import("@dnd-kit/core").useSensors>;
  dndCollisionDetection: typeof import("@dnd-kit/core").closestCenter;
  onDndDragStart: (event: DragStartEvent) => void;
  onDndDragMove: (event: DragMoveEvent) => void;
  onDndDragEnd: (event: DragEndEvent) => void;
  onDndDragCancel: () => void;
  activeId: UniqueIdentifier | null;
  activeNode: CatalogNode | null;
  dropTarget: DropTarget | null;
  isMoving: boolean;

  /* Context menu actions */
  onContextAddChild: (parentId: string) => void;
  onContextRename: (nodeId: string) => void;
  onContextCopyId: (nodeId: string) => void;
  onContextDelete: (node: CatalogNode) => void;
  onCloseContextMenu: () => void;
}

export function CatalogTreePane({
  catalogLoading,
  catalogError,
  treeLoading,
  nodes,
  selectedNodeId,
  expandedIds,
  searchQuery,
  editingNodeId,
  contextMenu,
  onSearchChange,
  onSelectNode,
  onToggleExpand,
  onCollapseAll,
  onExpandAll,
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

  onContextAddChild,
  onContextRename,
  onContextCopyId,
  onContextDelete,
  onCloseContextMenu,
}: CatalogTreePaneProps) {
  return (
    <aside className="w-[300px] shrink-0 flex flex-col gap-2 overflow-hidden">
      {catalogLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">加载目录...</p>
        </div>
      ) : catalogError ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed border-destructive/50">
          <p className="text-sm text-destructive">{catalogError}</p>
        </div>
      ) : treeLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      ) : (
        <>
          <CatalogTreeToolbar
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            onCollapseAll={onCollapseAll}
            onAddRoot={() => onAddChild("")}
            nodeCount={nodes.length}
          />
          <CatalogTree
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            expandedIds={expandedIds}
            searchQuery={searchQuery}
            editingNodeId={editingNodeId}
            onSelectNode={onSelectNode}
            onToggleExpand={onToggleExpand}
            onAddChild={onAddChild}
            onContextMenu={onContextMenu}
            onRename={onRename}
            onCancelEdit={onCancelEdit}
            dndSensors={dndSensors}
            dndCollisionDetection={dndCollisionDetection}
            onDndDragStart={onDndDragStart}
            onDndDragMove={onDndDragMove}
            onDndDragEnd={onDndDragEnd}
            onDndDragCancel={onDndDragCancel}
            activeId={activeId}
            activeNode={activeNode}
            dropTarget={dropTarget}
            isMoving={isMoving}
          />
        </>
      )}

      {contextMenu && (
        <CatalogContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={onCloseContextMenu}
          onAddChild={onContextAddChild}
          onAddRoot={() => onAddChild("")}
          onRename={onContextRename}
          onCopyId={onContextCopyId}
          onDelete={onContextDelete}
          onExpandAll={onExpandAll}
          onCollapseAll={onCollapseAll}
        />
      )}
    </aside>
  );
}
