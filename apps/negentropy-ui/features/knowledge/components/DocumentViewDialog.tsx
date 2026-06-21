/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "@/lib/activity-toast";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { Button } from "@/components/ui/Button";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import { useHeartbeatPoll } from "@/hooks/useHeartbeatPoll";

import type {
  KnowledgeDocument,
  KnowledgeDocumentDetail,
} from "../utils/knowledge-api";
import {
  downloadDocument,
  fetchDocumentDetail,
  refreshDocumentMarkdown,
} from "../utils/knowledge-api";
import { formatRelativeTime } from "../utils/pipeline-helpers";
import { DocumentMarkdownRenderer } from "./DocumentMarkdownRenderer";

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

function displayUser(createdBy: string | null, displayName?: string | null): string {
  if (displayName) return displayName;
  if (!createdBy) return "-";
  if (createdBy.includes("@")) {
    const local = createdBy.split("@")[0];
    return local || createdBy;
  }
  return createdBy.length > 20 ? `${createdBy.slice(0, 20)}...` : createdBy;
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
  const requestAppName = document?.app_name || APP_NAME;

  const loadDetail = useCallback(async () => {
    if (!isOpen || !document) return;

    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await fetchDocumentDetail(document.corpus_id, document.id, {
        appName: requestAppName,
      });
      setDetail(res);
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Failed to load document content",
      );
    } finally {
      setLoadingDetail(false);
    }
  }, [isOpen, document, requestAppName]);

  useEffect(() => {
    if (!isOpen || !document) {
      setDetail(null);
      setDetailError(null);
      setLoadingDetail(false);
      return;
    }

    void loadDetail();
  }, [isOpen, document, loadDetail]);

  // Phase 3-A: 由 useHeartbeatPoll 统一节拍（5s）+ 自动暂停（hidden）+ 网络恢复触发
  useHeartbeatPoll(loadDetail, {
    enabled:
      isOpen &&
      !!document &&
      (detail?.markdown_extract_status || "").toLowerCase() === "processing",
    fireImmediately: false,
  });

  const handleDownload = async () => {
    if (!document || isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadDocument(document.corpus_id, document.id, {
        appName: requestAppName,
      });
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

  if (!isOpen || !document) return null;

  const viewedDoc: KnowledgeDocument = detail ?? document;
  const statusBadge = getStatusBadge(viewedDoc.status);
  const markdownStatus =
    detail?.markdown_extract_status || document.markdown_extract_status || "pending";
  const markdownBadge = getMarkdownStatusBadge(markdownStatus);

  return (
    <OverlayDismissLayer
      open={isOpen && document !== null}
      onClose={onClose}
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="flex h-[86vh] w-full max-w-5xl flex-col rounded-2xl bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200"
    >
        {/* Header: Title + badges + close */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {getFileIcon(viewedDoc.content_type)}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-foreground" title={viewedDoc.original_filename}>
                  {viewedDoc.original_filename}
                </h2>
                <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-micro font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                  {statusBadge.label}
                </span>
                <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-micro font-medium ${markdownBadge.bg} ${markdownBadge.text}`}>
                  {markdownBadge.label}
                </span>
              </div>
              <p className="text-xs text-text-muted">
                {viewedDoc.content_type || "Unknown type"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close document view"
            className="shrink-0 text-text-muted hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Metadata strip */}
        <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-border bg-muted px-4 py-2.5 text-xs sm:grid-cols-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 text-text-muted">Size</span>
            <span className="truncate font-medium text-foreground">
              {formatFileSize(viewedDoc.file_size)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 text-text-muted">Hash</span>
            <span className="truncate font-mono font-medium text-foreground" title={viewedDoc.file_hash}>
              {truncateHash(viewedDoc.file_hash)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 text-text-muted">Corpus</span>
            <span
              className="truncate font-mono font-medium text-foreground"
              title={viewedDoc.corpus_id ?? "Library"}
            >
              {viewedDoc.corpus_id ? truncateHash(viewedDoc.corpus_id) : "Library"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 text-text-muted">Storage</span>
            <span className="truncate font-mono font-medium text-foreground" title={viewedDoc.content_uri}>
              {viewedDoc.content_uri ? `...${viewedDoc.content_uri.slice(-24)}` : "-"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 text-text-muted">Created By</span>
            <span className="truncate font-medium text-foreground" title={viewedDoc.created_by_name || viewedDoc.created_by || ""}>
              {displayUser(viewedDoc.created_by, viewedDoc.created_by_name)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 text-text-muted">Created</span>
            <span className="truncate font-medium text-foreground" title={viewedDoc.created_at || ""}>
              {formatRelativeTime(viewedDoc.created_at ?? undefined)}
            </span>
          </div>
        </div>

        {/* Markdown Content - full width */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Markdown Content</h3>
            <span className="text-xs text-text-muted">
              {detail?.markdown_extracted_at ? `Updated ${formatRelativeTime(detail.markdown_extracted_at ?? undefined)}` : ""}
            </span>
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-lg bg-muted p-4">
            {loadingDetail ? (
              <p className="text-sm text-text-muted">Loading markdown content...</p>
            ) : detailError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{detailError}</p>
            ) : markdownStatus === "processing" || markdownStatus === "pending" ? (
              <p className="text-sm text-text-muted">
                Markdown extraction is running in background. Please refresh in a moment.
              </p>
            ) : markdownStatus === "failed" ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {detail?.markdown_extract_error || "Markdown extraction failed. You can re-ingest this source to retry."}
              </p>
            ) : (detail?.markdown_content || "").trim().length === 0 ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Markdown content is empty. Click <strong>Re-Parse</strong> to regenerate from the source document.
              </p>
            ) : (
              <DocumentMarkdownRenderer
                content={detail?.markdown_content || ""}
                corpusId={document.corpus_id}
                documentId={document.id}
                appName={requestAppName}
              />
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <button
            onClick={handleRefreshMarkdown}
            disabled={isRefreshingMarkdown || !document}
            className={outlineButtonClassName(
              "neutral",
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm",
            )}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.636 18.364A9 9 0 103.22 9.88" />
            </svg>
            {isRefreshingMarkdown ? "Re-Parsing..." : "Re-Parse"}
          </button>
          <Button
            variant="neutral"
            onClick={handleDownload}
            disabled={isDownloading}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            }
          >
            {isDownloading ? "Downloading..." : "Download"}
          </Button>
        </div>
    </OverlayDismissLayer>
  );
}
