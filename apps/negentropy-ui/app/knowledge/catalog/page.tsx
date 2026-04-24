"use client";

import { useState, useCallback } from "react";
import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { CatalogSelector } from "./_components/CatalogSelector";
import { CatalogTree } from "./_components/CatalogTree";
import { CatalogTreeToolbar } from "./_components/CatalogTreeToolbar";
import { CatalogContextMenu } from "./_components/CatalogContextMenu";
import { NodeDetailPanel } from "./_components/NodeDetailPanel";
import { CreateNodeDialog } from "./_components/CreateNodeDialog";
import { useCatalogTree } from "./hooks/useCatalogTree";
import { CatalogNode, deleteCatalogNode } from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";

interface ContextMenuState {
  x: number;
  y: number;
  node: CatalogNode | null;
}

interface DragState {
  draggedId: string | null;
  targetId: string | null;
  position: "before" | "inside" | "after" | null;
}

export default function CatalogPage() {
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    draggedId: null,
    targetId: null,
    position: null,
  });

  const {
    nodes,
    selectedNode,
    selectedNodeId,
    expandedIds,
    loading,
    refresh,
    toggleExpand,
    selectNode,
    expandAll,
    collapseAll,
    renameNode,
    moveNode,
  } = useCatalogTree({ catalogId });

  const handleAddChild = useCallback((parentId: string) => {
    setAddParentId(parentId === "" ? null : parentId);
    setDialogOpen(true);
  }, []);

  const handleCreated = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleDeleted = useCallback(() => {
    selectNode(null);
    refresh();
  }, [selectNode, refresh]);

  // Context menu handlers
  const handleContextMenu = useCallback(
    (_node: CatalogNode | null, e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, node: _node });
    },
    [],
  );

  const handleContextAddChild = useCallback(
    (parentId: string) => {
      handleAddChild(parentId);
    },
    [handleAddChild],
  );

  const handleContextRename = useCallback((nodeId: string) => {
    setEditingNodeId(nodeId);
  }, []);

  const handleContextCopyId = useCallback(async (nodeId: string) => {
    try {
      await navigator.clipboard.writeText(nodeId);
      toast.success("ID 已复制");
    } catch {
      toast.error("复制失败");
    }
  }, []);

  const handleContextDelete = useCallback(
    async (node: CatalogNode) => {
      if (!catalogId) return;
      if (!confirm(`确定删除「${node.name}」？子节点将一并删除。`)) return;
      try {
        await deleteCatalogNode(catalogId, node.id);
        toast.success("节点已删除");
        handleDeleted();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "删除失败");
      }
    },
    [catalogId, handleDeleted],
  );

  const handleRename = useCallback(
    async (nodeId: string, newName: string) => {
      setEditingNodeId(null);
      await renameNode(nodeId, newName);
    },
    [renameNode],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingNodeId(null);
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((nodeId: string) => {
    setDragState({ draggedId: nodeId, targetId: null, position: null });
  }, []);

  const handleDragOver = useCallback(
    (targetId: string, e: React.DragEvent) => {
      if (!dragState.draggedId) return;

      // Prevent dropping on self
      if (dragState.draggedId === targetId) return;

      // Prevent dropping on descendant (cycle detection)
      const draggedNode = nodes.find((n) => n.id === dragState.draggedId);
      if (draggedNode?.path?.includes(targetId)) return;

      // Calculate drop zone based on mouse position
      const rect = (e.target as HTMLElement).closest("[draggable]")?.getBoundingClientRect();
      if (!rect) return;

      const y = e.clientY - rect.top;
      const height = rect.height;
      let position: "before" | "inside" | "after";
      if (y < height * 0.25) {
        position = "before";
      } else if (y > height * 0.75) {
        position = "after";
      } else {
        position = "inside";
      }

      setDragState((prev) => ({
        ...prev,
        targetId,
        position,
      }));
    },
    [dragState.draggedId, nodes],
  );

  const handleDrop = useCallback(
    async (targetId: string) => {
      if (!dragState.draggedId || !catalogId) {
        setDragState({ draggedId: null, targetId: null, position: null });
        return;
      }

      const draggedNodeId = dragState.draggedId;
      const targetNode = nodes.find((n) => n.id === targetId);
      if (!targetNode) {
        setDragState({ draggedId: null, targetId: null, position: null });
        return;
      }

      let newParentId: string | null;
      let newSortOrder: number;

      if (dragState.position === "inside") {
        // Nest inside target
        newParentId = targetId;
        const targetChildren = nodes.filter((n) => n.parent_id === targetId);
        const maxSort = targetChildren.length
          ? Math.max(...targetChildren.map((n) => n.sort_order))
          : 0;
        newSortOrder = maxSort + 1000;
      } else {
        // Insert before/after target (sibling)
        newParentId = targetNode.parent_id;
        const siblings = nodes
          .filter((n) => n.parent_id === targetNode.parent_id)
          .sort((a, b) => a.sort_order - b.sort_order);
        const targetIdx = siblings.findIndex((s) => s.id === targetId);

        if (dragState.position === "before") {
          const prevSort = targetIdx > 0 ? siblings[targetIdx - 1].sort_order : 0;
          newSortOrder = (prevSort + targetNode.sort_order) / 2;
        } else {
          const nextSort =
            targetIdx < siblings.length - 1
              ? siblings[targetIdx + 1].sort_order
              : targetNode.sort_order + 2000;
          newSortOrder = (targetNode.sort_order + nextSort) / 2;
        }
      }

      setDragState({ draggedId: null, targetId: null, position: null });
      await moveNode(draggedNodeId, newParentId, newSortOrder);
    },
    [dragState.draggedId, dragState.position, catalogId, nodes, moveNode],
  );

  const handleDragEnd = useCallback(() => {
    setDragState({ draggedId: null, targetId: null, position: null });
  }, []);

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <KnowledgeNav title="Catalog" description="知识目录编册管理" />

      <div className="flex min-h-0 flex-1 px-6 py-4 gap-4">
        {/* Sidebar: Tree */}
        <aside className="w-[300px] shrink-0 flex flex-col gap-2 overflow-hidden">
          <CatalogSelector value={catalogId} onChange={setCatalogId} />

          {!catalogId ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed border-border">
              <p className="text-sm text-muted">请先选择目录</p>
              <p className="text-xs text-muted/60 mt-1">
                从上方下拉选择一个目录以管理节点
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted">加载中...</p>
            </div>
          ) : (
            <>
              <CatalogTreeToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onCollapseAll={collapseAll}
                onAddRoot={() => handleAddChild("")}
                nodeCount={nodes.length}
              />
              <CatalogTree
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                expandedIds={expandedIds}
                searchQuery={searchQuery}
                editingNodeId={editingNodeId}
                onSelectNode={selectNode}
                onToggleExpand={toggleExpand}
                onAddChild={handleAddChild}
                onContextMenu={handleContextMenu}
                onRename={handleRename}
                onCancelEdit={handleCancelEdit}
                dragState={dragState}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            </>
          )}
        </aside>

        {/* Main: Detail Panel */}
        <main className="flex-1 min-w-0 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <NodeDetailPanel
            node={selectedNode}
            catalogId={catalogId ?? ""}
            onUpdate={refresh}
            onDelete={handleDeleted}
          />
        </main>
      </div>

      {/* Create Node Dialog */}
      <CreateNodeDialog
        open={dialogOpen}
        parentId={addParentId}
        catalogId={catalogId ?? ""}
        onClose={() => {
          setDialogOpen(false);
          setAddParentId(null);
        }}
        onCreated={handleCreated}
      />

      {/* Context Menu */}
      {contextMenu && (
        <CatalogContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={() => setContextMenu(null)}
          onAddChild={handleContextAddChild}
          onAddRoot={() => handleAddChild("")}
          onRename={handleContextRename}
          onCopyId={handleContextCopyId}
          onDelete={handleContextDelete}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
        />
      )}
    </div>
  );
}
