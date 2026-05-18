import React, { useState, useEffect, useCallback } from "react";
import { useSearchHistory } from "@/hooks/useLocalStorage";
import type { PaperCategory, PaperStatus } from "@/types";

interface SearchFormProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  loading?: boolean;
  className?: string;
}

interface SearchFilters {
  category?: PaperCategory;
  status?: PaperStatus;
  dateFrom?: string;
  dateTo?: string;
  author?: string;
}

const categories: { value: PaperCategory | ""; label: string }[] = [
  { value: "", label: "全部分类" },
  { value: "llm-agents", label: "LLM Agents" },
  { value: "context-engineering", label: "Context Engineering" },
  { value: "reasoning", label: "Reasoning" },
  { value: "tool-use", label: "Tool Use" },
  { value: "planning", label: "Planning" },
  { value: "memory", label: "Memory" },
  { value: "multi-agent", label: "Multi-Agent" },
  { value: "evaluation", label: "Evaluation" },
  { value: "other", label: "其他" },
];

const statuses: { value: PaperStatus | ""; label: string }[] = [
  { value: "", label: "全部状态" },
  { value: "uploaded", label: "已上传" },
  { value: "processing", label: "处理中" },
  { value: "translated", label: "已翻译" },
  { value: "analyzed", label: "已分析" },
  { value: "failed", label: "失败" },
];

export function SearchForm({
  onSearch,
  loading = false,
  className = "",
}: SearchFormProps) {
  const [query, setQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});

  const { history, addToHistory } = useSearchHistory();

  // Filter history based on current input
  const filteredHistory = history.filter((item) =>
    item.toLowerCase().includes(query.toLowerCase()),
  );

  // Handle search submission
  const handleSearch = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!query.trim()) return;

      addToHistory(query);
      setShowSuggestions(false);
      onSearch(query, filters);
    },
    [query, filters, onSearch, addToHistory],
  );

  // Handle history item click
  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setShowSuggestions(false);
    addToHistory(historyQuery);
    onSearch(historyQuery, filters);
  };

  // Handle filter change
  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({});
  };

  // Handle key press in suggestions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // Auto-hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== "",
  );

  return (
    <div className={`search-form ${className}`}>
      <form onSubmit={handleSearch} className="space-y-4">
        {/* Main Search Bar */}
        <div className="relative">
          <div className="relative">
            {/* Search Icon */}
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Search Input */}
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
              }}
              onFocus={() => setShowSuggestions(query.length > 0)}
              onKeyDown={handleKeyDown}
              placeholder="搜索论文标题、作者、摘要、关键词..."
              className="block w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-12 leading-5 placeholder-gray-500 focus:border-blue-500 focus:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
            />

            {/* Clear Button */}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setShowSuggestions(false);
                }}
                className="absolute inset-y-0 right-0 flex items-center pr-10"
              >
                <svg
                  className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}

            {/* Search Button */}
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute inset-y-0 right-0 flex items-center pr-3"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin">
                  <svg
                    className="text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              ) : (
                <svg
                  className="h-5 w-5 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Search Suggestions */}
          {showSuggestions && filteredHistory.length > 0 && (
            <div
              className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="py-1">
                <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  搜索历史
                </div>
                {filteredHistory.slice(0, 5).map((historyQuery, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleHistoryClick(historyQuery)}
                    className="flex w-full items-center px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <svg
                      className="mr-2 h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {historyQuery}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Advanced Search Toggle */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {showAdvanced ? "隐藏" : "显示"}高级搜索
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              清除筛选
            </button>
          )}
        </div>

        {/* Advanced Search Filters */}
        {showAdvanced && (
          <div className="space-y-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Category Filter */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  分类
                </label>
                <select
                  value={filters.category || ""}
                  onChange={(e) =>
                    handleFilterChange("category", e.target.value || undefined)
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  状态
                </label>
                <select
                  value={filters.status || ""}
                  onChange={(e) =>
                    handleFilterChange("status", e.target.value || undefined)
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  {statuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From Filter */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  开始日期
                </label>
                <input
                  type="date"
                  value={filters.dateFrom || ""}
                  onChange={(e) =>
                    handleFilterChange("dateFrom", e.target.value || undefined)
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              {/* Date To Filter */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  结束日期
                </label>
                <input
                  type="date"
                  value={filters.dateTo || ""}
                  onChange={(e) =>
                    handleFilterChange("dateTo", e.target.value || undefined)
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Author Filter */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                作者
              </label>
              <input
                type="text"
                value={filters.author || ""}
                onChange={(e) =>
                  handleFilterChange("author", e.target.value || undefined)
                }
                placeholder="输入作者姓名..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
              />
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export default SearchForm;
