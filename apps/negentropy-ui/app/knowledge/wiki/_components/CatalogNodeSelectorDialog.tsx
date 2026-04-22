"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CatalogNode, fetchCatalogTree } from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";

interface CatalogNodeSelectorDialogProps {
  open: boolean;
  corpusId: string;
  initialSelectedIds?: string[];
  onClose: () => void;
  onConfirm: (selectedNodeIds: string[]) => void;
  submitting?: boolean;
  confirmLabel?: string;
  title?: string;
}

export function CatalogNodeSelectorDialog({
  open,
  corpusId,
  initialSelectedIds = [],
  onClose,
  onConfirm,
  submitting = false,
  confirmLabel = "确认同步",
  title = "选择同步的 Catalog 节点",
}: CatalogNodeSelectorDialogProps) {
  const [nodes, setNodes] = useState<CatalogNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedIds),
  );

  const loadTree = useCallback(async () => {
    if (!corpusId) return;
    setLoading(true);
    try {
      const tree = await fetchCatalogTree(corpusId);
      setNodes(tree);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "目录加载失败");
    } finally {
      setLoading(false);
    }
  }, [corpusId]);

  const resetSelection = useCallback(() => {
    setSelectedIds(new Set(initialSelectedIds));
  }, [initialSelectedIds]);

  useEffect(() => {
    if (!open) return;
    void loadTree();
    resetSelection();
  }, [open, loadTree, resetSelection]);

  const rootNodes = useMemo(
    () => nodes.filter((n) => n.parent_id === null),
    [nodes],
  );

  const childrenMap = useMemo(() => {
    const map = new Map<string, CatalogNode[]>();
    for (const n of nodes) {
      if (!n.parent_id) continue;
      const arr = map.get(n.parent_id) ?? [];
      arr.push(n);
      map.set(n.parent_id, arr);
    }
    return map;
  }, [nodes]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedIds.size === 0) {
      toast.error("请至少选择一个节点");
      return;
    }
    onConfirm(Array.from(selectedIds));
  }, [selectedIds, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-xl border border-border p-6 w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
            ⚠️ 同步为
            <span className="font-semibold">全量覆盖</span>
            ：未在本次选择的子树内的既有条目将被删除。
          </p>
        </div>

        <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-background p-2">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">加载中...</p>
          ) : rootNodes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              暂无目录节点，请先在 Catalog 页创建
            </p>
          ) : (
            <TreeBranch
              nodes={rootNodes}
              childrenMap={childrenMap}
              depth={0}
              selectedIds={selectedIds}
              onToggle={toggle}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-4">
          <p className="text-xs text-muted">已选 {selectedIds.size} 个节点</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded-md border border-border text-muted hover:bg-muted"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting || selectedIds.size === 0}
              className="px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "处理中..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TreeBranchProps {
  nodes: CatalogNode[];
  childrenMap: Map<string, CatalogNode[]>;
  depth: number;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

function TreeBranch({
  nodes,
  childrenMap,
  depth,
  selectedIds,
  onToggle,
}: TreeBranchProps) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => {
        const children = childrenMap.get(node.id) ?? [];
        const checked = selectedIds.has(node.id);
        return (
          <li key={node.id}>
            <label
              className="flex items-center gap-2 py-1 px-1.5 text-sm rounded-md hover:bg-muted/40 cursor-pointer"
              style={{ paddingLeft: `${depth * 16 + 6}px` }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(node.id)}
                className="rounded"
              />
              <span className="truncate">{node.name}</span>
              <span className="ml-auto text-[10px] text-muted px-1.5 py-0.5 rounded-full bg-muted/40">
                {node.node_type}
              </span>
            </label>
            {children.length > 0 && (
              <TreeBranch
                nodes={children}
                childrenMap={childrenMap}
                depth={depth + 1}
                selectedIds={selectedIds}
                onToggle={onToggle}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
