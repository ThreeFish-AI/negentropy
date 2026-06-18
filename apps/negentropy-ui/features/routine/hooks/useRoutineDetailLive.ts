/* eslint-disable react-hooks/set-state-in-effect --
 * 同 useRoutineData：useEffect 内调用 fetcher 间接 setState 的既有数据加载模式。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchRoutineDetail } from "../api";
import type { RoutineActionStreamEvent, RoutineDTO, RoutineStreamEvent } from "../types";
import { useRoutineStream } from "./useRoutineStream";

const REFRESH_DEBOUNCE_MS = 500;
/** 单迭代实时动作缓冲上限（与后端 max_events_per_iter 对齐，防内存膨胀）。 */
const MAX_LIVE_ACTIONS = 100000;

/** 每迭代的实时动作缓冲：按 iteration_id 归集，按 seq 去重升序。 */
export type LiveActionsByIteration = Record<string, RoutineActionStreamEvent[]>;

/**
 * 单 Routine 详情实时 hook（Run 全过程页用）。
 *
 * - 拉取 ``recent`` 条迭代的完整详情；
 * - 订阅**过滤后**的 SSE（仅本 routine，事件量低）：
 *   · ``routine`` / ``iteration`` 事件 → 去抖动重拉详情；
 *   · ``action`` 事件 → 仅累积进 ``liveActionsByIteration`` 实时缓冲，**不**触发整体重拉
 *     （否则每个工具调用都会重载数十条迭代，开销巨大）；
 * - 暴露 ``connected`` 供实时指示，``reload`` 供控制动作后刷新，``liveActionsByIteration``
 *   供审计抽屉叠加在途迭代的实时动作。
 */
export function useRoutineDetailLive(id: string | null, recent = 50) {
  const [routine, setRoutine] = useState<RoutineDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveActionsByIteration, setLiveActions] = useState<LiveActionsByIteration>({});
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

  // 切换 routine 时清空实时动作缓冲，避免跨任务串味。
  useEffect(() => {
    setLiveActions({});
  }, [id]);

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

  // action 事件：仅累积进实时缓冲（按 iteration_id 归集、按 seq 去重升序、封顶），不触发重拉。
  const onAction = useCallback((e: RoutineStreamEvent) => {
    const iid = typeof e.iteration_id === "string" ? e.iteration_id : null;
    const seq = typeof e.seq === "number" ? e.seq : null;
    if (!iid || seq == null) return;
    const evt = e as unknown as RoutineActionStreamEvent;
    setLiveActions((prev) => {
      const cur = prev[iid] ?? [];
      if (cur.some((a) => a.seq === seq)) return prev; // 已有该 seq，去重
      const next = [...cur, evt].sort((a, b) => a.seq - b.seq);
      if (next.length > MAX_LIVE_ACTIONS) next.splice(0, next.length - MAX_LIVE_ACTIONS);
      return { ...prev, [iid]: next };
    });
  }, []);

  const { connected } = useRoutineStream({
    routineId: id ?? undefined,
    onRoutineEvent: schedule,
    onIterationEvent: schedule,
    onActionEvent: onAction,
  });

  return { routine, loading, error, reload: load, connected, liveActionsByIteration };
}
