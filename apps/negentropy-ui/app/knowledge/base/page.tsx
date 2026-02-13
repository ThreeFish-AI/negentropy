"use client";

import { useCallback, useEffect, useState } from "react";
import { CorpusRecord, useKnowledgeBase } from "@/features/knowledge";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";

import { CorpusList } from "./_components/CorpusList";
import { CorpusDetail } from "./_components/CorpusDetail";
import { CorpusFormDialog } from "./_components/CorpusFormDialog";
import { IngestPanel } from "./_components/IngestPanel";
import { SearchWorkspace } from "./_components/SearchWorkspace";
import { ContentExplorer } from "./_components/ContentExplorer";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

/**
 * KnowledgeBasePage
 *
 * 知识库管理主页。
 * 包含：数据源列表(CRUD)、详情展示、索引面板、搜索工作台。
 */
export default function KnowledgeBasePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"search" | "content" | "ingest">(
    "search",
  );

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

  // Reset tab when selection changes
  useEffect(() => {
    setActiveTab("search");
  }, [selectedId]);

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
    [kb, selectedId],
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
    [kb],
  );

  const handleReplace = useCallback(
    (params: { text: string; source_uri: string }) => kb.replaceSource(params),
    [kb],
  );

  const handleIngestUrl = useCallback(
    (params: { url: string }) => kb.ingestUrl(params),
    [kb],
  );

  return (
    <div className="min-h-screen bg-background">
      <KnowledgeNav
        title="Knowledge Base"
        description="数据源管理、索引构建与检索配置"
      />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[280px_1fr]">
        {/* Left sidebar: Sources + Detail */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-card-foreground">
              Sources
            </h2>
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
              className="mt-3 w-full rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted hover:border-foreground hover:text-foreground"
            >
              + 新建数据源
            </button>
          </div>

          <CorpusDetail corpus={kb.corpus} />
        </aside>

        {/* Right workspace */}
        <main className="space-y-4">
          {selectedId ? (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex w-fit items-center gap-1 rounded-full bg-muted/50 p-1 text-sm font-medium">
                {(
                  [
                    { key: "search", label: "Search" },
                    { key: "content", label: "Content" },
                    { key: "ingest", label: "Ingest / Replace" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-full px-4 py-1.5 text-xs transition-all ${
                      activeTab === tab.key
                        ? "bg-foreground text-background shadow-sm ring-1 ring-border"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "search" && (
                <SearchWorkspace
                  key={selectedId}
                  corpusId={selectedId}
                  appName={APP_NAME}
                />
              )}
              {activeTab === "content" && (
                <ContentExplorer
                  key={selectedId}
                  corpusId={selectedId}
                  appName={APP_NAME}
                />
              )}
              {activeTab === "ingest" && (
                <IngestPanel
                  corpusId={selectedId}
                  onIngest={handleIngest}
                  onIngestUrl={handleIngestUrl}
                  onReplace={handleReplace}
                />
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs text-muted">
                请先选择或创建一个数据源以开始。
              </p>
            </div>
          )}
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
