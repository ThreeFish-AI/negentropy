/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 与 ``apps/negentropy/src/negentropy/interface/api.py`` 的 ``AgentResponse`` 对齐。
 * 仅保留 Home Composer @ Agent 弹层所需字段。
 */
export interface AgentEntry {
  id: string;
  owner_id: string;
  visibility: string;
  name: string;
  display_name: string | null;
  description: string | null;
  is_builtin: boolean;
  is_enabled: boolean;
  kind?: "root" | "agent";
}

interface UseAgentsListResult {
  agents: AgentEntry[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * 加载当前用户可见的 Agent 列表（已隐藏 root + 已禁用）。
 *
 * 复用范式：与 ``app/knowledge/apis/_components/hooks/useCorporaList.ts`` 同构。
 *
 * 卸载安全：``mountedRef`` 提升到 hook 作用域，``useEffect`` 与 ``reload`` 共用同一份
 * 信号；组件卸载时 cleanup 将其置为 ``false``，确保 in-flight 请求即使在卸载后完成
 * 也不会触发 ``setAgents`` / ``setError`` / ``setLoading``（避免 React 开发态告警
 * 与潜在内存泄漏）。
 */
export function useAgentsList(): UseAgentsListResult {
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchOnce = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await fetch("/api/interface/agents", {
        method: "GET",
        cache: "no-store",
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = (await resp.json()) as unknown;
      if (!mountedRef.current) return;
      // 防御：测试 / 异常环境下 raw 可能非数组（空对象兜底等）。
      const data: AgentEntry[] = Array.isArray(raw) ? (raw as AgentEntry[]) : [];
      // 过滤：启用的 + 非 root + 非 root kind（Home 的"直达 Agent"语义，
      // root_agent 是默认目标，无需在 @ Agent 弹层中再选一次）。
      const filtered = data.filter(
        (a) =>
          a.is_enabled &&
          a.kind !== "root" &&
          a.name !== "NegentropyEngine",
      );
      setAgents(filtered);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "加载 Agent 列表失败");
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

  return { agents, loading, error, reload: fetchOnce };
}
