"use client";

/**
 * GlobalSearchPanel — Phase 4 G1 GraphRAG Global Search Map-Reduce UI
 *
 * 使用社区摘要回答"汇总性问题"，与单实体级 Hybrid Search 互补。
 * 流水线：嵌入 → 社区摘要余弦排序选 top_k → 并发 Map → Reduce 聚合。
 *
 * 设计参考：Edge et al. (2024) From Local to Global GraphRAG。
 */

import { useCallback, useState } from "react";
import {
  globalSearchKnowledgeGraph,
  type GlobalSearchResult,
} from "@/features/knowledge";

interface GlobalSearchPanelProps {
  corpusId: string | null;
}

export function GlobalSearchPanel({ corpusId }: GlobalSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!corpusId || !query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await globalSearchKnowledgeGraph(corpusId, {
        query,
        maxCommunities: 10,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [corpusId, query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !loading) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, loading],
  );

  if (!corpusId) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        选择语料库后启用全局问答
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="例如：该语料库的核心主题是什么？"
          className="flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !query.trim()}
          className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          {loading ? "聚合中..." : "提交"}
        </button>
      </div>

      {error && (
        <p className="text-[10px] text-rose-600 dark:text-rose-400">{error}</p>
      )}

      {result && (
        <div className="space-y-2 rounded bg-zinc-50 p-3 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
            <span>
              {result.evidence.length} / {result.candidates_total} 社区贡献证据
            </span>
            <span>{result.latency_ms.toFixed(0)} ms</span>
          </div>
          {result.summaries_dirty && (
            <p className="rounded bg-amber-100 px-2 py-1 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              提示：实体已更新但社区摘要未刷新，建议重跑 Louvain + 摘要流程
            </p>
          )}
          <div className="rounded bg-white p-2 text-xs leading-relaxed text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
            {result.answer}
          </div>

          {result.evidence.length > 0 && (
            <details className="text-[10px]">
              <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">
                查看证据链（{result.evidence.length} 个社区）
              </summary>
              <div className="mt-1 max-h-64 space-y-1 overflow-y-auto">
                {result.evidence.map((e) => (
                  <div
                    key={e.community_id}
                    className="rounded border border-zinc-200 p-2 dark:border-zinc-700"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                        Community #{e.community_id}
                      </span>
                      <span className="text-zinc-400">
                        sim={e.similarity.toFixed(3)}
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                      {e.partial_answer}
                    </p>
                    {e.top_entities.length > 0 && (
                      <p className="mt-1 truncate text-zinc-400 dark:text-zinc-500">
                        核心实体：{e.top_entities.slice(0, 5).join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
