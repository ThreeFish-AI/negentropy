"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CorpusRecord, fetchKnowledgeItems, KnowledgeItem, useKnowledgeBase } from "@/features/knowledge";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";

import { CorpusList } from "./_components/CorpusList";
import { CorpusDetail } from "./_components/CorpusDetail";
import { CorpusFormDialog } from "./_components/CorpusFormDialog";
import { IngestPanel } from "./_components/IngestPanel";
import { SearchWorkspace, SearchWorkspaceRef } from "./_components/SearchWorkspace";
import { ContentExplorer } from "./_components/ContentExplorer";
import { SourceList } from "./_components/SourceList";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

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

  // Content 标签页状态
  const [selectedSourceUri, setSelectedSourceUri] = useState<string | null | undefined>(undefined);
  const [displayChunks, setDisplayChunks] = useState<KnowledgeItem[]>([]);
  const [sourceStats, setSourceStats] = useState<Map<string | null, number>>(new Map());
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalChunks, setTotalChunks] = useState(0);

  // Refs for child components
  const searchWorkspaceRef = useRef<SearchWorkspaceRef>(null);

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

  // 加载 chunks 数据（分页 + 获取全局统计）
  const loadChunks = useCallback(async () => {
    if (!selectedId || activeTab !== "content") return;
    setContentLoading(true);
    setContentError(null);
    try {
      const data = await fetchKnowledgeItems(selectedId, {
        appName: APP_NAME,
        sourceUri: selectedSourceUri,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setDisplayChunks(data.items);
      setTotalChunks(data.count);

      // 更新全局统计（仅在 source_stats 存在时）
      if (data.source_stats) {
        const stats = new Map<string | null, number>();
        Object.entries(data.source_stats).forEach(([uri, count]) => {
          stats.set(uri === "__null__" ? null : uri, count);
        });
        setSourceStats(stats);
      }
    } catch (err) {
      setContentError(err instanceof Error ? err.message : String(err));
    } finally {
      setContentLoading(false);
    }
  }, [selectedId, activeTab, selectedSourceUri, page, pageSize]);

  // 切换 corpus 或进入 content 标签页时加载数据
  useEffect(() => {
    if (activeTab === "content" && selectedId) {
      setSelectedSourceUri(undefined);
      setPage(1);
      loadChunks();
    }
  }, [selectedId, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // 分页或 source 筛选变化时重新加载
  useEffect(() => {
    if (activeTab === "content" && selectedId) {
      loadChunks();
    }
  }, [selectedSourceUri, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(totalChunks / pageSize);

  // 切换 source 时重置分页
  const handleSourceSelect = useCallback((uri: string | null | undefined) => {
    setSelectedSourceUri(uri);
    setPage(1);
  }, []);

  // 分页控件处理
  const handlePagePrev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const handlePageNext = useCallback(() => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  // Clear search results when corpus changes
  useEffect(() => {
    if (selectedId) {
      searchWorkspaceRef.current?.clearResults();
    }
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
    <div className="flex h-screen flex-col bg-background">
      <KnowledgeNav
        title="Knowledge Base"
        description="数据源管理、索引构建与检索配置"
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 gap-6 px-6 py-6">
          {/* Left sidebar: Corpus + Detail */}
          <aside className="min-h-0 min-w-0 w-[280px] shrink-0 overflow-y-auto">
            <div className="space-y-4 pb-4 pr-2">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-card-foreground">
                  Corpus
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
            </div>
          </aside>

          {/* Right workspace */}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {selectedId ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {/* Tabs */}
                <div className="shrink-0 flex w-fit items-center gap-1 rounded-full bg-muted/50 p-1 text-sm font-medium mb-4">
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
                      ref={searchWorkspaceRef}
                      corpusId={selectedId}
                      appName={APP_NAME}
                    />
                  )}
                  {activeTab === "content" && (
                    <div className="flex min-h-0 flex-1 gap-4">
                      {/* 左侧: Sources 列表 */}
                      <aside className="shrink-0 w-[200px]">
                        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                          <h3 className="mb-2 text-xs font-semibold text-card-foreground">
                            Sources
                          </h3>
                          <SourceList
                            sourceStats={sourceStats}
                            selectedUri={selectedSourceUri}
                            onSelect={handleSourceSelect}
                          />
                        </div>
                      </aside>

                      {/* 右侧: Content 表格 + 分页 */}
                      <div className="flex min-h-0 flex-1 flex-col gap-3">
                        {/* 分页控件 - 移到上方 */}
                        {totalChunks > 0 && (
                          <div className="shrink-0 flex items-center justify-end gap-3">
                            <div className="flex items-center gap-1.5">
                              <label htmlFor="page-size" className="text-xs text-muted">
                                Rows
                              </label>
                              <select
                                id="page-size"
                                value={pageSize}
                                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                className="rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground outline-none focus:border-ring"
                              >
                                {PAGE_SIZE_OPTIONS.map((size) => (
                                  <option key={size} value={size}>
                                    {size}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={handlePagePrev}
                                disabled={page === 1 || contentLoading}
                                className="rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50 hover:bg-muted/50"
                              >
                                Previous
                              </button>
                              <span className="text-xs text-muted">
                                Page {page} / {totalPages || 1}
                              </span>
                              <button
                                onClick={handlePageNext}
                                disabled={page >= totalPages || contentLoading}
                                className="rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50 hover:bg-muted/50"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                        <ContentExplorer
                          items={displayChunks}
                          loading={contentLoading}
                          error={contentError}
                        />
                      </div>
                    </div>
                  )}
                  {activeTab === "ingest" && (
                    <div className="min-h-0 flex-1 overflow-y-auto pr-2 pb-4">
                      <IngestPanel
                        corpusId={selectedId}
                        onIngest={handleIngest}
                        onIngestUrl={handleIngestUrl}
                        onReplace={handleReplace}
                      />
                    </div>
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
