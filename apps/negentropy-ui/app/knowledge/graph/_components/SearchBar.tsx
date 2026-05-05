"use client";

import { useCallback, useState } from "react";
import {
  type GraphSearchResultItem,
  searchKnowledgeGraph,
} from "@/features/knowledge";

interface SearchBarProps {
  corpusId: string;
  onResults: (results: GraphSearchResultItem[]) => void;
  onClear: () => void;
}

export function SearchBar({ corpusId, onResults, onClear }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      onClear();
      return;
    }
    setSearching(true);
    try {
      const data = await searchKnowledgeGraph(corpusId, {
        query: query.trim(),
        mode: "hybrid",
        limit: 20,
        include_neighbors: true,
      });
      onResults(data.items);
    } catch (err) {
      console.error(err);
      onClear();
    } finally {
      setSearching(false);
    }
  }, [corpusId, query, onResults, onClear]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSearch();
        }}
        placeholder="搜索实体（Enter 执行）"
        className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />
      <button
        onClick={handleSearch}
        disabled={searching || !query.trim()}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {searching ? "搜索中..." : "搜索"}
      </button>
      {query && (
        <button
          onClick={() => {
            setQuery("");
            onClear();
          }}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          清除
        </button>
      )}
    </div>
  );
}
