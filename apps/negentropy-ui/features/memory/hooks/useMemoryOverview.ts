/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
/**
 * Memory Overview Hook
 *
 * 为 Overview 落地页并行编排三个数据源：
 * - /dashboard（KPI，全员）
 * - /health（系统健康 + feature flag 实时态，无鉴权）
 * - /metrics（聚合指标，admin only —— 403/404 静默降级为 null，绝不冒泡整页错误）
 *
 * 设计要点（Systemic Integrity）：Pipeline 图是「教学工件」，即便所有 live 数据缺失也必须
 * 结构性渲染，因此 health/metrics 的失败被吞掉，仅 dashboard 错误暴露给 RetryableErrorBanner。
 */

import { useCallback, useEffect, useState } from "react";
import {
  MemoryDashboard,
  MemoryHealth,
  MemorySystemMetrics,
  fetchMemoryDashboard,
  fetchMemoryHealth,
  fetchMemoryMetrics,
} from "../utils/memory-api";

export interface UseMemoryOverviewOptions {
  appName?: string;
  /** 当前用户是否 admin —— 非 admin 时跳过 /metrics 拉取，避免必然的 403。 */
  isAdmin?: boolean;
}

export interface UseMemoryOverviewReturnValue {
  dashboard: MemoryDashboard | null;
  health: MemoryHealth | null;
  metrics: MemorySystemMetrics | null;
  isLoading: boolean;
  /** dashboard 拉取错误（可重试）；health/metrics 错误被吞掉降级。 */
  error: Error | null;
  reload: () => Promise<void>;
}

export function useMemoryOverview(
  options: UseMemoryOverviewOptions,
): UseMemoryOverviewReturnValue {
  const { appName, isAdmin } = options;

  const [dashboard, setDashboard] = useState<MemoryDashboard | null>(null);
  const [health, setHealth] = useState<MemoryHealth | null>(null);
  const [metrics, setMetrics] = useState<MemorySystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // health / metrics 单独捕获并降级；dashboard 是主信号，错误向上抛。
    const [dashboardRes, healthRes, metricsRes] = await Promise.allSettled([
      fetchMemoryDashboard(appName),
      fetchMemoryHealth(),
      isAdmin ? fetchMemoryMetrics({ app_name: appName }) : Promise.resolve(null),
    ]);

    if (dashboardRes.status === "fulfilled") {
      setDashboard(dashboardRes.value);
    } else {
      setError(dashboardRes.reason as Error);
    }
    setHealth(healthRes.status === "fulfilled" ? healthRes.value : null);
    setMetrics(metricsRes.status === "fulfilled" ? metricsRes.value : null);

    setIsLoading(false);
  }, [appName, isAdmin]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { dashboard, health, metrics, isLoading, error, reload };
}
