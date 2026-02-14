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
