"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  KnowledgeDocument,
  downloadDocument,
  formatRelativeTime,
} from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

interface DocumentViewDialogProps {
  isOpen: boolean;
  document: KnowledgeDocument | null;
  onClose: () => void;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 获取文件图标
 */
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

/**
 * 获取状态标签样式
 */
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

/**
 * 截断哈希显示
 */
function truncateHash(hash: string | null): string {
  if (!hash) return "-";
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
}

/**
 * 显示用户名
 */
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

  if (!isOpen || !document) return null;

  const statusBadge = getStatusBadge(document.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 dark:bg-zinc-900">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getFileIcon(document.content_type)}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={document.original_filename}>
                {document.original_filename}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {document.content_type || "Unknown type"}
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

        {/* Status Badge */}
        <div className="mb-4">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
            {statusBadge.label}
          </span>
        </div>

        {/* Metadata Grid */}
        <div className="space-y-3">
          {/* File Size */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">File Size</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {formatFileSize(document.file_size)}
            </span>
          </div>

          {/* File Hash */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">File Hash</span>
            <span className="text-sm font-mono text-zinc-900 dark:text-zinc-100" title={document.file_hash}>
              {truncateHash(document.file_hash)}
            </span>
          </div>

          {/* Corpus ID */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Corpus ID</span>
            <span className="text-sm font-mono text-zinc-900 dark:text-zinc-100" title={document.corpus_id}>
              {truncateHash(document.corpus_id)}
            </span>
          </div>

          {/* GCS URI */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Storage Path</span>
            <span className="text-sm font-mono text-zinc-900 dark:text-zinc-100 truncate max-w-[250px]" title={document.gcs_uri}>
              ...{document.gcs_uri.slice(-30)}
            </span>
          </div>

          {/* Created By */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Created By</span>
            <span className="text-sm text-zinc-900 dark:text-zinc-100" title={document.created_by || ""}>
              {displayUser(document.created_by)}
            </span>
          </div>

          {/* Created At */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Created At</span>
            <span className="text-sm text-zinc-900 dark:text-zinc-100" title={document.created_at || ""}>
              {formatRelativeTime(document.created_at ?? undefined)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Close
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
