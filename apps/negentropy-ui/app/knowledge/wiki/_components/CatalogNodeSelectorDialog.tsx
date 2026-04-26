"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CatalogNode, fetchCatalogTree } from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";
import { BaseModal } from "@/components/ui/BaseModal";

const EMPTY_SELECTION: readonly string[] = Object.freeze([]);

interface CatalogNodeSelectorDialogProps {
  open: boolean;
  corpusId: string;
  initialSelectedIds?: readonly string[];
  onClose: () => void;
  onConfirm: (selectedNodeIds: string[]) => void;
  submitting?: boolean;
  confirmLabel?: string;
  title?: string;
}

export function CatalogNodeSelectorDialog({
  open,
  corpusId,
  initialSelectedIds = EMPTY_SELECTION,
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

  // 打开时加载树并以 initialSelectedIds 重置选择。
  // 依赖收敛到 [open, corpusId]：initialSelectedIds 作为「打开时刻的快照」消费，
  // 不纳入依赖避免父组件每次 render 传入新数组引用导致 effect 重跑 → 无限 fetch。
  useEffect(() => {
    if (!open || !corpusId) return;
    let cancelled = false;
    setLoading(true);
    setSelectedIds(new Set(initialSelectedIds));
    fetchCatalogTree(corpusId)
      .then((tree) => {
        if (!cancelled) setNodes(tree);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "目录加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialSelectedIds 是 open 切换时的瞬时快照，不应触发重载
  }, [open, corpusId]);

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

  return (
    <BaseModal
      open={open}
      title={title}
      onClose={onClose}
      size="lg"
      closeOnBackdrop={!submitting}
      closeOnEscape={!submitting}
      subtitle={
        <span className="text-amber-700 dark:text-amber-400">
          ⚠️ 同步为<span className="font-semibold">全量覆盖</span>：未在本次选择的子树内的既有条目将被删除。
        </span>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-2">
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
      }
    >
      <div className="rounded-lg border border-border bg-background p-2">
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
    </BaseModal>
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
