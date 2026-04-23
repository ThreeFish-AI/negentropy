"use client";

import { useState } from "react";
import {
  CatalogNode,
  updateCatalogNode,
  deleteCatalogNode,
} from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";
import { Pencil, Trash2 } from "./icons";
import { DocumentAssignmentSection } from "./DocumentAssignmentSection";

interface NodeDetailPanelProps {
  node: CatalogNode | null;
  catalogId: string;
  onUpdate: () => void;
  onDelete: () => void;
}

export function NodeDetailPanel({
  node,
  catalogId,
  onUpdate,
  onDelete,
}: NodeDetailPanelProps) {
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");

  if (!node) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted">
        选择一个节点查看详情
      </div>
    );
  }

  const handleSaveDesc = async () => {
    try {
      await updateCatalogNode(node.id, { description: descValue || undefined });
      toast.success("描述已更新");
      setEditingDesc(false);
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确定删除「${node.name}」？子节点将一并删除。`)) return;
    try {
      await deleteCatalogNode(node.id);
      toast.success("节点已删除");
      onDelete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {node.name}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {node.node_type} · slug: {node.slug}
              {node.depth != null && ` · 深度: ${node.depth}`}
            </p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => {
                setDescValue(node.description ?? "");
                setEditingDesc(true);
              }}
              className="p-1.5 rounded text-muted hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="编辑描述"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
              title="删除节点"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Description editor */}
      <div className="px-5 py-4 border-b border-border">
        {editingDesc ? (
          <div className="space-y-2">
            <textarea
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              placeholder="输入节点描述..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditingDesc(false);
                  setDescValue("");
                }}
                className="px-3 py-1 text-xs rounded-md border border-border text-muted hover:bg-muted"
              >
                取消
              </button>
              <button
                onClick={handleSaveDesc}
                className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90"
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
              描述
            </p>
            {node.description ? (
              <p className="text-sm text-foreground/80">{node.description}</p>
            ) : (
              <button
                onClick={() => {
                  setDescValue(node.description ?? "");
                  setEditingDesc(true);
                }}
                className="text-sm text-muted/60 italic hover:text-muted"
              >
                点击添加描述...
              </button>
            )}
          </div>
        )}
      </div>

      {/* Metadata info */}
      <div className="px-5 py-4 space-y-3 text-xs">
        <div className="flex justify-between">
          <span className="text-muted">ID</span>
          <span className="font-mono text-foreground/60">
            {node.id.slice(0, 8)}…
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">父节点</span>
          <span>
            {node.parent_id
              ? `${node.parent_id.slice(0, 8)}…`
              : "（根节点）"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">排序</span>
          <span>{node.sort_order}</span>
        </div>
      </div>

      {/* Document assignment */}
      <DocumentAssignmentSection nodeId={node.id} catalogId={catalogId} />
    </div>
  );
}
