"use client";

import { useState, useCallback } from "react";
import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { CorpusSelector } from "./_components/CorpusSelector";
import { CatalogTree } from "./_components/CatalogTree";
import { NodeDetailPanel } from "./_components/NodeDetailPanel";
import { CreateNodeDialog } from "./_components/CreateNodeDialog";
import { useCatalogTree } from "./hooks/useCatalogTree";

export default function CatalogPage() {
  const [corpusId, setCorpusId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);

  const {
    nodes,
    selectedNode,
    selectedNodeId,
    expandedIds,
    loading,
    refresh,
    toggleExpand,
    selectNode,
  } = useCatalogTree({ corpusId });

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

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <KnowledgeNav title="Catalog" description="知识目录编册管理" />

      <div className="flex min-h-0 flex-1 px-6 py-4 gap-4">
        {/* Sidebar: Tree */}
        <aside className="w-[300px] shrink-0 flex flex-col gap-3 overflow-hidden">
          <CorpusSelector value={corpusId} onChange={setCorpusId} />

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted">加载中...</p>
            </div>
          ) : (
            <CatalogTree
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              expandedIds={expandedIds}
              onSelectNode={selectNode}
              onToggleExpand={toggleExpand}
              onAddChild={handleAddChild}
            />
          )}
        </aside>

        {/* Main: Detail Panel */}
        <main className="flex-1 min-w-0 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <NodeDetailPanel
            node={selectedNode}
            corpusId={corpusId ?? ""}
            onUpdate={refresh}
            onDelete={handleDeleted}
          />
        </main>
      </div>

      <CreateNodeDialog
        open={dialogOpen}
        parentId={addParentId}
        corpusId={corpusId ?? ""}
        onClose={() => {
          setDialogOpen(false);
          setAddParentId(null);
        }}
        onCreated={handleCreated}
      />
    </div>
  );
}
