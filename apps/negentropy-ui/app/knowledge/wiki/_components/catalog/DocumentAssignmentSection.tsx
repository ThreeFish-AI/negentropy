/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCatalogNodeDocuments,
  unassignDocumentFromNode,
  updateDocument,
  KnowledgeDocument,
} from "@/features/knowledge";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { toast } from "@/lib/activity-toast";
import { Plus, Trash2, Pencil, Check, X } from "./icons";
import { AddDocumentsDialog } from "./AddDocumentsDialog";

interface DocumentAssignmentSectionProps {
  nodeId: string;
  catalogId: string;
  /** 文档归属变更（改名 / 增删）后通知父级刷新目录树——CTE 派生的节点名需即时反映 */
  onUpdate?: () => void;
}

/** 决定 Wiki 站点上显示的标题（优先级与后端 _resolve_doc_display_title 一致）。
 *  display_name（用户手填）→ metadata.title（PDF/抓取自动抽取）→ original_filename（兜底）。 */
function effectiveDisplayName(doc: KnowledgeDocument): string {
  const displayName = (doc.display_name || "").trim();
  if (displayName) return displayName;
  const metaTitle = typeof doc.metadata?.title === "string" ? doc.metadata.title.trim() : "";
  if (metaTitle) return metaTitle;
  return doc.original_filename;
}

export function DocumentAssignmentSection({
  nodeId,
  catalogId,
  onUpdate,
}: DocumentAssignmentSectionProps) {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  // 行内编辑态：正在编辑的文档 id
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCatalogNodeDocuments(catalogId, nodeId, { limit: 200 });
      setDocs(res.documents ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载文档失败");
    } finally {
      setLoading(false);
    }
  }, [catalogId, nodeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 编辑态挂载后自动聚焦
  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  const handleRemove = useCallback(
    async (docId: string, filename: string) => {
      const confirmed = await confirm({
        title: "移除归属文档",
        message: `从本节点移除「${filename}」？文档本身不会被删除。`,
        confirmLabel: "移除",
        destructive: true,
      });
      if (!confirmed) return;
      try {
        await unassignDocumentFromNode(catalogId, nodeId, docId);
        toast.success("已移除");
        await refresh();
        // 左栏目录树的 DOCUMENT_REF 节点随之消失，需同步刷新
        onUpdate?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "移除失败");
      }
    },
    [catalogId, confirm, nodeId, refresh, onUpdate],
  );

  const handleAdded = useCallback(() => {
    void refresh();
    onUpdate?.();
  }, [refresh, onUpdate]);

  const startEdit = useCallback((doc: KnowledgeDocument) => {
    setEditingId(doc.id);
    setEditDraft(doc.display_name ?? "");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft("");
  }, []);

  const commitEdit = useCallback(
    async (doc: KnowledgeDocument) => {
      const trimmed = editDraft.trim() || null;
      // 无变化时静默退出
      if (trimmed === (doc.display_name ?? null)) {
        cancelEdit();
        return;
      }
      setSaving(true);
      try {
        await updateDocument(doc.corpus_id, doc.id, { display_name: trimmed });
        toast.success("保存成功");
        setEditingId(null);
        setEditDraft("");
        await refresh();
        // 触发左栏目录树刷新：CTE 已对 DOCUMENT_REF 派生同一展示名，即时同步
        onUpdate?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "保存失败");
      } finally {
        setSaving(false);
      }
    },
    [cancelEdit, editDraft, refresh, onUpdate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, doc: KnowledgeDocument) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void commitEdit(doc);
      } else if (e.key === "Escape") {
        cancelEdit();
      }
    },
    [cancelEdit, commitEdit],
  );

  return (
    <div className="px-5 py-4 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          归属文档 ({docs.length})
        </h3>
        <button
          onClick={() => setAdding(true)}
          disabled={!catalogId}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-3 w-3" />
          添加文档
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">加载中...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic">暂无归属文档</p>
      ) : (
        <ul className="space-y-1 max-h-[280px] overflow-y-auto">
          {docs.map((doc) => {
            const isEditing = editingId === doc.id;
            const effectiveName = effectiveDisplayName(doc);

            return (
              <li
                key={doc.id}
                className="group flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/30 text-xs"
              >
                <div className="flex-1 min-w-0">
                  {/* 主行：Wiki 站点显示名 或 编辑态 input */}
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, doc)}
                        placeholder="留空则使用源名称"
                        maxLength={255}
                        disabled={saving}
                        aria-label="编辑 Wiki 显示名称"
                        className="flex-1 min-w-0 h-6 px-1.5 text-xs rounded border border-primary/50 bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        onClick={() => void commitEdit(doc)}
                        disabled={saving}
                        title="保存"
                        className="p-0.5 rounded text-muted-foreground hover:text-green-600 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        title="取消"
                        className="p-0.5 rounded text-muted-foreground hover:text-red-500 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="truncate font-medium text-foreground">
                      {effectiveName}
                    </p>
                  )}

                  {/* 副行：源名称 · 状态 · ID */}
                  <p className="text-micro text-muted-foreground/70 font-mono">
                    源名称：{doc.original_filename}
                    <span className="mx-1">·</span>
                    {doc.markdown_extract_status ?? "—"}
                    <span className="mx-1">·</span>
                    {doc.id.slice(0, 8)}…
                  </p>
                </div>

                {/* 操作按钮 */}
                {!isEditing && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => startEdit(doc)}
                      title="编辑 Wiki 显示名称"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-opacity"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleRemove(doc.id, doc.original_filename)}
                      title="从节点移除"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {adding && catalogId && (
        <AddDocumentsDialog
          nodeId={nodeId}
          catalogId={catalogId}
          existingDocIds={new Set(docs.map((d) => d.id))}
          onClose={() => setAdding(false)}
          onAdded={handleAdded}
        />
      )}
      {confirmDialog}
    </div>
  );
}
