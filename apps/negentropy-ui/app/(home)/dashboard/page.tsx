"use client";

import { useCallback, useState } from "react";

import { ActivityLogPanel } from "./_components/ActivityLogPanel";
import { DimensionCharts } from "./_components/DimensionCharts";
import { ExecutionTimeline } from "./_components/ExecutionTimeline";
import { FilterBar } from "./_components/FilterBar";
import { KpiRow } from "./_components/KpiRow";
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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto px-4 py-3">
      {error ? (
        <div className="mb-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      ) : null}
      <KpiRow kpis={kpis} loading={loading} />
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
      <div className="mt-3">
        <ActivityLogPanel />
      </div>
      <TaskDetailDrawer task={selectedTask} onClose={handleClose} onTaskChanged={refresh} />
    </div>
  );
}
