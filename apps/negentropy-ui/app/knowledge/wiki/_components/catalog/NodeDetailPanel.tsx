"use client";

import { useMemo, useState } from "react";
import {
  CatalogNode,
  updateCatalogNode,
  deleteCatalogNode,
} from "@/features/knowledge";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { Button } from "@/components/ui/Button";
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
      <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
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
      <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-heading text-foreground">
              {node.name}
            </h2>
            <p
              className="mt-0.5 truncate text-xs text-text-muted"
              title={`${node.node_type} · slug: ${node.slug}${node.depth != null ? ` · 深度: ${node.depth}` : ""}`}
            >
              {node.node_type} · slug: {node.slug}
              {node.depth != null && ` · 深度: ${node.depth}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => {
                setDescValue(node.description ?? "");
                setEditingDesc(true);
              }}
              aria-label="编辑描述"
              title="编辑描述"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={handleDelete}
              aria-label="删除节点"
              title="删除节点"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Description editor */}
      <div className="shrink-0 border-b border-border px-5 py-3">
        {editingDesc ? (
          <div className="space-y-2">
            <textarea
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              placeholder="为这个节点写一句描述…"
              className="w-full min-h-[80px] resize-y rounded-control border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingDesc(false);
                  setDescValue("");
                }}
              >
                取消
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveDesc}>
                保存
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-text-muted">
              描述
            </p>
            {node.description ? (
              <p className="text-sm leading-relaxed text-text-secondary">{node.description}</p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDescValue(node.description ?? "");
                  setEditingDesc(true);
                }}
                className="text-sm italic text-text-muted transition-colors hover:text-foreground"
              >
                点击添加描述…
              </button>
            )}
          </div>
        )}
      </div>

      {/* Metadata info */}
      <div className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-1.5 px-5 py-3 text-xs">
        <div className="col-span-2 flex items-center justify-between gap-2">
          <span className="text-text-muted">ID</span>
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
            className="flex cursor-pointer items-center gap-1 font-mono text-text-muted transition-colors hover:text-foreground"
            title="点击复制完整 ID"
          >
            <span className="text-[11px]">{node.id}</span>
            <svg className="h-3 w-3 shrink-0 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-text-muted">父节点</span>
          <span className="truncate text-foreground">
            {node.parent_id
              ? (() => {
                  const parent = nodes.find((n) => n.id === node.parent_id);
                  return parent ? parent.name : node.parent_id;
                })()
              : "（根节点）"}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-text-muted">排序</span>
          <span className="text-foreground">
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
