"use client";

import { useCallback, useEffect, useState } from "react";
import {
  KnowledgeDocument,
  fetchAllDocuments,
  deleteDocument,
  downloadDocument,
  fetchCorpora,
  CorpusRecord,
  formatRelativeTime,
} from "@/features/knowledge";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string | null): JSX.Element {
  if (contentType?.includes("pdf")) {
    return (
      <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  }
  if (contentType?.includes("markdown") || contentType?.includes("text")) {
    return (
      <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function truncateHash(hash: string | null): JSX.Element {
  if (!hash) return <span className="text-muted">-</span>;
  const truncated = `${hash.slice(0, 8)}...${hash.slice(-4)}`;
  return (
    <span className="font-mono text-xs text-muted cursor-help" title={hash}>
      {truncated}
    </span>
  );
}

function displayUser(createdBy: string | null): string {
  if (!createdBy) return "-";
  if (createdBy.includes("@")) {
    return createdBy.split("@")[0];
  }
  return createdBy.length > 12 ? createdBy.slice(0, 12) + "..." : createdBy;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [corpora, setCorpora] = useState<CorpusRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteHard, setDeleteHard] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  // 加载语料库列表
  const loadCorpora = useCallback(async () => {
    try {
      const data = await fetchCorpora(APP_NAME);
      setCorpora(data);
    } catch (err) {
      console.error("Failed to load corpora:", err);
    }
  }, []);

  // 加载文档列表
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllDocuments({
        appName: APP_NAME,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setDocuments(data.items);
      setTotal(data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadCorpora();
  }, [loadCorpora]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const totalPages = Math.ceil(total / pageSize);

  const handleDelete = async (doc: KnowledgeDocument) => {
    try {
      await deleteDocument(doc.corpus_id, doc.id, {
        appName: APP_NAME,
        hardDelete: deleteHard,
      });
      setDocuments((docs) => docs.filter((d) => d.id !== doc.id));
      setTotal((t) => t - 1);
      setDeleteConfirm(null);
      setDeleteHard(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  const handleDownload = async (doc: KnowledgeDocument) => {
    if (downloadingIds.has(doc.id)) return;

    setDownloadingIds((prev) => new Set(prev).add(doc.id));
    try {
      await downloadDocument(doc.corpus_id, doc.id, { appName: APP_NAME });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download document");
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

  const getCorpusName = (corpusId: string) => {
    const corpus = corpora.find((c) => c.id === corpusId);
    return corpus?.name || corpusId;
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <KnowledgeNav
        title="Documents"
        description="管理已上传到 GCS 的原始文档"
      />
      <div className="flex min-h-0 flex-1 px-6 py-6">
        {/* 文档列表 */}
        <main className="flex min-h-0 flex-1 flex-col">
          <div className="rounded-2xl border border-border bg-card shadow-sm flex-1 overflow-hidden flex flex-col">
            {/* 表头 */}
            <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted">
              <div className="col-span-4 text-center border-r border-border">File Name</div>
              <div className="col-span-1 text-center border-r border-border">Size</div>
              <div className="col-span-1 text-center border-r border-border">File Hash</div>
              <div className="col-span-3 text-center border-r border-border">Corpus</div>
              <div className="col-span-1 text-center border-r border-border">Created By</div>
              <div className="col-span-1 text-center border-r border-border">Created At</div>
              <div className="col-span-1 text-center">Actions</div>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-sm text-muted">
                  Loading documents...
                </div>
              ) : error ? (
                <div className="p-6 text-center text-sm text-red-500">{error}</div>
              ) : documents.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted">
                  No documents uploaded yet
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="grid grid-cols-12 gap-2 px-4 py-3 text-sm hover:bg-muted/30 transition-colors items-center"
                    >
                      {/* 文件名 - col-span-4 */}
                      <div className="col-span-4 flex items-center gap-2">
                        {getFileIcon(doc.content_type)}
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate" title={doc.original_filename}>
                            {doc.original_filename}
                          </p>
                          <p className="text-xs text-muted truncate">
                            {doc.content_type || "Unknown"}
                          </p>
                        </div>
                      </div>

                      {/* 大小 - col-span-1 */}
                      <div className="col-span-1 text-muted text-xs">
                        {formatFileSize(doc.file_size)}
                      </div>

                      {/* File Hash - col-span-1 */}
                      <div className="col-span-1">
                        {truncateHash(doc.file_hash)}
                      </div>

                      {/* 所属语料库 - col-span-3 */}
                      <div className="col-span-3 text-muted truncate text-xs text-right" title={getCorpusName(doc.corpus_id)}>
                        {getCorpusName(doc.corpus_id)}
                      </div>

                      {/* Created By - col-span-1 */}
                      <div className="col-span-1 text-muted truncate text-xs" title={doc.created_by || ""}>
                        {displayUser(doc.created_by)}
                      </div>

                      {/* Created At - col-span-1 */}
                      <div className="col-span-1 text-muted text-xs">
                        {formatRelativeTime(doc.created_at)}
                      </div>

                      {/* 操作 - col-span-1 */}
                      <div className="col-span-1 flex justify-end items-center gap-2">
                        {deleteConfirm === doc.id ? (
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-xs text-muted">
                              <input
                                type="checkbox"
                                checked={deleteHard}
                                onChange={(e) => setDeleteHard(e.target.checked)}
                                className="rounded"
                              />
                              Permanent
                            </label>
                            <button
                              onClick={() => handleDelete(doc)}
                              className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirm(null);
                                setDeleteHard(false);
                              }}
                              className="rounded bg-muted px-2 py-1 text-xs text-foreground hover:bg-muted/80"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleDownload(doc)}
                              disabled={downloadingIds.has(doc.id)}
                              className="rounded p-1.5 text-muted hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                              title="Download document"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(doc.id)}
                              className="rounded p-1.5 text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete document"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 分页 */}
            {total > 0 && (
              <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">
                    {total} document{total !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50 hover:bg-muted/50"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-muted">
                    Page {page} / {totalPages || 1}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className="rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50 hover:bg-muted/50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
