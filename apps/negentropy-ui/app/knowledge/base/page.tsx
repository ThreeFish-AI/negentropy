/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/activity-toast";
import {
  type CorpusRecord,
  type ChunkingConfig,
  LIBRARY_CORPUS_SEGMENT,
  type DocumentChunkItem,
  type DocumentChunksMetadata,
  type KnowledgeDocument,
  type KnowledgeMatch,
  type SearchMode,
  fetchDocumentChunks,
  fetchDocumentChunkDetail,
  fetchDocuments,
  regenerateDocumentChunkFamily,
  searchAcrossCorpora,
  updateDocumentChunk,
  useKnowledgeBase,
  syncDocument,
  rebuildDocument,
  replaceDocument,
  archiveDocument,
  unarchiveDocument,
  downloadDocument,
  deleteDocument,
  effectiveDocumentName,
  formatRelativeTime,
  normalizeChunkingConfig,
  PipelineStatusBadge,
} from "@/features/knowledge";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { Button } from "@/components/ui/Button";
import { AnimatedList } from "@/components/ui/AnimatedList";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import { navPillClassName, navRailContainerClassName } from "@/components/ui/nav-styles";
import {
  tableBodyClassName,
  tableContainerClassName,
  tableHeaderClassName,
  tableRowClassName,
} from "@/components/ui/table-styles";
import { cn } from "@/lib/utils";
import { AddSourceDialog } from "./_components/AddSourceDialog";
import { IngestFileDialog } from "./_components/IngestFileDialog";
import { IngestDocumentDialog } from "./_components/IngestDocumentDialog";
import { CorpusFormDialog } from "./_components/CorpusFormDialog";
import { CorpusSettingsPanel } from "./_components/CorpusSettingsPanel";
import { CorpusStatusBadge } from "./_components/CorpusStatusBadge";
import { DeleteCorpusDialog } from "./_components/DeleteCorpusDialog";
import { DeleteSourceDialog } from "./_components/DeleteSourceDialog";
import { DocumentMetadataPanel } from "./_components/DocumentMetadataPanel";
import { RetrievedChunkCard } from "./_components/RetrievedChunkCard";
import { ChunkDetailDialog } from "./_components/ChunkDetailDialog";
import { ReplaceDocumentDialog } from "./_components/ReplaceDocumentDialog";
import { buildRetrievedChunkViewModel } from "./_components/retrieved-chunk-presenter";
import { formatCorpusConfigSummary, toDocumentChunkCardViewModel } from "./_components/format-utils";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

type ViewMode = "overview" | "corpus";
type CorpusTab = "documents" | "settings" | "document-chunks";

export default function KnowledgeBasePage() {
  const pathname = usePathname();
  const router = useRouter();
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
    ingestDocument,
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
  const [documentsTotal, setDocumentsTotal] = useState(0);
  const [documentsPage, setDocumentsPage] = useState(1);
  const documentsPageSize = 10;
  const [buildingDocIds, setBuildingDocIds] = useState<Set<string>>(new Set());

  const [documentChunks, setDocumentChunks] = useState<DocumentChunkItem[]>([]);
  const [documentChunksMetadata, setDocumentChunksMetadata] = useState<DocumentChunksMetadata>({});
  const [documentChunkCount, setDocumentChunkCount] = useState(0);
  const [documentChunkPage, setDocumentChunkPage] = useState(1);
  const [documentChunkPageSize, setDocumentChunkPageSize] = useState(10);
  const [chunksLoading, setChunksLoading] = useState(false);

  const [selectedRetrievedChunk, setSelectedRetrievedChunk] = useState<KnowledgeMatch | null>(null);
  const [selectedDocumentChunk, setSelectedDocumentChunk] = useState<DocumentChunkItem | null>(null);
  const [chunkDraftContent, setChunkDraftContent] = useState("");
  const [chunkDraftEnabled, setChunkDraftEnabled] = useState(true);
  const [chunkActionPending, setChunkActionPending] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingCorpus, setEditingCorpus] = useState<CorpusRecord | undefined>(undefined);
  const [isDeleteCorpusDialogOpen, setIsDeleteCorpusDialogOpen] = useState(false);
  const [isIngestUrlDialogOpen, setIsIngestUrlDialogOpen] = useState(false);
  const [isIngestFileDialogOpen, setIsIngestFileDialogOpen] = useState(false);
  const [isIngestDocumentDialogOpen, setIsIngestDocumentDialogOpen] = useState(false);
  const [deletingCorpus, setDeletingCorpus] = useState<CorpusRecord | null>(null);
  const [isDeletingCorpus, setIsDeletingCorpus] = useState(false);
  const [isDeleteDocumentDialogOpen, setIsDeleteDocumentDialogOpen] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState<KnowledgeDocument | null>(null);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);
  const [replacingDocument, setReplacingDocument] = useState<KnowledgeDocument | null>(null);

  const selectedCorpus = useMemo(
    () => corpora.find((item) => item.id === selectedCorpusId) || null,
    [corpora, selectedCorpusId],
  );
  const corpusChunkingConfig = selectedCorpus?.config
    ? normalizeChunkingConfig(selectedCorpus.config as Record<string, unknown>)
    : undefined;
  const retrievedChunkCards = useMemo(
    () => retrievalResults.map((item) => buildRetrievedChunkViewModel(item)),
    [retrievalResults],
  );
  const selectedRetrievedChunkCard = useMemo(
    () =>
      selectedRetrievedChunk
        ? buildRetrievedChunkViewModel(selectedRetrievedChunk)
        : null,
    [selectedRetrievedChunk],
  );
  // 选中文档 chunk 的展示视图模型：与卡片复用同一 presenter，喂给统一的 ChunkDetailDialog（编辑态）。
  const selectedDocumentChunkCard = useMemo(
    () =>
      selectedDocumentChunk
        ? toDocumentChunkCardViewModel(selectedDocumentChunk)
        : null,
    [selectedDocumentChunk],
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
      // 使用 window.history.replaceState 绕过 Next.js 路由缓存去重机制
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
      // 直接同步 React 状态，不依赖 useEffect 响应 searchParams 变化
      setViewMode((params.get("view") as ViewMode) || "overview");
      setSelectedCorpusId(params.get("corpusId"));
      setCorpusTab((params.get("tab") as CorpusTab) || "documents");
      setSelectedDocumentId(params.get("documentId"));
    },
    [pathname, searchParams],
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 使用 toString() 按内容比较，避免对象引用不变导致不触发
  }, [searchParams.toString()]);

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
      const res = await fetchDocuments(selectedCorpusId, {
        appName: APP_NAME,
        limit: documentsPageSize,
        offset: (documentsPage - 1) * documentsPageSize,
      });
      setDocuments(res.items);
      setDocumentsTotal(res.count);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setDocumentsLoading(false);
    }
  }, [selectedCorpusId, documentsPage]);

  /** 静默刷新：更新文档列表但不显示 Loading 状态 */
  const silentLoadDocuments = useCallback(async () => {
    if (!selectedCorpusId) return;
    try {
      const res = await fetchDocuments(selectedCorpusId, {
        appName: APP_NAME,
        limit: documentsPageSize,
        offset: (documentsPage - 1) * documentsPageSize,
      });
      setDocuments(res.items);
      setDocumentsTotal(res.count);
    } catch { /* 静默刷新失败不阻断 */ }
  }, [selectedCorpusId, documentsPage]);

  // 切换语料时回到第 1 页，避免停留在新语料不存在的页码导致空列表
  useEffect(() => {
    setDocumentsPage(1);
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
        limit: documentChunkPageSize,
        offset: (documentChunkPage - 1) * documentChunkPageSize,
      });
      setDocumentChunks(res.items);
      setDocumentChunksMetadata(res.document_metadata || {});
      setDocumentChunkCount(res.count);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load chunks");
    } finally {
      setChunksLoading(false);
    }
  }, [selectedCorpusId, selectedDocumentId, documentChunkPage, documentChunkPageSize]);

  useEffect(() => {
    if (viewMode === "corpus" && corpusTab === "document-chunks" && selectedCorpusId && selectedDocumentId) {
      loadDocumentChunks();
    }
  }, [viewMode, corpusTab, selectedCorpusId, selectedDocumentId, loadDocumentChunks]);

  useEffect(() => {
    setSelectedDocumentChunk(null);
    setChunkDraftContent("");
    setChunkDraftEnabled(true);
    setDocumentChunkPage(1);
  }, [selectedDocumentId]);

  const handleSelectDocumentChunk = useCallback(
    async (chunk: DocumentChunkItem) => {
      if (!selectedCorpusId || !selectedDocumentId) return;
      try {
        const detail = await fetchDocumentChunkDetail(
          selectedCorpusId,
          selectedDocumentId,
          chunk.id,
          { appName: APP_NAME },
        );
        setSelectedDocumentChunk(detail.item);
        setChunkDraftContent(detail.item.content);
        setChunkDraftEnabled(detail.item.is_enabled);
        setDocumentChunksMetadata(detail.document_metadata || documentChunksMetadata);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load chunk detail");
      }
    },
    [selectedCorpusId, selectedDocumentId, documentChunksMetadata],
  );

  const handleSaveDocumentChunk = useCallback(async () => {
    if (!selectedCorpusId || !selectedDocumentId || !selectedDocumentChunk) return;
    setChunkActionPending(true);
    try {
      const detail = await updateDocumentChunk(
        selectedCorpusId,
        selectedDocumentId,
        selectedDocumentChunk.id,
        {
          appName: APP_NAME,
          content: chunkDraftContent,
          is_enabled: chunkDraftEnabled,
        },
      );
      setSelectedDocumentChunk(detail.item);
      setChunkDraftContent(detail.item.content);
      setChunkDraftEnabled(detail.item.is_enabled);
      await loadDocumentChunks();
      toast.success("Chunk saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save chunk");
    } finally {
      setChunkActionPending(false);
    }
  }, [
    selectedCorpusId,
    selectedDocumentId,
    selectedDocumentChunk,
    chunkDraftContent,
    chunkDraftEnabled,
    loadDocumentChunks,
  ]);

  const handleRegenerateDocumentChunkFamily = useCallback(async () => {
    if (!selectedCorpusId || !selectedDocumentId || !selectedDocumentChunk) return;
    setChunkActionPending(true);
    try {
      const detail = await regenerateDocumentChunkFamily(
        selectedCorpusId,
        selectedDocumentId,
        selectedDocumentChunk.id,
        {
          appName: APP_NAME,
          content: chunkDraftContent,
          is_enabled: chunkDraftEnabled,
        },
      );
      setSelectedDocumentChunk(detail.item);
      setChunkDraftContent(detail.item.content);
      setChunkDraftEnabled(detail.item.is_enabled);
      await loadDocumentChunks();
      toast.success("Chunk family regenerated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate chunk family");
    } finally {
      setChunkActionPending(false);
    }
  }, [
    selectedCorpusId,
    selectedDocumentId,
    selectedDocumentChunk,
    chunkDraftContent,
    chunkDraftEnabled,
    loadDocumentChunks,
  ]);

  const resetRetrievalView = useCallback(() => {
    setRetrievalResults([]);
    setRetrievalError(null);
    setRetrievalDocked(false);
    setIsCorpusPanelExpanded(false);
    setSelectedRetrievedChunk(null);
  }, []);

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
      if (res.errors && res.errors.length > 0) {
        // 部分 Corpus 检索失败：展示成功项 + 顶部警示，避免静默丢失
        const summary = res.errors
          .map((e) => `[${e.corpusId.slice(0, 8)}] ${e.message}`)
          .join("; ")
          .slice(0, 200);
        toast.warning(`部分语料检索失败：${summary}`);
      }
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

  const handleIngestUrl = ({
    url,
  }: {
    url: string;
    chunkingConfig?: ChunkingConfig;
  }) => {
    if (!selectedCorpusId) {
      return Promise.reject(new Error("请先选择 Corpus"));
    }

    // Toast 由 AddSourceDialog 负责显示，此处不重复；错误也由 AddSourceDialog .catch() 处理
    setIsIngestUrlDialogOpen(false);

    return ingestUrl({
      url: url.trim(),
      as_document: true,
      chunkingConfig: corpusChunkingConfig,
    }).then((result) => {
      loadDocuments();
      return result;
    });
  };


  const runDocumentAction = async (
    action: "sync" | "rebuild" | "replace" | "archive" | "unarchive" | "download" | "view" | "delete",
    doc: KnowledgeDocument,
  ) => {
    if (!selectedCorpusId) return;

    // rebuild / sync: 乐观更新 + 静默刷新，避免列表闪烁
    if (action === "rebuild" || action === "sync") {
      setBuildingDocIds((prev) => new Set(prev).add(doc.id));
      toast.info(`正在${action === "rebuild" ? "重建" : "同步"}「${doc.original_filename}」…`);
      try {
        if (action === "rebuild") {
          await rebuildDocument(selectedCorpusId, doc.id, {
            app_name: APP_NAME,
            ...corpusChunkingConfig,
          });
        } else {
          await syncDocument(selectedCorpusId, doc.id, {
            app_name: APP_NAME,
            ...corpusChunkingConfig,
          });
        }
        toast.success(`${action === "rebuild" ? "重建" : "同步"}已启动「${doc.original_filename}」`);
        await silentLoadDocuments();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `${action} failed`);
      } finally {
        setBuildingDocIds((prev) => {
          const next = new Set(prev);
          next.delete(doc.id);
          return next;
        });
      }
      return;
    }

    try {
      if (action === "archive") {
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
        // 收敛到独立文档详情页（与 Knowledge/Documents 一致）。
        // 携带编码后的返回路径 from，使详情页 Back 能原路返回当前 Corpus 的 Documents。
        const returnPath = `/knowledge/base?view=corpus&corpusId=${selectedCorpusId}&tab=documents`;
        const seg = doc.corpus_id ?? selectedCorpusId ?? LIBRARY_CORPUS_SEGMENT;
        router.push(
          `/knowledge/documents/${seg}/${doc.id}?from=${encodeURIComponent(returnPath)}`,
        );
        return;
      } else if (action === "delete") {
        setDeletingDocument(doc);
        setIsDeleteDocumentDialogOpen(true);
        return;
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
      ...corpusChunkingConfig,
    });
    toast.success("replace success");
    setIsReplaceDialogOpen(false);
    setReplacingDocument(null);
    await loadDocuments();
  };

  const handleConfirmDeleteDocument = async () => {
    if (!selectedCorpusId || !deletingDocument || isDeletingDocument) return;
    setIsDeletingDocument(true);
    try {
      await deleteDocument(selectedCorpusId, deletingDocument.id, {
        appName: APP_NAME,
      });
      toast.success("delete success");
      setIsDeleteDocumentDialogOpen(false);
      setDeletingDocument(null);
      await loadDocuments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "delete failed");
    } finally {
      setIsDeletingDocument(false);
    }
  };

  const handleSaveCorpusSettings = async (config: Record<string, unknown>) => {
    if (!selectedCorpus) return;
    try {
      const result = await updateCorpus(selectedCorpus.id, { config });
      await loadCorpus(selectedCorpus.id);
      if (result?.rebuild_triggered?.count) {
        toast.success(`Settings saved · ${result.rebuild_triggered.count} 条重建任务已入队`);
      } else {
        toast.success("Settings saved");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save settings failed");
    }
  };

  const renderRetrievalModule = () => (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Retrieval</h2>
        <div className="flex items-center gap-2">
          {retrievalDocked && (
            <button
              type="button"
              onClick={resetRetrievalView}
              className={outlineButtonClassName(
                "neutral",
                "rounded-lg px-3 py-1.5 text-xs font-semibold",
              )}
            >
              收起结果
            </button>
          )}
          <div className={navRailContainerClassName}>
            {(["semantic", "keyword", "hybrid"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={navPillClassName(mode === item)}
              >
                {item}
              </button>
            ))}
          </div>
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
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-muted-foreground">Target Corpus（可多选）</span>
          {selectedRetrievalCorpusIds.length === 0 && (
            <span className="text-caption text-amber-600">
              请至少选择一个 Corpus 后再执行 Retrieve
            </span>
          )}
        </div>
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
        <Button variant="neutral" size="sm" onClick={handleCreateCorpus}>
          Add Corpus
        </Button>
      </div>
      {corpora.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无 Corpus</p>
      ) : (
        <AnimatedList
          className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
          staggerMs={50}
        >
          {corpora.map((corpus) => (
            <div
              key={corpus.id}
              data-testid={`corpus-card-${corpus.id}`}
              className="flex h-40 cursor-pointer flex-col rounded-xl border border-border bg-background p-3 transition hover:border-foreground/40"
              onClick={() => openCorpusWorkspace(corpus.id, "documents")}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{corpus.name}</h3>
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <span
                    data-testid={`corpus-chunks-${corpus.id}`}
                    className="text-caption font-medium text-muted-foreground"
                  >
                    {corpus.knowledge_count} chunks
                    {corpus.chunk_count_total != null &&
                      corpus.chunk_count_total !== corpus.knowledge_count && (
                        <span className="opacity-60">
                          {" · "}{corpus.chunk_count_total} vectors
                        </span>
                      )}
                  </span>
                  <CorpusStatusBadge corpus={corpus} />
                </div>
              </div>
              <p
                data-testid={`corpus-description-${corpus.id}`}
                className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground"
                title={corpus.description || "No description"}
              >
                {corpus.description || "No description"}
              </p>
              <div
                data-testid={`corpus-footer-${corpus.id}`}
                className="mt-auto flex items-center justify-between gap-3 pt-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  data-testid={`corpus-summary-${corpus.id}`}
                  className="min-w-0 flex-1 self-center truncate text-caption leading-5 text-muted-foreground"
                  title={formatCorpusConfigSummary(corpus)}
                >
                  {formatCorpusConfigSummary(corpus)}
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <button
                    onClick={() => handleEditCorpus(corpus)}
                    className={outlineButtonClassName(
                      "neutral",
                      "inline-flex h-7 items-center rounded px-2.5 text-caption",
                    )}
                  >
                    Settings
                  </button>
                  <button
                    onClick={() => handleDeleteCorpus(corpus)}
                    className={outlineButtonClassName(
                      "danger",
                      "inline-flex h-7 items-center rounded px-2.5 text-caption",
                    )}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </AnimatedList>
      )}
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <KnowledgeNav title="Knowledge Base" description="Retrieval 与 Corpus 维护" />

      <div className="relative flex-1 overflow-hidden px-6 py-6">
        {viewMode === "overview" ? (
          <div className="h-full overflow-y-auto">
            <div className="space-y-4 pb-28">
              {retrievalDocked && retrievalResults.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                  <div className="mb-2.5 text-2xl font-semibold text-foreground">
                    {retrievedChunkCards.length} Retrieved Chunks
                  </div>
                  <AnimatedList className="space-y-1.5" staggerMs={40}>
                    {retrievedChunkCards.map((item) => (
                      <RetrievedChunkCard
                        key={`${item.id}-${item.raw.metadata?.corpus_id || "na"}`}
                        chunk={item}
                        onOpen={() => setSelectedRetrievedChunk(item.raw)}
                      />
                    ))}
                  </AnimatedList>
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
                        className={outlineButtonClassName(
                          "neutral",
                          "w-full rounded-lg px-4 py-3 text-sm font-semibold",
                        )}
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
          </div>
        ) : (
          <div className="flex h-full min-h-0 gap-4">
            <div className="hidden h-full w-[240px] shrink-0 md:block">
              <aside
                data-testid="corpus-sidebar"
                className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <button
                  onClick={() => syncQueryState({ view: "overview", corpusId: null, tab: null, documentId: null })}
                  className={outlineButtonClassName("neutral", "mb-3 rounded px-2 py-1 text-xs")}
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
            </div>

            <main
              data-testid="corpus-content-scroll"
              className={`min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 shadow-sm ${
                corpusTab === "document-chunks" ? "overflow-hidden" : "overflow-y-auto"
              }`}
            >
              {corpusTab === "documents" && (
                <div className="space-y-3 pb-10">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Documents</h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsIngestUrlDialogOpen(true)}
                        className={outlineButtonClassName("neutral", "rounded px-3 py-1.5 text-xs")}
                      >
                        Ingest From URL
                      </button>
                      <button
                        onClick={() => setIsIngestFileDialogOpen(true)}
                        className={outlineButtonClassName("neutral", "rounded px-3 py-1.5 text-xs")}
                      >
                        Ingest From File
                      </button>
                      <button
                        onClick={() => setIsIngestDocumentDialogOpen(true)}
                        className={outlineButtonClassName("neutral", "rounded px-3 py-1.5 text-xs")}
                      >
                        Ingest From Document
                      </button>
                    </div>
                  </div>

                  <div className={tableContainerClassName}>
                    {/* 表头 */}
                    <div className={cn("grid grid-cols-12 gap-2", tableHeaderClassName)}>
                      <div className="col-span-3 text-center">Name</div>
                      <div className="col-span-1 text-center">Source</div>
                      <div className="col-span-1 text-center">Size</div>
                      <div className="col-span-2 text-center">Status</div>
                      <div className="col-span-2 text-center">Updated At</div>
                      <div className="col-span-3 text-center">Actions</div>
                    </div>

                    {documentsLoading ? (
                      <p className="px-4 py-6 text-center text-xs text-muted-foreground">Loading...</p>
                    ) : documents.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-muted-foreground">No documents.</p>
                    ) : (
                      <div className={tableBodyClassName}>
                        {documents.map((doc) => {
                          const sourceType = String(doc.metadata?.source_type || "file");
                          return (
                            <div
                              key={doc.id}
                              className={cn("grid grid-cols-12 items-center gap-2", tableRowClassName)}
                            >
                              {/* Name —— 点击进入 document-chunks 标签页 */}
                              <button
                                className="col-span-3 min-w-0 text-left"
                                onClick={() => syncQueryState({ view: "corpus", corpusId: selectedCorpusId, tab: "document-chunks", documentId: doc.id })}
                              >
                                <p className="truncate text-sm font-medium" title={effectiveDocumentName(doc)}>
                                  {effectiveDocumentName(doc)}
                                </p>
                              </button>
                              {/* Source */}
                              <div className="col-span-1 truncate text-center text-xs text-muted-foreground" title={sourceType}>
                                {sourceType}
                              </div>
                              {/* Size */}
                              <div className="col-span-1 text-center text-xs text-muted-foreground">
                                {doc.file_size} bytes
                              </div>
                              {/* Status */}
                              <div className="col-span-2 flex justify-center">
                                <PipelineStatusBadge
                                  status={
                                    buildingDocIds.has(doc.id)
                                      ? "processing"
                                      : doc.markdown_extract_status || doc.status
                                  }
                                />
                              </div>
                              {/* Updated At —— 列表按最终修改时间倒序 */}
                              <div className="col-span-2 text-center text-xs text-muted-foreground">
                                {formatRelativeTime(doc.updated_at ?? undefined)}
                              </div>
                              {/* Actions */}
                              <div className="col-span-3 flex flex-wrap items-center justify-end gap-1">
                                <button
                                  onClick={() => runDocumentAction("view", doc)}
                                  title="打开文档详情页查看解析后的 Markdown 正文"
                                  className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-caption")}
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => runDocumentAction("download", doc)}
                                  title="下载原始文件到本地"
                                  className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-caption")}
                                >
                                  Download
                                </button>
                                <button
                                  onClick={() => runDocumentAction("replace", doc)}
                                  title="用新文本替换该文档并重建索引（保留文档元信息）"
                                  className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-caption")}
                                >
                                  Replace
                                </button>
                                <button
                                  onClick={() => runDocumentAction("rebuild", doc)}
                                  title="重新分块并重建向量索引（不更换原始内容）"
                                  className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-caption")}
                                >
                                  Rebuild
                                </button>
                                {sourceType === "url" && (
                                  <button
                                    onClick={() => runDocumentAction("sync", doc)}
                                    title="重新抓取该 URL 源并刷新内容（仅 URL 类型）"
                                    className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-caption")}
                                  >
                                    Sync
                                  </button>
                                )}
                                {!doc.archived ? (
                                  <button
                                    onClick={() => runDocumentAction("archive", doc)}
                                    title="归档该文档，将其从默认检索中排除（可解档恢复）"
                                    className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-caption")}
                                  >
                                    Archive
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => runDocumentAction("unarchive", doc)}
                                    title="取消归档，恢复参与检索"
                                    className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-caption")}
                                  >
                                    Unarchive
                                  </button>
                                )}
                                <button
                                  onClick={() => runDocumentAction("delete", doc)}
                                  title="删除该文档及其全部 Chunks"
                                  className={outlineButtonClassName("danger", "rounded px-2 py-1 text-caption")}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 分页：每页 10 条 */}
                    {documentsTotal > 0 && (
                      <div className="flex items-center justify-between border-t border-border px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {`${documentsTotal} document${documentsTotal !== 1 ? "s" : ""}`}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={documentsPage <= 1 || documentsLoading}
                            onClick={() => setDocumentsPage((current) => Math.max(1, current - 1))}
                            className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-xs")}
                          >
                            Prev
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {documentsPage}/{Math.max(1, Math.ceil(documentsTotal / documentsPageSize))}
                          </span>
                          <button
                            type="button"
                            disabled={
                              documentsPage >= Math.max(1, Math.ceil(documentsTotal / documentsPageSize)) ||
                              documentsLoading
                            }
                            onClick={() =>
                              setDocumentsPage((current) =>
                                Math.min(Math.max(1, Math.ceil(documentsTotal / documentsPageSize)), current + 1),
                              )
                            }
                            className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-xs")}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {corpusTab === "document-chunks" && (
                <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <section className="flex min-h-0 flex-col rounded-2xl border border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                      <div>
                        <h2 className="text-lg font-semibold">Document Chunks</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{documentChunkCount} Chunks</p>
                      </div>
                      <button
                        onClick={() =>
                          syncQueryState({ view: "corpus", corpusId: selectedCorpusId, tab: "documents", documentId: null })
                        }
                        className={outlineButtonClassName("neutral", "rounded-xl px-3 py-2 text-xs")}
                      >
                        Back to Documents
                      </button>
                    </div>

                    <div
                      data-testid="document-chunks-queue"
                      className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-4"
                    >
                      {chunksLoading ? (
                        <p className="text-xs text-muted-foreground">Loading chunks...</p>
                      ) : documentChunks.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No chunks.</p>
                      ) : (
                        documentChunks.map((chunk) => {
                          const cardModel = toDocumentChunkCardViewModel(chunk);
                          return (
                            <RetrievedChunkCard
                              key={chunk.id}
                              chunk={cardModel}
                              onOpen={() => void handleSelectDocumentChunk(chunk)}
                              hideScores
                              showHitPrefix={false}
                              onChildChunkOpen={(childChunkId) => {
                                const childChunk = chunk.child_chunks.find((child) => child.id === childChunkId);
                                if (childChunk) {
                                  void handleSelectDocumentChunk(childChunk);
                                }
                              }}
                              className={
                                selectedDocumentChunk?.id === chunk.id
                                  ? "border-blue-500 bg-blue-500/5"
                                  : "bg-background"
                              }
                              badges={(
                                <>
                                  <span className="shrink-0 text-text-muted">·</span>
                                  <span className="shrink-0 text-text-secondary">
                                    Retrieval Count {chunk.display_retrieval_count}
                                  </span>
                                  <span
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-micro font-semibold uppercase tracking-overline ${
                                      chunk.is_enabled
                                        ? "bg-emerald-500/15 text-emerald-500"
                                        : "bg-muted text-text-muted"
                                    }`}
                                  >
                                    {chunk.is_enabled ? "Enabled" : "Disabled"}
                                  </span>
                                </>
                              )}
                            />
                          );
                        })
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-border px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={documentChunkPage <= 1}
                          onClick={() => setDocumentChunkPage((current) => Math.max(1, current - 1))}
                          className={outlineButtonClassName("neutral", "rounded-xl px-3 py-2 text-xs")}
                        >
                          Prev
                        </button>
                        <span className="text-sm text-muted-foreground">
                          {documentChunkPage}/{Math.max(1, Math.ceil(documentChunkCount / documentChunkPageSize))}
                        </span>
                        <button
                          type="button"
                          disabled={documentChunkPage >= Math.max(1, Math.ceil(documentChunkCount / documentChunkPageSize))}
                          onClick={() =>
                            setDocumentChunkPage((current) =>
                              Math.min(Math.max(1, Math.ceil(documentChunkCount / documentChunkPageSize)), current + 1),
                            )
                          }
                          className={outlineButtonClassName("neutral", "rounded-xl px-3 py-2 text-xs")}
                        >
                          Next
                        </button>
                      </div>
                      <select
                        value={String(documentChunkPageSize)}
                        onChange={(event) => {
                          setDocumentChunkPageSize(Number(event.target.value));
                          setDocumentChunkPage(1);
                        }}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
                      >
                        {[10, 25, 50].map((size) => (
                          <option key={size} value={String(size)}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                  </section>

                  <div className="min-h-0">
                    <DocumentMetadataPanel metadata={documentChunksMetadata} />
                  </div>
                </div>
              )}

              {corpusTab === "settings" && selectedCorpus && (
                <div className="pb-10">
                  <CorpusSettingsPanel
                    key={selectedCorpus.id}
                    corpus={selectedCorpus}
                    onSave={handleSaveCorpusSettings}
                  />
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      <ChunkDetailDialog
        chunk={selectedRetrievedChunkCard}
        onClose={() => setSelectedRetrievedChunk(null)}
      />

      <AddSourceDialog
        isOpen={isIngestUrlDialogOpen}
        corpusId={selectedCorpusId}
        onClose={() => setIsIngestUrlDialogOpen(false)}
        onIngestUrl={handleIngestUrl}
        onIngestFile={ingestFile}
        chunkingConfig={corpusChunkingConfig}
        onSuccess={() => setIsIngestUrlDialogOpen(false)}
        initialMode="url"
        allowedModes={["url"]}
        title="Ingest From URL"
      />

      <IngestFileDialog
        isOpen={isIngestFileDialogOpen}
        corpusId={selectedCorpusId}
        onClose={() => setIsIngestFileDialogOpen(false)}
        onIngestFile={(params) =>
          ingestFile(params).then((result) => {
            void loadDocuments();
            return result;
          })
        }
        chunkingConfig={corpusChunkingConfig}
        onSuccess={() => setIsIngestFileDialogOpen(false)}
        title="Ingest From File"
      />

      <IngestDocumentDialog
        isOpen={isIngestDocumentDialogOpen}
        corpusId={selectedCorpusId}
        onClose={() => setIsIngestDocumentDialogOpen(false)}
        onIngestDocument={(params) =>
          ingestDocument(params).then((result) => {
            void loadDocuments();
            return result;
          })
        }
        chunkingConfig={corpusChunkingConfig}
        onSuccess={() => setIsIngestDocumentDialogOpen(false)}
      />

      <CorpusFormDialog
        key={`${dialogMode}-${editingCorpus?.id || "new"}-${isDialogOpen ? "open" : "closed"}`}
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

      <DeleteSourceDialog
        isOpen={isDeleteDocumentDialogOpen}
        sourceName={deletingDocument?.original_filename ?? null}
        isDeleting={isDeletingDocument}
        title="Delete Document"
        message={
          <>
            确定删除文档{" "}
            <span className="font-semibold break-all">
              「{deletingDocument?.original_filename ?? "-"}」
            </span>{" "}
            吗？此操作会删除关联 chunks，且不可恢复。
          </>
        }
        onClose={() => {
          if (isDeletingDocument) return;
          setIsDeleteDocumentDialogOpen(false);
          setDeletingDocument(null);
        }}
        onConfirm={handleConfirmDeleteDocument}
      />

      <ChunkDetailDialog
        chunk={selectedDocumentChunkCard}
        onClose={() => {
          setSelectedDocumentChunk(null);
          setChunkDraftContent("");
          setChunkDraftEnabled(true);
        }}
        editable={
          selectedDocumentChunk
            ? {
                draftContent: chunkDraftContent,
                draftEnabled: chunkDraftEnabled,
                onDraftContentChange: setChunkDraftContent,
                onDraftEnabledChange: setChunkDraftEnabled,
                onSave: () => void handleSaveDocumentChunk(),
                onRegenerate: () => void handleRegenerateDocumentChunkFamily(),
                pending: chunkActionPending,
              }
            : undefined
        }
      />
    </div>
  );
}
