"use client";

import { CatalogTree } from "./CatalogTree";
import { CatalogTreeToolbar } from "./CatalogTreeToolbar";
import { CatalogContextMenu } from "./CatalogContextMenu";
import { CatalogNode } from "@/features/knowledge";

interface DragState {
  draggedId: string | null;
  targetId: string | null;
  position: "before" | "inside" | "after" | null;
}

interface CatalogTreePaneProps {
  catalogLoading: boolean;
  catalogError: string | null;
  treeLoading: boolean;
  nodes: CatalogNode[];
  selectedNodeId: string | null;
  expandedIds: Set<string>;
  searchQuery: string;
  editingNodeId: string | null;
  dragState: DragState;
  contextMenu: { x: number; y: number; node: CatalogNode | null } | null;
  onSearchChange: (q: string) => void;
  onSelectNode: (node: CatalogNode | null) => void;
  onToggleExpand: (id: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onAddChild: (parentId: string) => void;
  onContextMenu: (node: CatalogNode | null, e: React.MouseEvent) => void;
  onRename: (nodeId: string, newName: string) => void;
  onCancelEdit: () => void;
  onDragStart: (nodeId: string) => void;
  onDragOver: (targetId: string, e: React.DragEvent) => void;
  onDrop: (targetId: string) => void;
  onDragEnd: () => void;
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
  dragState,
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
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
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
            dragState={dragState}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
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
