/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7 的 React Compiler 兼容规则集命中
 * 「useEffect 内调用 fetcher 间接 setState」的既有数据加载模式（对齐 useSchedulerData）。
 * 功能正确，仅严格度提升导致告警；TODO(react-compiler): 后续按 SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useInfiniteList, type CursorFetcher } from "@/hooks/useInfiniteList";

import { fetchKpis, fetchRoutines } from "../api";
import type { RoutineDTO, RoutineFilters, RoutineKpis } from "../types";

/** 列表每页条数（游标无限滚动的加载粒度 + 页码跳页粒度）。 */
export const ROUTINE_PAGE_SIZE = 10;

/**
 * Routine 列表 + KPI 数据 hook。
 *
 * 列表改由 [[useInfiniteList]] 游标分页驱动（消除此前「仅取最近 50 条」上限），
 * 支持页码跳页 + 无限滚动；KPI 独立拉取（统计全量，不受列表 limit 影响）。
 * ``refresh()`` 供控制动作 / SSE 去抖刷新：原地重载已加载范围 + 重拉 KPI，不闪空。
 */
export function useRoutineData(filters: Partial<RoutineFilters>) {
  const [kpis, setKpis] = useState<RoutineKpis | null>(null);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const fetcher = useMemo<CursorFetcher<RoutineDTO, Partial<RoutineFilters>>>(
    () => ({
      kind: "cursor",
      fetchPage: async ({ cursor, limit, filters: f, signal }) => {
        const r = await fetchRoutines(f ?? {}, { limit, cursor: cursor as string | null, signal });
        return { items: r.items, nextCursor: r.next_cursor, hasMore: r.has_more, total: r.total ?? null };
      },
    }),
    [],
  );

  const list = useInfiniteList<RoutineDTO, Partial<RoutineFilters>>({
    fetcher,
    pageSize: ROUTINE_PAGE_SIZE,
    filters,
  });

  const loadKpis = useCallback(async () => {
    try {
      setKpis(await fetchKpis());
      setKpiError(null);
    } catch (err) {
      setKpiError(err instanceof Error ? err.message : "Failed to load KPIs");
    }
  }, []);

  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);

  const { refresh: listRefresh } = list;
  const refresh = useCallback(() => {
    listRefresh();
    void loadKpis();
  }, [listRefresh, loadKpis]);

  return {
    routines: list.items,
    kpis,
    loading: list.loading,
    error: list.error ?? kpiError,
    refresh,
    // 分页控件 + 无限滚动控制
    currentPage: list.currentPage,
    total: list.total,
    totalPages: list.totalPages,
    goToPage: list.goToPage,
    loadMore: list.loadMore,
    hasMore: list.hasMore,
    loadingMore: list.loadingMore,
    pageSize: ROUTINE_PAGE_SIZE,
  };
}
