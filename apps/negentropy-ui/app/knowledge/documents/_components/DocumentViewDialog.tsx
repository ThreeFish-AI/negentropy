"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  KnowledgeDocument,
  KnowledgeDocumentDetail,
  downloadDocument,
  fetchDocumentDetail,
  formatRelativeTime,
  refreshDocumentMarkdown,
} from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

interface DocumentViewDialogProps {
  isOpen: boolean;
  document: KnowledgeDocument | null;
  onClose: () => void;
}

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

function displayUser(createdBy: string | null): string {
  if (!createdBy) return "-";
  if (createdBy.includes("@")) {
    return createdBy.split("@")[0];
  }
  return createdBy.length > 20 ? createdBy.slice(0, 20) + "..." : createdBy;
}

export function DocumentViewDialog({
  isOpen,
  document,
  onClose,
}: DocumentViewDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRefreshingMarkdown, setIsRefreshingMarkdown] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnowledgeDocumentDetail | null>(null);

  const loadDetail = useCallback(async () => {
    if (!isOpen || !document) return;

    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await fetchDocumentDetail(document.corpus_id, document.id, {
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
  }, [isOpen, document]);

  useEffect(() => {
    if (!isOpen || !document) {
      setDetail(null);
      setDetailError(null);
      setLoadingDetail(false);
      return;
    }

    void loadDetail();
  }, [isOpen, document?.id, document?.corpus_id, loadDetail]);

  useEffect(() => {
    if (!isOpen || !document) return;
    if ((detail?.markdown_extract_status || "").toLowerCase() !== "processing") {
      return;
    }

    const timer = setInterval(() => {
      void loadDetail();
    }, 3000);
    return () => clearInterval(timer);
  }, [isOpen, document, detail?.markdown_extract_status, loadDetail]);

  const handleDownload = async () => {
    if (!document || isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadDocument(document.corpus_id, document.id, { appName: APP_NAME });
      toast.success(`Downloaded: ${document.original_filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download document");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRefreshMarkdown = async () => {
    if (!document || isRefreshingMarkdown) return;

    setIsRefreshingMarkdown(true);
    try {
      const result = await refreshDocumentMarkdown(document.corpus_id, document.id, {
        appName: APP_NAME,
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

  if (!isOpen || !document) return null;

  const viewedDoc: KnowledgeDocument = detail ?? document;
  const statusBadge = getStatusBadge(viewedDoc.status);
  const markdownStatus = detail?.markdown_extract_status || document.markdown_extract_status || "pending";
  const markdownBadge = getMarkdownStatusBadge(markdownStatus);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex h-[86vh] w-full max-w-5xl flex-col rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 dark:bg-zinc-900">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getFileIcon(viewedDoc.content_type)}
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100" title={viewedDoc.original_filename}>
                {viewedDoc.original_filename}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {viewedDoc.content_type || "Unknown type"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
            {statusBadge.label}
          </span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${markdownBadge.bg} ${markdownBadge.text}`}>
            {markdownBadge.label}
          </span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-h-0 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Markdown Content</h3>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {detail?.markdown_extracted_at ? `Updated ${formatRelativeTime(detail.markdown_extracted_at ?? undefined)}` : ""}
              </span>
            </div>

            <div className="h-full max-h-[52vh] overflow-auto rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950">
              {loadingDetail ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading markdown content...</p>
              ) : detailError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{detailError}</p>
              ) : markdownStatus === "processing" || markdownStatus === "pending" ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Markdown extraction is running in background. Please refresh in a moment.
                </p>
              ) : markdownStatus === "failed" ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {detail?.markdown_extract_error || "Markdown extraction failed. You can re-ingest this source to retry."}
                </p>
              ) : (detail?.markdown_content || "").trim().length === 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Markdown content is empty. Click <strong>Re-Parse from GCS</strong> to regenerate from the source document.
                </p>
              ) : (
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-800 dark:text-zinc-200">
                  {detail?.markdown_content || "No markdown content available."}
                </pre>
              )}
            </div>
          </div>

          <div className="min-h-0 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Metadata</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 py-2 dark:border-zinc-800">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">File Size</span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {formatFileSize(viewedDoc.file_size)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-100 py-2 dark:border-zinc-800">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">File Hash</span>
                <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100" title={viewedDoc.file_hash}>
                  {truncateHash(viewedDoc.file_hash)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-100 py-2 dark:border-zinc-800">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Corpus ID</span>
                <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100" title={viewedDoc.corpus_id}>
                  {truncateHash(viewedDoc.corpus_id)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-100 py-2 dark:border-zinc-800">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Storage Path</span>
                <span className="max-w-[160px] truncate font-mono text-sm text-zinc-900 dark:text-zinc-100" title={viewedDoc.gcs_uri}>
                  ...{viewedDoc.gcs_uri.slice(-24)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-100 py-2 dark:border-zinc-800">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Created By</span>
                <span className="text-sm text-zinc-900 dark:text-zinc-100" title={viewedDoc.created_by || ""}>
                  {displayUser(viewedDoc.created_by)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Created At</span>
                <span className="text-sm text-zinc-900 dark:text-zinc-100" title={viewedDoc.created_at || ""}>
                  {formatRelativeTime(viewedDoc.created_at ?? undefined)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Close
          </button>
          <button
            onClick={handleRefreshMarkdown}
            disabled={isRefreshingMarkdown || !document}
            className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.636 18.364A9 9 0 103.22 9.88" />
            </svg>
            {isRefreshingMarkdown ? "Re-Parsing..." : "Re-Parse from GCS"}
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {isDownloading ? "Downloading..." : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
