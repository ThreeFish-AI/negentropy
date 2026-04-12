"use client";

import { useState, useCallback, useEffect } from "react";
import { CatalogNode, fetchCatalogTree } from "@/features/knowledge";

interface UseCatalogTreeOptions {
  corpusId: string | null;
}

export function useCatalogTree({ corpusId }: UseCatalogTreeOptions) {
  const [nodes, setNodes] = useState<CatalogNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!corpusId) {
      setNodes([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchCatalogTree(corpusId);
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
  }, [corpusId]);

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
  };
}
