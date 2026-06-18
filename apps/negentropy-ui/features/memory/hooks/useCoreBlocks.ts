/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
/**
 * Core Blocks Hook
 *
 * 身份记忆块（persona/human，always-injected）的查询与自身编辑能力。
 * upsert / remove 在成功后自动 reload，使列表与服务端保持一致。
 */

import { useCallback, useEffect, useState } from "react";
import {
  CoreBlockListPayload,
  CoreBlockUpsertResult,
  deleteCoreBlock,
  fetchCoreBlocks,
  upsertCoreBlock,
} from "../utils/memory-api";

export interface UseCoreBlocksOptions {
  appName?: string;
  /** 选中的用户；为空时不拉取（后端 user_id 必填）。 */
  userId: string | null;
}

export interface UseCoreBlocksReturnValue {
  payload: CoreBlockListPayload | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  upsert: (input: {
    scope?: "user" | "app" | "thread";
    thread_id?: string | null;
    label: string;
    content: string;
    metadata?: Record<string, unknown>;
  }) => Promise<CoreBlockUpsertResult>;
  remove: (input: {
    scope?: string;
    thread_id?: string;
    label: string;
  }) => Promise<void>;
}

export function useCoreBlocks(
  options: UseCoreBlocksOptions,
): UseCoreBlocksReturnValue {
  const { appName, userId } = options;

  const [payload, setPayload] = useState<CoreBlockListPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setPayload(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCoreBlocks({ user_id: userId, app_name: appName });
      setPayload(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [appName, userId]);

  const upsert = useCallback<UseCoreBlocksReturnValue["upsert"]>(
    async (input) => {
      if (!userId) throw new Error("No user selected");
      const result = await upsertCoreBlock({
        user_id: userId,
        app_name: appName,
        ...input,
      });
      await reload();
      return result;
    },
    [appName, userId, reload],
  );

  const remove = useCallback<UseCoreBlocksReturnValue["remove"]>(
    async (input) => {
      if (!userId) throw new Error("No user selected");
      await deleteCoreBlock({ user_id: userId, app_name: appName, ...input });
      await reload();
    },
    [appName, userId, reload],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return { payload, isLoading, error, reload, upsert, remove };
}
