"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  buildExtractorRoutesFromDraft,
  buildCorpusConfig,
  CorpusRecord,
  ChunkingConfig,
  ChunkingStrategy,
  DocumentViewDialog,
  DocumentChunkItem,
  DocumentChunksMetadata,
  ExtractorDraftRoutes,
  ExtractorDraftTarget,
  KnowledgeDocument,
  KnowledgeMatch,
  SearchMode,
  createEmptyExtractorDraftTarget,
  fetchDocumentChunks,
  fetchDocumentChunkDetail,
  fetchDocuments,
  normalizeExtractorDraftRoutes,
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
  createDefaultChunkingConfig,
  normalizeChunkingConfig,
} from "@/features/knowledge";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import { AddSourceDialog } from "./_components/AddSourceDialog";
import { CorpusFormDialog } from "./_components/CorpusFormDialog";
import { DeleteCorpusDialog } from "./_components/DeleteCorpusDialog";
import { DeleteSourceDialog } from "./_components/DeleteSourceDialog";
import { RetrievedChunkCard } from "./_components/RetrievedChunkCard";
import { RetrievedChunkDetailDialog } from "./_components/RetrievedChunkDetailDialog";
import { ReplaceDocumentDialog } from "./_components/ReplaceDocumentDialog";
import { buildRetrievedChunkViewModel } from "./_components/retrieved-chunk-presenter";

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

function formatCorpusConfigSummary(corpus: CorpusRecord): string {
  const config = normalizeChunkingConfig(
    (corpus.config ?? {}) as Record<string, unknown>,
  );

  if (config.strategy === "semantic") {
    return `strategy: semantic · threshold: ${config.semantic_threshold.toFixed(2)} · buffer: ${config.semantic_buffer_size}`;
  }

  if (config.strategy === "hierarchical") {
    return `strategy: hierarchical · parent: ${config.hierarchical_parent_chunk_size} · child: ${config.hierarchical_child_chunk_size}`;
  }

  return `strategy: ${config.strategy} · size: ${config.chunk_size} · overlap: ${config.overlap}`;
}

function formatFileSize(size?: number | null): string {
  if (!size || size <= 0) return "--";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN");
}

function DocumentMetadataPanel({
  metadata,
}: {
  metadata: DocumentChunksMetadata;
}) {
  const stats = [
    ["Chunks specification", metadata.chunk_specification ?? "--"],
    ["Chunks length", metadata.chunk_length ?? "--"],
    ["Avg. paragraph length", metadata.avg_paragraph_length ?? "--"],
    ["Paragraphs", metadata.paragraph_count ?? "--"],
    ["Retrieval count", metadata.retrieval_count ?? 0],
    ["Embedding time", metadata.embedding_time_ms ? `${metadata.embedding_time_ms} ms` : "--"],
    ["Embedded spend", metadata.embedded_tokens ? `${metadata.embedded_tokens} tokens` : "--"],
  ];
  const docInfo = [
    ["Original filename", metadata.original_filename ?? "--"],
    ["Original file size", formatFileSize(metadata.file_size)],
    ["Upload date", formatDateTime(metadata.upload_date)],
    ["Last update date", formatDateTime(metadata.last_update_date)],
    ["Source", metadata.source ?? "--"],
  ];

  return (
    <section className="h-full rounded-2xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold">Document Metadata</h3>
      <p className="mt-2 text-sm text-muted">
        Metadata serves as a critical filter that enhances the accuracy and relevance of information retrieval.
      </p>
      <div className="mt-6 space-y-6">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Document Information</h4>
          <div className="mt-3 space-y-3">
            {docInfo.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-muted">{label}</span>
                <span className="text-right">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Technical Parameters</h4>
          <div className="mt-3 space-y-3">
            {stats.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-muted">{label}</span>
                <span className="text-right">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EditChunkPanel({
  chunk,
  draftContent,
  draftEnabled,
  onDraftContentChange,
  onDraftEnabledChange,
  onCancel,
  onSave,
  onRegenerate,
  pending,
}: {
  chunk: DocumentChunkItem;
  draftContent: string;
  draftEnabled: boolean;
  onDraftContentChange: (value: string) => void;
  onDraftEnabledChange: (value: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
  onRegenerate: () => void;
  pending: boolean;
}) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-2xl font-semibold">Edit Chunk</h3>
        <p className="mt-1 text-sm text-muted">
          {chunk.chunk_role === "parent" ? "Parent" : "Chunk"}-{String(chunk.chunk_index).padStart(2, "0")} · {chunk.character_count} characters
        </p>
      </div>
      <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
        <span className="text-sm text-muted">Enabled</span>
        <button
          type="button"
          aria-pressed={draftEnabled}
          onClick={() => onDraftEnabledChange(!draftEnabled)}
          className={`rounded-full px-3 py-1 text-xs font-medium ${draftEnabled ? "bg-emerald-500 text-white" : "bg-zinc-700 text-zinc-200"}`}
        >
          {draftEnabled ? "Enabled" : "Disabled"}
        </button>
      </div>
      <textarea
        value={draftContent}
        onChange={(event) => onDraftContentChange(event.target.value)}
        className="min-h-0 flex-1 resize-none rounded-2xl border border-border bg-background p-4 text-sm outline-none"
      />
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={outlineButtonClassName("neutral", "rounded-xl px-4 py-2 text-sm")}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onRegenerate}
          className={outlineButtonClassName("neutral", "rounded-xl px-4 py-2 text-sm")}
        >
          Save & Regenerate Child Chunks
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onSave}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </section>
  );
}

function ChunkingStrategyPanel({
  config,
  onChange,
  title,
  description,
}: {
  config: ChunkingConfig;
  onChange: Dispatch<SetStateAction<ChunkingConfig>>;
  title: string;
  description?: string;
}) {
  const strategyDescriptions: Record<ChunkingStrategy, string> = {
    fixed: "固定长度切分，简单可预测，但可能割裂句子或段落。",
    recursive: "按段落、句子、词递归切分，适合大多数技术文档。",
    semantic: "基于语义相似度断点切分，完整性更高，但计算成本更高。",
    hierarchical: "构建父子块结构，检索子块并返回父块上下文，适合长文与手册。",
  };

  const setStrategy = (strategy: ChunkingStrategy) => {
    onChange(createDefaultChunkingConfig(strategy));
  };

  const updateConfig = (nextConfig: ChunkingConfig) => {
    onChange(nextConfig);
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="mt-1 text-xs text-muted">{description}</p>
          )}
        </div>
        <div className="text-[11px] text-muted">大小单位: 字符近似值</div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {(["fixed", "recursive", "semantic", "hierarchical"] as const).map(
          (strategy) => (
            <button
              key={strategy}
              type="button"
              onClick={() => setStrategy(strategy)}
              className={`rounded-xl border px-3 py-3 text-left ${
                config.strategy === strategy
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted"
              }`}
            >
              <div className="text-xs font-semibold capitalize">{strategy}</div>
              <div
                className={`mt-1 text-[11px] ${
                  config.strategy === strategy ? "text-background/80" : "text-muted"
                }`}
              >
                {strategyDescriptions[strategy]}
              </div>
            </button>
          ),
        )}
      </div>

      {config.strategy === "fixed" && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs">
            <div className="mb-1 text-muted">Chunk Size</div>
            <input
              type="number"
              value={String(config.chunk_size)}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  chunk_size: Number(e.target.value || 0) || 800,
                })
              }
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
          <label className="text-xs">
            <div className="mb-1 text-muted">Overlap</div>
            <input
              type="number"
              value={String(config.overlap)}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  overlap: Number(e.target.value || 0) || 0,
                })
              }
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.preserve_newlines}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  preserve_newlines: e.target.checked,
                })
              }
            />
            <span>保留换行</span>
          </label>
        </div>
      )}

      {config.strategy === "recursive" && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs">
              <div className="mb-1 text-muted">Chunk Size</div>
              <input
                type="number"
                value={String(config.chunk_size)}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    chunk_size: Number(e.target.value || 0) || 800,
                  })
                }
                className="w-full rounded border border-border bg-card px-2 py-2"
              />
            </label>
            <label className="text-xs">
              <div className="mb-1 text-muted">Overlap</div>
              <input
                type="number"
                value={String(config.overlap)}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    overlap: Number(e.target.value || 0) || 0,
                  })
                }
                className="w-full rounded border border-border bg-card px-2 py-2"
              />
            </label>
            <label className="text-xs md:col-span-2">
              <div className="mb-1 text-muted">Separators（每行一个）</div>
              <textarea
                value={config.separators.join("\n")}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    separators: e.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                rows={3}
                className="w-full rounded border border-border bg-card px-2 py-2"
              />
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.preserve_newlines}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  preserve_newlines: e.target.checked,
                })
              }
            />
            <span>保留换行</span>
          </label>
        </div>
      )}

      {config.strategy === "semantic" && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-xs">
            <div className="mb-1 text-muted">Similarity Threshold</div>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={String(config.semantic_threshold)}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  semantic_threshold: Number(e.target.value) || 0.85,
                })
              }
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
          <label className="text-xs">
            <div className="mb-1 text-muted">Buffer Size</div>
            <input
              type="number"
              value={String(config.semantic_buffer_size)}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  semantic_buffer_size: Number(e.target.value) || 1,
                })
              }
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
          <label className="text-xs">
            <div className="mb-1 text-muted">Min Chunk Size</div>
            <input
              type="number"
              value={String(config.min_chunk_size)}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  min_chunk_size: Number(e.target.value) || 50,
                })
              }
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
          <label className="text-xs">
            <div className="mb-1 text-muted">Max Chunk Size</div>
            <input
              type="number"
              value={String(config.max_chunk_size)}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  max_chunk_size: Number(e.target.value) || 2000,
                })
              }
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
        </div>
      )}

      {config.strategy === "hierarchical" && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs">
              <div className="mb-1 text-muted">Parent Size</div>
              <input
                type="number"
                value={String(config.hierarchical_parent_chunk_size)}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    hierarchical_parent_chunk_size: Number(e.target.value) || 1024,
                  })
                }
                className="w-full rounded border border-border bg-card px-2 py-2"
              />
            </label>
            <label className="text-xs">
              <div className="mb-1 text-muted">Child Size</div>
              <input
                type="number"
                value={String(config.hierarchical_child_chunk_size)}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    hierarchical_child_chunk_size: Number(e.target.value) || 256,
                  })
                }
                className="w-full rounded border border-border bg-card px-2 py-2"
              />
            </label>
            <label className="text-xs">
              <div className="mb-1 text-muted">Child Overlap</div>
              <input
                type="number"
                value={String(config.hierarchical_child_overlap)}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    hierarchical_child_overlap: Number(e.target.value) || 0,
                  })
                }
                className="w-full rounded border border-border bg-card px-2 py-2"
              />
            </label>
          </div>
          <label className="text-xs">
            <div className="mb-1 text-muted">Separators（每行一个）</div>
            <textarea
              value={config.separators.join("\n")}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  separators: e.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
              rows={3}
              className="w-full rounded border border-border bg-card px-2 py-2"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.preserve_newlines}
              onChange={(e) =>
                updateConfig({
                  ...config,
                  preserve_newlines: e.target.checked,
                })
              }
            />
            <span>保留换行</span>
          </label>
        </div>
      )}
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
  const [documentChunksMetadata, setDocumentChunksMetadata] = useState<DocumentChunksMetadata>({});
  const [documentChunkCount, setDocumentChunkCount] = useState(0);
  const [documentChunkPage, setDocumentChunkPage] = useState(1);
  const [documentChunkPageSize, setDocumentChunkPageSize] = useState(10);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [expandedChunkFamilies, setExpandedChunkFamilies] = useState<Record<string, boolean>>({});

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
  const [deletingCorpus, setDeletingCorpus] = useState<CorpusRecord | null>(null);
  const [isDeletingCorpus, setIsDeletingCorpus] = useState(false);
  const [isDeleteDocumentDialogOpen, setIsDeleteDocumentDialogOpen] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState<KnowledgeDocument | null>(null);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);
  const [replacingDocument, setReplacingDocument] = useState<KnowledgeDocument | null>(null);
  const [viewingDoc, setViewingDoc] = useState<KnowledgeDocument | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleIngestUrl = async ({
    url,
  }: {
    url: string;
    chunkingConfig?: ChunkingConfig;
  }) => {
    if (!selectedCorpusId) {
      throw new Error("Corpus is required before ingesting URL sources");
    }
    try {
      const result = await ingestUrl({
        url: url.trim(),
        as_document: true,
        chunkingConfig: corpusChunkingConfig,
      });
      toast.success("URL ingest started");
      setIsIngestUrlDialogOpen(false);
      await loadDocuments();
      return result;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "URL ingest failed");
      throw err;
    }
  };

  const handleIngestFile = async ({
    file,
    source_uri,
    chunkingConfig,
  }: {
    file: File;
    source_uri?: string;
    chunkingConfig?: ChunkingConfig;
  }) => {
    if (!selectedCorpusId) {
      throw new Error("Corpus is required before ingesting file sources");
    }
    try {
      const result = await ingestFile({
        file,
        source_uri: source_uri || file.name,
        chunkingConfig: chunkingConfig ?? corpusChunkingConfig,
      });
      toast.success("File ingest started");
      await loadDocuments();
      return result;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "File ingest failed");
      throw err;
    }
  };

  const runDocumentAction = async (
    action: "sync" | "rebuild" | "replace" | "archive" | "unarchive" | "download" | "view" | "delete",
    doc: KnowledgeDocument,
  ) => {
    if (!selectedCorpusId) return;
    try {
      if (action === "sync") {
        await syncDocument(selectedCorpusId, doc.id, {
          app_name: APP_NAME,
          ...corpusChunkingConfig,
        });
      } else if (action === "rebuild") {
        await rebuildDocument(selectedCorpusId, doc.id, {
          app_name: APP_NAME,
          ...corpusChunkingConfig,
        });
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
        setViewingDoc(doc);
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
      await updateCorpus(selectedCorpus.id, { config });
      await loadCorpus(selectedCorpus.id);
      toast.success("Settings saved");
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
          <span className="text-muted">Target Corpus（可多选）</span>
          {selectedRetrievalCorpusIds.length === 0 && (
            <span className="text-[11px] text-amber-600">
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
              data-testid={`corpus-card-${corpus.id}`}
              className="flex h-40 cursor-pointer flex-col rounded-xl border border-border bg-background p-3 transition hover:border-foreground/40"
              onClick={() => openCorpusWorkspace(corpus.id, "documents")}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{corpus.name}</h3>
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <span
                    data-testid={`corpus-chunks-${corpus.id}`}
                    className="text-[11px] font-medium text-muted"
                  >
                    chunks: {corpus.knowledge_count}
                  </span>
                  <CorpusStatusBadge corpus={corpus} />
                </div>
              </div>
              <p
                data-testid={`corpus-description-${corpus.id}`}
                className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-muted"
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
                  className="min-w-0 flex-1 self-center truncate text-[11px] leading-5 text-muted"
                  title={formatCorpusConfigSummary(corpus)}
                >
                  {formatCorpusConfigSummary(corpus)}
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <button
                    onClick={() => handleEditCorpus(corpus)}
                    className={outlineButtonClassName(
                      "neutral",
                      "inline-flex h-7 items-center rounded px-2.5 text-[11px]",
                    )}
                  >
                    Settings
                  </button>
                  <button
                    onClick={() => handleDeleteCorpus(corpus)}
                    className={outlineButtonClassName(
                      "danger",
                      "inline-flex h-7 items-center rounded px-2.5 text-[11px]",
                    )}
                  >
                    Delete
                  </button>
                </div>
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

      <div className="relative flex-1 overflow-hidden px-6 py-6">
        {viewMode === "overview" ? (
          <div className="h-full overflow-y-auto">
            <div className="space-y-4 pb-28">
              {retrievalDocked && retrievalResults.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="mb-3 text-3xl font-semibold text-foreground">
                    {retrievedChunkCards.length} Retrieved Chunks
                  </div>
                  <div className="space-y-2">
                    {retrievedChunkCards.map((item) => (
                      <RetrievedChunkCard
                        key={`${item.id}-${item.raw.metadata?.corpus_id || "na"}`}
                        chunk={item}
                        onOpen={() => setSelectedRetrievedChunk(item.raw)}
                      />
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
              className="min-w-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-sm"
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
                        onClick={() => fileInputRef.current?.click()}
                        className={outlineButtonClassName("neutral", "rounded px-3 py-1.5 text-xs")}
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
                            void handleIngestFile({ file, source_uri: file.name });
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
                                <button onClick={() => runDocumentAction("view", doc)} className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-[11px]")}>View</button>
                                <button onClick={() => runDocumentAction("download", doc)} className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-[11px]")}>Download</button>
                                <button onClick={() => runDocumentAction("replace", doc)} className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-[11px]")}>Replace</button>
                                <button onClick={() => runDocumentAction("rebuild", doc)} className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-[11px]")}>Rebuild</button>
                                {sourceType === "url" && (
                                  <button onClick={() => runDocumentAction("sync", doc)} className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-[11px]")}>Sync</button>
                                )}
                                <button onClick={() => runDocumentAction("archive", doc)} className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-[11px]")}>Archive</button>
                                <button onClick={() => runDocumentAction("unarchive", doc)} className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-[11px]")}>Unarchive</button>
                                <button onClick={() => runDocumentAction("delete", doc)} className={outlineButtonClassName("danger", "rounded px-2 py-1 text-[11px]")}>Delete</button>
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
                <div className="grid gap-4 pb-10 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <section className="flex min-h-[760px] flex-col rounded-2xl border border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                      <div>
                        <h2 className="text-lg font-semibold">Document Chunks</h2>
                        <p className="mt-1 text-sm text-muted">{documentChunkCount} Chunks</p>
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

                    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                      {chunksLoading ? (
                        <p className="text-xs text-muted">Loading chunks...</p>
                      ) : documentChunks.length === 0 ? (
                        <p className="text-xs text-muted">No chunks.</p>
                      ) : (
                        documentChunks.map((chunk) => {
                          const familyKey = chunk.chunk_family_id || chunk.id;
                          const expanded = Boolean(expandedChunkFamilies[familyKey]);
                          return (
                            <div
                              key={chunk.id}
                              className={`rounded-2xl border p-4 ${
                                selectedDocumentChunk?.id === chunk.id
                                  ? "border-blue-500 bg-blue-500/5"
                                  : "border-border bg-background"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => void handleSelectDocumentChunk(chunk)}
                                className="block w-full text-left"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                                      {chunk.chunk_role === "parent" ? "Parent" : "Chunk"}-{String(chunk.chunk_index).padStart(2, "0")} · {chunk.character_count} characters · {chunk.display_retrieval_count} Retrieval count
                                    </p>
                                    <p className="mt-2 line-clamp-2 text-base">{chunk.content}</p>
                                  </div>
                                  <span
                                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                                      chunk.is_enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"
                                    }`}
                                  >
                                    {chunk.is_enabled ? "Enabled" : "Disabled"}
                                  </span>
                                </div>
                              </button>
                              {chunk.child_chunks.length > 0 && (
                                <div className="mt-4">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedChunkFamilies((current) => ({
                                        ...current,
                                        [familyKey]: !expanded,
                                      }))
                                    }
                                    className="text-sm font-semibold text-muted"
                                  >
                                    {expanded ? "v" : ">"} {chunk.child_chunks.length} Child Chunks
                                  </button>
                                  {expanded && (
                                    <div className="mt-3 space-y-2 border-l border-blue-500/40 pl-3">
                                      {chunk.child_chunks.map((child) => (
                                        <button
                                          key={child.id}
                                          type="button"
                                          onClick={() => void handleSelectDocumentChunk(child)}
                                          className="block w-full rounded-xl bg-muted/40 px-3 py-2 text-left text-sm hover:bg-muted"
                                        >
                                          <span className="mr-2 text-xs text-muted">
                                            C-{child.child_chunk_index ?? child.chunk_index}
                                          </span>
                                          <span className="line-clamp-1">{child.content}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
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
                        <span className="text-sm text-muted">
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

                  {selectedDocumentChunk ? (
                    <EditChunkPanel
                      chunk={selectedDocumentChunk}
                      draftContent={chunkDraftContent}
                      draftEnabled={chunkDraftEnabled}
                      onDraftContentChange={setChunkDraftContent}
                      onDraftEnabledChange={setChunkDraftEnabled}
                      onCancel={() => {
                        setSelectedDocumentChunk(null);
                        setChunkDraftContent("");
                        setChunkDraftEnabled(true);
                      }}
                      onSave={() => void handleSaveDocumentChunk()}
                      onRegenerate={() => void handleRegenerateDocumentChunkFamily()}
                      pending={chunkActionPending}
                    />
                  ) : (
                    <DocumentMetadataPanel metadata={documentChunksMetadata} />
                  )}
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

      <RetrievedChunkDetailDialog
        chunk={selectedRetrievedChunkCard}
        onClose={() => setSelectedRetrievedChunk(null)}
      />

      <DocumentViewDialog
        isOpen={viewingDoc !== null}
        document={viewingDoc}
        onClose={() => setViewingDoc(null)}
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
  const [formConfig, setFormConfig] = useState<ChunkingConfig>(
    normalizeChunkingConfig((corpus.config || {}) as Record<string, unknown>),
  );
  const [extractorDraftRoutes, setExtractorDraftRoutes] = useState<ExtractorDraftRoutes>(
    normalizeExtractorDraftRoutes((corpus.config || {}) as Record<string, unknown>),
  );
  const [servers, setServers] = useState<Array<{ id: string; name: string; display_name: string | null; is_enabled: boolean }>>([]);
  const [toolsByServer, setToolsByServer] = useState<Record<string, Array<{ name: string; display_name: string | null; is_enabled: boolean }>>>({});

  useEffect(() => {
    let active = true;

    const loadServers = async () => {
      const response = await fetch("/api/plugins/mcp/servers");
      if (!response.ok) {
        throw new Error("Failed to load MCP servers");
      }
      const data = (await response.json()) as Array<{
        id: string;
        name: string;
        display_name: string | null;
        is_enabled: boolean;
      }>;
      if (!active) return;
      const enabledServers = data.filter((item) => item.is_enabled);
      setServers(enabledServers);

      const toolEntries = await Promise.all(
        enabledServers.map(async (server) => {
          const toolsResponse = await fetch(`/api/plugins/mcp/servers/${server.id}/tools`);
          if (!toolsResponse.ok) {
            return [server.id, []] as const;
          }
          const tools = (await toolsResponse.json()) as Array<{
            name: string;
            display_name: string | null;
            is_enabled: boolean;
          }>;
          return [server.id, tools.filter((item) => item.is_enabled)] as const;
        }),
      );
      if (!active) return;
      setToolsByServer(Object.fromEntries(toolEntries));
    };

    void loadServers().catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load MCP servers");
    });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async () => {
    await onSave(
      buildCorpusConfig(formConfig, buildExtractorRoutesFromDraft(extractorDraftRoutes)),
    );
  };

  return (
    <div className="space-y-3">
      <ChunkingStrategyPanel
        config={formConfig}
        onChange={setFormConfig}
        title="Chunking Settings"
        description="保存后作为该 Corpus 的默认分块配置。"
      />

      <div className="rounded-2xl border border-border bg-background p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">Document Extraction Settings</h3>
            <p className="mt-1 text-xs text-muted">
              通过 MCP Tools 为当前 Corpus 注入 URL、PDF 等源文档解释器。
            </p>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              可用于此处的 Tool 需提供可发现的 input/output schema，并能返回正文 Markdown 或文本；当前兼容单文档扁平协议，以及单个
              sources 数组的 batch 协议，系统会自动把单个 URL/PDF 请求包装为对应格式。
            </p>
          </div>
        </div>

        {([
          ["url", "URL 文档", "页面抓取、正文抽取、Markdown 化"],
          ["file_pdf", "PDF 文档", "PDF 解析、Markdown 转换、图片提取"],
        ] as const).map(([routeKey, title, description]) => {
          const targets = extractorDraftRoutes[routeKey];
          return (
            <div key={routeKey} className="mt-4 rounded-xl border border-border p-3">
              <div className="mb-3">
                <div className="text-xs font-semibold">{title}</div>
                <div className="text-[11px] text-muted">{description}</div>
              </div>
              <div className="space-y-3">
                {[0, 1].map((index) => {
                  const target = targets[index];
                  const selectedServerId = target?.server_id || "";
                  const toolOptions = selectedServerId
                    ? (toolsByServer[selectedServerId] || [])
                    : [];
                  const selectedServer =
                    servers.find((server) => server.id === selectedServerId) || null;
                  const hasSelectedTool = toolOptions.some(
                    (tool) => tool.name === target.tool_name,
                  );

                  const serverOptions = selectedServerId && !selectedServer
                    ? [
                        {
                          id: selectedServerId,
                          name: selectedServerId,
                          display_name: "已配置 MCP（当前不可用）",
                          is_enabled: false,
                        },
                        ...servers,
                      ]
                    : servers;
                  const visibleToolOptions =
                    target.tool_name && !hasSelectedTool
                      ? [
                          {
                            name: target.tool_name,
                            display_name: "已配置 Tool（当前不可用）",
                            is_enabled: false,
                          },
                          ...toolOptions,
                        ]
                      : toolOptions;

                  const setTarget = (patch: Partial<ExtractorDraftTarget>) => {
                    setExtractorDraftRoutes((prev) => {
                      const nextRoute = [...prev[routeKey]] as typeof prev[typeof routeKey];
                      nextRoute[index] = {
                        ...nextRoute[index],
                        ...patch,
                        priority: index,
                        enabled: true,
                      };
                      return {
                        ...prev,
                        [routeKey]: nextRoute,
                      };
                    });
                  };

                  const clearTarget = () => {
                    setExtractorDraftRoutes((prev) => {
                      const nextRoute = [...prev[routeKey]] as typeof prev[typeof routeKey];
                      nextRoute[index] = createEmptyExtractorDraftTarget(index);
                      return {
                        ...prev,
                        [routeKey]: nextRoute,
                      };
                    });
                  };

                  return (
                    <div key={`${routeKey}-${index}`} className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[120px_1fr_1fr_auto]">
                      <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                        {index === 0 ? "主用" : "备用"}
                      </div>
                      <label className="text-xs">
                        <div className="mb-1 text-muted">MCP Server</div>
                        <select
                          value={selectedServerId}
                          onChange={(e) =>
                            setTarget({ server_id: e.target.value, tool_name: "" })
                          }
                          className="w-full rounded border border-border bg-background px-2 py-2"
                        >
                          <option value="">未配置</option>
                          {serverOptions.map((server) => (
                            <option key={server.id} value={server.id}>
                              {server.display_name || server.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs">
                        <div className="mb-1 text-muted">Tool</div>
                        <select
                          value={target?.tool_name || ""}
                          onChange={(e) => setTarget({ tool_name: e.target.value })}
                          disabled={!selectedServerId}
                          className="w-full rounded border border-border bg-background px-2 py-2 disabled:opacity-50"
                        >
                          <option value="">未配置</option>
                          {visibleToolOptions.map((tool) => (
                            <option key={tool.name} value={tool.name}>
                              {tool.display_name || tool.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={clearTarget}
                          className={outlineButtonClassName("neutral", "rounded px-3 py-2 text-[11px]")}
                        >
                          清空
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

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
