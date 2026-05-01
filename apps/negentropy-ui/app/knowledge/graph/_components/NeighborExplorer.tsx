"use client";

import { useCallback, useState } from "react";
import { findGraphNeighbors } from "@/features/knowledge";

interface NeighborExplorerProps {
  entityId: string | null;
}

export function NeighborExplorer({
  entityId,
}: NeighborExplorerProps) {
  const [neighbors, setNeighbors] = useState<
    Array<{ id: string; label?: string; type?: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [depth, setDepth] = useState(1);
  const [expanded, setExpanded] = useState(false);

  const loadNeighbors = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const data = await findGraphNeighbors({
        entity_id: entityId,
        max_depth: depth,
        limit: 50,
      });
      setNeighbors(data.neighbors);
      setExpanded(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [entityId, depth]);

  if (!entityId) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        选择实体后探索邻居
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value={1}>1 跳</option>
          <option value={2}>2 跳</option>
          <option value={3}>3 跳</option>
        </select>
        <button
          onClick={loadNeighbors}
          disabled={loading}
          className="rounded bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {loading ? "加载中..." : "展开邻居"}
        </button>
      </div>

      {expanded && (
        <div className="space-y-1">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {neighbors.length} 个邻居
          </p>
          {neighbors.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              无邻居实体
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {neighbors.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-1.5 rounded border border-zinc-100 dark:border-zinc-800 px-2 py-1 text-xs"
                >
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {n.label || n.id.slice(0, 8)}
                  </span>
                  {n.type && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      ({n.type})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
