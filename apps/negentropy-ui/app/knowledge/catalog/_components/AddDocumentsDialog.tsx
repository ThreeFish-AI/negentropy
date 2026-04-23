"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchCatalogDocuments,
  assignDocumentToNode,
  KnowledgeDocument,
} from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";

interface AddDocumentsDialogProps {
  nodeId: string;
  catalogId: string;
  existingDocIds: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}

export function AddDocumentsDialog({
  nodeId,
  catalogId,
  existingDocIds,
  onClose,
  onAdded,
}: AddDocumentsDialogProps) {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchCatalogDocuments(catalogId, { limit: 200 });
        if (!cancelled) setDocs(res.items ?? []);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "加载文档失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [catalogId]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return docs;
    return docs.filter((d) =>
      d.original_filename.toLowerCase().includes(kw),
    );
  }, [docs, keyword]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      // 并发分配；后端端点已改为批量，这里通过单次循环逐项调用以复用既有 API
      const results = await Promise.allSettled(
        Array.from(selected).map((id) => assignDocumentToNode(nodeId, id)),
      );
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length) {
        toast.error(`${failures.length} 个文档分配失败`);
      } else {
        toast.success(`已分配 ${selected.size} 个文档`);
      }
      onAdded();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "分配失败");
    } finally {
      setSubmitting(false);
    }
  }, [selected, nodeId, onAdded, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-xl border border-border p-5 w-full max-w-xl flex flex-col"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-3">添加文档到节点</h3>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="按文件名搜索..."
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 mb-3"
        />
        <div className="flex-1 overflow-y-auto border border-border rounded-md">
          {loading ? (
            <p className="text-sm text-muted p-4 text-center">加载中...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted/60 p-4 text-center">
              无可添加的文档
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((doc) => {
                const already = existingDocIds.has(doc.id);
                const checked = selected.has(doc.id);
                return (
                  <li key={doc.id}>
                    <label
                      className={`flex items-center gap-2 px-3 py-2 text-sm ${
                        already
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-muted/30 cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={already}
                        checked={checked}
                        onChange={() => toggle(doc.id)}
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">
                          {doc.original_filename}
                        </p>
                        <p className="text-[10px] text-muted/70 font-mono">
                          {doc.markdown_extract_status ?? "—"} ·{" "}
                          {already ? "已归属" : doc.id.slice(0, 8) + "…"}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-muted">
            已选择 {selected.size} 个
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded-md border border-border text-muted hover:bg-muted"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || selected.size === 0}
              className="px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "分配中..." : `分配 (${selected.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
