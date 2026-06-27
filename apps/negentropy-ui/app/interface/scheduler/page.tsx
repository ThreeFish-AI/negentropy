"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { DashboardFilters, ScheduledTaskDTO, TaskWritePayload } from "@/features/scheduler";
import { runTaskNow, toggleTaskEnabled, createTask, updateTask, deleteTask } from "@/features/scheduler/api";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { Pagination } from "@/components/ui/Pagination";
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

const PAGE_SIZE = 10;

/** 解析 last_fire_at 为毫秒；无值/非法返回 null（用于沉底）。 */
function lastFireMs(t: ScheduledTaskDTO): number | null {
  if (!t.last_fire_at) return null;
  const ms = Date.parse(t.last_fire_at);
  return Number.isNaN(ms) ? null : ms;
}

/** 按 Last（上次触发）时间倒序；从未触发(null)沉底，id 兜底稳定排序。 */
function compareByLastFireDesc(a: ScheduledTaskDTO, b: ScheduledTaskDTO): number {
  const ta = lastFireMs(a);
  const tb = lastFireMs(b);
  if (ta != null && tb != null) {
    if (tb !== ta) return tb - ta;
  } else if (ta != null) {
    return -1;
  } else if (tb != null) {
    return 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

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

  // ---- Tasks 排序 + 分页（镜像 Routine：排序 → totalPages/safePage → 切片）----
  const [page, setPage] = useState(1);
  const sortedTasks = useMemo(() => [...tasks].sort(compareByLastFireDesc), [tasks]);
  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageTasks = useMemo(
    () => sortedTasks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sortedTasks, safePage],
  );

  // 反向深链：?task_key=<key> 打开指定任务详情抽屉（来自 Routine 详情「派生自 Scheduler」回链）。
  // 用 window.location.search（client-only effect）规避 useSearchParams 的 Suspense 边界要求。
  useEffect(() => {
    if (selectedTask || tasks.length === 0) return;
    const key = new URLSearchParams(window.location.search).get("task_key");
    if (!key) return;
    const found = tasks.find((t) => t.key === key);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 由 URL ?task_key 同步选中态（外部源，仅首次命中）
    if (found) setSelectedTask(found);
  }, [tasks, selectedTask]);

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
          <SchedulerFilterBar
            filters={filters}
            tasks={tasks}
            onFiltersChange={(f) => {
              setFilters(f);
              setPage(1);
            }}
          />

          {activeTab === "tasks" && (
            <>
              <SchedulerTaskTable
                tasks={pageTasks}
                total={sortedTasks.length}
                loading={loading}
                onToggle={handleToggle}
                onRun={handleRun}
                onSelect={setSelectedTask}
              />
              {sortedTasks.length > 0 && (
                <Pagination
                  page={safePage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  total={sortedTasks.length}
                  itemLabel="task"
                  disabled={loading}
                />
              )}
            </>
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
