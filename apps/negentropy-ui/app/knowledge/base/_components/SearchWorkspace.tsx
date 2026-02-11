"use client";

import { useMemo, useState } from "react";
import { useKnowledgeSearch, type SearchMode } from "@/features/knowledge";

interface SearchWorkspaceProps {
  corpusId: string;
  appName: string;
}

export function SearchWorkspace({ corpusId, appName }: SearchWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("hybrid");

  const searchConfig = useMemo(() => ({ mode, limit: 10 }), [mode]);

  const { results, isSearching, error, search } = useKnowledgeSearch({
    corpusId,
    appName,
    defaultConfig: searchConfig,
  });

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      await search(query);
    } catch {
      // error handled by hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      handleSearch();
    }
  };

  const matches = results?.items ?? [];

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Search</h2>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded border border-zinc-200 px-3 py-1.5 text-xs"
            placeholder="Search query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="rounded bg-black px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            disabled={isSearching || !query.trim()}
            onClick={handleSearch}
          >
            {isSearching ? "搜索中…" : "Search"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          {(["semantic", "keyword", "hybrid"] as const).map((option) => (
            <button
              key={option}
              className={`rounded-full border px-3 py-1 ${
                mode === option
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
              }`}
              onClick={() => setMode(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {isSearching && (
          <div className="mt-3 h-0.5 overflow-hidden rounded bg-zinc-100">
            <div className="h-full w-1/3 animate-pulse rounded bg-zinc-400" />
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error instanceof Error ? error.message : String(error)}
          </div>
        )}
      </div>

      {/* Search results */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">检索结果</h2>
        {matches.length > 0 ? (
          <div className="custom-scrollbar mt-3 max-h-[calc(100vh-24rem)] space-y-3 overflow-y-auto pr-1">
            {matches.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-zinc-200 p-3 text-xs"
              >
                <p className="text-zinc-900">{item.content}</p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
                  <span>{item.source_uri || "-"}</span>
                  <span>score: {(item.combined_score ?? 0).toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">
            {results ? "无匹配结果" : "输入关键词开始搜索"}
          </p>
        )}
      </div>
    </div>
  );
}
