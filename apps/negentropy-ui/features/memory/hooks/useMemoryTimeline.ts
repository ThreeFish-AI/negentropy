/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
/**
 * Memory Timeline Hook
 *
 * 提供记忆时间线的数据获取与搜索能力
 * 遵循 AGENTS.md 原则：单一职责、状态下沉、复用驱动
 */

import { useCallback, useEffect, useState } from "react";
import {
  MemoryListPayload,
  MemorySearchResult,
  fetchMemories,
  searchMemories,
} from "../utils/memory-api";

export interface UseMemoryTimelineOptions {
  appName?: string;
  userId?: string;
  limit?: number;
}

export interface UseMemoryTimelineReturnValue {
  payload: MemoryListPayload | null;
  searchResult: MemorySearchResult | null;
  isLoading: boolean;
  error: Error | null;
  selectedUserId: string | null;
  setSelectedUserId: (userId: string | null) => void;
  reload: () => Promise<void>;
  search: (userId: string, query: string) => Promise<void>;
  clearSearch: () => void;
}

export function useMemoryTimeline(
  options: UseMemoryTimelineOptions = {},
): UseMemoryTimelineReturnValue {
  const { appName, userId: initialUserId, limit } = options;

  const [payload, setPayload] = useState<MemoryListPayload | null>(null);
  const [searchResult, setSearchResult] = useState<MemorySearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialUserId || null,
  );

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMemories(appName, selectedUserId || undefined, limit);
      setPayload(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [appName, selectedUserId, limit]);

  const search = useCallback(
    async (userId: string, query: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await searchMemories({
          app_name: appName,
          user_id: userId,
          query,
        });
        setSearchResult(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [appName],
  );

  const clearSearch = useCallback(() => {
    setSearchResult(null);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    payload,
    searchResult,
    isLoading,
    error,
    selectedUserId,
    setSelectedUserId,
    reload,
    search,
    clearSearch,
  };
}
