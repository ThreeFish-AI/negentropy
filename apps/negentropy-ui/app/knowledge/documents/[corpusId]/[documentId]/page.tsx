/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "@/lib/activity-toast";
import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import { useHeartbeatPoll } from "@/hooks/useHeartbeatPoll";

import type {
  KnowledgeDocumentDetail,
} from "@/features/knowledge/utils/knowledge-api";
import {
  documentPreviewUrl,
  downloadDocument,
  effectiveDocumentName,
  fetchDocumentDetail,
  isPdfDocument,
  LIBRARY_CORPUS_SEGMENT,
  refreshDocumentMarkdown,
  updateDocument,
} from "@/features/knowledge/utils/knowledge-api";
import { formatRelativeTime } from "@/features/knowledge/utils/pipeline-helpers";
import { DocumentMarkdownRenderer } from "@/features/knowledge/components/DocumentMarkdownRenderer";
import { DocumentPdfViewer } from "@/features/knowledge/components/DocumentPdfViewer";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

// ---------------------------------------------------------------------------
// Utility helpers（文档详情展示用，原 DocumentViewDialog 已退役并收敛至本页）
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string | null): React.ReactElement {
  if (contentType?.includes("pdf")) {
    return (
      <svg className="h-8 w-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  }
  if (contentType?.includes("markdown") || contentType?.includes("text")) {
    return (
      <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  return (
    <svg className="h-8 w-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function getStatusBadge(status: string): { bg: string; text: string; label: string } {
  switch (status.toLowerCase()) {
    case "active":
      return { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", label: "Active" };
    case "deleted":
      return { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", label: "Deleted" };
    default:
      return { bg: "bg-muted", text: "text-text-secondary", label: status };
  }
}

function getMarkdownStatusBadge(status: string): { bg: string; text: string; label: string } {
  switch (status.toLowerCase()) {
    case "completed":
      return { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", label: "Markdown Ready" };
    case "processing":
      return { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", label: "Extracting" };
    case "failed":
      return { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", label: "Extraction Failed" };
    default:
      return { bg: "bg-muted", text: "text-text-secondary", label: "Pending" };
  }
}

function truncateHash(hash: string | null): string {
  if (!hash) return "-";
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
}

// 根据当前 markdown_extract_status 与错误内容判定按钮语义并直接返回应展示文案。
// 失败 / partial 状态下，后端 + perceives 已为每切片落 checkpoint；
// 再次调用 refresh_markdown 会自动从最后一个完成的切片继续（resume=True）。
// 因此 UI 在这些状态下把按钮文案改为 "Continue"，更准确表达「断点续传」语义。
function getMarkdownActionLabel(
  status: string,
  isWorking: boolean,
  error: string | null | undefined,
): { label: string; isResumable: boolean } {
  const normalized = (status || "").toLowerCase();
  const errStr = (error || "").toLowerCase();
  const isResumable =
    normalized === "failed" || errStr.includes("partial");
  if (isResumable) {
    return {
      label: isWorking ? "Resuming..." : "Continue (resume)",
      isResumable: true,
    };
  }
  return {
    label: isWorking ? "Re-Parsing..." : "Re-Parse",
    isResumable: false,
  };
}

function displayUser(createdBy: string | null, displayName?: string | null): string {
  if (displayName) return displayName;
  if (!createdBy) return "-";
  if (createdBy.includes("@")) {
    const local = createdBy.split("@")[0];
    return local || createdBy;
  }
  return createdBy.length > 20 ? `${createdBy.slice(0, 20)}...` : createdBy;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function DocumentDetailPage() {
  const params = useParams<{ corpusId: string; documentId: string }>();
  // 路由段为 "library" 时表示库文档（corpus_id=null），API 走无 corpus 平行路由
  const corpusId =
    params.corpusId === LIBRARY_CORPUS_SEGMENT ? null : params.corpusId;
  const documentId = params.documentId;

  // 上下文化「Back」：from 携带打开来源的站内返回路径（如 Knowledge/Base 的某 Corpus）。
  // 站内护栏：仅接受以单个 "/" 开头的本站路径，拒绝 http(s)://、协议相对 "//"、javascript: 等外跳。
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const decodedFrom = fromParam ? decodeURIComponent(fromParam) : null;
  const safeFrom =
    decodedFrom && /^\/(?!\/)/.test(decodedFrom) ? decodedFrom : null;
  const backHref = safeFrom ?? "/knowledge/documents";
  const backLabel = safeFrom ? "Back" : "Back to Documents";

  const [detail, setDetail] = useState<KnowledgeDocumentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRefreshingMarkdown, setIsRefreshingMarkdown] = useState(false);
  // 文档预览模式：仅当源文档为 PDF 时才会出现「PDF」切换；默认 Markdown，保持现状。
  const [viewMode, setViewMode] = useState<"markdown" | "pdf">("markdown");

  // Article Metadata editing state
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState({
    author: "",
    author_url: "",
    source_url: "",
    published_at: "",
  });

  const requestAppName = detail?.app_name || APP_NAME;

  // ---- Data fetching ----

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await fetchDocumentDetail(corpusId, documentId, {
        appName: APP_NAME,
      });
      setDetail(res);
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Failed to load document content",
      );
    } finally {
      setLoadingDetail(false);
    }
  }, [corpusId, documentId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  // Auto-poll when markdown is still processing - Phase 3-A unified heartbeat
  // useHeartbeatPoll handles tabs visibility + online events + 5s heartbeat parity
  // with backend NEGENTROPY_SCHEDULER_HEARTBEAT_SECONDS.
  useHeartbeatPoll(loadDetail, {
    enabled:
      !!detail && (detail.markdown_extract_status || "").toLowerCase() === "processing",
    fireImmediately: false,
  });

  // ---- Action handlers ----

  const handleDownload = async () => {
    if (!detail || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadDocument(corpusId, detail.id, {
        appName: requestAppName,
      });
      toast.success(`Downloaded: ${detail.original_filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download document");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRefreshMarkdown = async () => {
    if (!detail || isRefreshingMarkdown) return;
    setIsRefreshingMarkdown(true);
    try {
      const result = await refreshDocumentMarkdown(corpusId, detail.id, {
        appName: requestAppName,
      });
      toast.success(result.message || "Markdown re-parse started");
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              markdown_extract_status: "processing",
              markdown_extract_error: null,
            }
          : prev,
      );
      await loadDetail();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start markdown re-parse",
      );
    } finally {
      setIsRefreshingMarkdown(false);
    }
  };

  // ---- Derived state ----

  const meta = detail?.metadata as Record<string, string> | undefined;

  const startMetaEdit = useCallback(() => {
    if (!detail) return;
    const m = (detail.metadata as Record<string, string>) || {};
    setMetaDraft({
      author: m.author || "",
      author_url: m.author_url || "",
      source_url: m.source_url || m.source_uri || "",
      published_at: m.published_at || "",
    });
    setIsEditingMeta(true);
  }, [detail]);

  const cancelMetaEdit = useCallback(() => {
    setIsEditingMeta(false);
  }, []);

  const commitMetaEdit = useCallback(async () => {
    if (!detail) return;
    setIsSavingMeta(true);
    try {
      await updateDocument(corpusId, detail.id, {
        author: metaDraft.author.trim() || null,
        author_url: metaDraft.author_url.trim() || null,
        source_url: metaDraft.source_url.trim() || null,
        published_at: metaDraft.published_at.trim() || null,
      });
      toast.success("Article metadata saved — Wiki will update after next publish");
      setIsEditingMeta(false);
      await loadDetail();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save metadata");
    } finally {
      setIsSavingMeta(false);
    }
  }, [detail, corpusId, metaDraft, loadDetail]);

  const statusBadge = getStatusBadge(detail?.status || "");
  const markdownStatus =
    detail?.markdown_extract_status || "pending";
  const markdownBadge = getMarkdownStatusBadge(markdownStatus);
  const markdownAction = getMarkdownActionLabel(
    markdownStatus,
    isRefreshingMarkdown,
    detail?.markdown_extract_error,
  );

  // 源文档是否为 PDF —— 决定是否展示「Markdown | PDF」切换。
  const isPdf = detail ? isPdfDocument(detail) : false;
  // 仅在 PDF 文档 + 选中 PDF 标签时渲染原文查看器；其余一律走 Markdown 分支。
  const showPdf = isPdf && viewMode === "pdf";

  // PDF「意图预取」：默认视图是 Markdown 且多数用户不会点开 PDF，故不在挂载时预取
  // （会让所有人白白下载整份 PDF）。改在用户对 PDF 标签产生意图（hover/focus）时，
  // 用低优先级 `<link rel=prefetch>` 预热浏览器缓存一次，使随后点击近乎秒开。
  // 后端已为预览端点补齐 ETag/Cache-Control，预取内容可被 `<object>` 命中复用。
  const pdfPrefetchedRef = useRef(false);
  const prefetchPdf = useCallback(() => {
    if (pdfPrefetchedRef.current || !isPdf) return;
    pdfPrefetchedRef.current = true;
    const href = documentPreviewUrl(corpusId, documentId, { appName: requestAppName });
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "document"; // 原生查看器以 document/object 加载，as=document 对齐缓存分区
    link.href = href;
    link.setAttribute("fetchpriority", "low"); // 不与首屏 markdown 资源争抢带宽
    document.head.appendChild(link);
  }, [isPdf, corpusId, documentId, requestAppName]);

  // ---- Render ----

  return (
    <div className="flex h-full flex-col bg-background">
      <KnowledgeNav
        title={detail ? effectiveDocumentName(detail) : "Document Detail"}
      />

      {/* Action bar */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-2 flex items-center gap-3">
        <Link
          href={backHref}
          className={outlineButtonClassName(
            "neutral",
            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold",
          )}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {backLabel}
        </Link>

        {/* 顶部中栏：Markdown | PDF 切换（仅 PDF 源文档显示，居中于操作栏） */}
        <div className="flex flex-1 justify-center">
          {isPdf ? (
            <div
              role="tablist"
              aria-label="Document view mode"
              className="inline-flex items-center rounded-lg border border-border bg-muted p-0.5 text-xs font-semibold"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "markdown"}
                onClick={() => setViewMode("markdown")}
                className={`rounded-md px-3 py-1 transition-colors ${
                  viewMode === "markdown"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-text-muted hover:text-foreground"
                }`}
              >
                Markdown
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "pdf"}
                onClick={() => setViewMode("pdf")}
                onPointerEnter={prefetchPdf}
                onFocus={prefetchPdf}
                className={`rounded-md px-3 py-1 transition-colors ${
                  viewMode === "pdf"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-text-muted hover:text-foreground"
                }`}
              >
                PDF
              </button>
            </div>
          ) : null}
        </div>

        <button
          onClick={handleRefreshMarkdown}
          disabled={isRefreshingMarkdown || !detail}
          className={outlineButtonClassName(
            "neutral",
            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm",
          )}
          title={
            markdownAction.isResumable
              ? "从最后一个完成的切片继续解析（perceives auto_batch checkpoint）"
              : "从已存储的源文档重新解析 Markdown"
          }
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.636 18.364A9 9 0 103.22 9.88" />
          </svg>
          {markdownAction.label}
        </button>
        <button
          onClick={handleDownload}
          disabled={isDownloading || !detail}
          className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {isDownloading ? "Downloading..." : "Download"}
        </button>
      </div>

      {/* Scrollable content area */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {!detail && loadingDetail ? (
          <div className="flex items-center justify-center py-20 text-sm text-text-muted">
            Loading document...
          </div>
        ) : detailError && !detail ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <p className="text-sm text-red-600 dark:text-red-400">{detailError}</p>
            <button
              onClick={() => void loadDetail()}
              className={outlineButtonClassName("neutral", "rounded-lg px-4 py-2 text-xs font-semibold")}
            >
              Retry
            </button>
          </div>
        ) : detail ? (
          <div className="mx-auto max-w-5xl">
            {/* Header: icon + filename + badges */}
            <div className="mb-4 flex items-center gap-3">
              {getFileIcon(detail.content_type)}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold text-foreground" title={effectiveDocumentName(detail)}>
                    {effectiveDocumentName(detail)}
                  </h1>
                  <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-micro font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                    {statusBadge.label}
                  </span>
                  <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-micro font-medium ${markdownBadge.bg} ${markdownBadge.text}`}>
                    {markdownBadge.label}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  {detail.content_type || "Unknown type"}
                </p>
              </div>
            </div>

            {/* Metadata strip */}
            <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-border bg-muted px-4 py-2.5 text-xs sm:grid-cols-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-text-muted">Size</span>
                <span className="truncate font-medium text-foreground">
                  {formatFileSize(detail.file_size)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-text-muted">Hash</span>
                <span className="truncate font-mono font-medium text-foreground" title={detail.file_hash}>
                  {truncateHash(detail.file_hash)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-text-muted">Corpus</span>
                {detail.corpus_id ? (
                  <span className="truncate font-mono font-medium text-foreground" title={detail.corpus_id}>
                    {truncateHash(detail.corpus_id)}
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-text-secondary">
                    Library
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-text-muted">Storage</span>
                <span className="truncate font-mono font-medium text-foreground" title={detail.content_uri}>
                  {detail.content_uri ? `...${detail.content_uri.slice(-24)}` : "-"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-text-muted">Created By</span>
                <span className="truncate font-medium text-foreground" title={detail.created_by_name || detail.created_by || ""}>
                  {displayUser(detail.created_by, detail.created_by_name)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-text-muted">Created</span>
                <span className="truncate font-medium text-foreground" title={detail.created_at || ""}>
                  {formatRelativeTime(detail.created_at ?? undefined)}
                </span>
              </div>
            </div>

            {/* Article Metadata panel (Wiki 文章元数据编辑) */}
            <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-xs">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Article Metadata
                </h3>
                {!isEditingMeta ? (
                  <button
                    type="button"
                    onClick={startMetaEdit}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-text-muted hover:text-foreground hover:bg-border/40 transition-colors"
                    title="Edit article metadata"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void commitMetaEdit()}
                      disabled={isSavingMeta}
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {isSavingMeta ? "..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelMetaEdit}
                      disabled={isSavingMeta}
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-text-muted hover:bg-border/40 disabled:opacity-50"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {isEditingMeta ? (
                <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 items-center">
                  <label className="text-text-muted">Author</label>
                  <input
                    type="text"
                    value={metaDraft.author}
                    onChange={(e) => setMetaDraft((d) => ({ ...d, author: e.target.value }))}
                    placeholder="e.g. Anthropic Engineering"
                    className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                  />
                  <label className="text-text-muted">Author URL</label>
                  <input
                    type="url"
                    value={metaDraft.author_url}
                    onChange={(e) => setMetaDraft((d) => ({ ...d, author_url: e.target.value }))}
                    placeholder="e.g. https://github.com/username"
                    className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                  />
                  <label className="text-text-muted">Source URL</label>
                  <input
                    type="url"
                    value={metaDraft.source_url}
                    onChange={(e) => setMetaDraft((d) => ({ ...d, source_url: e.target.value }))}
                    placeholder="e.g. https://example.com/article"
                    className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                  />
                  <label className="text-text-muted">Published At</label>
                  <input
                    type="date"
                    value={metaDraft.published_at}
                    onChange={(e) => setMetaDraft((d) => ({ ...d, published_at: e.target.value }))}
                    className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 text-text-muted">Author</span>
                    <span className="truncate font-medium text-foreground">
                      {meta?.author || <span className="text-text-muted/50">–</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 text-text-muted">Source</span>
                    {meta?.source_url || meta?.source_uri ? (
                      <a
                        href={(meta?.source_url || meta?.source_uri) as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-medium text-foreground underline decoration-text-muted/40 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {(meta?.source_url || meta?.source_uri) as string}
                      </a>
                    ) : (
                      <span className="text-text-muted/50">–</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 text-text-muted">Published</span>
                    <span className="truncate font-medium text-foreground">
                      {meta?.published_at || <span className="text-text-muted/50">–</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 text-text-muted">Author URL</span>
                    {meta?.author_url ? (
                      <a
                        href={meta.author_url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-medium text-foreground underline decoration-text-muted/40 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {meta.author_url as string}
                      </a>
                    ) : (
                      <span className="text-text-muted/50">–</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Content card: Markdown 解析视图 / PDF 原文视图（由顶部中栏切换） */}
            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  {showPdf ? "PDF Source" : "Markdown Content"}
                </h2>
                <span className="text-xs text-text-muted">
                  {!showPdf && detail.markdown_extracted_at
                    ? `Updated ${formatRelativeTime(detail.markdown_extracted_at ?? undefined)}`
                    : ""}
                </span>
              </div>

              {showPdf ? (
                <DocumentPdfViewer
                  src={documentPreviewUrl(corpusId, documentId, { appName: requestAppName })}
                  filename={effectiveDocumentName(detail)}
                />
              ) : (
                <div className="rounded-lg bg-muted p-4">
                  {loadingDetail ? (
                    <p className="text-sm text-text-muted">Loading markdown content...</p>
                  ) : detailError ? (
                    <p className="text-sm text-red-600 dark:text-red-400">{detailError}</p>
                  ) : markdownStatus === "processing" || markdownStatus === "pending" ? (
                    <p className="text-sm text-text-muted">
                      Markdown extraction is running in background. This page will auto-refresh.
                    </p>
                  ) : markdownStatus === "failed" ? (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {detail.markdown_extract_error || "Markdown extraction failed. You can re-ingest this source to retry."}
                    </p>
                  ) : (detail.markdown_content || "").trim().length === 0 ? (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Markdown content is empty. Click <strong>Re-Parse</strong> to regenerate from the source document.
                    </p>
                  ) : (
                    <DocumentMarkdownRenderer
                      content={detail.markdown_content || ""}
                      corpusId={corpusId}
                      documentId={documentId}
                      appName={requestAppName}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
