"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createWikiPublication,
  WikiPublication,
  WikiTheme,
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

interface CreateWikiPublicationDialogProps {
  open: boolean;
  corpusId: string;
  onClose: () => void;
  onCreated: (pub: WikiPublication) => void;
}

export function CreateWikiPublicationDialog({
  open,
  corpusId,
  onClose,
  onCreated,
}: CreateWikiPublicationDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState<WikiTheme>("default");
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
    setDescription("");
    setTheme("default");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !slug.trim() || !corpusId) return;
    setSubmitting(true);
    try {
      const pub = await createWikiPublication({
        corpus_id: corpusId,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        theme,
      });
      toast.success(`发布「${pub.name}」已创建`);
      onCreated(pub);
      handleReset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }, [name, slug, description, theme, corpusId, onCreated, onClose, handleReset]);

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
        <h3 className="text-base font-semibold mb-4">新建 Wiki 发布</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              名称 *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：工程 Wiki"
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
              placeholder="engineering"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-[11px] text-muted">
              作为站点 URL 前缀，例如 /{slug || "engineering"}/...
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要说明本发布的目标受众与内容范围"
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              主题
            </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as WikiTheme)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none"
            >
              <option value="default">默认</option>
              <option value="book">图书（Book）</option>
              <option value="docs">文档（Docs）</option>
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
            disabled={submitting || !name.trim() || !slug.trim() || !corpusId}
            className="px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
