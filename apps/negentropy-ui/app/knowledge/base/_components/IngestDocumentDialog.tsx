"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Pagination } from "@/components/ui/Pagination";
import { useInfiniteList, type OffsetFetcher } from "@/hooks/useInfiniteList";
import { useInfiniteScrollSentinel, useScrollPageSync } from "@/hooks/useInfiniteScrollSentinel";
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
  const [corpora, setCorpora] = useState<CorpusRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 无限滚动 + 翻页：滚动容器 ref（哨兵 / 滚动联动 observer 的 root）、程序化滚动闸门、待跳页号。
  // 红线：root 必须是对话框内的 overflow 容器（下方 max-h-[360px] overflow-y-auto），不可用 viewport。
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollRef = useRef(false);
  const pendingPageRef = useRef<number | null>(null);

  // 偏移分页适配器：薄包 fetchAllDocuments；响应 count 归一为 total。
  const fetcher = useMemo<OffsetFetcher<KnowledgeDocument>>(
    () => ({
      kind: "offset",
      fetchRange: async ({ offset, limit }) => {
        const data = await fetchAllDocuments({ appName: APP_NAME, limit, offset });
        return { items: data.items, total: data.count };
      },
    }),
    [],
  );

  // enabled=isOpen：对话框关闭时挂起取数（对齐 useHeartbeatPoll.enabled 语义）。
  const list = useInfiniteList<KnowledgeDocument>({
    fetcher,
    pageSize: PAGE_SIZE,
    enabled: isOpen,
  });
  const documents = list.items;
  const total = list.total ?? 0;
  const loading = list.loading;
  const error = list.error;
  const { reset: listReset } = list;

  // 无限滚动哨兵：滚到底（提前 200px）→ 偏移补齐下一页。root = 对话框内 overflow 容器。
  const { sentinelRef } = useInfiniteScrollSentinel({
    onReach: list.loadMore,
    enabled: list.hasMore && !list.loadingMore && !list.loading,
    root: scrollRootRef,
  });

  // 滚动联动当前页高亮：观测每页首项的 data-infinite-page 锚点，取最靠上可见页。
  useScrollPageSync({
    enabled: isOpen,
    onPageChange: list.goToPage,
    root: scrollRootRef,
    rescanKey: documents.length,
    programmaticRef: programmaticScrollRef,
  });

  // 点页码跳页：先经 hook 确保该页已加载（偏移单请求补齐），再滚动到该页锚点。
  const handleGoToPage = useCallback(
    (target: number) => {
      pendingPageRef.current = target;
      programmaticScrollRef.current = true; // 抑制 observer 回写，防跳页与联动互相递归
      list.goToPage(target);
    },
    [list],
  );

  // 待跳页锚点出现即平滑滚动（偏移补齐后，锚点随 documents 增长后再现 → effect 重跑命中）。
  useEffect(() => {
    const target = pendingPageRef.current;
    if (target == null) return;
    const anchor = scrollRootRef.current?.querySelector<HTMLElement>(`[data-infinite-page="${target}"]`);
    if (!anchor) return;
    anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    pendingPageRef.current = null;
    const t = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 600);
    return () => window.clearTimeout(t);
  }, [list.currentPage, documents.length]);

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
    listReset(); // 回第 1 页 + 清缓冲（替代此前 setPage(1)）
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

      {/* Document List — 红线：此 overflow 容器即无限滚动哨兵 / 滚动联动 observer 的 root（非 viewport）。 */}
      <div ref={scrollRootRef} className="max-h-[360px] min-h-[160px] overflow-y-auto rounded-lg border border-border">
        {loading && documents.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">Loading documents...</p>
        ) : error ? (
          <p className="p-4 text-center text-xs text-red-500">{error}</p>
        ) : documents.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            暂无文档，可先在 Documents 页 Import Document
          </p>
        ) : (
          <div className="divide-y divide-border">
            {documents.map((doc, i) => {
              const ready =
                (doc.markdown_extract_status || "").toLowerCase() === "completed";
              const badge = markdownStatusBadge(doc.markdown_extract_status);
              const isSelected = selectedId === doc.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  data-infinite-page={
                    i % PAGE_SIZE === 0 ? Math.floor(i / PAGE_SIZE) + 1 : undefined
                  }
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

        {/* 无限滚动哨兵：进入视口即追加下一页。须位于 overflow root 内方能被正确观测。 */}
        <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      </div>

      {/* 居中翻页控件，与无限滚动并存。 */}
      {total > PAGE_SIZE && (
        <div className="mt-2">
          <Pagination
            page={list.currentPage}
            totalPages={list.totalPages}
            onPageChange={handleGoToPage}
            total={total}
            itemLabel="document"
            disabled={loading}
            loadingMore={list.loadingMore}
          />
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
