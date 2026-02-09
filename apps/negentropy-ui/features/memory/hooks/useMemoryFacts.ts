/**
 * Memory Facts Hook
 *
 * 提供语义记忆 (Facts) 的数据获取与搜索能力
 * 遵循 AGENTS.md 原则：单一职责、状态下沉、复用驱动
 */

import { useCallback, useEffect, useState } from "react";
import {
  FactListPayload,
  fetchFacts,
  searchFacts,
} from "../utils/memory-api";

export interface UseMemoryFactsOptions {
  appName?: string;
  userId: string;
  factType?: string;
  limit?: number;
}

export interface UseMemoryFactsReturnValue {
  payload: FactListPayload | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
}

export function useMemoryFacts(
  options: UseMemoryFactsOptions,
): UseMemoryFactsReturnValue {
  const { appName, userId, factType, limit } = options;

  const [payload, setPayload] = useState<FactListPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchFacts(userId, appName, factType, limit);
      setPayload(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [appName, userId, factType, limit]);

  const search = useCallback(
    async (query: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await searchFacts({
          app_name: appName,
          user_id: userId,
          query,
          limit,
        });
        setPayload(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [appName, userId, limit],
  );

  const clearSearch = useCallback(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    payload,
    isLoading,
    error,
    reload,
    search,
    clearSearch,
  };
}
