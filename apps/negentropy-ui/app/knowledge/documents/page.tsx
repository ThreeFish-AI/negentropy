/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/activity-toast";
import {
  KnowledgeDocument,
  DocumentTranslationMeta,
  fetchAllDocuments,
  deleteDocument,
  downloadDocument,
  translateDocuments,
  importDocumentUrl,
  importDocumentFile,
  fetchCorpora,
  CorpusRecord,
  formatRelativeTime,
  LIBRARY_CORPUS_SEGMENT,
  effectiveDocumentName,
  useInlineDocumentRename,
} from "@/features/knowledge";
import { Check, Pencil, X } from "lucide-react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import {
  tableBodyClassName,
  tableContainerClassName,
  tableHeaderClassName,
  tableRowClassName,
} from "@/components/ui/table-styles";
import { cn } from "@/lib/utils";
import { useHeartbeatPoll } from "@/hooks/useHeartbeatPoll";
import { ImportDocumentDialog } from "./_components/ImportDocumentDialog";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string | null): React.ReactElement {
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
    <svg className="h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function truncateHash(hash: string | null): React.ReactElement {
  if (!hash) return <span className="text-muted-foreground">-</span>;
  const truncated = `${hash.slice(0, 8)}...${hash.slice(-4)}`;
  return (
    <span className="font-mono text-xs text-muted-foreground" title={hash}>
      {truncated}
    </span>
  );
}

function displayUser(createdBy: string | null, displayName?: string | null): string {
  if (displayName) return displayName;
  if (!createdBy) return "-";
  if (createdBy.includes("@")) {
    return createdBy.split("@")[0];
  }
  return createdBy.length > 12 ? createdBy.slice(0, 12) + "..." : createdBy;
}

/** 源文档翻译进度（metadata.translation，由后端翻译服务状态机维护）。 */
function getTranslationMeta(doc: KnowledgeDocument): DocumentTranslationMeta | undefined {
  return doc.metadata?.translation as DocumentTranslationMeta | undefined;
}

/** 译文文档的来源 ID（metadata.translated_from_document_id）。 */
function getTranslatedFromId(doc: KnowledgeDocument): string | undefined {
  const value = doc.metadata?.translated_from_document_id;
  return typeof value === "string" && value ? value : undefined;
}

/** 是否可勾选翻译：归属某 Corpus（译文需落库到同 corpus）、Markdown 已就绪、自身非译文、且当前没有进行中的翻译。 */
function isTranslatable(doc: KnowledgeDocument): boolean {
  if (!doc.corpus_id) return false; // Library 文档（未归属 Corpus）暂不支持翻译
  if (getTranslatedFromId(doc)) return false;
  if ((doc.markdown_extract_status || "").toLowerCase() !== "completed") return false;
  return getTranslationMeta(doc)?.status !== "processing";
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [corpora, setCorpora] = useState<CorpusRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteHard, setDeleteHard] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isTranslating, setIsTranslating] = useState(false);
  const router = useRouter();

  // 加载语料库列表
  const loadCorpora = useCallback(async () => {
    try {
      const data = await fetchCorpora(APP_NAME);
      setCorpora(data);
    } catch (err) {
      console.error("Failed to load corpora:", err);
    }
  }, []);

  // 加载文档列表（silent: 轮询路径跳过 loading 态，避免整表闪烁）
  const loadDocuments = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);
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
        if (!options?.silent) setLoading(false);
      }
    },
    [page, pageSize],
  );

  useEffect(() => {
    loadCorpora();
  }, [loadCorpora]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // 翻译 / 导入转换进行中时按心跳节拍静默刷新列表（完成后新分录与状态自动出现）
  const anyTranslating = useMemo(
    () => documents.some((doc) => getTranslationMeta(doc)?.status === "processing"),
    [documents],
  );
  const anyExtracting = useMemo(
    () =>
      documents.some((doc) =>
        ["pending", "processing"].includes((doc.markdown_extract_status || "").toLowerCase()),
      ),
    [documents],
  );
  const silentReload = useCallback(() => loadDocuments({ silent: true }), [loadDocuments]);
  useHeartbeatPoll(silentReload, {
    enabled: anyTranslating || anyExtracting,
    fireImmediately: false,
  });

  // 行内重命名 File Name → 写入 display_name（逻辑下沉到 useInlineDocumentRename，
  // 与 Wiki 目录共用）。保存成功后按服务端返回值局部 patch，避免全量 loadDocuments
  // 与心跳轮询/分页互相打架。
  const handleRenameSaved = useCallback((updated: KnowledgeDocument) => {
    setDocuments((docs) => docs.map((d) => (d.id === updated.id ? updated : d)));
  }, []);
  const {
    editingId,
    editDraft,
    setEditDraft,
    saving: renaming,
    editInputRef,
    startEdit,
    cancelEdit,
    commitEdit,
    handleKeyDown,
  } = useInlineDocumentRename({
    onSaved: handleRenameSaved,
    savingToast: "文件名称已更新",
  });

  const totalPages = Math.ceil(total / pageSize);

  const translatableDocs = useMemo(() => documents.filter(isTranslatable), [documents]);
  const allSelected =
    translatableDocs.length > 0 && translatableDocs.every((doc) => selectedIds.has(doc.id));

  const toggleSelect = (docId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(translatableDocs.map((doc) => doc.id)));
  };

  // 本地把指定文档置为 processing（轮询接管后续状态）
  const markProcessingLocally = useCallback((docIds: string[]) => {
    const idSet = new Set(docIds);
    setDocuments((docs) =>
      docs.map((doc) =>
        idSet.has(doc.id)
          ? {
              ...doc,
              metadata: {
                ...(doc.metadata || {}),
                translation: { status: "processing" } satisfies DocumentTranslationMeta,
              },
            }
          : doc,
      ),
    );
  }, []);

  const handleTranslate = async (docIds: string[], options?: { force?: boolean }) => {
    if (docIds.length === 0 || isTranslating) return;
    setIsTranslating(true);
    try {
      const result = await translateDocuments(docIds, {
        appName: APP_NAME,
        force: options?.force,
      });
      if (result.accepted.length > 0) {
        toast.success(
          `Translation started: ${result.accepted.length} document${result.accepted.length !== 1 ? "s" : ""} (EN → 中文)`,
        );
        markProcessingLocally(result.accepted);
      }
      if (result.skipped.length > 0) {
        const reasons = result.skipped
          .slice(0, 3)
          .map((item) => item.reason)
          .join(", ");
        toast.error(`Skipped ${result.skipped.length} document(s): ${reasons}`);
      }
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start translation");
    } finally {
      setIsTranslating(false);
    }
  };

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
      toast.success(deleteHard ? "Document permanently deleted" : "Document deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  const handleDownload = async (doc: KnowledgeDocument) => {
    if (downloadingIds.has(doc.id)) return;

    setDownloadingIds((prev) => new Set(prev).add(doc.id));
    try {
      await downloadDocument(doc.corpus_id, doc.id, { appName: APP_NAME });
      toast.success(`Downloaded: ${doc.original_filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download document");
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

  const getCorpusName = (corpusId: string | null) => {
    if (!corpusId) return null;
    const corpus = corpora.find((c) => c.id === corpusId);
    return corpus?.name || corpusId;
  };

  // Translation 列四态：译文 badge / 翻译中 / 已翻译（链接译文）/ 失败（可重试）
  const renderTranslationCell = (doc: KnowledgeDocument) => {
    const translatedFromId = getTranslatedFromId(doc);
    if (translatedFromId) {
      const fromName =
        (doc.metadata?.translated_from_filename as string | undefined) || translatedFromId;
      return (
        <button
          onClick={() => router.push(`/knowledge/documents/${doc.corpus_id}/${translatedFromId}`)}
          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100 transition-colors dark:bg-blue-950 dark:text-blue-300"
          title={`Translated from: ${fromName}`}
        >
          译文
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      );
    }

    const translation = getTranslationMeta(doc);
    if (translation?.status === "processing") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Translating…
        </span>
      );
    }
    if (translation?.status === "completed" && translation.target_document_id) {
      return (
        <button
          onClick={() =>
            router.push(`/knowledge/documents/${doc.corpus_id}/${translation.target_document_id}`)
          }
          className="text-xs text-green-600 hover:text-green-700 hover:underline dark:text-green-400"
          title="View translated document"
        >
          Translated
        </button>
      );
    }
    if (translation?.status === "failed") {
      return (
        <button
          onClick={() => handleTranslate([doc.id], { force: true })}
          className="text-xs text-red-500 hover:text-red-600 hover:underline"
          title={`${translation.error || "Translation failed"} — click to retry`}
        >
          Failed · Retry
        </button>
      );
    }
    return <span className="text-xs text-muted-foreground">-</span>;
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <KnowledgeNav
        title="Documents"
        description="管理已上传到 GCS 的原始文档"
      />
      <div className="flex min-h-0 flex-1 px-6 py-6">
        {/* 文档列表 */}
        <main className="flex min-h-0 flex-1 flex-col">
          {/* 工具栏：左侧勾选提示，右侧 Translate / Import 批量操作 */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} document${selectedIds.size !== 1 ? "s" : ""} selected`
                : "Select documents to translate (EN → 中文)"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTranslate(Array.from(selectedIds))}
                disabled={selectedIds.size === 0 || isTranslating}
                className={outlineButtonClassName(
                  "neutral",
                  "rounded-lg px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5",
                )}
                title="Translate selected documents to Chinese"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                {isTranslating
                  ? "Translating…"
                  : `Translate${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
              </button>
              <button
                onClick={() => setIsImportDialogOpen(true)}
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm hover:opacity-90"
              >
                Import Document
              </button>
            </div>
          </div>
          <div className={cn(tableContainerClassName, "flex flex-1 flex-col")}>
            {/* 表头 */}
            <div className={cn("flex items-center", tableHeaderClassName)}>
              <div className="w-8 shrink-0 flex justify-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  disabled={translatableDocs.length === 0}
                  className="rounded"
                  title="Select all translatable documents"
                />
              </div>
              <div className="grid grid-cols-13 gap-2 flex-1">
                <div className="col-span-3 text-center">File Name</div>
                <div className="col-span-1 text-center">Size</div>
                <div className="col-span-1 text-center">File Hash</div>
                <div className="col-span-2 text-center">Corpus</div>
                <div className="col-span-2 text-center">Translation</div>
                <div className="col-span-1 text-center">Created By</div>
                <div className="col-span-1 text-center">Created At</div>
                <div className="col-span-1 text-center">Updated At</div>
                <div className="col-span-1 text-center">Actions</div>
              </div>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Loading documents...
                </div>
              ) : error ? (
                <div className="p-6 text-center text-sm text-red-500">{error}</div>
              ) : documents.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No documents uploaded yet
                </div>
              ) : (
                <div className={tableBodyClassName}>
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={cn("group flex items-center text-sm", tableRowClassName)}
                    >
                      {/* 勾选 - 固定宽 */}
                      <div className="w-8 shrink-0 flex justify-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => toggleSelect(doc.id)}
                          disabled={!isTranslatable(doc)}
                          className="rounded disabled:opacity-30"
                          title={
                            isTranslatable(doc)
                              ? "Select for translation"
                              : "Not translatable (library document, markdown not ready, already a translation, or translating)"
                          }
                        />
                      </div>
                      <div className="grid grid-cols-13 gap-2 flex-1 items-center">
                      {/* 文件名 - col-span-3，支持就地重命名（写 display_name） */}
                      <div className="col-span-3 flex items-center gap-2">
                        {getFileIcon(doc.content_type)}
                        {editingId === doc.id ? (
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, doc)}
                              placeholder="留空则使用源名称"
                              maxLength={255}
                              disabled={renaming}
                              aria-label="编辑文件名称"
                              className="flex-1 min-w-0 h-6 px-1.5 text-sm rounded border border-primary/50 bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <button
                              onClick={() => void commitEdit(doc)}
                              disabled={renaming}
                              title="保存"
                              aria-label="保存文件名称"
                              className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-green-600 disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={renaming}
                              title="取消"
                              aria-label="取消编辑"
                              className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-red-500 disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1 flex items-center gap-1">
                            <div className="min-w-0">
                              <p
                                className="font-medium text-foreground truncate"
                                title={effectiveDocumentName(doc)}
                              >
                                {effectiveDocumentName(doc)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {doc.content_type || "Unknown"}
                              </p>
                            </div>
                            <button
                              onClick={() => startEdit(doc)}
                              title="编辑文件名称"
                              aria-label="编辑文件名称"
                              className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-opacity"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 大小 - col-span-1 */}
                      <div className="col-span-1 text-muted-foreground text-xs text-center">
                        {formatFileSize(doc.file_size)}
                      </div>

                      {/* File Hash - col-span-1 */}
                      <div className="col-span-1 text-center">
                        {truncateHash(doc.file_hash)}
                      </div>

                      {/* 所属语料库 - col-span-2；库文档（corpus_id=null）显示 Library 徽标 */}
                      <div className="col-span-2 flex justify-end">
                        {doc.corpus_id ? (
                          <span
                            className="text-muted-foreground truncate text-xs"
                            title={getCorpusName(doc.corpus_id) ?? undefined}
                          >
                            {getCorpusName(doc.corpus_id)}
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            Library
                          </span>
                        )}
                      </div>

                      {/* Translation - col-span-2 */}
                      <div className="col-span-2 flex justify-center">
                        {renderTranslationCell(doc)}
                      </div>

                      {/* Created By - col-span-1 */}
                      <div className="col-span-1 text-muted-foreground truncate text-xs text-center" title={doc.created_by_name || doc.created_by || ""}>
                        {displayUser(doc.created_by, doc.created_by_name)}
                      </div>

                      {/* Created At - col-span-1 */}
                      <div className="col-span-1 text-muted-foreground text-xs text-center">
                        {formatRelativeTime(doc.created_at ?? undefined)}
                      </div>

                      {/* Updated At - col-span-1（按最终修改时间倒序，故置于 Created At 之后） */}
                      <div className="col-span-1 text-muted-foreground text-xs text-center">
                        {formatRelativeTime(doc.updated_at ?? undefined)}
                      </div>

                      {/* 操作 - col-span-1 */}
                      <div className="col-span-1 flex justify-center items-center gap-2">
                        {deleteConfirm === doc.id ? (
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-xs text-muted-foreground">
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
                              onClick={() =>
                                router.push(
                                  `/knowledge/documents/${doc.corpus_id ?? LIBRARY_CORPUS_SEGMENT}/${doc.id}`,
                                )
                              }
                              className="rounded p-1.5 text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors"
                              title="View document content"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDownload(doc)}
                              disabled={downloadingIds.has(doc.id)}
                              className="rounded p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                              title="Download document"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(doc.id)}
                              className="rounded p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
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
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 分页 */}
            {total > 0 && (
              <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {/* 单字符串避免 JSX 文本节点相邻被 a11y 规范化为 "X document s" */}
                    {`${total} document${total !== 1 ? "s" : ""}`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-xs")}
                  >
                    Previous
                  </button>
                  <span className="text-xs text-muted-foreground">
                    Page {page} / {totalPages || 1}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-xs")}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Import Document 对话框 */}
      <ImportDocumentDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImportUrl={({ url }) =>
          importDocumentUrl({ app_name: APP_NAME, url }).then((result) => {
            void loadDocuments();
            return result;
          })
        }
        onImportFile={({ file }) =>
          importDocumentFile({ app_name: APP_NAME, file }).then((result) => {
            void loadDocuments();
            return result;
          })
        }
        onSuccess={() => setIsImportDialogOpen(false)}
      />
    </div>
  );
}
