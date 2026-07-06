"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  DashboardFilters,
  ExecutionStatus,
  ScheduledTaskDTO,
  StatsWindow,
  TaskWritePayload,
} from "@/features/scheduler";
import {
  runTaskNow,
  toggleTaskEnabled,
  createTask,
  updateTask,
  deleteTask,
  fetchTasks,
  fetchExecutions,
} from "@/features/scheduler/api";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { Pagination } from "@/components/ui/Pagination";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { useInfiniteList, type CursorFetcher } from "@/hooks/useInfiniteList";

import { useSchedulerData } from "@/app/(home)/dashboard/_hooks/useSchedulerData";
import { useSchedulerStream } from "@/app/(home)/dashboard/_hooks/useSchedulerStream";
import type { TaskExecutionDTO } from "@/features/scheduler";

import { SchedulerHeader } from "./_components/SchedulerHeader";
import type { ExecutionStatusFilter } from "./_components/SchedulerFilterBar";
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

/** 任务列表每页条数（纯分页：仅展示当前页 TASK_PAGE_SIZE 条，翻页由 goToPage 顺序补齐游标）。 */
const TASK_PAGE_SIZE = 10;
/** 执行列表每页条数（服务端游标分页：按页懒加载，total 反映当前时间窗+过滤下的全量）。 */
const EXEC_PAGE_SIZE = 10;
/** SSE 抖动合并到尾沿的去抖窗（对齐 Routine useRoutineLive）。 */
const REFRESH_DEBOUNCE_MS = 500;

/** 时间窗 → 起始 ISO 时间戳（对齐后端 `_window_to_delta`，让 executions 列表真正受时间窗约束）。 */
const WINDOW_MS: Record<StatsWindow, number> = {
  "1h": 3_600_000,
  "24h": 86_400_000,
  "7d": 604_800_000,
};
function windowToSince(window: StatsWindow): string {
  return new Date(Date.now() - WINDOW_MS[window]).toISOString();
}

export default function SchedulerPage() {
  const [activeTab, setActiveTab] = useState<"tasks" | "executions" | "stats">("tasks");
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatusFilter>("");
  const [selectedTask, setSelectedTask] = useState<ScheduledTaskDTO | null>(null);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTaskDTO | null>(null);

  // Delete confirmation
  const { confirm, confirmDialog } = useConfirmDialog();

  // KPI / stats + 全量任务快照（allTasks 仅用于派生 Role/Scenario/Category 筛选下拉选项与 ?task_key
  // 深链检索）。executions 展示列表已改由下方 execList 服务端游标分页独立驱动，不再消费此处内存数组；
  // pushExecution 仍用于 KPI/Stats 内存快照的 SSE 增量（其去重语义不变）。
  const {
    kpis,
    tasks: allTasks,
    statsByRole,
    statsByScenario,
    statsByOwner,
    loading,
    error,
    refresh,
    pushExecution,
  } = useSchedulerData(filters);

  // ── 任务列表：游标分页（fetchTasks 已游标化，前向只读 + 跳页顺序补齐，mirror Routine）──
  const taskFetcher = useMemo<CursorFetcher<ScheduledTaskDTO, DashboardFilters>>(
    () => ({
      kind: "cursor",
      fetchPage: async ({ cursor, limit, filters: f, signal }) => {
        const r = await fetchTasks(f ?? filters, { limit, cursor: cursor as string | null, signal });
        return {
          items: r.items,
          nextCursor: r.next_cursor,
          hasMore: r.has_more ?? r.next_cursor != null,
          total: r.total ?? null,
        };
      },
    }),
    [filters],
  );
  const taskList = useInfiniteList<ScheduledTaskDTO, DashboardFilters>({
    fetcher: taskFetcher,
    pageSize: TASK_PAGE_SIZE,
    filters,
  });

  // ── 执行列表：服务端游标分页（fetchExecutions 游标化）。按页懒加载、去掉旧 100 上限，
  //    total 反映「当前时间窗 + role/scenario/agent + 状态」下的全量计数（后端 COUNT）。
  //    时间窗经 since 下推，使 executions 真正受 1h/24h/7d 约束（此前时间窗对 executions 失效）。──
  interface ExecFilters {
    role: string | null;
    scenario: string | null;
    agent: string | null;
    since: string;
    status: ExecutionStatusFilter;
  }
  const execFilters = useMemo<ExecFilters>(
    () => ({
      role: filters.role,
      scenario: filters.scenario,
      agent: filters.agent,
      since: windowToSince(filters.window),
      status: executionStatus,
    }),
    [filters.role, filters.scenario, filters.agent, filters.window, executionStatus],
  );
  const execFetcher = useMemo<CursorFetcher<TaskExecutionDTO, ExecFilters>>(
    () => ({
      kind: "cursor",
      fetchPage: async ({ cursor, limit, filters: f, signal }) => {
        const r = await fetchExecutions({
          role: f?.role ?? null,
          scenario: f?.scenario ?? null,
          agent: f?.agent ?? null,
          since: f?.since,
          status: (f?.status || null) as ExecutionStatus | null,
          limit,
          cursor: cursor as string | null,
          signal,
        });
        return {
          items: r.items,
          nextCursor: r.next_cursor,
          hasMore: r.has_more ?? r.next_cursor != null,
          total: r.total ?? null,
        };
      },
    }),
    [],
  );
  const execList = useInfiniteList<TaskExecutionDTO, ExecFilters>({
    fetcher: execFetcher,
    pageSize: EXEC_PAGE_SIZE,
    filters: execFilters,
    // 仅 executions tab 激活时才发请求，避免 Tasks/Stats tab 下无谓拉取。
    enabled: activeTab === "executions",
  });
  const execPageStart = (execList.currentPage - 1) * EXEC_PAGE_SIZE;
  const pagedExecutions = execList.items.slice(execPageStart, execPageStart + EXEC_PAGE_SIZE);

  // ── 纯分页（mirror Routine useRoutineData）：useInfiniteList 维护游标缓冲，展示层仅切片当前页，
  //    不再累积渲染、无无限滚动哨兵 / 滚动联动；翻页由 goToPage 顺序补齐游标（每页 TASK_PAGE_SIZE 条）。──
  const taskPageStart = (taskList.currentPage - 1) * TASK_PAGE_SIZE;
  const pagedTasks = taskList.items.slice(taskPageStart, taskPageStart + TASK_PAGE_SIZE);

  // ── SSE：执行事件 → pushExecution（更新 KPI/Stats 用的内存快照 + 全量任务快照内存字段，沿用既有语义）
  //    并去抖刷新任务【分页列表】与执行【分页列表】，使其对齐最新数据（mirror Routine：不在内存逐字段改分页列表）──
  const taskRefreshRef = useRef(taskList.refresh);
  useEffect(() => {
    taskRefreshRef.current = taskList.refresh;
  }, [taskList.refresh]);
  const execRefreshRef = useRef(execList.refresh);
  useEffect(() => {
    execRefreshRef.current = execList.refresh;
  }, [execList.refresh]);
  const debTimer = useRef<number | null>(null);
  const scheduleListRefresh = useCallback(() => {
    if (debTimer.current !== null) return; // 已有待发，合并
    debTimer.current = window.setTimeout(() => {
      debTimer.current = null;
      taskRefreshRef.current();
      execRefreshRef.current(); // execList.refresh 仅重载已加载范围、不清空，安全（enabled=false 时为 no-op 语义）
    }, REFRESH_DEBOUNCE_MS);
  }, []);
  useEffect(() => {
    return () => {
      if (debTimer.current !== null) window.clearTimeout(debTimer.current);
    };
  }, []);
  const handleExecution = useCallback(
    (e: TaskExecutionDTO) => {
      pushExecution(e); // KPI/Stats 内存快照更新 + 全量任务快照内存字段更新（沿用既有契约）
      if (e.status !== "running") scheduleListRefresh(); // 分页列表去抖刷新对齐 Last/Recent + 新执行入列
    },
    [pushExecution, scheduleListRefresh],
  );
  const { connected } = useSchedulerStream({ onExecution: handleExecution });

  // 反向深链：?task_key=<key> 打开指定任务详情抽屉（来自 Routine 详情「派生自 Scheduler」回链）。
  // 用 window.location.search（client-only effect）规避 useSearchParams 的 Suspense 边界要求。
  // 在全量快照 allTasks（非分页前缀）中检索，避免深链目标落在未加载页时漏命中。
  useEffect(() => {
    if (selectedTask || allTasks.length === 0) return;
    const key = new URLSearchParams(window.location.search).get("task_key");
    if (!key) return;
    const found = allTasks.find((t) => t.key === key);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 由 URL ?task_key 同步选中态（外部源，仅首次命中）
    if (found) setSelectedTask(found);
  }, [allTasks, selectedTask]);

  // ---- Existing handlers ----

  const handleRefresh = useCallback(() => {
    refresh();
    taskRefreshRef.current();
    execRefreshRef.current();
  }, [refresh]);

  const handleRun = async (id: string) => {
    try {
      const result = await runTaskNow(id);
      if (result.ok) {
        toast.success("Task triggered successfully");
        handleRefresh();
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
        handleRefresh();
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
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  const handleFormSubmit = async (mode: "create" | "edit", id: string | null, body: TaskWritePayload) => {
    if (mode === "create") {
      const created = await createTask(body);
      toast.success("Task created");
      setFormOpen(false);
      handleRefresh();
      // Auto-select the new task
      setSelectedTask(created);
    } else if (mode === "edit" && id) {
      const updated = await updateTask(id, body);
      toast.success("Task updated");
      setFormOpen(false);
      handleRefresh();
      // Update selected task in drawer
      setSelectedTask(updated);
    }
  };

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Scheduler" />
      <div className="flex-1 overflow-auto">
        <div className="space-y-2.5 px-6 py-3">
          <SchedulerHeader
            connected={connected}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onRefresh={handleRefresh}
            loading={loading}
            onCreateTask={handleCreate}
            kpis={kpis}
            filters={filters}
            tasks={allTasks}
            onFiltersChange={setFilters}
            executionStatus={executionStatus}
            onExecutionStatusChange={setExecutionStatus}
          />

          {error && <ErrorBanner message={error} />}

          {activeTab === "tasks" && (
            <>
              <SchedulerTaskTable
                tasks={pagedTasks}
                loading={taskList.loading}
                onToggle={handleToggle}
                onRun={handleRun}
                onSelect={setSelectedTask}
              />
              {/* 居中翻页控件（页总数 + 控件组居中成组）；sticky 底栏始终可达。纯分页：不累积、无无限滚动。 */}
              {taskList.items.length > 0 && (
                <div className="sticky bottom-0 -mx-6 border-t border-border bg-muted/95 px-6 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  <Pagination
                    page={taskList.currentPage}
                    totalPages={taskList.totalPages}
                    onPageChange={taskList.goToPage}
                    total={taskList.total ?? undefined}
                    itemLabel="task"
                    disabled={taskList.loading}
                    loadingMore={taskList.loadingMore}
                    // 计数字号增至 12px（对齐 Routine，比默认 10px 明显增大）。
                    countClassName="text-xs"
                  />
                </div>
              )}
            </>
          )}

          {activeTab === "executions" && (
            <>
              <SchedulerExecutionPanel
                executions={pagedExecutions}
                loading={execList.loading}
              />
              {/* 居中翻页控件；sticky 底栏始终可达。服务端游标分页：按页懒加载、total 反映时间窗内全量。 */}
              {execList.total !== 0 && (
                <div className="sticky bottom-0 -mx-6 border-t border-border bg-muted/95 px-6 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  <Pagination
                    page={execList.currentPage}
                    totalPages={execList.totalPages}
                    onPageChange={execList.goToPage}
                    total={execList.total ?? undefined}
                    itemLabel="execution"
                    disabled={execList.loading}
                    loadingMore={execList.loadingMore}
                    countClassName="text-xs"
                  />
                </div>
              )}
            </>
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
