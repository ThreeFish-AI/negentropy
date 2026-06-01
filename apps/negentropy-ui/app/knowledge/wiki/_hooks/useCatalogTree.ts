/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useState, useCallback, useEffect } from "react";
import {
  CatalogNode,
  fetchCatalogTree,
  updateCatalogNode,
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

interface UseCatalogTreeOptions {
  catalogId: string | null;
}

export function useCatalogTree({ catalogId }: UseCatalogTreeOptions) {
  const [nodes, setNodes] = useState<CatalogNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!catalogId) {
      setNodes([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchCatalogTree(catalogId);
      setNodes(data);
      // Preserve existing expanded state; only auto-expand root on first load.
      // Also handles catalogId switch: stale IDs are pruned against the new node set.
      setExpandedIds((prev) => {
        const validIds = new Set(data.map((n) => n.id));
        const filtered = new Set([...prev].filter((id) => validIds.has(id)));
        if (filtered.size > 0) return filtered;
        const rootIds = data
          .filter((n) => (n.depth ?? 0) === 0)
          .map((n) => n.id);
        return new Set(rootIds);
      });
    } catch (err) {
      console.error("Failed to load catalog tree:", err);
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, [catalogId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedNode =
    nodes.find((n) => n.id === selectedNodeId) ?? null;

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const selectNode = useCallback((node: CatalogNode | null) => {
    setSelectedNodeId(node?.id ?? null);
    if (node) {
      // Auto-expand ancestors
      const path = node.path ?? [];
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const id of path) next.add(id);
        return next;
      });
    }
  }, []);

  const navigateToPath = useCallback(
    (targetNodeId: string) => {
      setSelectedNodeId(targetNodeId);
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      if (targetNode?.path) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          for (const id of targetNode.path!) next.add(id);
          return next;
        });
      }
    },
    [nodes],
  );

  const expandAll = useCallback(() => {
    // All nodes that have children are non-leaf nodes
    const parentIds = new Set<string>();
    for (const node of nodes) {
      if (node.parent_id) {
        parentIds.add(node.parent_id);
      }
    }
    setExpandedIds(parentIds);
  }, [nodes]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const renameNode = useCallback(
    async (nodeId: string, newName: string) => {
      if (!catalogId) return;
      try {
        await updateCatalogNode(catalogId, nodeId, {
          name: newName,
          slug: slugify(newName),
        });
        toast.success(`已重命名为「${newName}」`);
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "重命名失败");
        throw err;
      }
    },
    [catalogId, refresh],
  );

  const moveNode = useCallback(
    async (
      nodeId: string,
      newParentId: string | null,
      newSortOrder: number,
    ) => {
      if (!catalogId) return;

      // Capture snapshots inside setState callbacks for atomicity
      let snapNodes: CatalogNode[] | null = null;
      let snapExpanded: Set<string> | null = null;

      // Optimistic update: immediately reflect the move in local state,
      // including path/depth recalculation for cross-folder moves.
      setNodes((prev) => {
        snapNodes = prev.map((n) => ({ ...n })); // defensive shallow copy
        return prev.map((n) => {
          if (n.id !== nodeId) return n;
          const targetParent = newParentId
            ? prev.find((p) => p.id === newParentId)
            : null;
          const newPath = targetParent
            ? [...(targetParent.path ?? []), targetParent.id]
            : [];
          const newDepth = targetParent
            ? (targetParent.depth ?? 0) + 1
            : 0;
          return {
            ...n,
            parent_id: newParentId,
            sort_order: newSortOrder,
            path: newPath,
            depth: newDepth,
          };
        });
      });

      // Auto-expand the target folder when moving into a new parent
      setExpandedIds((prev) => {
        snapExpanded = new Set(prev);
        if (newParentId && !prev.has(newParentId)) {
          const next = new Set(prev);
          next.add(newParentId);
          return next;
        }
        return prev;
      });

      try {
        await updateCatalogNode(catalogId, nodeId, {
          parent_id: newParentId,
          sort_order: newSortOrder,
        });
        // Success — no full refresh needed; reindexSiblings will refresh
        // when necessary and it now preserves expandedIds.
      } catch (err) {
        // Rollback to pre-move snapshot
        if (snapNodes) setNodes(snapNodes);
        if (snapExpanded) setExpandedIds(snapExpanded);
        toast.error(err instanceof Error ? err.message : "移动失败");
        throw err;
      }
    },
    [catalogId],
  );

  return {
    nodes,
    selectedNode,
    selectedNodeId,
    expandedIds,
    loading,
    refresh,
    toggleExpand,
    selectNode,
    navigateToPath,
    expandAll,
    collapseAll,
    renameNode,
    moveNode,
  };
}
