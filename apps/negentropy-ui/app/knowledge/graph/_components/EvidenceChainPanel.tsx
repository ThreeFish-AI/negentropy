"use client";

/**
 * EvidenceChainPanel — Phase 4 G4 多跳推理 + Provenance 证据链
 *
 * 流水线：seed 推断 → Personalized PageRank → top-K → 反向最短路径 → 三元组
 * 证据链。UI 树形渲染：每个 top-K 实体作为根节点，下方展开 evidence edges
 * 与 evidence_text。
 *
 * 设计参考：
 *   - HippoRAG (NeurIPS'24) PPR + 命名实体抽取
 *   - Think-on-Graph (ICLR'24) 三元路径验证
 */

import { useCallback, useState } from "react";
import {
  multiHopReasonKnowledgeGraph,
  type MultiHopReasonResult,
} from "@/features/knowledge";

interface EvidenceChainPanelProps {
  corpusId: string | null;
}

export function EvidenceChainPanel({ corpusId }: EvidenceChainPanelProps) {
  const [query, setQuery] = useState("");
  const [seedHint, setSeedHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MultiHopReasonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!corpusId || !query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const seedList = seedHint
        .split(/[,，;；\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await multiHopReasonKnowledgeGraph(corpusId, {
        query,
        seedEntities: seedList.length > 0 ? seedList : undefined,
        topK: 8,
        maxHops: 3,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [corpusId, query, seedHint]);

  if (!corpusId) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        选择语料库后启用多跳推理
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="例如：X 公司谁负责 AI 项目并向 CEO 汇报？"
        className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />
      <input
        type="text"
        value={seedHint}
        onChange={(e) => setSeedHint(e.target.value)}
        placeholder="可选：种子实体（用逗号分隔；留空则自动从查询提取）"
        className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-[10px] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !query.trim()}
        className="rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-40"
      >
        {loading ? "推理中..." : "执行多跳推理"}
      </button>

      {error && (
        <p className="text-[10px] text-rose-600 dark:text-rose-400">{error}</p>
      )}

      {result && (
        <div className="space-y-2 rounded bg-zinc-50 p-2 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
            <span>seeds: {result.seeds.join(", ") || "（未找到）"}</span>
            <span>{result.latency_ms.toFixed(0)} ms</span>
          </div>
          {result.evidence_chain.length === 0 ? (
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {result.seeds.length === 0
                ? "未能从查询中提取种子实体；请显式提供种子。"
                : "未发现可达的多跳推理路径。"}
            </p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {result.evidence_chain.map((c) => (
                <details
                  key={c.target_entity_id}
                  className="rounded border border-zinc-200 p-2 dark:border-zinc-700"
                >
                  <summary className="cursor-pointer text-xs">
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">
                      {c.target_label}
                    </span>
                    <span className="ml-2 text-[10px] text-zinc-400">
                      score={c.score.toFixed(4)} · {c.path.length - 1} 跳
                    </span>
                  </summary>
                  {c.edges.length > 0 ? (
                    <ol className="mt-1 space-y-1 pl-4">
                      {c.edges.map((e, i) => (
                        <li
                          key={`${e.source_id}-${e.target_id}-${i}`}
                          className="text-[10px] text-zinc-600 dark:text-zinc-400"
                        >
                          <span className="font-mono text-zinc-500">
                            {e.source_id.slice(0, 6)} ─[{e.relation}]→{" "}
                            {e.target_id.slice(0, 6)}
                          </span>
                          {e.evidence_text && (
                            <p className="mt-1 text-zinc-500 dark:text-zinc-500">
                              {e.evidence_text}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-1 text-[10px] text-zinc-500">
                      （无完整证据链 — 可能是孤立 / 跨子图节点）
                    </p>
                  )}
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
