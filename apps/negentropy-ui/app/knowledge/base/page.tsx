"use client";

import { useCallback, useEffect, useState } from "react";
import { CorpusRecord } from "@/features/knowledge";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { useKnowledgeBase } from "@/features/knowledge";

import { CorpusList } from "./_components/CorpusList";
import { CorpusDetail } from "./_components/CorpusDetail";
import { CorpusFormDialog } from "./_components/CorpusFormDialog";
import { IngestPanel } from "./_components/IngestPanel";
import { SearchWorkspace } from "./_components/SearchWorkspace";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

/**
 * KnowledgeBasePage
 *
 * 知识库管理主页。
 * 包含：数据源列表(CRUD)、详情展示、索引面板、搜索工作台。
 */
export default function KnowledgeBasePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingCorpus, setEditingCorpus] = useState<CorpusRecord | undefined>(
    undefined,
  );

  const kb = useKnowledgeBase({
    appName: APP_NAME,
    corpusId: selectedId ?? undefined,
  });

  useEffect(() => {
    kb.loadCorpora();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Auto-select first if none selected
    if (!selectedId && kb.corpora.length > 0) {
      setSelectedId(kb.corpora[0].id);
    }
    // If selected ID no longer exists (e.g. after delete), select first
    if (
      selectedId &&
      kb.corpora.length > 0 &&
      !kb.corpora.find((c) => c.id === selectedId)
    ) {
      setSelectedId(kb.corpora[0].id);
    }
  }, [kb.corpora, selectedId]);

  // Handlers for List Actions
  const handleEditClick = (corpus: CorpusRecord) => {
    setEditingCorpus(corpus);
    setDialogMode("edit");
    setIsDialogOpen(true);
  };

  const handleCreateClick = () => {
    setEditingCorpus(undefined);
    setDialogMode("create");
    setIsDialogOpen(true);
  };

  const handleDelete = useCallback(
    async (id: string) => {
      await kb.deleteCorpus(id);
      if (selectedId === id) setSelectedId(null);
    },
    [kb.deleteCorpus, selectedId],
  );

  // Handler for Dialog Submit
  const handleDialogSubmit = async (params: {
    name: string;
    description?: string;
    config?: Record<string, unknown>;
  }) => {
    if (dialogMode === "create") {
      const created = await kb.createCorpus(params);
      setSelectedId(created.id);
    } else if (dialogMode === "edit" && editingCorpus) {
      await kb.updateCorpus(editingCorpus.id, params);
    }
    setIsDialogOpen(false);
  };

  const handleIngest = useCallback(
    (params: { text: string; source_uri?: string }) => kb.ingestText(params),
    [kb.ingestText],
  );

  const handleReplace = useCallback(
    (params: { text: string; source_uri: string }) => kb.replaceSource(params),
    [kb.replaceSource],
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      <KnowledgeNav
        title="Knowledge Base"
        description="数据源管理、索引构建与检索配置"
      />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[280px_1fr]">
        {/* Left sidebar: Sources + Detail */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Sources</h2>
            <div className="mt-3">
              <CorpusList
                corpora={kb.corpora}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onEdit={handleEditClick}
                onDelete={handleDelete}
                isLoading={kb.isLoading}
              />
            </div>

            <button
              onClick={handleCreateClick}
              className="mt-3 w-full rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
            >
              + 新建数据源
            </button>
          </div>

          {/* Replaced CreateCorpusForm with Dialog trigger above */}

          <CorpusDetail corpus={kb.corpus} />
        </aside>

        {/* Right workspace: Search + Ingest */}
        <main className="space-y-4">
          {selectedId ? (
            <SearchWorkspace
              key={selectedId}
              corpusId={selectedId}
              appName={APP_NAME}
            />
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-zinc-500">
                请先选择或创建一个数据源以开始。
              </p>
            </div>
          )}
          <IngestPanel
            corpusId={selectedId}
            onIngest={handleIngest}
            onReplace={handleReplace}
          />
        </main>
      </div>

      <CorpusFormDialog
        isOpen={isDialogOpen}
        mode={dialogMode}
        initialData={editingCorpus}
        isLoading={kb.isLoading}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleDialogSubmit}
      />
    </div>
  );
}
