/* eslint-disable react-hooks/set-state-in-effect --
 * 同 useRoutineData：useEffect 内调用 fetcher 间接 setState 的既有数据加载模式。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchRoutineDetail } from "../api";
import type { RoutineDTO } from "../types";
import { useRoutineStream } from "./useRoutineStream";

const REFRESH_DEBOUNCE_MS = 500;

/**
 * 单 Routine 详情实时 hook（Run 全过程页用）。
 *
 * - 拉取 ``recent`` 条迭代的完整详情；
 * - 订阅**过滤后**的 SSE（仅本 routine，事件量低），事件到达去抖动重拉详情；
 * - 暴露 ``connected`` 供实时指示，``reload`` 供控制动作后刷新。
 */
export function useRoutineDetailLive(id: string | null, recent = 50) {
  const [routine, setRoutine] = useState<RoutineDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!id) return;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchRoutineDetail(id, recent);
      if (reqId !== reqIdRef.current) return;
      setRoutine(detail);
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load routine");
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [id, recent]);

  useEffect(() => {
    void load();
  }, [load]);

  // SSE → 去抖动重拉（合并事件突发）。
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  const debTimer = useRef<number | null>(null);
  const schedule = useCallback(() => {
    if (debTimer.current !== null) return;
    debTimer.current = window.setTimeout(() => {
      debTimer.current = null;
      void loadRef.current();
    }, REFRESH_DEBOUNCE_MS);
  }, []);
  useEffect(() => {
    return () => {
      if (debTimer.current !== null) window.clearTimeout(debTimer.current);
    };
  }, []);

  const { connected } = useRoutineStream({
    routineId: id ?? undefined,
    onRoutineEvent: schedule,
    onIterationEvent: schedule,
  });

  return { routine, loading, error, reload: load, connected };
}
