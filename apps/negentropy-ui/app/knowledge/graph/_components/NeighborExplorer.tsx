/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
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

  useEffect(() => {
    setExpanded(false);
    setNeighbors([]);
  }, [entityId]);

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
      <p className="text-xs text-text-muted">
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
          className="rounded border border-input bg-background px-2 py-1 text-xs"
        >
          <option value={1}>1 跳</option>
          <option value={2}>2 跳</option>
          <option value={3}>3 跳</option>
        </select>
        <button
          onClick={loadNeighbors}
          disabled={loading}
          className="rounded bg-muted px-3 py-1 text-xs font-medium text-text-secondary hover:bg-border disabled:opacity-40"
        >
          {loading ? "加载中..." : "展开邻居"}
        </button>
      </div>

      {expanded && (
        <div className="space-y-1">
          <p className="text-micro text-text-muted">
            {neighbors.length} 个邻居
          </p>
          {neighbors.length === 0 ? (
            <p className="text-xs text-text-muted">
              无邻居实体
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {neighbors.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs"
                >
                  <span className="text-text-secondary">
                    {n.label || n.id.slice(0, 8)}
                  </span>
                  {n.type && (
                    <span className="text-micro text-text-muted">
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
