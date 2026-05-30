/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7 的 React Compiler 兼容规则集命中
 * 「useEffect 内调用 fetcher 间接 setState」的既有数据加载模式（对齐 useSchedulerData）。
 * 功能正确，仅严格度提升导致告警；TODO(react-compiler): 后续按 SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchKpis, fetchRoutines } from "../api";
import type { RoutineDTO, RoutineFilters, RoutineKpis } from "../types";

/**
 * Routine 列表 + KPI 数据 hook。
 *
 * - 依据 filters 拉取列表与 KPI；
 * - 暴露 ``refresh()`` 供控制动作 / SSE 事件后手动刷新；
 * - ``bump`` 计数器允许外部（SSE）触发去抖刷新。
 */
export function useRoutineData(filters: Partial<RoutineFilters>) {
  const [routines, setRoutines] = useState<RoutineDTO[]>([]);
  const [kpis, setKpis] = useState<RoutineKpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 序列化 filters 以稳定 effect 依赖
  const filterKey = JSON.stringify({ status: filters.status ?? null, q: filters.q ?? "" });
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [listRes, kpiRes] = await Promise.all([fetchRoutines(filters), fetchKpis()]);
      if (reqId !== reqIdRef.current) return; // 过期请求丢弃
      setRoutines(listRes.items);
      setKpis(kpiRes);
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load routines");
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { routines, kpis, loading, error, refresh: load };
}
