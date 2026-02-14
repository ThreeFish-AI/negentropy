/**
 * Memory Audit Hook
 *
 * 提供记忆审计治理能力 (Retain / Delete / Anonymize)
 * 遵循 AGENTS.md 原则：单一职责、状态下沉、复用驱动
 */

import { useCallback, useEffect, useState } from "react";
import {
  AuditHistoryPayload,
  AuditResponse,
  fetchAuditHistory,
  submitAudit,
} from "../utils/memory-api";

export interface UseMemoryAuditOptions {
  appName?: string;
  userId: string;
  limit?: number;
}

export interface UseMemoryAuditReturnValue {
  history: AuditHistoryPayload | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  submit: (
    decisions: Record<string, string>,
    options?: {
      note?: string;
      expectedVersions?: Record<string, number>;
    },
  ) => Promise<AuditResponse>;
}

export function useMemoryAudit(
  options: UseMemoryAuditOptions,
): UseMemoryAuditReturnValue {
  const { appName, userId, limit } = options;

  const [history, setHistory] = useState<AuditHistoryPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAuditHistory(userId, appName, limit);
      setHistory(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [appName, userId, limit]);

  const submit = useCallback(
    async (
      decisions: Record<string, string>,
      opts?: {
        note?: string;
        expectedVersions?: Record<string, number>;
      },
    ) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await submitAudit({
          app_name: appName,
          user_id: userId,
          decisions,
          note: opts?.note,
          expected_versions: opts?.expectedVersions,
          idempotency_key: crypto.randomUUID(),
        });
        // 刷新审计历史
        await reload();
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [appName, userId, reload],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    history,
    isLoading,
    isSubmitting,
    error,
    reload,
    submit,
  };
}
