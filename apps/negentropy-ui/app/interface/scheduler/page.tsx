"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { DashboardFilters, ScheduledTaskDTO } from "@/features/scheduler";
import { runTaskNow, toggleTaskEnabled } from "@/features/scheduler/api";
import { InterfaceNav } from "@/components/ui/InterfaceNav";

import { useSchedulerData } from "@/app/(home)/dashboard/_hooks/useSchedulerData";
import { useSchedulerStream } from "@/app/(home)/dashboard/_hooks/useSchedulerStream";

import { SchedulerHeader } from "./_components/SchedulerHeader";
import { SchedulerKpiStrip } from "./_components/SchedulerKpiStrip";
import { SchedulerFilterBar } from "./_components/SchedulerFilterBar";
import { SchedulerTaskTable } from "./_components/SchedulerTaskTable";
import { SchedulerExecutionPanel } from "./_components/SchedulerExecutionPanel";
import { SchedulerStatsPanel } from "./_components/SchedulerStatsPanel";
import { SchedulerTaskDetailDrawer } from "./_components/SchedulerTaskDetailDrawer";

const DEFAULT_FILTERS: DashboardFilters = {
  role: null,
  scenario: null,
  agent: null,
  owner: null,
  category: null,
  window: "24h",
};

export default function SchedulerPage() {
  const [activeTab, setActiveTab] = useState<"tasks" | "executions" | "stats">("tasks");
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
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

  const { connected } = useSchedulerStream({ onExecution: pushExecution });

  const handleRun = async (id: string) => {
    try {
      const result = await runTaskNow(id);
      if (result.ok) {
        toast.success("Task triggered successfully");
        refresh();
      } else {
        toast.error("Failed to trigger task");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run task");
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const result = await toggleTaskEnabled(id, enabled);
      if (result.ok) {
        toast.success(`Task ${enabled ? "enabled" : "disabled"}`);
        refresh();
      } else {
        toast.error("Failed to toggle task");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle task");
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <InterfaceNav title="Scheduler" />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6 space-y-5">
          <SchedulerHeader
            connected={connected}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onRefresh={refresh}
            loading={loading}
          />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
              {error}
            </div>
          )}

          <SchedulerKpiStrip kpis={kpis} loading={loading} />
          <SchedulerFilterBar filters={filters} tasks={tasks} onFiltersChange={setFilters} />

          {activeTab === "tasks" && (
            <SchedulerTaskTable
              tasks={tasks}
              loading={loading}
              onToggle={handleToggle}
              onRun={handleRun}
              onSelect={setSelectedTask}
            />
          )}

          {activeTab === "executions" && (
            <SchedulerExecutionPanel executions={executions} loading={loading} />
          )}

          {activeTab === "stats" && (
            <SchedulerStatsPanel
              statsByRole={statsByRole}
              statsByScenario={statsByScenario}
              statsByOwner={statsByOwner}
              loading={loading}
            />
          )}

          {selectedTask && (
            <SchedulerTaskDetailDrawer
              task={selectedTask}
              onClose={() => setSelectedTask(null)}
              onRun={handleRun}
              onToggle={handleToggle}
            />
          )}
        </div>
      </div>
    </div>
  );
}
