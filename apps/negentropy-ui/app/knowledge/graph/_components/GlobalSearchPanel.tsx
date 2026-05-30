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
      <p className="text-xs text-text-muted">
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
          className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
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
        <p className="text-micro text-rose-600 dark:text-rose-400">{error}</p>
      )}

      {result && (
        <div className="space-y-2 rounded bg-muted p-3">
          <div className="flex items-center justify-between text-micro text-text-muted">
            <span>
              {result.evidence.length} / {result.candidates_total} 社区贡献证据
            </span>
            <span>{result.latency_ms.toFixed(0)} ms</span>
          </div>
          {result.summaries_dirty && (
            <p className="rounded bg-amber-100 px-2 py-1 text-micro text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              提示：实体已更新但社区摘要未刷新，建议重跑 Louvain + 摘要流程
            </p>
          )}
          <div className="rounded bg-card p-2 text-xs leading-relaxed text-foreground">
            {result.answer}
          </div>

          {result.evidence.length > 0 && (
            <details className="text-micro">
              <summary className="cursor-pointer text-text-secondary">
                查看证据链（{result.evidence.length} 个社区）
              </summary>
              <div className="mt-1 max-h-64 space-y-1 overflow-y-auto">
                {result.evidence.map((e) => (
                  <div
                    key={e.community_id}
                    className="rounded border border-border p-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-text-secondary">
                        Community #{e.community_id}
                      </span>
                      <span className="text-text-muted">
                        sim={e.similarity.toFixed(3)}
                      </span>
                    </div>
                    <p className="mt-1 text-text-secondary">
                      {e.partial_answer}
                    </p>
                    {e.top_entities.length > 0 && (
                      <p className="mt-1 truncate text-text-muted">
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
