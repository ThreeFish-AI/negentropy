/**
 * 文档 display_name 行内重命名 Hook（单一职责、复用驱动）。
 *
 * 抽取自 Wiki 目录 `DocumentAssignmentSection` 的行内编辑逻辑，供 Knowledge → Documents
 * 页与 Wiki 目录共用，避免双份漂移。调用方经 `onSaved(updated)` 回写各自 state
 * （Documents 页做局部 patch；Wiki 目录走 `refresh()`）。
 *
 * 遵循 AGENTS.md：Single Source of Truth（display_name 写入仅此一处）、Reuse-Driven。
 */

"use client";

import { type KeyboardEvent, type RefObject, useCallback, useEffect, useRef, useState } from "react";

import { type KnowledgeDocument, updateDocument } from "../utils/knowledge-api";
import { toast } from "@/lib/activity-toast";

export interface UseInlineDocumentRenameOptions {
  /** 保存成功后回调，参数为服务端返回的规范化文档（含最终 display_name）。 */
  onSaved: (updated: KnowledgeDocument) => void | Promise<void>;
  /** 保存成功 toast 文案（默认「保存成功」）。 */
  savingToast?: string;
}

export interface UseInlineDocumentRename {
  editingId: string | null;
  editDraft: string;
  setEditDraft: (value: string) => void;
  saving: boolean;
  editInputRef: RefObject<HTMLInputElement | null>;
  startEdit: (doc: KnowledgeDocument) => void;
  cancelEdit: () => void;
  commitEdit: (doc: KnowledgeDocument) => void;
  handleKeyDown: (e: KeyboardEvent, doc: KnowledgeDocument) => void;
}

/**
 * 管理单个文档 `display_name` 的行内编辑生命周期（编辑/草稿/保存/聚焦/快捷键）。
 *
 * - Enter 保存、Escape 取消；
 * - 无变化时静默退出；
 * - 失败保留编辑态供重试，并 toast 报错；
 * - 保存期间 `saving=true`，调用方据此禁用输入与按钮。
 */
export function useInlineDocumentRename({
  onSaved,
  savingToast = "保存成功",
}: UseInlineDocumentRenameOptions): UseInlineDocumentRename {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // 编辑态挂载后自动聚焦并全选
  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

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
        const updated = await updateDocument(doc.corpus_id, doc.id, { display_name: trimmed });
        toast.success(savingToast);
        setEditingId(null);
        setEditDraft("");
        await onSaved(updated);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "保存失败");
      } finally {
        setSaving(false);
      }
    },
    [cancelEdit, editDraft, onSaved, savingToast],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent, doc: KnowledgeDocument) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void commitEdit(doc);
      } else if (e.key === "Escape") {
        cancelEdit();
      }
    },
    [cancelEdit, commitEdit],
  );

  return {
    editingId,
    editDraft,
    setEditDraft,
    saving,
    editInputRef,
    startEdit,
    cancelEdit,
    commitEdit,
    handleKeyDown,
  };
}
