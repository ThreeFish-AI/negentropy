"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

  // 兜底定时刷新（SSE 抖动时仍能保持视图新鲜度）
  useEffect(() => {
    const id = window.setInterval(loadAll, FALLBACK_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [loadAll]);

  // SSE 推送时把最新 execution 插到时间线头部 + 更新对应 task.recent
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
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== e.task_id) return t;
        if (e.status === "running") return t;
        return {
          ...t,
          last_fire_at: e.finished_at ?? e.started_at ?? t.last_fire_at,
          last_status: e.status,
          last_error: e.error ?? null,
          total_runs: t.total_runs + 1,
          recent: [e.status, ...t.recent].slice(0, 3),
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
