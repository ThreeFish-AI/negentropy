"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "@/lib/activity-toast";
import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { outlineButtonClassName } from "@/components/ui/button-styles";

import type {
  KnowledgeDocumentDetail,
} from "@/features/knowledge/utils/knowledge-api";
import {
  downloadDocument,
  fetchDocumentDetail,
  refreshDocumentMarkdown,
} from "@/features/knowledge/utils/knowledge-api";
import { formatRelativeTime } from "@/features/knowledge/utils/pipeline-helpers";
import { DocumentMarkdownRenderer } from "@/features/knowledge/components/DocumentMarkdownRenderer";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

// ---------------------------------------------------------------------------
// Utility helpers (mirrored from DocumentViewDialog)
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
    <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      return { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-700 dark:text-zinc-400", label: status };
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
      return { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-700 dark:text-zinc-400", label: "Pending" };
  }
}

function truncateHash(hash: string | null): string {
  if (!hash) return "-";
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
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
  const corpusId = params.corpusId;
  const documentId = params.documentId;

  const [detail, setDetail] = useState<KnowledgeDocumentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRefreshingMarkdown, setIsRefreshingMarkdown] = useState(false);

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

  // Auto-poll when markdown is still processing
  useEffect(() => {
    if (!detail) return;
    if ((detail.markdown_extract_status || "").toLowerCase() !== "processing") {
      return;
    }
    const timer = setInterval(() => {
      void loadDetail();
    }, 3000);
    return () => clearInterval(timer);
  }, [detail?.markdown_extract_status, loadDetail]);

  // ---- Action handlers ----

  const handleDownload = async () => {
    if (!detail || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadDocument(detail.corpus_id, detail.id, {
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
      const result = await refreshDocumentMarkdown(detail.corpus_id, detail.id, {
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

  const statusBadge = getStatusBadge(detail?.status || "");
  const markdownStatus =
    detail?.markdown_extract_status || "pending";
  const markdownBadge = getMarkdownStatusBadge(markdownStatus);

  // ---- Render ----

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <KnowledgeNav
        title={detail?.original_filename || "Document Detail"}
      />

      {/* Action bar */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-2 flex items-center gap-3">
        <Link
          href="/knowledge/documents"
          className={outlineButtonClassName(
            "neutral",
            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold",
          )}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Documents
        </Link>

        <div className="flex-1" />

        <button
          onClick={handleRefreshMarkdown}
          disabled={isRefreshingMarkdown || !detail}
          className={outlineButtonClassName(
            "neutral",
            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm",
          )}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.636 18.364A9 9 0 103.22 9.88" />
          </svg>
          {isRefreshingMarkdown ? "Re-Parsing..." : "Re-Parse from GCS"}
        </button>
        <button
          onClick={handleDownload}
          disabled={isDownloading || !detail}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
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
          <div className="flex items-center justify-center py-20 text-sm text-zinc-500 dark:text-zinc-400">
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
                  <h1 className="truncate text-xl font-semibold text-zinc-900 dark:text-zinc-100" title={detail.original_filename}>
                    {detail.original_filename}
                  </h1>
                  <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                    {statusBadge.label}
                  </span>
                  <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${markdownBadge.bg} ${markdownBadge.text}`}>
                    {markdownBadge.label}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {detail.content_type || "Unknown type"}
                </p>
              </div>
            </div>

            {/* Metadata strip */}
            <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-zinc-500 dark:text-zinc-400">Size</span>
                <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                  {formatFileSize(detail.file_size)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-zinc-500 dark:text-zinc-400">Hash</span>
                <span className="truncate font-mono font-medium text-zinc-900 dark:text-zinc-100" title={detail.file_hash}>
                  {truncateHash(detail.file_hash)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-zinc-500 dark:text-zinc-400">Corpus</span>
                <span className="truncate font-mono font-medium text-zinc-900 dark:text-zinc-100" title={detail.corpus_id}>
                  {truncateHash(detail.corpus_id)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-zinc-500 dark:text-zinc-400">Storage</span>
                <span className="truncate font-mono font-medium text-zinc-900 dark:text-zinc-100" title={detail.gcs_uri}>
                  {detail.gcs_uri ? `...${detail.gcs_uri.slice(-24)}` : "-"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-zinc-500 dark:text-zinc-400">Created By</span>
                <span className="truncate font-medium text-zinc-900 dark:text-zinc-100" title={detail.created_by_name || detail.created_by || ""}>
                  {displayUser(detail.created_by, detail.created_by_name)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 text-zinc-500 dark:text-zinc-400">Created</span>
                <span className="truncate font-medium text-zinc-900 dark:text-zinc-100" title={detail.created_at || ""}>
                  {formatRelativeTime(detail.created_at ?? undefined)}
                </span>
              </div>
            </div>

            {/* Markdown content card */}
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Markdown Content</h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {detail.markdown_extracted_at ? `Updated ${formatRelativeTime(detail.markdown_extracted_at ?? undefined)}` : ""}
                </span>
              </div>

              <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-950">
                {loadingDetail ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading markdown content...</p>
                ) : detailError ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{detailError}</p>
                ) : markdownStatus === "processing" || markdownStatus === "pending" ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Markdown extraction is running in background. This page will auto-refresh.
                  </p>
                ) : markdownStatus === "failed" ? (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {detail.markdown_extract_error || "Markdown extraction failed. You can re-ingest this source to retry."}
                  </p>
                ) : (detail.markdown_content || "").trim().length === 0 ? (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Markdown content is empty. Click <strong>Re-Parse from GCS</strong> to regenerate from the source document.
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
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
