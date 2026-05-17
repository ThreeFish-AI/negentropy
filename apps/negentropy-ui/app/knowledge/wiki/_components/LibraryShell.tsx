"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { CatalogNode, deleteCatalogNode } from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";

import { useSingletonCatalog } from "../_hooks/useSingletonCatalog";
import { useCatalogTree } from "../_hooks/useCatalogTree";
import { useWikiPublications } from "../_hooks/useWikiPublications";

import { ModeToggle, type ViewMode } from "./ModeToggle";
import { CatalogTreePane } from "./catalog/CatalogTreePane";
import { NodeDetailPanel } from "./catalog/NodeDetailPanel";
import { CreateNodeDialog } from "./catalog/CreateNodeDialog";
import { WikiPublicationList } from "./WikiPublicationList";
import { WikiPublicationDetail } from "./WikiPublicationDetail";
import { CreateWikiPublicationDialog } from "./CreateWikiPublicationDialog";

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

export function LibraryShell({ initialMode }: { initialMode: ViewMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, confirmDialog } = useConfirmDialog();

  const { catalogId, loading: catalogLoading, error: catalogError } = useSingletonCatalog();
  const treeApi = useCatalogTree({ catalogId });
  const pubsApi = useWikiPublications({ catalogId });

  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [createPubOpen, setCreatePubOpen] = useState(false);
  const [dragState, setDragState] = useState<DragState>({
    draggedId: null,
    targetId: null,
    position: null,
  });

  const handleModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      const params = new URLSearchParams(searchParams.toString());
      params.set("mode", mode);
      router.replace(`/knowledge/wiki?${params.toString()}`);
    },
    [router, searchParams],
  );

  // --- Catalog handlers ---
  const handleAddChild = useCallback((parentId: string) => {
    setAddParentId(parentId === "" ? null : parentId);
    setDialogOpen(true);
  }, []);

  const handleCreated = useCallback(() => {
    treeApi.refresh();
  }, [treeApi]);

  const handleDeleted = useCallback(() => {
    treeApi.selectNode(null);
    treeApi.refresh();
  }, [treeApi]);

  const handleContextMenu = useCallback(
    (_node: CatalogNode | null, e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, node: _node });
    },
    [],
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
      const confirmed = await confirm({
        title: "删除目录节点",
        message: `确定删除「${node.name}」？子节点将一并删除。`,
        confirmLabel: "删除",
        destructive: true,
      });
      if (!confirmed) return;
      try {
        await deleteCatalogNode(catalogId, node.id);
        toast.success("节点已删除");
        handleDeleted();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "删除失败");
      }
    },
    [catalogId, confirm, handleDeleted],
  );

  const handleRename = useCallback(
    async (nodeId: string, newName: string) => {
      setEditingNodeId(null);
      await treeApi.renameNode(nodeId, newName);
    },
    [treeApi],
  );

  const handleDragStart = useCallback((nodeId: string) => {
    setDragState({ draggedId: nodeId, targetId: null, position: null });
  }, []);

  const handleDragOver = useCallback(
    (targetId: string, e: React.DragEvent) => {
      if (!dragState.draggedId) return;
      if (dragState.draggedId === targetId) return;
      const draggedNode = treeApi.nodes.find((n) => n.id === dragState.draggedId);
      if (draggedNode?.path?.includes(targetId)) return;

      const rect = (e.target as HTMLElement).closest("[draggable]")?.getBoundingClientRect();
      if (!rect) return;

      const y = e.clientY - rect.top;
      const height = rect.height;
      let position: "before" | "inside" | "after";
      if (y < height * 0.25) position = "before";
      else if (y > height * 0.75) position = "after";
      else position = "inside";

      setDragState((prev) => ({ ...prev, targetId, position }));
    },
    [dragState.draggedId, treeApi],
  );

  const handleDrop = useCallback(
    async (targetId: string) => {
      if (!dragState.draggedId || !catalogId) {
        setDragState({ draggedId: null, targetId: null, position: null });
        return;
      }
      const draggedNodeId = dragState.draggedId;
      const targetNode = treeApi.nodes.find((n) => n.id === targetId);
      if (!targetNode) {
        setDragState({ draggedId: null, targetId: null, position: null });
        return;
      }

      let newParentId: string | null;
      let newSortOrder: number;

      if (dragState.position === "inside") {
        newParentId = targetId;
        const targetChildren = treeApi.nodes.filter((n) => n.parent_id === targetId);
        const maxSort = targetChildren.length
          ? Math.max(...targetChildren.map((n) => n.sort_order))
          : 0;
        newSortOrder = maxSort + 1000;
      } else {
        newParentId = targetNode.parent_id;
        const siblings = treeApi.nodes
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
      await treeApi.moveNode(draggedNodeId, newParentId, newSortOrder);
    },
    [dragState.draggedId, dragState.position, catalogId, treeApi],
  );

  const handleDragEnd = useCallback(() => {
    setDragState({ draggedId: null, targetId: null, position: null });
  }, []);

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <KnowledgeNav title="Wiki" modeToggle={<ModeToggle value={viewMode} onChange={handleModeChange} />} />

      <div className="flex min-h-0 flex-1 px-6 py-4 gap-4">
        <CatalogTreePane
          catalogLoading={catalogLoading}
          catalogError={catalogError}
          treeLoading={treeApi.loading}
          nodes={treeApi.nodes}
          selectedNodeId={treeApi.selectedNodeId}
          expandedIds={treeApi.expandedIds}
          searchQuery={searchQuery}
          editingNodeId={editingNodeId}
          dragState={dragState}
          contextMenu={contextMenu}
          onSearchChange={setSearchQuery}
          onSelectNode={treeApi.selectNode}
          onToggleExpand={treeApi.toggleExpand}
          onCollapseAll={treeApi.collapseAll}
          onExpandAll={treeApi.expandAll}
          onAddChild={handleAddChild}
          onContextMenu={handleContextMenu}
          onRename={handleRename}
          onCancelEdit={() => setEditingNodeId(null)}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onContextAddChild={handleAddChild}
          onContextRename={handleContextRename}
          onContextCopyId={handleContextCopyId}
          onContextDelete={handleContextDelete}
          onCloseContextMenu={() => setContextMenu(null)}
        />

        <main className="flex-1 min-w-0 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {viewMode === "edit" ? (
            <NodeDetailPanel
              node={treeApi.selectedNode}
              catalogId={catalogId ?? ""}
              onUpdate={treeApi.refresh}
              onDelete={handleDeleted}
            />
          ) : (
            <div className="flex h-full">
              <div className="w-[280px] shrink-0 border-r border-border flex flex-col">
                <div className="p-3 border-b border-border">
                  <button
                    onClick={() => setCreatePubOpen(true)}
                    disabled={!catalogId}
                    className="w-full px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    + 新建发布
                  </button>
                </div>
                <WikiPublicationList
                  publications={pubsApi.publications}
                  selectedId={pubsApi.selectedId}
                  onSelect={(pub) => pubsApi.setSelectedId(pub.id)}
                  loading={pubsApi.loading}
                />
              </div>
              <div className="flex-1 min-w-0 overflow-auto">
                <WikiPublicationDetail
                  publication={pubsApi.selectedPub}
                  onChanged={pubsApi.loadPublications}
                  onDeleted={pubsApi.handleDeleted}
                />
              </div>
            </div>
          )}
        </main>
      </div>

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

      <CreateWikiPublicationDialog
        open={createPubOpen}
        catalogId={catalogId ?? ""}
        onClose={() => setCreatePubOpen(false)}
        onCreated={pubsApi.handleCreated}
      />

      {confirmDialog}
    </div>
  );
}
