"use client";

import { useState, useCallback, useEffect } from "react";
import {
  CatalogNodeType,
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
  corpusId: string;
  onClose: () => void;
  onCreated: (node: CatalogNode) => void;
}

export function CreateNodeDialog({
  open,
  parentId,
  corpusId,
  onClose,
  onCreated,
}: CreateNodeDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [nodeType, setNodeType] = useState<CatalogNodeType>("category");
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
    setNodeType("category");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !slug.trim()) return;
    setSubmitting(true);
    try {
      const node = await createCatalogNode({
        corpus_id: corpusId,
        name: name.trim(),
        slug: slug.trim(),
        parent_id: parentId ?? undefined,
        node_type: nodeType,
      });
      toast.success(`节点「${name}」已创建`);
      onCreated(node);
      handleReset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }, [name, slug, nodeType, corpusId, parentId, onCreated, onClose, handleReset]);

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
        <h3 className="text-base font-semibold mb-4">创建目录节点</h3>
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
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              类型
            </label>
            <select
              value={nodeType}
              onChange={(e) =>
                setNodeType(e.target.value as CatalogNodeType)
              }
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none"
            >
              <option value="category">分类</option>
              <option value="collection">集合</option>
              <option value="document_ref">文档引用</option>
            </select>
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
