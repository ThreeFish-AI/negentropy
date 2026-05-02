"use client";

import { useEffect, useState } from "react";
import { type GraphStatsResponse, fetchGraphStats } from "@/features/knowledge";
import { communityColor } from "./constants";

interface GraphStatsPanelProps {
  corpusId: string;
}

export function GraphStatsPanel({ corpusId }: GraphStatsPanelProps) {
  const [result, setResult] = useState<{
    corpusId: string;
    stats: GraphStatsResponse | null;
    error: boolean;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchGraphStats(corpusId)
      .then((data) => {
        if (mounted) setResult({ corpusId, stats: data, error: false });
      })
      .catch((err) => {
        console.error(err);
        if (mounted) setResult({ corpusId, stats: null, error: true });
      });
    return () => {
      mounted = false;
    };
  }, [corpusId]);

  const isCurrent = result?.corpusId === corpusId;
  const error = isCurrent && result?.error === true;
  const stats = isCurrent && !error ? result!.stats : null;

  if (error) {
    return (
      <p className="text-xs text-red-500 dark:text-red-400">加载失败，请重试</p>
    );
  }

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

      {/* Top Entities by Importance (PageRank) */}
      {"top_entities" in stats &&
        Array.isArray(stats.top_entities) &&
        stats.top_entities.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Top 实体 (PageRank)
            </p>
            <div className="space-y-1">
              {stats.top_entities.map(
                (e: { name: string; entity_type: string; importance_score: number }, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 w-3">{i + 1}</span>
                    <span className="text-xs text-zinc-900 dark:text-zinc-100 truncate flex-1">
                      {e.name}
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {e.importance_score.toFixed(4)}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

      {/* Community Distribution (Louvain) */}
      {"community_distribution" in stats &&
        Object.keys(stats.community_distribution).length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              社区分布 (Louvain) — {stats.community_count} 个社区
            </p>
            <div className="space-y-1">
              {Object.entries(stats.community_distribution)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([cid, count]) => {
                  const pct =
                    stats.total_entities > 0
                      ? Math.round((count / stats.total_entities) * 100)
                      : 0;
                  return (
                    <div key={cid} className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: communityColor(Number(cid)) }}
                      />
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 w-10">
                        C-{cid}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: communityColor(Number(cid)),
                          }}
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
