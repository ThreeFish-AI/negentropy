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
      // Auto-expand first level
      const rootIds = data
        .filter((n) => (n.depth ?? 0) === 0)
        .map((n) => n.id);
      setExpandedIds(new Set(rootIds));
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
      try {
        await updateCatalogNode(catalogId, nodeId, {
          parent_id: newParentId,
          sort_order: newSortOrder,
        });
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "移动失败");
        throw err;
      }
    },
    [catalogId, refresh],
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
