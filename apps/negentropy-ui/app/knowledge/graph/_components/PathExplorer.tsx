"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type GraphEntityItem,
  fetchGraphEntities,
  findGraphPath,
} from "@/features/knowledge";

interface PathExplorerProps {
  corpusId: string;
  onPathFound: (path: string[]) => void;
}

export function PathExplorer({ corpusId, onPathFound }: PathExplorerProps) {
  const [entities, setEntities] = useState<GraphEntityItem[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{
    found: boolean;
    length: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchGraphEntities(corpusId, { limit: 200 })
      .then((data) => {
        if (mounted) setEntities(data.items);
      })
      .catch(console.error);
    return () => {
      mounted = false;
    };
  }, [corpusId]);

  const handleFindPath = useCallback(async () => {
    if (!sourceId || !targetId) return;
    setSearching(true);
    setResult(null);
    try {
      const data = await findGraphPath({
        source_id: sourceId,
        target_id: targetId,
        max_depth: 5,
      });
      setResult({ found: data.found, length: data.length });
      if (data.found && data.path) {
        onPathFound(data.path);
      }
    } catch (err) {
      console.error(err);
      setResult({ found: false, length: 0 });
    } finally {
      setSearching(false);
    }
  }, [sourceId, targetId, onPathFound]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div>
          <label className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
            起始实体
          </label>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">选择起始实体...</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.entity_type})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
            目标实体
          </label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">选择目标实体...</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.entity_type})
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleFindPath}
        disabled={!sourceId || !targetId || searching}
        className="w-full rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {searching ? "查找中..." : "查找路径"}
      </button>

      {result && (
        <div
          className={`rounded-lg p-2 text-xs ${
            result.found
              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
          }`}
        >
          {result.found
            ? `找到路径，长度 ${result.length} 跳`
            : "未找到路径（实体间不连通或超出搜索深度）"}
        </div>
      )}
    </div>
  );
}
