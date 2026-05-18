"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSearch } from "@/hooks/useApi";
import SearchForm from "@/components/search/SearchForm";
import SearchResults from "@/components/search/SearchResults";
import SearchFilters from "@/components/search/SearchFilters";
import type { PaperCategory, PaperStatus } from "@/types";

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<{
    categories: PaperCategory[];
    statuses: PaperStatus[];
  }>({
    categories: [],
    statuses: [],
  });
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Build search params for API
  const searchParams = React.useMemo(() => {
    const params: any = {
      q: query,
      page,
      limit: pageSize,
    };

    if (filters.categories.length > 0) {
      params.category = filters.categories.join(",");
    }

    if (filters.statuses.length > 0) {
      params.status = filters.statuses.join(",");
    }

    return params;
  }, [query, filters.categories, filters.statuses, page]);

  // Fetch search results
  const {
    data: searchResults,
    error,
    isLoading,
    mutate,
  } = useSearch(query, {
    category: filters.categories.join(","),
    status: filters.statuses.join(","),
  });

  // Handle search submission
  const handleSearch = useCallback((newQuery: string, newFilters: any) => {
    setQuery(newQuery);
    setPage(1);

    // Update filters
    const updatedFilters = {
      categories: newFilters.category ? [newFilters.category] : [],
      statuses: newFilters.status ? [newFilters.status] : [],
    };
    setFilters(updatedFilters);
  }, []);

  // Handle filters change
  const handleFiltersChange = useCallback(
    (newFilters: { categories: PaperCategory[]; statuses: PaperStatus[] }) => {
      setFilters(newFilters);
      setPage(1);
      // Re-trigger search
      if (query) {
        mutate();
      }
    },
    [query, mutate],
  );

  // Handle load more
  const handleLoadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  // Handle result click
  const handleResultClick = useCallback(
    (paperId: string) => {
      router.push(`/papers/${paperId}`);
    },
    [router],
  );

  // Extract results and pagination info
  const results = searchResults?.items || [];
  const total = searchResults?.total || 0;
  const hasMore = page * pageSize < total;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          搜索论文
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          在论文库中查找相关内容
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <SearchFilters
              categories={filters.categories}
              statuses={filters.statuses}
              onFiltersChange={handleFiltersChange}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Search Form */}
          <div className="mb-8">
            <SearchForm
              onSearch={handleSearch}
              loading={isLoading}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            />
          </div>

          {/* Search Results */}
          <SearchResults
            results={results}
            query={query}
            total={total}
            loading={isLoading}
            error={error}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
          />
        </div>
      </div>

      {/* Search Tips */}
      {query && results.length === 0 && !isLoading && !error && (
        <div className="mt-12 rounded-lg bg-blue-50 p-6 dark:bg-blue-900/20">
          <h3 className="mb-4 text-lg font-semibold text-blue-900 dark:text-blue-100">
            搜索技巧
          </h3>
          <ul className="space-y-2 text-blue-800 dark:text-blue-200">
            <li>• 使用中文或英文关键词搜索</li>
            <li>• 尝试不同的同义词或相关术语</li>
            <li>• 使用左侧筛选器缩小搜索范围</li>
            <li>• 搜索作者姓名可以找到该作者的所有论文</li>
            <li>• 搜索特定的概念或技术术语</li>
          </ul>
        </div>
      )}
    </div>
  );
}
