"use client";

import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { useKnowledgeSearch, type SearchMode } from "@/features/knowledge";

interface SearchWorkspaceProps {
  corpusId: string;
  appName: string;
}

export interface SearchWorkspaceRef {
  clearResults: () => void;
}

export const SearchWorkspace = forwardRef<SearchWorkspaceRef, SearchWorkspaceProps>(
  function SearchWorkspace({ corpusId, appName }, ref) {
    const [query, setQuery] = useState("");
    const [mode, setMode] = useState<SearchMode>("hybrid");

    const searchConfig = useMemo(() => ({ mode, limit: 10 }), [mode]);

    const { results, isSearching, error, search, clearResults } = useKnowledgeSearch({
      corpusId,
      appName,
      defaultConfig: searchConfig,
    });

    useImperativeHandle(
      ref,
      () => ({
        clearResults: () => clearResults(),
      }),
      [clearResults],
    );

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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Search bar */}
      <div className="shrink-0 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-card-foreground">Search</h2>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder-muted"
            placeholder="Search query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            disabled={isSearching || !query.trim()}
            onClick={handleSearch}
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>
        <div className="mt-2 flex w-fit items-center gap-1 rounded-full bg-zinc-100/50 p-1 dark:bg-zinc-800/50">
          {(["semantic", "keyword", "hybrid"] as const).map((option) => (
            <button
              key={option}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                mode === option
                  ? "bg-foreground text-background shadow-sm ring-1 ring-border"
                  : "text-muted hover:text-foreground"
              }`}
              onClick={() => setMode(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {isSearching && (
          <div className="mt-3 h-0.5 overflow-hidden rounded bg-secondary">
            <div className="h-full w-1/3 animate-pulse rounded bg-secondary-foreground/20" />
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-lg border border-error/50 bg-error/10 p-3 text-xs text-error">
            {error instanceof Error ? error.message : String(error)}
          </div>
        )}
      </div>

      {/* Search results */}
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="shrink-0 text-sm font-semibold text-card-foreground">检索结果</h2>
        {matches.length > 0 ? (
          <div className="custom-scrollbar mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 pb-2">
            {matches.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-card p-3 text-xs"
              >
                <p className="text-card-foreground">{item.content}</p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
                  <span>{item.source_uri || "-"}</span>
                  <span>score: {(item.combined_score ?? 0).toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">
            {results ? "无匹配结果" : "输入关键词开始搜索"}
          </p>
        )}
      </div>
    </div>
  );
  },
);
