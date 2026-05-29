"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { DashboardFilters, ScheduledTaskDTO, TaskWritePayload } from "@/features/scheduler";
import { runTaskNow, toggleTaskEnabled, createTask, updateTask, deleteTask } from "@/features/scheduler/api";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";

import { useSchedulerData } from "@/app/(home)/dashboard/_hooks/useSchedulerData";
import { useSchedulerStream } from "@/app/(home)/dashboard/_hooks/useSchedulerStream";

import { SchedulerHeader } from "./_components/SchedulerHeader";
import { SchedulerKpiStrip } from "./_components/SchedulerKpiStrip";
import { SchedulerFilterBar } from "./_components/SchedulerFilterBar";
import { SchedulerTaskTable } from "./_components/SchedulerTaskTable";
import { SchedulerExecutionPanel } from "./_components/SchedulerExecutionPanel";
import { SchedulerStatsPanel } from "./_components/SchedulerStatsPanel";
import { SchedulerTaskDetailDrawer } from "./_components/SchedulerTaskDetailDrawer";
import { SchedulerTaskFormDialog } from "./_components/SchedulerTaskFormDialog";

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

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTaskDTO | null>(null);

  // Delete confirmation
  const { confirm, confirmDialog } = useConfirmDialog();

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

  // ---- Existing handlers ----

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

  // ---- CRUD handlers ----

  const handleCreate = () => {
    setEditingTask(null);
    setFormOpen(true);
  };

  const handleEdit = (task: ScheduledTaskDTO) => {
    setEditingTask(task);
    setFormOpen(true);
  };

  const handleDelete = async (task: ScheduledTaskDTO) => {
    const confirmed = await confirm({
      title: "Delete Task",
      message: (
        <>
          Are you sure you want to delete{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
            {task.display_name || task.key}
          </code>
          ? This action cannot be undone. All execution history will be permanently removed.
        </>
      ),
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await deleteTask(task.id);
      toast.success("Task deleted");
      setSelectedTask(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  const handleFormSubmit = async (mode: "create" | "edit", id: string | null, body: TaskWritePayload) => {
    if (mode === "create") {
      const created = await createTask(body);
      toast.success("Task created");
      setFormOpen(false);
      refresh();
      // Auto-select the new task
      setSelectedTask(created);
    } else if (mode === "edit" && id) {
      const updated = await updateTask(id, body);
      toast.success("Task updated");
      setFormOpen(false);
      refresh();
      // Update selected task in drawer
      setSelectedTask(updated);
    }
  };

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Scheduler" />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6 space-y-5">
          <SchedulerHeader
            connected={connected}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onRefresh={refresh}
            loading={loading}
            onCreateTask={handleCreate}
          />

          {error && <ErrorBanner message={error} />}

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
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {/* Task Create/Edit Dialog */}
      <SchedulerTaskFormDialog
        open={formOpen}
        task={editingTask}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation Dialog */}
      {confirmDialog}
    </div>
  );
}
