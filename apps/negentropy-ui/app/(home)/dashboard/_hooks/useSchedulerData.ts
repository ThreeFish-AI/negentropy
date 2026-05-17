"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useHeartbeatPoll } from "@/hooks/useHeartbeatPoll";

import {
  fetchExecutions,
  fetchKpis,
  fetchStats,
  fetchTasks,
} from "../_lib/api";
import type {
  DashboardFilters,
  KpiResponse,
  ScheduledTaskDTO,
  StatsResponse,
  TaskExecutionDTO,
} from "../_lib/types";

const FALLBACK_REFRESH_MS = 30_000;

interface UseSchedulerDataReturn {
  kpis: KpiResponse | null;
  tasks: ScheduledTaskDTO[];
  executions: TaskExecutionDTO[];
  statsByRole: StatsResponse | null;
  statsByScenario: StatsResponse | null;
  statsByOwner: StatsResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  pushExecution: (e: TaskExecutionDTO) => void;
}

export function useSchedulerData(filters: DashboardFilters): UseSchedulerDataReturn {
  const [kpis, setKpis] = useState<KpiResponse | null>(null);
  const [tasks, setTasks] = useState<ScheduledTaskDTO[]>([]);
  const [executions, setExecutions] = useState<TaskExecutionDTO[]>([]);
  const [statsByRole, setStatsByRole] = useState<StatsResponse | null>(null);
  const [statsByScenario, setStatsByScenario] = useState<StatsResponse | null>(null);
  const [statsByOwner, setStatsByOwner] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filtersKey = JSON.stringify(filters);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // 去重缓存：记录已被计入 total_runs / recent 的 execution.id。
  // 防御场景：
  // (1) 页面初次加载时后端返回的 total_runs 已包含某条执行，SSE 又把该执行的 ok
  //     事件推回来（事件总线在 commit 后 publish，理论上 loadAll 总能拿到最新值）；
  // (2) SSE 重连后服务端重发了订阅前广播过的事件（ExecutionBus fan-out 不区分
  //     新老订阅者）。
  // 任一情况下，无 dedup 都会让 UI 上的 total_runs 越累越大。
  const seenExecRef = useRef<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const f = filtersRef.current;
    try {
      const [k, t, e, sr, ss, so] = await Promise.all([
        fetchKpis(f.window),
        fetchTasks(f),
        fetchExecutions({ ...f, limit: 100 }),
        fetchStats("role", f.window),
        fetchStats("scenario", f.window),
        fetchStats("owner", f.window),
      ]);
      setKpis(k);
      setTasks(t.items);
      setExecutions(e.items);
      // 把刚拉到的 execution.id 全部种入 seen 集合，让 SSE 即便重发也不再增量。
      // 仅对已落地（非 running）的执行才视为"已计入"，否则后续 ok 事件应当被计入。
      const seeded = new Set(seenExecRef.current);
      for (const item of e.items) {
        if (item.status !== "running") seeded.add(item.id);
      }
      seenExecRef.current = seeded;
      setStatsByRole(sr);
      setStatsByScenario(ss);
      setStatsByOwner(so);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载 + filter 变化触发
  useEffect(() => {
    void loadAll();
  }, [loadAll, filtersKey]);

  // 兜底定时刷新（SSE 抖动时仍能保持视图新鲜度）— Phase 3-A 统一到 useHeartbeatPoll
  // 让 Dashboard 自身的回退路径也享受 visibility 暂停 + online 恢复触发的语义。
  useHeartbeatPoll(loadAll, {
    intervalMs: FALLBACK_REFRESH_MS,
    fireImmediately: false,
  });

  // SSE 推送时把最新 execution 插到时间线头部 + 更新对应 task.recent。
  // total_runs / recent 仅在「该 execution.id 首次以非 running 状态被消费」时累加，
  // 防止 SSE 重发或冷启动 + SSE 二次计数（详见 seenExecRef 注释）。
  const pushExecution = useCallback((e: TaskExecutionDTO) => {
    setExecutions((prev) => {
      // 已经存在则替换（status running → ok 的二次推送）
      const idx = prev.findIndex((x) => x.id === e.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = e;
        return next;
      }
      return [e, ...prev].slice(0, 200);
    });

    if (e.status === "running") return;

    const firstSeen = !seenExecRef.current.has(e.id);
    if (firstSeen) seenExecRef.current.add(e.id);

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== e.task_id) return t;
        return {
          ...t,
          last_fire_at: e.finished_at ?? e.started_at ?? t.last_fire_at,
          last_status: e.status,
          last_error: e.error ?? null,
          total_runs: firstSeen ? t.total_runs + 1 : t.total_runs,
          recent: firstSeen ? [e.status, ...t.recent].slice(0, 3) : t.recent,
        };
      }),
    );
  }, []);

  return {
    kpis,
    tasks,
    executions,
    statsByRole,
    statsByScenario,
    statsByOwner,
    loading,
    error,
    refresh: loadAll,
    pushExecution,
  };
}
