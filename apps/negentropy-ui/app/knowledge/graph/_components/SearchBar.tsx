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
        className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-blue-500 focus:outline-none"
      />
      <button
        onClick={handleSearch}
        disabled={searching || !query.trim()}
        className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-40"
      >
        {searching ? "搜索中..." : "搜索"}
      </button>
      {query && (
        <button
          onClick={() => {
            setQuery("");
            onClear();
          }}
          className="text-xs text-text-muted hover:text-foreground"
        >
          清除
        </button>
      )}
    </div>
  );
}
