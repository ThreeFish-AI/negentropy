"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CorpusRecord,
  ChunkingConfig,
  DocumentChunkItem,
  KnowledgeDocument,
  KnowledgeMatch,
  SearchMode,
  fetchDocumentChunks,
  fetchDocuments,
  searchAcrossCorpora,
  useKnowledgeBase,
  syncDocument,
  rebuildDocument,
  replaceDocument,
  archiveDocument,
  unarchiveDocument,
  downloadDocument,
  deleteDocument,
} from "@/features/knowledge";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { CorpusFormDialog } from "./_components/CorpusFormDialog";
import { DeleteCorpusDialog } from "./_components/DeleteCorpusDialog";
import { ReplaceDocumentDialog } from "./_components/ReplaceDocumentDialog";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

type ViewMode = "overview" | "corpus";
type CorpusTab = "documents" | "settings" | "document-chunks";

function CorpusStatusBadge({ corpus }: { corpus: CorpusRecord }) {
  const hasKnowledge = corpus.knowledge_count > 0;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        hasKnowledge
          ? "bg-emerald-100 text-emerald-700"
          : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {hasKnowledge ? "Ready" : "Empty"}
    </span>
  );
}

function ChunkDetailDrawer({
  chunk,
  onClose,
}: {
  chunk: KnowledgeMatch | DocumentChunkItem | null;
  onClose: () => void;
}) {
  if (!chunk) return null;
  const metadata = "metadata" in chunk ? chunk.metadata : {};
  const content = "content" in chunk ? chunk.content : "";
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[420px] border-l border-border bg-card p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Chunk Detail</h3>
        <button
          onClick={onClose}
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
        >
          Close
        </button>
      </div>
      <div className="space-y-3 text-xs">
        <div className="rounded border border-border bg-background p-3">
          <p className="whitespace-pre-wrap break-words text-foreground">{content}</p>
        </div>
        <div className="rounded border border-border bg-background p-3">
          <div className="mb-2 text-[11px] font-medium text-muted">Metadata</div>
          <pre className="whitespace-pre-wrap break-words text-[11px] text-muted">
            {JSON.stringify(metadata || {}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeBasePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    corpora,
    isLoading,
    loadCorpora,
    loadCorpus,
    createCorpus,
    updateCorpus,
    deleteCorpus: deleteCorpusById,
    ingestUrl,
    ingestFile,
  } = useKnowledgeBase({ appName: APP_NAME });

  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedCorpusId, setSelectedCorpusId] = useState<string | null>(null);
  const [corpusTab, setCorpusTab] = useState<CorpusTab>("documents");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("hybrid");
  const [selectedRetrievalCorpusIds, setSelectedRetrievalCorpusIds] = useState<string[]>([]);
  const [retrievalResults, setRetrievalResults] = useState<KnowledgeMatch[]>([]);
  const [retrievalLoading, setRetrievalLoading] = useState(false);
  const [retrievalError, setRetrievalError] = useState<string | null>(null);
  const [retrievalDocked, setRetrievalDocked] = useState(false);
  const [isCorpusPanelExpanded, setIsCorpusPanelExpanded] = useState(false);

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const [documentChunks, setDocumentChunks] = useState<DocumentChunkItem[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);

  const [selectedChunk, setSelectedChunk] = useState<KnowledgeMatch | DocumentChunkItem | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingCorpus, setEditingCorpus] = useState<CorpusRecord | undefined>(undefined);
  const [isDeleteCorpusDialogOpen, setIsDeleteCorpusDialogOpen] = useState(false);
  const [deletingCorpus, setDeletingCorpus] = useState<CorpusRecord | null>(null);
  const [isDeletingCorpus, setIsDeletingCorpus] = useState(false);
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);
  const [replacingDocument, setReplacingDocument] = useState<KnowledgeDocument | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCorpus = useMemo(
    () => corpora.find((item) => item.id === selectedCorpusId) || null,
    [corpora, selectedCorpusId],
  );

  const syncQueryState = useCallback(
    (next: Partial<Record<"view" | "corpusId" | "tab" | "documentId", string | null>>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(next).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    void loadCorpora();
  }, [loadCorpora]);

  useEffect(() => {
    const nextView = (searchParams.get("view") as ViewMode) || "overview";
    const nextCorpusId = searchParams.get("corpusId");
    const nextTab = (searchParams.get("tab") as CorpusTab) || "documents";
    const nextDocId = searchParams.get("documentId");

    setViewMode(nextView);
    setSelectedCorpusId(nextCorpusId);
    setCorpusTab(nextTab);
    setSelectedDocumentId(nextDocId);
  }, [searchParams]);

  useEffect(() => {
    if (selectedCorpusId) {
      void loadCorpus(selectedCorpusId);
    }
  }, [loadCorpus, selectedCorpusId]);

  useEffect(() => {
    if (!retrievalDocked) {
      setIsCorpusPanelExpanded(false);
    }
  }, [retrievalDocked]);

  const loadDocuments = useCallback(async () => {
    if (!selectedCorpusId) return;
    setDocumentsLoading(true);
    try {
      const res = await fetchDocuments(selectedCorpusId, { appName: APP_NAME, limit: 100, offset: 0 });
      setDocuments(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setDocumentsLoading(false);
    }
  }, [selectedCorpusId]);

  useEffect(() => {
    if (viewMode === "corpus" && corpusTab === "documents" && selectedCorpusId) {
      loadDocuments();
    }
  }, [viewMode, corpusTab, selectedCorpusId, loadDocuments]);

  const loadDocumentChunks = useCallback(async () => {
    if (!selectedCorpusId || !selectedDocumentId) return;
    setChunksLoading(true);
    try {
      const res = await fetchDocumentChunks(selectedCorpusId, selectedDocumentId, {
        appName: APP_NAME,
        limit: 200,
        offset: 0,
      });
      setDocumentChunks(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load chunks");
    } finally {
      setChunksLoading(false);
    }
  }, [selectedCorpusId, selectedDocumentId]);

  useEffect(() => {
    if (viewMode === "corpus" && corpusTab === "document-chunks" && selectedCorpusId && selectedDocumentId) {
      loadDocumentChunks();
    }
  }, [viewMode, corpusTab, selectedCorpusId, selectedDocumentId, loadDocumentChunks]);

  const handleRetrieve = async () => {
    const corpusIds = selectedRetrievalCorpusIds;
    if (!query.trim() || corpusIds.length === 0) return;

    setRetrievalLoading(true);
    setRetrievalError(null);
    try {
      const res = await searchAcrossCorpora(corpusIds, {
        app_name: APP_NAME,
        query,
        mode,
        limit: 50,
      });
      setRetrievalResults(res.items);
      setRetrievalDocked(true);
      setIsCorpusPanelExpanded(false);
    } catch (err) {
      setRetrievalError(err instanceof Error ? err.message : "Retrieve failed");
    } finally {
      setRetrievalLoading(false);
    }
  };

  const openCorpusWorkspace = (corpusId: string, tab: CorpusTab = "documents") => {
    syncQueryState({
      view: "corpus",
      corpusId,
      tab,
      documentId: null,
    });
  };

  const handleCreateCorpus = () => {
    setDialogMode("create");
    setEditingCorpus(undefined);
    setIsDialogOpen(true);
  };

  const handleEditCorpus = (corpus: CorpusRecord) => {
    setDialogMode("edit");
    setEditingCorpus(corpus);
    setIsDialogOpen(true);
  };

  const handleDeleteCorpus = async (corpus: CorpusRecord) => {
    setDeletingCorpus(corpus);
    setIsDeleteCorpusDialogOpen(true);
  };

  const handleConfirmDeleteCorpus = async () => {
    if (!deletingCorpus || isDeletingCorpus) return;
    setIsDeletingCorpus(true);
    try {
      await deleteCorpusById(deletingCorpus.id);
      toast.success("Corpus deleted");
      if (selectedCorpusId === deletingCorpus.id) {
        syncQueryState({ view: "overview", corpusId: null, tab: null, documentId: null });
      }
      setIsDeleteCorpusDialogOpen(false);
      setDeletingCorpus(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeletingCorpus(false);
    }
  };

  const handleDialogSubmit = async (params: {
    name: string;
    description?: string;
    config?: Record<string, unknown>;
  }) => {
    if (dialogMode === "create") {
      const created = await createCorpus(params);
      syncQueryState({ view: "corpus", corpusId: created.id, tab: "documents", documentId: null });
    } else if (editingCorpus) {
      await updateCorpus(editingCorpus.id, params);
      if (selectedCorpusId === editingCorpus.id) {
        await loadCorpus(editingCorpus.id);
      }
    }
    setIsDialogOpen(false);
  };

  const handleIngestUrl = async () => {
    if (!selectedCorpusId) return;
    const url = window.prompt("请输入 URL");
    if (!url?.trim()) return;
    try {
      await ingestUrl({
        url: url.trim(),
        as_document: true,
        chunkingConfig: selectedCorpus?.config as ChunkingConfig | undefined,
      });
      toast.success("URL ingest started");
      await loadDocuments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "URL ingest failed");
    }
  };

  const handleIngestFile = async (file: File) => {
    if (!selectedCorpusId) return;
    try {
      await ingestFile({
        file,
        source_uri: file.name,
        chunkingConfig: selectedCorpus?.config as ChunkingConfig | undefined,
      });
      toast.success("File ingest started");
      await loadDocuments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "File ingest failed");
    }
  };

  const runDocumentAction = async (
    action: "sync" | "rebuild" | "replace" | "archive" | "unarchive" | "download" | "view" | "delete",
    doc: KnowledgeDocument,
  ) => {
    if (!selectedCorpusId) return;
    try {
      if (action === "sync") {
        await syncDocument(selectedCorpusId, doc.id, { app_name: APP_NAME });
      } else if (action === "rebuild") {
        await rebuildDocument(selectedCorpusId, doc.id, { app_name: APP_NAME });
      } else if (action === "archive") {
        await archiveDocument(selectedCorpusId, doc.id, { app_name: APP_NAME });
      } else if (action === "unarchive") {
        await unarchiveDocument(selectedCorpusId, doc.id, { app_name: APP_NAME });
      } else if (action === "replace") {
        setReplacingDocument(doc);
        setIsReplaceDialogOpen(true);
        return;
      } else if (action === "download") {
        await downloadDocument(selectedCorpusId, doc.id, { appName: APP_NAME });
      } else if (action === "view") {
        syncQueryState({ view: "corpus", corpusId: selectedCorpusId, tab: "document-chunks", documentId: doc.id });
        return;
      } else if (action === "delete") {
        if (!window.confirm("确定删除该文档吗？")) return;
        await deleteDocument(selectedCorpusId, doc.id, { appName: APP_NAME });
      }
      toast.success(`${action} success`);
      await loadDocuments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${action} failed`);
    }
  };

  const handleReplaceDocumentSubmit = async (payload: { text: string }) => {
    if (!selectedCorpusId || !replacingDocument) {
      throw new Error("No document selected");
    }
    await replaceDocument(selectedCorpusId, replacingDocument.id, {
      app_name: APP_NAME,
      text: payload.text,
    });
    toast.success("replace success");
    setIsReplaceDialogOpen(false);
    setReplacingDocument(null);
    await loadDocuments();
  };

  const handleSaveCorpusSettings = async (config: Record<string, unknown>) => {
    if (!selectedCorpus) return;
    try {
      await updateCorpus(selectedCorpus.id, { config });
      await loadCorpus(selectedCorpus.id);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save settings failed");
    }
  };

  const renderRetrievalModule = () => (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Retrieval</h2>
        <div className="flex items-center gap-1 rounded-full bg-muted/60 p-1 text-xs">
          {(["semantic", "keyword", "hybrid"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className={`rounded-full px-3 py-1 ${mode === item ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRetrieve();
          }}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="输入检索内容"
        />
        <button
          onClick={handleRetrieve}
          disabled={retrievalLoading || !query.trim() || selectedRetrievalCorpusIds.length === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {retrievalLoading ? "Retrieving..." : "Retrieve"}
        </button>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-xs text-muted">Target Corpus（可多选）</div>
        <div className="flex flex-wrap gap-2">
          {corpora.map((corpus) => {
            const checked = selectedRetrievalCorpusIds.includes(corpus.id);
            return (
              <label key={corpus.id} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setSelectedRetrievalCorpusIds((prev) =>
                      e.target.checked
                        ? [...prev, corpus.id]
                        : prev.filter((id) => id !== corpus.id),
                    );
                  }}
                />
                <span>{corpus.name}</span>
              </label>
            );
          })}
        </div>
        {selectedRetrievalCorpusIds.length === 0 && (
          <div className="mt-2 text-[11px] text-amber-600">
            请至少选择一个 Corpus 后再执行 Retrieve
          </div>
        )}
      </div>

      {retrievalError && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-600">
          {retrievalError}
        </div>
      )}
    </div>
  );

  const renderCorpusCards = ({ embedded = false }: { embedded?: boolean } = {}) => (
    <div className={embedded ? "rounded-2xl border border-border bg-card p-4" : "rounded-2xl border border-border bg-card p-4 shadow-sm"}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Corpus</h2>
        <button
          onClick={handleCreateCorpus}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Add Corpus
        </button>
      </div>
      {corpora.length === 0 ? (
        <p className="text-xs text-muted">暂无 Corpus</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {corpora.map((corpus) => (
            <div
              key={corpus.id}
              className="cursor-pointer rounded-xl border border-border bg-background p-4 transition hover:border-foreground/40"
              onClick={() => openCorpusWorkspace(corpus.id, "documents")}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="truncate text-base font-semibold">{corpus.name}</h3>
                <CorpusStatusBadge corpus={corpus} />
              </div>
              <p className="line-clamp-2 h-10 text-xs text-muted">
                {corpus.description || "No description"}
              </p>
              <div className="mt-2 text-[11px] text-muted">
                chunks: {corpus.knowledge_count}
              </div>
              <div className="mt-1 text-[11px] text-muted">
                strategy: {String((corpus.config?.strategy as string) || "recursive")}
              </div>
              <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleEditCorpus(corpus)}
                  className="rounded border border-border px-2 py-1 text-[11px] hover:bg-muted"
                >
                  Settings
                </button>
                <button
                  onClick={() => openCorpusWorkspace(corpus.id, "documents")}
                  className="rounded border border-border px-2 py-1 text-[11px] hover:bg-muted"
                >
                  Add Documents
                </button>
                <button
                  onClick={() => handleDeleteCorpus(corpus)}
                  className="rounded border border-red-300 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <KnowledgeNav title="Knowledge Base" description="Retrieval 与 Corpus 维护" />

      <div className="relative flex-1 overflow-y-auto px-6 py-6">
        {viewMode === "overview" ? (
          <div className="space-y-4 pb-28">
            {retrievalDocked && retrievalResults.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-2 text-sm font-semibold">Retrieved Chunks</div>
                <div className="space-y-2">
                  {retrievalResults.map((item) => (
                    <button
                      type="button"
                      key={`${item.id}-${item.metadata?.corpus_id || "na"}`}
                      onClick={() => setSelectedChunk(item)}
                      className="block w-full rounded-lg border border-border bg-background p-3 text-left hover:bg-muted/40"
                    >
                      <p className="line-clamp-3 text-xs text-foreground">{item.content}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
                        <span>score: {(item.combined_score || 0).toFixed(4)}</span>
                        <span>corpus: {String(item.metadata?.corpus_id || "-")}</span>
                        <span>source: {item.source_uri || "-"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!retrievalDocked && renderRetrievalModule()}
            {!retrievalDocked && renderCorpusCards()}

            {retrievalDocked && (
              <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 px-6 py-3 backdrop-blur">
                <div
                  data-testid="docked-retrieval-container"
                  className="max-h-[70vh] w-full overflow-y-auto"
                >
                  {renderRetrievalModule()}
                  <div className="mt-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setIsCorpusPanelExpanded((prev) => !prev)}
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-muted"
                    >
                      {isCorpusPanelExpanded ? "收起 Corpus" : "Corpus"}
                    </button>
                  </div>
                  {isCorpusPanelExpanded && (
                    <div className="mt-3">
                      {renderCorpusCards({ embedded: true })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 gap-4 pb-10">
            <aside className="w-[240px] shrink-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <button
                onClick={() => syncQueryState({ view: "overview", corpusId: null, tab: null, documentId: null })}
                className="mb-3 rounded border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                ← Back
              </button>
              <div className="mb-3 text-sm font-semibold">{selectedCorpus?.name || "Corpus"}</div>
              <div className="space-y-2 text-xs">
                <button
                  onClick={() => syncQueryState({ view: "corpus", corpusId: selectedCorpusId, tab: "documents", documentId: null })}
                  className={`block w-full rounded px-3 py-2 text-left ${corpusTab === "documents" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  Documents
                </button>
                <button
                  onClick={() => syncQueryState({ view: "corpus", corpusId: selectedCorpusId, tab: "settings", documentId: null })}
                  className={`block w-full rounded px-3 py-2 text-left ${corpusTab === "settings" ? "bg-foreground text-background" : "hover:bg-muted"}`}
                >
                  Settings
                </button>
              </div>
            </aside>

            <main className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 shadow-sm">
              {corpusTab === "documents" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Documents</h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleIngestUrl}
                        className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
                      >
                        Ingest From URL
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
                      >
                        Ingest From File
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void handleIngestFile(file);
                            e.currentTarget.value = "";
                          }
                        }}
                      />
                    </div>
                  </div>

                  {documentsLoading ? (
                    <p className="text-xs text-muted">Loading...</p>
                  ) : documents.length === 0 ? (
                    <p className="text-xs text-muted">No documents.</p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => {
                        const sourceType = String(doc.metadata?.source_type || "file");
                        return (
                          <div
                            key={doc.id}
                            className="rounded-lg border border-border bg-background p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                className="min-w-0 text-left"
                                onClick={() => syncQueryState({ view: "corpus", corpusId: selectedCorpusId, tab: "document-chunks", documentId: doc.id })}
                              >
                                <p className="truncate text-sm font-medium">{doc.original_filename}</p>
                                <p className="text-[11px] text-muted">{sourceType} · {doc.status} · {doc.file_size} bytes</p>
                              </button>
                              <div className="flex flex-wrap items-center justify-end gap-1">
                                <button onClick={() => runDocumentAction("view", doc)} className="rounded border border-border px-2 py-1 text-[11px]">View</button>
                                <button onClick={() => runDocumentAction("download", doc)} className="rounded border border-border px-2 py-1 text-[11px]">Download</button>
                                <button onClick={() => runDocumentAction("replace", doc)} className="rounded border border-border px-2 py-1 text-[11px]">Replace</button>
                                <button onClick={() => runDocumentAction("rebuild", doc)} className="rounded border border-border px-2 py-1 text-[11px]">Rebuild</button>
                                {sourceType === "url" && (
                                  <button onClick={() => runDocumentAction("sync", doc)} className="rounded border border-border px-2 py-1 text-[11px]">Sync</button>
                                )}
                                <button onClick={() => runDocumentAction("archive", doc)} className="rounded border border-border px-2 py-1 text-[11px]">Archive</button>
                                <button onClick={() => runDocumentAction("unarchive", doc)} className="rounded border border-border px-2 py-1 text-[11px]">Unarchive</button>
                                <button onClick={() => runDocumentAction("delete", doc)} className="rounded border border-red-300 px-2 py-1 text-[11px] text-red-600">Delete</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {corpusTab === "document-chunks" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Document Chunks</h2>
                    <button
                      onClick={() => syncQueryState({ view: "corpus", corpusId: selectedCorpusId, tab: "documents", documentId: null })}
                      className="rounded border border-border px-2 py-1 text-xs"
                    >
                      Back to Documents
                    </button>
                  </div>
                  {chunksLoading ? (
                    <p className="text-xs text-muted">Loading chunks...</p>
                  ) : documentChunks.length === 0 ? (
                    <p className="text-xs text-muted">No chunks.</p>
                  ) : (
                    <div className="space-y-2">
                      {documentChunks.map((chunk) => (
                        <button
                          type="button"
                          key={chunk.id}
                          onClick={() => setSelectedChunk(chunk)}
                          className="block w-full rounded-lg border border-border bg-background p-3 text-left hover:bg-muted/40"
                        >
                          <p className="line-clamp-3 text-xs">{chunk.content}</p>
                          <div className="mt-2 text-[11px] text-muted">
                            chunk_index: {chunk.chunk_index} · source: {chunk.source_uri || "-"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {corpusTab === "settings" && selectedCorpus && (
                <CorpusSettingsPanel
                  key={selectedCorpus.id}
                  corpus={selectedCorpus}
                  onSave={handleSaveCorpusSettings}
                />
              )}
            </main>
          </div>
        )}
      </div>

      <ChunkDetailDrawer chunk={selectedChunk} onClose={() => setSelectedChunk(null)} />

      <CorpusFormDialog
        isOpen={isDialogOpen}
        mode={dialogMode}
        initialData={editingCorpus}
        isLoading={isLoading}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleDialogSubmit}
      />

      <ReplaceDocumentDialog
        isOpen={isReplaceDialogOpen}
        corpusId={selectedCorpusId}
        document={replacingDocument}
        onClose={() => {
          setIsReplaceDialogOpen(false);
          setReplacingDocument(null);
        }}
        onSubmit={handleReplaceDocumentSubmit}
      />

      <DeleteCorpusDialog
        isOpen={isDeleteCorpusDialogOpen}
        corpusName={deletingCorpus?.name ?? null}
        isDeleting={isDeletingCorpus}
        onClose={() => {
          if (isDeletingCorpus) return;
          setIsDeleteCorpusDialogOpen(false);
          setDeletingCorpus(null);
        }}
        onConfirm={handleConfirmDeleteCorpus}
      />
    </div>
  );
}

function CorpusSettingsPanel({
  corpus,
  onSave,
}: {
  corpus: CorpusRecord;
  onSave: (config: Record<string, unknown>) => Promise<void>;
}) {
  const [strategy, setStrategy] = useState<string>(String(corpus.config?.strategy || "recursive"));
  const [chunkSize, setChunkSize] = useState<string>(String(corpus.config?.chunk_size || 800));
  const [overlap, setOverlap] = useState<string>(String(corpus.config?.overlap || 100));
  const [preserveNewlines, setPreserveNewlines] = useState<boolean>(corpus.config?.preserve_newlines !== false);
  const [separators, setSeparators] = useState<string>(
    Array.isArray(corpus.config?.separators)
      ? (corpus.config?.separators as string[]).join("\n")
      : "",
  );

  const handleSubmit = async () => {
    const config: Record<string, unknown> = {
      ...(corpus.config || {}),
      strategy,
      chunk_size: Number(chunkSize),
      overlap: Number(overlap),
      preserve_newlines: preserveNewlines,
      separators: separators
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    };
    await onSave(config);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Settings</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs">
          <div className="mb-1 text-muted">Chunking Strategy</div>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-2"
          >
            <option value="fixed">Fixed Character Size</option>
            <option value="recursive">Recursive Aware</option>
            <option value="semantic">Semantic (Embedding Similarity)</option>
          </select>
        </label>

        <label className="text-xs">
          <div className="mb-1 text-muted">Chunk Size</div>
          <input
            type="number"
            value={chunkSize}
            onChange={(e) => setChunkSize(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-2"
          />
        </label>

        <label className="text-xs">
          <div className="mb-1 text-muted">Overlap</div>
          <input
            type="number"
            value={overlap}
            onChange={(e) => setOverlap(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-2"
          />
        </label>

        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={preserveNewlines}
            onChange={(e) => setPreserveNewlines(e.target.checked)}
          />
          <span>Preserve Newlines</span>
        </label>
      </div>

      <label className="block text-xs">
        <div className="mb-1 text-muted">Separators（每行一个）</div>
        <textarea
          value={separators}
          onChange={(e) => setSeparators(e.target.value)}
          rows={5}
          className="w-full rounded border border-border bg-background px-2 py-2"
          placeholder={"\\n\\n\n\\n\n. \n, "}
        />
      </label>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          className="rounded bg-zinc-900 px-3 py-2 text-xs font-semibold text-white"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
