/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { fetchMemoryDashboard, type MemoryDashboard } from "@/features/memory";
import { useActivityLog } from "@/hooks/useActivityLog";

import { ActivityDrawer } from "./_components/ActivityDrawer";
import { DashboardHeaderStrip } from "./_components/DashboardHeaderStrip";
import { DimensionCharts } from "./_components/DimensionCharts";
import { ExecutionTimeline } from "./_components/ExecutionTimeline";
import { FilterBar } from "./_components/FilterBar";
import { MemoryDetailPanel } from "./_components/MemoryDetailPanel";
import { RetrievalMetricsCard } from "./_components/RetrievalMetricsCard";
import { TaskDetailDrawer } from "./_components/TaskDetailDrawer";
import { TaskTable } from "./_components/TaskTable";
import { useDashboardAgentOptions } from "./_hooks/useDashboardAgentOptions";
import { useDashboardOwnerOptions } from "./_hooks/useDashboardOwnerOptions";
import { useSchedulerData } from "./_hooks/useSchedulerData";
import { useSchedulerStream } from "./_hooks/useSchedulerStream";
import type { DashboardFilters, ScheduledTaskDTO } from "./_lib/types";

const INITIAL_FILTERS: DashboardFilters = {
  role: null,
  scenario: null,
  agent: null,
  owner: null,
  category: null,
  window: "24h",
};

/* ---------- Interface Stats type ---------- */

interface InterfaceStats {
  mcp_servers: { total: number; enabled: number };
  skills: { total: number; enabled: number };
  subagents: { total: number; enabled: number };
  models: { total: number; enabled: number; vendors: number };
  tools: { total: number; enabled: number };
}

/**
 * Home / Dashboard 主页面。
 *
 * 数据流（Plan §9 时序图）：
 * - 进入页面 → useSchedulerData 并行 fetch 6 个端点（kpis / tasks / executions / 3*stats）；
 * - useSchedulerStream 订阅 /api/scheduler/stream SSE，每条 execution 事件 push 到列表头部；
 * - 30s 兜底定时刷新（防 SSE 抖动）；
 * - 点击任务行 → Drawer 打开 → 加载 /scheduler/tasks/{id}；
 * - Run Now / Toggle 操作完成后调用 refresh() 同步状态。
 * - 客户端 Activity 面板渲染 localStorage Toast 历史（与后端 Execution Timeline 正交）。
 */
export default function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>(INITIAL_FILTERS);
  const [selectedTask, setSelectedTask] = useState<ScheduledTaskDTO | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const { totalCount: activityCount } = useActivityLog();

  const {
    kpis,
    tasks,
    executions,
    statsByRole,
    statsByScenario,
    statsByOwner,
    loading,
    error,
    refresh,
    pushExecution,
  } = useSchedulerData(filters);

  // Agent / Owner 下拉选项是「全局枚举」（SubAgent 注册表、用户表），
  // 不应从 useSchedulerData 返回的 tasks（已被 filters 过滤）推导，
  // 否则下拉选项会随过滤动态塌缩。改由独立 hook 提供 SSOT。
  const { options: agentOptions } = useDashboardAgentOptions();
  const { options: ownerOptions } = useDashboardOwnerOptions();

  const { connected } = useSchedulerStream({ onExecution: pushExecution });

  const handleSelect = useCallback((task: ScheduledTaskDTO) => {
    setSelectedTask(task);
  }, []);
  const handleClose = useCallback(() => setSelectedTask(null), []);

  /* ── Memory data ── */
  const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";
  const [memoryDashboard, setMemoryDashboard] = useState<MemoryDashboard | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | undefined>(undefined);

  const loadMemoryDashboard = useCallback(async () => {
    setMemoryLoading(true);
    setMemoryError(null);
    try {
      const data = await fetchMemoryDashboard(APP_NAME, activeUserId);
      setMemoryDashboard(data);
    } catch (err) {
      setMemoryError(err instanceof Error ? err.message : String(err));
    } finally {
      setMemoryLoading(false);
    }
  }, [APP_NAME, activeUserId]);

  useEffect(() => {
    loadMemoryDashboard();
  }, [loadMemoryDashboard]);

  /* ── Interface data ── */
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin") ?? false;

  const [interfaceStats, setInterfaceStats] = useState<InterfaceStats | null>(null);
  const [interfaceLoading, setInterfaceLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/interface/stats");
        if (!response.ok) {
          throw new Error(
            `获取 Interface 统计失败（HTTP ${response.status}），请稍后重试或联系管理员。`,
          );
        }
        const data = await response.json();
        setInterfaceStats(data);
      } catch {
        // silently fail — interface stats are non-critical
      } finally {
        setInterfaceLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto px-4 py-3">
      {error ? (
        <div className="mb-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {/* Unified dashboard header strip */}
      <DashboardHeaderStrip
        kpis={kpis}
        kpiLoading={loading}
        memoryDashboard={memoryDashboard}
        memoryLoading={memoryLoading}
        interfaceStats={interfaceStats}
        interfaceLoading={interfaceLoading}
        isAdmin={isAdmin}
        activityCount={activityCount}
        onOpenActivity={() => setActivityOpen(true)}
      />

      {/* Expandable Memory detail panel */}
      <RetrievalMetricsCard appName={APP_NAME} />

      <MemoryDetailPanel
        dashboard={memoryDashboard}
        loading={memoryLoading}
        error={memoryError}
        onRefresh={loadMemoryDashboard}
        activeUserId={activeUserId}
        onFilterUser={(id) => setActiveUserId(id || undefined)}
        onClearFilter={() => setActiveUserId(undefined)}
      />

      <div className="mt-3">
        <FilterBar
          filters={filters}
          tasks={tasks}
          agentOptions={agentOptions}
          ownerOptions={ownerOptions}
          onChange={setFilters}
          onRefresh={refresh}
          connected={connected}
        />
      </div>
      <div className="mt-3">
        <DimensionCharts byRole={statsByRole} byScenario={statsByScenario} byOwner={statsByOwner} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <TaskTable tasks={tasks} filters={filters} onSelect={handleSelect} />
        </div>
        <div className="lg:col-span-5">
          <ExecutionTimeline executions={executions} />
        </div>
      </div>
      <TaskDetailDrawer task={selectedTask} onClose={handleClose} onTaskChanged={refresh} />
      <ActivityDrawer open={activityOpen} onClose={() => setActivityOpen(false)} />
    </div>
  );
}
