"use client";

import { useCallback, useRef, useState } from "react";
import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { CatalogNode, deleteCatalogNode } from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";

import { useSingletonCatalog } from "../_hooks/useSingletonCatalog";
import { useCatalogTree } from "../_hooks/useCatalogTree";
import { useCatalogTreeDnd } from "../_hooks/useCatalogTreeDnd";
import { useWikiPublications } from "../_hooks/useWikiPublications";

import { CatalogTreePane } from "./catalog/CatalogTreePane";
import { NodeDetailPanel } from "./catalog/NodeDetailPanel";
import { CreateNodeDialog } from "./catalog/CreateNodeDialog";
import { WikiPublishToolbar } from "./WikiPublishToolbar";
import {
  WikiEntriesPreview,
  type WikiEntriesPreviewHandle,
} from "./WikiEntriesPreview";

interface ContextMenuState {
  x: number;
  y: number;
  node: CatalogNode | null;
}

export function LibraryShell() {
  const { confirm, confirmDialog } = useConfirmDialog();

  const { catalogId, loading: catalogLoading, error: catalogError } = useSingletonCatalog();
  const treeApi = useCatalogTree({ catalogId });
  const pubsApi = useWikiPublications({ catalogId });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const entriesPreviewRef = useRef<WikiEntriesPreviewHandle | null>(null);

  // ---- @dnd-kit DnD ----
  const dnd = useCatalogTreeDnd({
    nodes: treeApi.nodes,
    expandedIds: treeApi.expandedIds,
    catalogId,
    onMove: treeApi.moveNode,
    onExpand: treeApi.toggleExpand,
    onRefresh: treeApi.refresh,
  });

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

  const handleAfterSync = useCallback(() => {
    entriesPreviewRef.current?.refresh();
  }, []);

  return (
    <div className="flex h-full flex-col bg-background">
      <KnowledgeNav title="Wiki" />

      <WikiPublishToolbar
        catalogId={catalogId ?? ""}
        publications={pubsApi.publications}
        selectedPub={pubsApi.selectedPub}
        selectedId={pubsApi.selectedId}
        publicationsLoading={pubsApi.loading}
        onSelectPublication={pubsApi.setSelectedId}
        onPublicationsChanged={pubsApi.loadPublications}
        onPublicationCreated={pubsApi.handleCreated}
        onPublicationDeleted={pubsApi.handleDeleted}
        onAfterSync={handleAfterSync}
      />

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
          dndSensors={dnd.sensors}
          dndCollisionDetection={dnd.collisionDetection}
          onDndDragStart={dnd.onDragStart}
          onDndDragMove={dnd.onDragMove}
          onDndDragEnd={dnd.onDragEnd}
          onDndDragCancel={dnd.onDragCancel}
          activeId={dnd.activeId}
          activeNode={dnd.activeNode}
          dropTarget={dnd.dropTarget}
          isMoving={dnd.isMoving}
          onContextAddChild={handleAddChild}
          onContextRename={handleContextRename}
          onContextCopyId={handleContextCopyId}
          onContextDelete={handleContextDelete}
          onCloseContextMenu={() => setContextMenu(null)}
        />

        <main className="flex-1 min-w-0 rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto">
            <NodeDetailPanel
              node={treeApi.selectedNode}
              catalogId={catalogId ?? ""}
              nodes={treeApi.nodes}
              onUpdate={treeApi.refresh}
              onDelete={handleDeleted}
            />
          </div>
          <WikiEntriesPreview
            ref={entriesPreviewRef}
            publication={pubsApi.selectedPub}
          />
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

      {confirmDialog}
    </div>
  );
}
