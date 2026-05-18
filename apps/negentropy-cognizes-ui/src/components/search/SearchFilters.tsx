import React, { useState, useCallback } from "react";
import type { PaperCategory, PaperStatus } from "@/types";

interface SearchFiltersProps {
  categories: PaperCategory[];
  statuses: PaperStatus[];
  onFiltersChange: (filters: {
    categories: PaperCategory[];
    statuses: PaperStatus[];
  }) => void;
  className?: string;
}

const categoryOptions: {
  value: PaperCategory;
  label: string;
  color: string;
}[] = [
  { value: "llm-agents", label: "LLM Agents", color: "blue" },
  {
    value: "context-engineering",
    label: "Context Engineering",
    color: "green",
  },
  { value: "reasoning", label: "Reasoning", color: "purple" },
  { value: "tool-use", label: "Tool Use", color: "yellow" },
  { value: "planning", label: "Planning", color: "pink" },
  { value: "memory", label: "Memory", color: "indigo" },
  { value: "multi-agent", label: "Multi-Agent", color: "orange" },
  { value: "evaluation", label: "Evaluation", color: "red" },
  { value: "other", label: "其他", color: "gray" },
];

const statusOptions: { value: PaperStatus; label: string; color: string }[] = [
  { value: "uploaded", label: "已上传", color: "gray" },
  { value: "processing", label: "处理中", color: "blue" },
  { value: "translated", label: "已翻译", color: "green" },
  { value: "analyzed", label: "已分析", color: "purple" },
  { value: "failed", label: "失败", color: "red" },
  { value: "deleted", label: "已删除", color: "gray" },
];

const getColorClasses = (
  color: string,
  variant: "bg" | "border" | "text" = "bg",
) => {
  const colorMap: Record<string, Record<string, string>> = {
    bg: {
      blue: "bg-blue-100 dark:bg-blue-900",
      green: "bg-green-100 dark:bg-green-900",
      purple: "bg-purple-100 dark:bg-purple-900",
      yellow: "bg-yellow-100 dark:bg-yellow-900",
      pink: "bg-pink-100 dark:bg-pink-900",
      indigo: "bg-indigo-100 dark:bg-indigo-900",
      orange: "bg-orange-100 dark:bg-orange-900",
      red: "bg-red-100 dark:bg-red-900",
      gray: "bg-gray-100 dark:bg-gray-800",
    },
    border: {
      blue: "border-blue-300 dark:border-blue-700",
      green: "border-green-300 dark:border-green-700",
      purple: "border-purple-300 dark:border-purple-700",
      yellow: "border-yellow-300 dark:border-yellow-700",
      pink: "border-pink-300 dark:border-pink-700",
      indigo: "border-indigo-300 dark:border-indigo-700",
      orange: "border-orange-300 dark:border-orange-700",
      red: "border-red-300 dark:border-red-700",
      gray: "border-gray-300 dark:border-gray-600",
    },
    text: {
      blue: "text-blue-800 dark:text-blue-200",
      green: "text-green-800 dark:text-green-200",
      purple: "text-purple-800 dark:text-purple-200",
      yellow: "text-yellow-800 dark:text-yellow-200",
      pink: "text-pink-800 dark:text-pink-200",
      indigo: "text-indigo-800 dark:text-indigo-200",
      orange: "text-orange-800 dark:text-orange-200",
      red: "text-red-800 dark:text-red-200",
      gray: "text-gray-800 dark:text-gray-200",
    },
  };
  return colorMap[variant][color] || colorMap[variant].gray;
};

export function SearchFilters({
  categories,
  statuses,
  onFiltersChange,
  className = "",
}: SearchFiltersProps) {
  const [activeTab, setActiveTab] = useState<"category" | "status">("category");

  const handleCategoryToggle = useCallback(
    (category: PaperCategory) => {
      const newCategories = categories.includes(category)
        ? categories.filter((c) => c !== category)
        : [...categories, category];

      onFiltersChange({
        categories: newCategories,
        statuses,
      });
    },
    [categories, statuses, onFiltersChange],
  );

  const handleStatusToggle = useCallback(
    (status: PaperStatus) => {
      const newStatuses = statuses.includes(status)
        ? statuses.filter((s) => s !== status)
        : [...statuses, status];

      onFiltersChange({
        categories,
        statuses: newStatuses,
      });
    },
    [categories, statuses, onFiltersChange],
  );

  const handleClearAll = useCallback(() => {
    onFiltersChange({
      categories: [],
      statuses: [],
    });
  }, [onFiltersChange]);

  const handleSelectAll = useCallback(() => {
    if (activeTab === "category") {
      onFiltersChange({
        categories: categoryOptions.map((opt) => opt.value),
        statuses,
      });
    } else {
      onFiltersChange({
        categories,
        statuses: statusOptions.map((opt) => opt.value),
      });
    }
  }, [activeTab, categories, statuses, onFiltersChange]);

  const hasActiveFilters = categories.length > 0 || statuses.length > 0;

  return (
    <div className={`search-filters ${className}`}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          筛选器
        </h3>
        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            清除全部
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("category")}
            className={`border-b-2 px-1 py-2 text-sm font-medium ${
              activeTab === "category"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            } `}
          >
            分类
            {categories.length > 0 && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                {categories.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("status")}
            className={`border-b-2 px-1 py-2 text-sm font-medium ${
              activeTab === "status"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            } `}
          >
            状态
            {statuses.length > 0 && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                {statuses.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Quick Actions */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {activeTab === "category" ? "选择论文分类" : "选择论文状态"}
        </span>
        <button
          onClick={handleSelectAll}
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          全选
        </button>
      </div>

      {/* Category Filters */}
      {activeTab === "category" && (
        <div className="space-y-2">
          {categoryOptions.map((option) => {
            const isSelected = categories.includes(option.value);
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                  isSelected
                    ? `${getColorClasses(option.color, "bg")} ${getColorClasses(option.color, "border")}`
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                } `}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleCategoryToggle(option.value)}
                  className="sr-only"
                />
                <div
                  className={`mr-3 flex h-4 w-4 items-center justify-center rounded border-2 ${
                    isSelected
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 dark:border-gray-600"
                  } `}
                >
                  {isSelected && (
                    <svg
                      className="h-3 w-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div
                    className={`font-medium ${isSelected ? getColorClasses(option.color, "text") : "text-gray-700 dark:text-gray-300"}`}
                  >
                    {option.label}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* Status Filters */}
      {activeTab === "status" && (
        <div className="space-y-2">
          {statusOptions.map((option) => {
            const isSelected = statuses.includes(option.value);
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                  isSelected
                    ? `${getColorClasses(option.color, "bg")} ${getColorClasses(option.color, "border")}`
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                } `}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleStatusToggle(option.value)}
                  className="sr-only"
                />
                <div
                  className={`mr-3 flex h-4 w-4 items-center justify-center rounded border-2 ${
                    isSelected
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 dark:border-gray-600"
                  } `}
                >
                  {isSelected && (
                    <svg
                      className="h-3 w-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div
                    className={`font-medium ${isSelected ? getColorClasses(option.color, "text") : "text-gray-700 dark:text-gray-300"}`}
                  >
                    {option.label}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
          <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            当前筛选
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const option = categoryOptions.find(
                (opt) => opt.value === category,
              );
              return option ? (
                <span
                  key={category}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getColorClasses(option.color, "bg")} ${getColorClasses(option.color, "text")} `}
                >
                  {option.label}
                  <button
                    onClick={() => handleCategoryToggle(category)}
                    className="ml-1 hover:opacity-70"
                  >
                    <svg
                      className="h-3 w-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </span>
              ) : null;
            })}
            {statuses.map((status) => {
              const option = statusOptions.find((opt) => opt.value === status);
              return option ? (
                <span
                  key={status}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getColorClasses(option.color, "bg")} ${getColorClasses(option.color, "text")} `}
                >
                  {option.label}
                  <button
                    onClick={() => handleStatusToggle(status)}
                    className="ml-1 hover:opacity-70"
                  >
                    <svg
                      className="h-3 w-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchFilters;
