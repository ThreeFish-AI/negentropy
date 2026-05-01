"use client";

import { useEffect, useState } from "react";
import { type GraphStatsResponse, fetchGraphStats } from "@/features/knowledge";

interface GraphStatsPanelProps {
  corpusId: string;
}

export function GraphStatsPanel({ corpusId }: GraphStatsPanelProps) {
  const [stats, setStats] = useState<GraphStatsResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchGraphStats(corpusId)
      .then((data) => {
        if (mounted) setStats(data);
      })
      .catch(console.error);
    return () => {
      mounted = false;
    };
  }, [corpusId]);

  if (!stats) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">加载中...</p>
    );
  }

  const sortedTypes = Object.entries(stats.by_type).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="space-y-3">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-2 text-center">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {stats.total_entities}
          </p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">实体</p>
        </div>
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-2 text-center">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {stats.edge_count}
          </p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">关系</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">平均置信度</span>
        <span className="text-zinc-900 dark:text-zinc-100">
          {stats.avg_confidence.toFixed(3)}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">图密度</span>
        <span className="text-zinc-900 dark:text-zinc-100">
          {stats.density.toFixed(4)}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">平均度数</span>
        <span className="text-zinc-900 dark:text-zinc-100">
          {stats.avg_degree.toFixed(1)}
        </span>
      </div>

      {/* Type Distribution */}
      {sortedTypes.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            类型分布
          </p>
          <div className="space-y-1">
            {sortedTypes.map(([type, count]) => {
              const pct =
                stats.total_entities > 0
                  ? Math.round((count / stats.total_entities) * 100)
                  : 0;
              return (
                <div key={type} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 w-20 truncate">
                    {type}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 w-8 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
