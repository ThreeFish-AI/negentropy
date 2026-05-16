"use client";

import { useEffect, useState } from "react";

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
 */
export function useSubAgentsList(): UseSubAgentsListResult {
  const [subagents, setSubagents] = useState<SubAgentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = async (mounted: { current: boolean }) => {
    try {
      setLoading(true);
      setError(null);
      const resp = await fetch("/api/interface/subagents", {
        method: "GET",
        cache: "no-store",
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = (await resp.json()) as unknown;
      if (!mounted.current) return;
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
      if (mounted.current) {
        setError(err instanceof Error ? err.message : "加载 SubAgent 列表失败");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    const mounted = { current: true };
    void fetchOnce(mounted);
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = async () => {
    const mounted = { current: true };
    await fetchOnce(mounted);
  };

  return { subagents, loading, error, reload };
}
