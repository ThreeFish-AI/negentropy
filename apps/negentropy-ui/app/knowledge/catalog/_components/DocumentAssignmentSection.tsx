"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchCatalogNodeDocuments,
  unassignDocumentFromNode,
  KnowledgeDocument,
} from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";
import { Plus, Trash2 } from "./icons";
import { AddDocumentsDialog } from "./AddDocumentsDialog";

interface DocumentAssignmentSectionProps {
  nodeId: string;
  corpusId: string;
}

export function DocumentAssignmentSection({
  nodeId,
  corpusId,
}: DocumentAssignmentSectionProps) {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCatalogNodeDocuments(nodeId, { limit: 200 });
      setDocs(res.documents ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载文档失败");
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRemove = useCallback(
    async (docId: string, filename: string) => {
      if (!confirm(`从本节点移除「${filename}」？文档本身不会被删除。`)) return;
      try {
        await unassignDocumentFromNode(nodeId, docId);
        toast.success("已移除");
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "移除失败");
      }
    },
    [nodeId, refresh],
  );

  const handleAdded = useCallback(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="px-5 py-4 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
          归属文档 ({docs.length})
        </h3>
        <button
          onClick={() => setAdding(true)}
          disabled={!corpusId}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-muted hover:text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-3 w-3" />
          添加文档
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted">加载中...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted/60 italic">暂无归属文档</p>
      ) : (
        <ul className="space-y-1 max-h-[280px] overflow-y-auto">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="group flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/30 text-xs"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-foreground">
                  {doc.original_filename}
                </p>
                <p className="text-[10px] text-muted/70 font-mono">
                  {doc.markdown_extract_status ?? "—"} · {doc.id.slice(0, 8)}…
                </p>
              </div>
              <button
                onClick={() => handleRemove(doc.id, doc.original_filename)}
                title="从节点移除"
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-muted hover:text-red-600 hover:bg-red-50 transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && corpusId && (
        <AddDocumentsDialog
          nodeId={nodeId}
          corpusId={corpusId}
          existingDocIds={new Set(docs.map((d) => d.id))}
          onClose={() => setAdding(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}
