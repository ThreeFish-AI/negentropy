import type { PaperCategory, PaperStatus, SearchResult } from "@/types";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import Link from "next/link";
import React from "react";

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  total: number;
  loading?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  hasMore?: boolean;
  className?: string;
}

const categoryLabels: Record<PaperCategory, string> = {
  "llm-agents": "LLM Agents",
  "context-engineering": "Context Engineering",
  reasoning: "Reasoning",
  "tool-use": "Tool Use",
  planning: "Planning",
  memory: "Memory",
  "multi-agent": "Multi-Agent",
  evaluation: "Evaluation",
  other: "其他",
};

const statusLabels: Record<PaperStatus, string> = {
  uploaded: "已上传",
  processing: "处理中",
  translated: "已翻译",
  analyzed: "已分析",
  failed: "失败",
  deleted: "已删除",
};

// Component to highlight search terms in text
const HighlightText: React.FC<{ text: string; highlight: string }> = ({
  text,
  highlight,
}) => {
  if (!highlight) return <span>{text}</span>;

  const parts = text.split(new RegExp(`(${highlight})`, "gi"));

  return (
    <span>
      {parts.map((part, index) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark
            key={index}
            className="rounded bg-yellow-200 px-1 dark:bg-yellow-800"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  );
};

export function SearchResults({
  results,
  query,
  total,
  loading = false,
  error = null,
  onLoadMore,
  hasMore = false,
  className = "",
}: SearchResultsProps) {
  if (loading && results.length === 0) {
    return (
      <div className={`search-results ${className}`}>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg bg-white p-6 dark:bg-gray-800"
            >
              <div className="space-y-3">
                <div className="h-6 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`search-results ${className}`}>
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <svg
              className="h-12 w-12 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="mb-4 text-red-600 dark:text-red-400">
            搜索失败: {error}
          </p>
        </div>
      </div>
    );
  }

  if (results.length === 0 && query) {
    return (
      <div className={`search-results ${className}`}>
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <svg
              className="h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="mb-2 text-gray-500 dark:text-gray-400">
            没有找到与 &quot;{query}&quot; 相关的论文
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            尝试使用不同的关键词或调整筛选条件
          </p>
        </div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className={`search-results ${className}`}>
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <svg
              className="h-12 w-12 text-gray-400"
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
          <p className="text-gray-500 dark:text-gray-400">
            输入关键词开始搜索论文
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`search-results ${className}`}>
      {/* Results Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          找到{" "}
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {total}
          </span>{" "}
          篇相关论文
        </div>
        {hasMore && onLoadMore && (
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {loading ? "加载中..." : "加载更多"}
          </button>
        )}
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {results.map((result) => {
          const paper = result.paper;
          const highlights = result.highlights;

          return (
            <div
              key={paper.id}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              {/* Title */}
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                <Link
                  href={`/papers/${paper.id}`}
                  className="transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <HighlightText
                    text={paper.translation?.title || paper.title}
                    highlight={query}
                  />
                </Link>
              </h3>

              {/* Authors and Metadata */}
              <div className="mb-3 flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                <span>{paper.authors.slice(0, 3).join(", ")}</span>
                {paper.authors.length > 3 && (
                  <span>等 {paper.authors.length} 位作者</span>
                )}
                <span>•</span>
                <span>
                  {format(new Date(paper.uploadedAt), "yyyy-MM-dd", {
                    locale: zhCN,
                  })}
                </span>
                <span>•</span>
                <span>{(paper.fileSize / 1024 / 1024).toFixed(2)} MB</span>
              </div>

              {/* Category and Status */}
              <div className="mb-3 flex items-center space-x-2">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                  {categoryLabels[paper.category]}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${paper.status === "translated" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : ""} ${paper.status === "processing" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : ""} ${paper.status === "analyzed" ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" : ""} ${paper.status === "uploaded" ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200" : ""} `}
                >
                  {statusLabels[paper.status]}
                </span>
              </div>

              {/* Highlighted Content */}
              {(highlights.abstract ||
                highlights.title ||
                highlights.content) && (
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  {highlights.title && (
                    <div>
                      <span className="font-medium">标题: </span>
                      <HighlightText
                        text={highlights.title.join("...")}
                        highlight={query}
                      />
                    </div>
                  )}
                  {highlights.abstract && (
                    <div>
                      <span className="font-medium">摘要: </span>
                      <HighlightText
                        text={highlights.abstract.join("...")}
                        highlight={query}
                      />
                    </div>
                  )}
                  {highlights.content && (
                    <div>
                      <span className="font-medium">内容: </span>
                      <HighlightText
                        text={highlights.content.join("...")}
                        highlight={query}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Score */}
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-500">
                相关度: {Math.round(result.score * 100)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More Button */}
      {hasMore && onLoadMore && (
        <div className="mt-6 text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
          >
            {loading && (
              <svg
                className="-ml-1 mr-2 h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {loading ? "加载中..." : "加载更多结果"}
          </button>
        </div>
      )}
    </div>
  );
}

export default SearchResults;
