"use client";

import { useMemo, useState } from "react";
import {
  CatalogNode,
  updateCatalogNode,
  deleteCatalogNode,
} from "@/features/knowledge";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { toast } from "@/lib/activity-toast";
import { Pencil, Trash2 } from "./icons";
import { DocumentAssignmentSection } from "./DocumentAssignmentSection";

interface NodeDetailPanelProps {
  node: CatalogNode | null;
  catalogId: string;
  /** Full node list for resolving parent name and computing sibling position */
  nodes: CatalogNode[];
  onUpdate: () => void;
  onDelete: () => void;
}

export function NodeDetailPanel({
  node,
  catalogId,
  nodes,
  onUpdate,
  onDelete,
}: NodeDetailPanelProps) {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");

  // 整棵 Wiki 目录树范围内已添加的文档 ID 集合——一篇文档全站仅出现一次，
  // 用于「添加文档」模态框灰显防重复。复用已加载的全树 nodes，零新增请求。
  const existingDocIds = useMemo(
    () =>
      new Set(
        nodes
          .filter((n) => n.node_type === "document_ref" && n.document_id)
          .map((n) => n.document_id!),
      ),
    [nodes],
  );

  if (!node) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        选择一个节点查看详情
      </div>
    );
  }

  const handleSaveDesc = async () => {
    try {
      await updateCatalogNode(catalogId, node.id, { description: descValue || undefined });
      toast.success("描述已更新");
      setEditingDesc(false);
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败");
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "删除目录节点",
      message: `确定删除「${node.name}」？子节点将一并删除。`,
      confirmLabel: "删除",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteCatalogNode(catalogId, node.id);
      toast.success("节点已删除");
      onDelete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <>
      <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {node.name}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
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
              className="p-1.5 rounded text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="编辑描述"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
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
                className="px-3 py-1 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted"
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
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
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
                className="text-sm text-muted-foreground/60 italic hover:text-muted-foreground"
              >
                点击添加描述...
              </button>
            )}
          </div>
        )}
      </div>

      {/* Metadata info */}
      <div className="px-5 py-4 space-y-3 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">ID</span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(node.id);
                toast.success("ID 已复制");
              } catch {
                toast.error("复制失败");
              }
            }}
            className="font-mono text-foreground/60 hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
            title="点击复制完整 ID"
          >
            <span className="text-[11px]">{node.id}</span>
            <svg className="h-3 w-3 shrink-0 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">父节点</span>
          <span className="text-foreground/80">
            {node.parent_id
              ? (() => {
                  const parent = nodes.find((n) => n.id === node.parent_id);
                  return parent ? parent.name : node.parent_id;
                })()
              : "（根节点）"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">排序</span>
          <span className="text-foreground/80">
            {(() => {
              const siblings = nodes
                .filter((n) => n.parent_id === node.parent_id)
                .sort((a, b) => a.sort_order - b.sort_order);
              const idx = siblings.findIndex((n) => n.id === node.id);
              return idx >= 0
                ? `第 ${idx + 1} / ${siblings.length}`
                : "-";
            })()}
          </span>
        </div>
      </div>

      {/* Document assignment */}
      <DocumentAssignmentSection
        nodeId={node.id}
        catalogId={catalogId}
        existingDocIds={existingDocIds}
        onUpdate={onUpdate}
      />
      </div>
      {confirmDialog}
    </>
  );
}
