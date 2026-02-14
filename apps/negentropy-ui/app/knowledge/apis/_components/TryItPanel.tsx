"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { ApiEndpoint } from "@/features/knowledge/utils/api-specs";
import { searchKnowledge, SearchResults } from "@/features/knowledge";

interface TryItPanelProps {
  endpoint: ApiEndpoint;
}

export function TryItPanel({ endpoint }: TryItPanelProps) {
  const [corpusId, setCorpusId] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"semantic" | "keyword" | "hybrid">("semantic");
  const [limit, setLimit] = useState("10");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canExecute = endpoint.id === "search" && corpusId && query;

  const handleExecute = async () => {
    if (!canExecute) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await searchKnowledge(corpusId, {
        query,
        mode,
        limit: parseInt(limit, 10) || 10,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (endpoint.id !== "search") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          交互式调用目前仅支持 Search API。其他端点请参考代码示例。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          交互式调用
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          填写参数后点击执行，直接调用 Knowledge Search API
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Corpus ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={corpusId}
              onChange={(e) => setCorpusId(e.target.value)}
              placeholder="输入语料库 ID (UUID)"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              查询文本 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入搜索查询"
              rows={2}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                搜索模式
              </label>
              <select
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as "semantic" | "keyword" | "hybrid")
                }
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="semantic">语义检索</option>
                <option value="keyword">关键词检索</option>
                <option value="hybrid">混合检索</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                返回数量
              </label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                min={1}
                max={100}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <button
            onClick={handleExecute}
            disabled={!canExecute || loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                执行中...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                执行
              </>
            )}
          </button>
        </div>
      </div>

      {/* Result */}
      {(result || error) && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            响应结果
          </h4>
          <div className="mt-3">
            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400">
                {error}
              </div>
            ) : result ? (
              <div className="max-h-80 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                <JsonViewer data={result} />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
