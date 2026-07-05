/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7 的 React Compiler 兼容规则集命中
 * 「useEffect 内调用 fetcher 间接 setState」的既有数据加载模式（对齐 useSchedulerData）。
 * 功能正确，仅严格度提升导致告警；TODO(react-compiler): 后续按 SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useInfiniteList, type OffsetFetcher } from "@/hooks/useInfiniteList";

import { fetchKpis, fetchRoutines } from "../api";
import type { RoutineDTO, RoutineFilters, RoutineKpis } from "../types";

/** 列表每页条数（游标无限滚动的加载粒度 + 页码跳页粒度）。 */
export const ROUTINE_PAGE_SIZE = 10;

/**
 * Routine 列表 + KPI 数据 hook。
 *
 * 列表由 [[useInfiniteList]] **偏移分页**驱动（``offset`` 模式）：每页 ``ROUTINE_PAGE_SIZE``
 * 条、按后端 ``updated_at`` 倒序，``total`` 为无上限全量计数 → 可翻阅所有 Routine（无 50 条上限）。
 * 该页以「纯翻页」呈现：``routines`` 仅暴露**当前页切片**（``items[(page-1)*size, page*size)``），
 * 不再做无限滚动追加；KPI 独立拉取（统计全量，不受列表 limit 影响）。
 * ``refresh()`` 供控制动作 / SSE 去抖刷新：原地重载当前页 + 重拉 KPI，不闪空。
 */
export function useRoutineData(filters: Partial<RoutineFilters>) {
  const [kpis, setKpis] = useState<RoutineKpis | null>(null);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const fetcher = useMemo<OffsetFetcher<RoutineDTO, Partial<RoutineFilters>>>(
    () => ({
      kind: "offset",
      fetchRange: async ({ offset, limit, filters: f, signal }) => {
        const r = await fetchRoutines(f ?? {}, { limit, offset, signal });
        return { items: r.items, total: r.total ?? r.items.length };
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

  // 纯翻页：仅暴露当前页切片（连续前缀缓冲由 useInfiniteList 内部维护）。
  const pageStart = (list.currentPage - 1) * ROUTINE_PAGE_SIZE;
  const routines = list.items.slice(pageStart, pageStart + ROUTINE_PAGE_SIZE);

  return {
    routines,
    kpis,
    loading: list.loading,
    error: list.error ?? kpiError,
    refresh,
    // 翻页控制（loadMore/hasMore/loadingMore 透传保留，纯翻页 UI 不再使用，最小化上层改动）
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
