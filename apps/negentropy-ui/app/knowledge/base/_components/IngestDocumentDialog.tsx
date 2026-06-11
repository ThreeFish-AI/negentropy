/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 命中既有代码模式（useEffect 内调用 fetcher 同步外部数据到 state）。
 * 与 documents/page.tsx 同款豁免；TODO(react-compiler): 按 SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/lib/activity-toast";
import {
  AsyncPipelineResult,
  ChunkingConfig,
  CorpusRecord,
  KnowledgeDocument,
  fetchAllDocuments,
  fetchCorpora,
} from "@/features/knowledge";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import { FileText, X } from "lucide-react";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";
const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IngestDocumentDialogProps {
  isOpen: boolean;
  /** 当前激活 Corpus（摄入目标） */
  corpusId: string | null;
  onClose: () => void;
  onIngestDocument: (params: {
    document_id: string;
    chunkingConfig?: ChunkingConfig;
  }) => Promise<AsyncPipelineResult>;
  chunkingConfig?: ChunkingConfig;
  onSuccess?: () => void;
  title?: string;
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

function markdownStatusBadge(status: string | undefined): {
  className: string;
  label: string;
} {
  switch ((status || "pending").toLowerCase()) {
    case "completed":
      return {
        className:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        label: "Ready",
      };
    case "processing":
      return {
        className:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        label: "Extracting",
      };
    case "failed":
      return {
        className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        label: "Failed",
      };
    default:
      return { className: "bg-muted text-text-secondary", label: "Pending" };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Ingest From Document 对话框：从全局文档库（含库文档与其他 Corpus 的文档）
 * 选取一个 Document，将其 Markdown 索引进当前 Corpus（跨 Corpus 摄入）。
 *
 * 仅 `markdown_extract_status === "completed"` 的文档可被摄入；
 * chunks 建在目标 Corpus，文档本体不动。
 */
export function IngestDocumentDialog({
  isOpen,
  corpusId,
  onClose,
  onIngestDocument,
  chunkingConfig,
  onSuccess,
  title = "Ingest From Document",
}: IngestDocumentDialogProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [corpora, setCorpora] = useState<CorpusRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllDocuments({
        appName: APP_NAME,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setDocuments(data.items);
      setTotal(data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (!isOpen) return;
    void loadDocuments();
  }, [isOpen, loadDocuments]);

  useEffect(() => {
    if (!isOpen) return;
    fetchCorpora(APP_NAME)
      .then(setCorpora)
      .catch(() => {
        // corpus 名称仅用于展示，失败时回退显示 corpus_id
      });
  }, [isOpen]);

  const getCorpusName = (id: string) =>
    corpora.find((c) => c.id === id)?.name || id;

  const resetForm = () => {
    setSelectedId(null);
    setPage(1);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleIngest = () => {
    if (!corpusId || !selectedId) return;

    const documentId = selectedId;

    // 立即关闭并重置
    resetForm();
    onSuccess?.();

    toast.success("已开始摄入文档", {
      description: "可在 Pipeline 页面查看构建进度",
    });

    // Fire-and-forget
    onIngestDocument({ document_id: documentId, chunkingConfig }).catch((err) => {
      toast.error("摄入失败", {
        description: err instanceof Error ? err.message : String(err),
      });
    });
  };

  if (!isOpen) return null;

  return (
    <OverlayDismissLayer
      open={isOpen}
      onClose={handleClose}
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200"
      contentProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": "ingest-document-dialog-title",
      }}
      backdropTestId="overlay-backdrop"
      contentTestId="overlay-content"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2
          id="ingest-document-dialog-title"
          className="text-lg font-semibold text-foreground"
        >
          {title}
        </h2>
        <button
          onClick={handleClose}
          className="text-text-muted hover:text-foreground"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <p className="mb-3 text-xs text-text-muted">
        从文档库选取 Document，将其 Markdown 索引进当前语料库（文档本体不移动；仅
        Markdown 就绪的文档可摄入）。
      </p>

      {/* Document List */}
      <div className="max-h-[360px] min-h-[160px] overflow-y-auto rounded-lg border border-border">
        {loading ? (
          <p className="p-4 text-center text-xs text-muted-foreground">Loading documents...</p>
        ) : error ? (
          <p className="p-4 text-center text-xs text-red-500">{error}</p>
        ) : documents.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            暂无文档，可先在 Documents 页 Import Document
          </p>
        ) : (
          <div className="divide-y divide-border">
            {documents.map((doc) => {
              const ready =
                (doc.markdown_extract_status || "").toLowerCase() === "completed";
              const badge = markdownStatusBadge(doc.markdown_extract_status);
              const isSelected = selectedId === doc.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  disabled={!ready}
                  title={ready ? undefined : "Markdown 未就绪，无法摄入"}
                  onClick={() => setSelectedId(isSelected ? null : doc.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-muted/40"
                  } ${ready ? "" : "cursor-not-allowed opacity-50"}`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      isSelected
                        ? "border-blue-500 bg-blue-500"
                        : "border-border"
                    }`}
                    aria-hidden
                  >
                    {isSelected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <FileText className="h-4 w-4 shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm font-medium text-foreground"
                      title={doc.original_filename}
                    >
                      {doc.original_filename}
                    </span>
                  </span>
                  {doc.corpus_id === corpusId ? (
                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      当前语料库
                    </span>
                  ) : doc.corpus_id ? (
                    <span
                      className="max-w-[140px] shrink-0 truncate rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      title={getCorpusName(doc.corpus_id)}
                    >
                      {getCorpusName(doc.corpus_id)}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Library
                    </span>
                  )}
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-xs")}
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-xs")}
          >
            Next
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={handleClose}
          className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={handleIngest}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm hover:opacity-90 disabled:opacity-50"
          disabled={!corpusId || !selectedId}
        >
          Ingest
        </button>
      </div>
    </OverlayDismissLayer>
  );
}
