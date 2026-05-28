/**
 * Scheduler 共享模块 — 统一导出类型、API 客户端和 hooks。
 *
 * Dashboard 和 Interface/Scheduler 页面共同依赖此模块。
 */

// Types
export type {
  TriggerType,
  ExecutionStatus,
  FireReason,
  StatsGroupBy,
  StatsWindow,
} from "./types";
export type {
  ScheduledTaskDTO,
  TaskExecutionDTO,
  KpiResponse,
  StatsBucket,
  StatsResponse,
  TaskListResponse,
  ExecutionListResponse,
  TaskDetailResponse,
  DashboardFilters,
} from "./types";

// API
export {
  fetchKpis,
  fetchTasks,
  fetchTaskDetail,
  fetchExecutions,
  fetchStats,
  runTaskNow,
  toggleTaskEnabled,
} from "./api";

// Filter type
export type { FilterOption } from "./hooks/filter-option";
