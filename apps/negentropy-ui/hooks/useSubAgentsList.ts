"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 与 ``apps/negentropy/src/negentropy/interface/api.py`` 的 ``SubAgentResponse`` 对齐。
 * 仅保留 Home Composer @ Agent 弹层所需字段。
 */
export interface SubAgentEntry {
  id: string;
  owner_id: string;
  visibility: string;
  name: string;
  display_name: string | null;
  description: string | null;
  is_builtin: boolean;
  is_enabled: boolean;
  kind?: "root" | "subagent";
}

interface UseSubAgentsListResult {
  subagents: SubAgentEntry[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * 加载当前用户可见的 SubAgent 列表（已隐藏 root + 已禁用）。
 *
 * 复用范式：与 ``app/knowledge/apis/_components/hooks/useCorporaList.ts`` 同构。
 *
 * 卸载安全：``mountedRef`` 提升到 hook 作用域，``useEffect`` 与 ``reload`` 共用同一份
 * 信号；组件卸载时 cleanup 将其置为 ``false``，确保 in-flight 请求即使在卸载后完成
 * 也不会触发 ``setSubagents`` / ``setError`` / ``setLoading``（避免 React 开发态告警
 * 与潜在内存泄漏）。
 */
export function useSubAgentsList(): UseSubAgentsListResult {
  const [subagents, setSubagents] = useState<SubAgentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchOnce = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await fetch("/api/interface/subagents", {
        method: "GET",
        cache: "no-store",
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = (await resp.json()) as unknown;
      if (!mountedRef.current) return;
      // 防御：测试 / 异常环境下 raw 可能非数组（空对象兜底等）。
      const data: SubAgentEntry[] = Array.isArray(raw) ? (raw as SubAgentEntry[]) : [];
      // 过滤：启用的 + 非 root + 非 root kind（Home 的"直达 SubAgent"语义，
      // root_agent 是默认目标，无需在 @ Agent 弹层中再选一次）。
      const filtered = data.filter(
        (a) =>
          a.is_enabled &&
          a.kind !== "root" &&
          a.name !== "NegentropyEngine",
      );
      setSubagents(filtered);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "加载 SubAgent 列表失败");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Strict Mode 下 effect 会双触发（mount → cleanup → mount），需在 mount 阶段
    // 显式置 true，防止第二次 mount 时仍读到上一次 cleanup 写入的 false。
    mountedRef.current = true;
    void fetchOnce();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchOnce]);

  return { subagents, loading, error, reload: fetchOnce };
}
