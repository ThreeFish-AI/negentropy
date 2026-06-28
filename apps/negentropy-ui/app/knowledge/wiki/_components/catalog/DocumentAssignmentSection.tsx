/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchCatalogNodeDocuments,
  unassignDocumentFromNode,
  useInlineDocumentRename,
  effectiveDisplayName,
  type KnowledgeDocument,
} from "@/features/knowledge";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/activity-toast";
import { Plus, Trash2, Pencil, Check, X } from "./icons";
import { AddDocumentsDialog } from "./AddDocumentsDialog";

interface DocumentAssignmentSectionProps {
  nodeId: string;
  catalogId: string;
  /** 整棵 Wiki 目录树范围内已添加的文档 ID 集合——由 NodeDetailPanel 从全树
   *  DOCUMENT_REF 节点派生，保证「一篇文档全站仅出现一次」，灰显防止二次添加。 */
  existingDocIds: Set<string>;
  /** 文档归属变更（改名 / 增删）后通知父级刷新目录树——CTE 派生的节点名需即时反映 */
  onUpdate?: () => void;
}

export function DocumentAssignmentSection({
  nodeId,
  catalogId,
  existingDocIds,
  onUpdate,
}: DocumentAssignmentSectionProps) {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

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

  // 行内重命名 display_name（逻辑下沉到 useInlineDocumentRename，与 Documents 页共用）
  const {
    editingId,
    editDraft,
    setEditDraft,
    saving,
    editInputRef,
    startEdit,
    cancelEdit,
    commitEdit,
    handleKeyDown,
  } = useInlineDocumentRename({
    // 保存后回写本组件文档列表，并通知父级刷新目录树（CTE 对 DOCUMENT_REF 派生同一展示名）
    onSaved: async () => {
      await refresh();
      onUpdate?.();
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border px-5 py-4">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          归属文档 ({docs.length})
        </h3>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Plus className="h-3 w-3" />}
          onClick={() => setAdding(true)}
          disabled={!catalogId}
        >
          添加文档
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">加载中...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic">暂无归属文档</p>
      ) : (
        <ul className="space-y-1 min-h-0 flex-1 overflow-y-auto">
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
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        title="取消"
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
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
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleRemove(doc.id, doc.original_filename)}
                      title="从节点移除"
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
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
          existingDocIds={existingDocIds}
          onClose={() => setAdding(false)}
          onAdded={handleAdded}
        />
      )}
      {confirmDialog}
    </div>
  );
}
