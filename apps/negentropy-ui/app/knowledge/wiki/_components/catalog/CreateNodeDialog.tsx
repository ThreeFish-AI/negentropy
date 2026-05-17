"use client";

import { useState, useCallback, useEffect } from "react";
import {
  createCatalogNode,
  CatalogNode,
} from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || "untitled"
  );
}

interface CreateNodeDialogProps {
  open: boolean;
  parentId: string | null;
  catalogId: string;
  onClose: () => void;
  onCreated: (node: CatalogNode) => void;
}

/**
 * 创建目录节点对话框（PR-4 起仅创建 FOLDER 类型）
 *
 * 历史的「类型」下拉框（分类 / 集合 / 文档引用）已移除：
 *   - CATEGORY + COLLECTION 在后端归并为单一 FOLDER；
 *   - DOCUMENT_REF 是系统内部软引用，不再暴露至用户创建路径——文档归属应通过
 *     节点详情页的「挂载文档」按钮完成。
 */
export function CreateNodeDialog({
  open,
  parentId,
  catalogId,
  onClose,
  onCreated,
}: CreateNodeDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!slugEdited && name) {
      setSlug(slugify(name));
    }
  }, [name, slugEdited]);

  const handleReset = useCallback(() => {
    setName("");
    setSlug("");
    setSlugEdited(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !slug.trim()) return;
    setSubmitting(true);
    try {
      const node = await createCatalogNode({
        catalog_id: catalogId,
        name: name.trim(),
        slug: slug.trim(),
        parent_id: parentId ?? undefined,
        node_type: "folder",
      });
      toast.success(`目录「${name}」已创建`);
      onCreated(node);
      handleReset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }, [name, slug, catalogId, parentId, onCreated, onClose, handleReset]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-xl border border-border p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-1">创建目录节点</h3>
        <p className="text-[11px] text-muted mb-4">
          目录节点用于组织子目录与文档。文档需通过节点详情页「挂载文档」入口添加，无需在此选择类型。
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              名称 *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="节点名称"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Slug *
            </label>
            <input
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                );
              }}
              placeholder="node-slug"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-[11px] text-muted">
              仅支持小写字母、数字与短横线；将作为 URL 片段与 Wiki 层级标识。
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md border border-border text-muted hover:bg-muted"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || !slug.trim()}
            className="px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
