import { usePaperStore, useUIStore } from "@/store";
import type { Paper, PaperCategory, PaperStatus, SortOrder } from "@/types";
import React, { useMemo, useState } from "react";
import PaperCard from "./PaperCard";

interface PaperListProps {
  papers?: any[];
  onPaperSelect?: (id: string) => void;
  onPaperProcess?: (id: string, workflow: string) => void;
  onPaperDelete?: (id: string) => void;
  onUploadNew?: () => void;
  className?: string;
}

const categories: { value: PaperCategory | "all"; label: string }[] = [
  { value: "all", label: "全部分类" },
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

const statuses: { value: PaperStatus | "all"; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "uploaded", label: "已上传" },
  { value: "processing", label: "处理中" },
  { value: "translated", label: "已翻译" },
  { value: "analyzed", label: "已分析" },
  { value: "failed", label: "失败" },
];

const sortOptions = [
  { value: "uploadedAt", label: "上传时间" },
  { value: "updatedAt", label: "更新时间" },
  { value: "title", label: "标题" },
];

export function PaperList({
  papers: externalPapers,
  onPaperSelect,
  onPaperProcess,
  onPaperDelete,
  onUploadNew,
  className = "",
}: PaperListProps) {
  const {
    papers: storePapers,
    filters,
    selectedPapers,
    loading,
    error,
    setFilters,
    selectAllPapers,
    clearPaperSelection,
    fetchPapers,
    batchProcessPapers,
    batchDeletePapers,
    pagination,
  } = usePaperStore();

  const { addNotification, setModal } = useUIStore();

  // Use external papers if provided, otherwise use store papers
  const papers = externalPapers || storePapers;

  // Local state for filters
  const [searchQuery, setSearchQuery] = useState(filters.search || "");
  const [categoryFilter, setCategoryFilter] = useState(
    filters.category || "all",
  );
  const [statusFilter, setStatusFilter] = useState(filters.status || "all");
  const [sortBy, setSortBy] = useState(filters.sortBy || "uploadedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    filters.sortOrder || "desc",
  );

  // Filtered and sorted papers
  const filteredPapers = useMemo(() => {
    let filtered = papers.filter((paper) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const title = paper.title.toLowerCase();
        const authors = paper.authors.join(" ").toLowerCase();
        const abstract = (paper.abstract || "").toLowerCase();
        const translatedTitle = (paper.translation?.title || "").toLowerCase();
        const translatedAbstract = (
          paper.translation?.abstract || ""
        ).toLowerCase();

        if (
          !title.includes(query) &&
          !translatedTitle.includes(query) &&
          !authors.includes(query) &&
          !abstract.includes(query) &&
          !translatedAbstract.includes(query)
        ) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== "all" && paper.category !== categoryFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && paper.status !== statusFilter) {
        return false;
      }

      return true;
    });

    // Sort papers
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof Paper];
      let bValue: any = b[sortBy as keyof Paper];

      // For translated title sort, use translated title if available
      if (sortBy === "title" && a.translation?.title) {
        aValue = a.translation.title;
      }
      if (sortBy === "title" && b.translation?.title) {
        bValue = b.translation.title;
      }

      // Handle string comparison
      if (typeof aValue === "string" && typeof bValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      // Handle date comparison
      if (aValue instanceof Date || bValue instanceof Date) {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [papers, searchQuery, categoryFilter, statusFilter, sortBy, sortOrder]);

  // Update filters when they change
  React.useEffect(() => {
    const newFilters = {
      search: searchQuery,
      category: categoryFilter,
      status: statusFilter,
      sortBy,
      sortOrder,
    };

    // Only update if filters actually changed
    const hasChanged = Object.keys(newFilters).some(
      (key) =>
        newFilters[key as keyof typeof newFilters] !==
        filters[key as keyof typeof filters],
    );

    if (hasChanged) {
      setFilters(newFilters);
      fetchPapers();
    }
  }, [
    searchQuery,
    categoryFilter,
    statusFilter,
    sortBy,
    sortOrder,
    setFilters,
    filters,
    fetchPapers,
  ]);

  // Handle bulk actions
  const handleSelectAll = () => {
    if (selectedPapers.length === filteredPapers.length) {
      clearPaperSelection();
    } else {
      selectAllPapers();
    }
  };

  const handleBulkProcess = async (workflow: string) => {
    if (selectedPapers.length === 0) {
      addNotification({
        type: "warning",
        title: "提示",
        message: "请先选择要处理的论文",
        duration: 3000,
      });
      return;
    }

    try {
      const workflowLabel =
        workflow === "translate"
          ? "翻译"
          : workflow === "analyze"
            ? "分析"
            : "建立索引";

      await batchProcessPapers(selectedPapers, workflow);
      addNotification({
        type: "success",
        title: "批量处理已启动",
        message: `已提交 ${selectedPapers.length} 篇论文进行${workflowLabel}`,
        duration: 5000,
      });
      clearPaperSelection();
    } catch (error) {
      addNotification({
        type: "error",
        title: "批量处理失败",
        message: error instanceof Error ? error.message : "未知错误",
        duration: 5000,
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPapers.length === 0) {
      addNotification({
        type: "warning",
        title: "提示",
        message: "请先选择要删除的论文",
        duration: 3000,
      });
      return;
    }

    if (
      window.confirm(
        `确定要删除选中的 ${selectedPapers.length} 篇论文吗？此操作不可恢复。`,
      )
    ) {
      try {
        await batchDeletePapers(selectedPapers);
        addNotification({
          type: "success",
          title: "删除成功",
          message: `已删除 ${selectedPapers.length} 篇论文`,
          duration: 5000,
        });
        clearPaperSelection();
      } catch (error) {
        addNotification({
          type: "error",
          title: "删除失败",
          message: error instanceof Error ? error.message : "未知错误",
          duration: 5000,
        });
      }
    }
  };

  const openUploadModal = () => {
    setModal("uploadPaper", true);
    onUploadNew?.();
  };

  return (
    <div
      className={`paper-list ${className}`}
      role="region"
      aria-label="论文列表"
    >
      {/* Filters and Actions */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <input
              type="text"
              data-testid="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索论文标题、作者或摘要..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
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
          <button
            onClick={openUploadModal}
            aria-label="上传论文"
            className="inline-flex items-center rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            上传论文
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            data-testid="status-filter"
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          {/* Sort Controls */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                按{option.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="rounded-md border border-gray-300 px-3 py-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {sortOrder === "asc" ? "升序" : "降序"}
          </button>

          {/* Result Count */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            共 {filteredPapers.length} 篇论文
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedPapers.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-blue-800 dark:text-blue-200">
                已选择 {selectedPapers.length} 篇论文
              </span>
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {selectedPapers.length === filteredPapers.length
                  ? "取消全选"
                  : "全选当前页"}
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkProcess("translate")}
                className="rounded border border-blue-300 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-blue-100 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-blue-900/30"
              >
                批量翻译
              </button>
              <button
                onClick={() => handleBulkProcess("analyze")}
                className="rounded border border-blue-300 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-blue-100 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-blue-900/30"
              >
                批量分析
              </button>
              <button
                onClick={() => handleBulkProcess("index")}
                className="rounded border border-blue-300 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-blue-100 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-blue-900/30"
              >
                批量建立索引
              </button>
              <button
                onClick={handleBulkDelete}
                className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
              >
                批量删除
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Paper Grid */}
      {loading ? (
        <div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          data-testid="loading-spinner"
        >
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-64 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-12 text-center">
          <p className="text-red-600 dark:text-red-400">加载失败: {error}</p>
          <button
            onClick={() => fetchPapers()}
            className="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            重试
          </button>
        </div>
      ) : filteredPapers.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400">没有找到匹配的论文</p>
          <button
            onClick={openUploadModal}
            className="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            上传第一篇论文
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPapers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              onSelect={onPaperSelect}
              onProcess={onPaperProcess}
              onDelete={onPaperDelete}
            />
          ))}
        </div>
      )}
      {/* Pagination */}
      {storePapers.length > 0 && (
        <div
          className="mt-8 flex items-center justify-center space-x-4"
          data-testid="pagination"
        >
          <button
            onClick={() =>
              fetchPapers({ page: Math.max(1, pagination.page - 1) })
            }
            disabled={pagination.page <= 1}
            aria-label="Previous page"
            className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            上一页
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            第 {pagination.page} 页
          </span>
          <button
            onClick={() => fetchPapers({ page: pagination.page + 1 })}
            disabled={pagination.page >= pagination.totalPages}
            aria-label="Next page"
            className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}

export default PaperList;
