"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { DashboardFilters, ScheduledTaskDTO, TaskWritePayload } from "@/features/scheduler";
import { runTaskNow, toggleTaskEnabled, createTask, updateTask, deleteTask, fetchTasks } from "@/features/scheduler/api";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { Pagination } from "@/components/ui/Pagination";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { useInfiniteList, type CursorFetcher } from "@/hooks/useInfiniteList";
import { useInfiniteScrollSentinel, useScrollPageSync } from "@/hooks/useInfiniteScrollSentinel";

import { useSchedulerData } from "@/app/(home)/dashboard/_hooks/useSchedulerData";
import { useSchedulerStream } from "@/app/(home)/dashboard/_hooks/useSchedulerStream";
import type { TaskExecutionDTO } from "@/features/scheduler";

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

/** 任务列表每页条数（游标无限滚动加载粒度 + 页码跳页粒度）。 */
const TASK_PAGE_SIZE = 10;
/** SSE 抖动合并到尾沿的去抖窗（对齐 Routine useRoutineLive）。 */
const REFRESH_DEBOUNCE_MS = 500;

export default function SchedulerPage() {
  const [activeTab, setActiveTab] = useState<"tasks" | "executions" | "stats">("tasks");
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [selectedTask, setSelectedTask] = useState<ScheduledTaskDTO | null>(null);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTaskDTO | null>(null);

  // Delete confirmation
  const { confirm, confirmDialog } = useConfirmDialog();

  // KPI / executions / stats + 全量任务快照（allTasks 仅用于派生 Role/Scenario/Category 筛选下拉
  // 选项与 ?task_key 深链检索；展示用任务列表由下方 cursor list 独立分页，二者解耦避免回归）。
  const {
    kpis,
    tasks: allTasks,
    executions,
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

  // 无限滚动 + 翻页：页面级滚动容器 ref、程序化滚动闸门、待跳页号（mirror Routine 样板）。
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollRef = useRef(false);
  const pendingPageRef = useRef<number | null>(null);

  // 无限滚动哨兵：滚到底（提前 200px）→ 追加下一游标页。root = 页面级滚动容器。
  const { sentinelRef } = useInfiniteScrollSentinel({
    onReach: taskList.loadMore,
    enabled: taskList.hasMore && !taskList.loadingMore && !taskList.loading,
    root: scrollRootRef,
  });

  // 滚动联动当前页高亮：观测每页首行的 data-infinite-page 锚点，取最靠上可见页。
  useScrollPageSync({
    enabled: true,
    onPageChange: taskList.goToPage,
    root: scrollRootRef,
    rescanKey: taskList.items.length,
    programmaticRef: programmaticScrollRef,
  });

  // 点页码跳页：先经 hook 确保该页已加载（游标顺序补齐 / 已加载即时），再滚动到该页锚点。
  const handleGoToPage = useCallback(
    (target: number) => {
      pendingPageRef.current = target;
      programmaticScrollRef.current = true; // 抑制 observer 回写，防跳页与联动互相递归
      taskList.goToPage(target);
    },
    [taskList],
  );

  // 待跳页锚点出现即平滑滚动（cursor 顺序补齐时，锚点随 tasks 增长后再现 → effect 重跑命中）。
  const taskPage = taskList.currentPage;
  const taskItemsLen = taskList.items.length;
  useEffect(() => {
    const target = pendingPageRef.current;
    if (target == null) return;
    const anchor = scrollRootRef.current?.querySelector<HTMLElement>(`[data-infinite-page="${target}"]`);
    if (!anchor) return; // 该页尚未渲染，待 tasks 增长后重跑
    anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    pendingPageRef.current = null;
    const t = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 600);
    return () => window.clearTimeout(t);
  }, [taskPage, taskItemsLen]);

  // ── SSE：执行事件 → pushExecution（更新时间线 + 全量任务快照内存字段，沿用 useSchedulerData 既有语义）
  //    并去抖刷新任务【分页列表】，使其 Last/Recent/状态点对齐（mirror Routine：不在内存逐字段改分页列表）──
  const taskRefreshRef = useRef(taskList.refresh);
  useEffect(() => {
    taskRefreshRef.current = taskList.refresh;
  }, [taskList.refresh]);
  const debTimer = useRef<number | null>(null);
  const scheduleTaskRefresh = useCallback(() => {
    if (debTimer.current !== null) return; // 已有待发，合并
    debTimer.current = window.setTimeout(() => {
      debTimer.current = null;
      taskRefreshRef.current();
    }, REFRESH_DEBOUNCE_MS);
  }, []);
  useEffect(() => {
    return () => {
      if (debTimer.current !== null) window.clearTimeout(debTimer.current);
    };
  }, []);
  const handleExecution = useCallback(
    (e: TaskExecutionDTO) => {
      pushExecution(e); // 时间线头插 + 全量快照内存字段更新（沿用既有契约）
      if (e.status !== "running") scheduleTaskRefresh(); // 分页列表去抖刷新对齐 Last/Recent
    },
    [pushExecution, scheduleTaskRefresh],
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
      <div ref={scrollRootRef} className="flex-1 overflow-auto">
        <div className="px-6 py-6 space-y-5">
          <SchedulerHeader
            connected={connected}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onRefresh={handleRefresh}
            loading={loading}
            onCreateTask={handleCreate}
          />

          {error && <ErrorBanner message={error} />}

          <SchedulerKpiStrip kpis={kpis} loading={loading} />
          <SchedulerFilterBar
            filters={filters}
            tasks={allTasks}
            onFiltersChange={setFilters}
          />

          {activeTab === "tasks" && (
            <>
              <SchedulerTaskTable
                tasks={taskList.items}
                total={taskList.total ?? taskList.items.length}
                loading={taskList.loading}
                onToggle={handleToggle}
                onRun={handleRun}
                onSelect={setSelectedTask}
                pageSize={TASK_PAGE_SIZE}
              />
              {/* 无限滚动哨兵：进入视口即追加下一页（taskList.hasMore 为否时 hook 自动停观察）。 */}
              <div ref={sentinelRef} aria-hidden className="h-px w-full" />
              {/* 居中翻页控件（页总数 + 控件组居中成组），与无限滚动并存；sticky 底栏始终可达。 */}
              {taskList.items.length > 0 && (
                <div className="sticky bottom-0 -mx-6 border-t border-border bg-muted/95 px-6 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  <Pagination
                    page={taskList.currentPage}
                    totalPages={taskList.totalPages}
                    onPageChange={handleGoToPage}
                    total={taskList.total ?? undefined}
                    itemLabel="task"
                    disabled={taskList.loading}
                    loadingMore={taskList.loadingMore}
                  />
                </div>
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
