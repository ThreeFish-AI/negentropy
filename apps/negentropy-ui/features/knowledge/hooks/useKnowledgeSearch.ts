/**
 * 知识库搜索 Hook
 *
 * 提供知识库搜索功能的封装
 * 遵循 AGENTS.md 原则：单一职责、状态下沉、复用驱动
 *
 * 参考文献:
 * [1] Y. Wang et al., "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods,"
 *     SIGIR'18, 2018.
 */

import { useCallback, useState } from "react";
import {
  SearchResults,
  SearchConfig,
  searchKnowledge,
  KnowledgeError,
} from "../index";

// ============================================================================
// Types
// ============================================================================

/**
 * useKnowledgeSearch Hook 参数
 */
export interface UseKnowledgeSearchOptions {
  /** 语料库 ID */
  corpusId: string;
  /** 应用名称 */
  appName?: string;
  /** 默认搜索配置 */
  defaultConfig?: SearchConfig;
  /** 错误回调 */
  onError?: (error: KnowledgeError) => void;
  /** 成功回调 */
  onSuccess?: (results: SearchResults) => void;
  /** 搜索去抖动延迟（毫秒） */
  debounceMs?: number;
}

/**
 * useKnowledgeSearch Hook 返回值
 */
export interface UseKnowledgeSearchReturnValue {
  /** 搜索结果 */
  results: SearchResults | null;
  /** 是否正在搜索 */
  isSearching: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 执行搜索 */
  search: (query: string, config?: SearchConfig) => Promise<SearchResults>;
  /** 清空结果 */
  clearResults: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  mode: "hybrid",
  limit: 10,
  semantic_weight: 0.7,
  keyword_weight: 0.3,
};

/**
 * 知识库搜索 Hook
 *
 * 提供知识库搜索功能，支持语义、关键词、混合和 RRF 搜索模式
 *
 * @param options - Hook 配置选项
 * @returns Hook 返回值
 *
 * @example
 * ```ts
 * const { results, search, isSearching } = useKnowledgeSearch({
 *   corpusId: "corpus-123",
 *   appName: "my-app",
 *   defaultConfig: { mode: "hybrid", limit: 20 },
 * });
 *
 * // 执行搜索
 * const results = await search("query about something");
 * ```
 */
export function useKnowledgeSearch(
  options: UseKnowledgeSearchOptions,
): UseKnowledgeSearchReturnValue {
  const {
    corpusId,
    appName,
    defaultConfig = DEFAULT_SEARCH_CONFIG,
    onError,
    onSuccess,
    debounceMs = 300,
  } = options;

  // 状态管理
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 执行搜索
  const search = useCallback(async (query: string, config?: SearchConfig) => {
    if (!query.trim()) {
      setResults({ count: 0, items: [] });
      return { count: 0, items: [] };
    }

    setIsSearching(true);
    setError(null);

    try {
      const finalConfig = { ...defaultConfig, ...config };
      const searchResults = await searchKnowledge(corpusId, {
        app_name: appName,
        query,
        mode: finalConfig.mode,
        limit: finalConfig.limit,
        semantic_weight: finalConfig.semantic_weight,
        keyword_weight: finalConfig.keyword_weight,
        metadata_filter: finalConfig.metadata_filter,
      });

      setResults(searchResults);
      onSuccess?.(searchResults);
      return searchResults;
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error as KnowledgeError);
      throw error;
    } finally {
      setIsSearching(false);
    }
  }, [corpusId, appName, defaultConfig, onError, onSuccess]);

  // 清空结果
  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return {
    results,
    isSearching,
    error,
    search,
    clearResults,
  };
}
