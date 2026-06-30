/**
 * Scheduler API 客户端。
 *
 * 所有请求经 ``/api/scheduler/*`` 反向代理走到后端 ``/scheduler/*``。
 */

import type {
  DashboardFilters,
  ExecutionListResponse,
  HandlerListResponse,
  HandlerSourceResponse,
  KpiResponse,
  ScheduledTaskDTO,
  StatsGroupBy,
  StatsResponse,
  StatsWindow,
  TaskDetailResponse,
  TaskListResponse,
  TaskWritePayload,
} from "./types";

const API_ROOT = "/api/scheduler";

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_ROOT}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = typeof j === "object" && j ? JSON.stringify(j) : String(j);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(`scheduler API ${path} → ${res.status}: ${detail || res.statusText}`);
  }
  return (await res.json()) as T;
}

function buildFilterQuery(filters: Partial<DashboardFilters>): string {
  const sp = new URLSearchParams();
  if (filters.role) sp.set("role", filters.role);
  if (filters.scenario) sp.set("scenario", filters.scenario);
  if (filters.agent) sp.set("agent", filters.agent);
  if (filters.owner) sp.set("owner", filters.owner);
  if (filters.category) sp.set("category", filters.category);
  return sp.toString();
}

export async function fetchKpis(window: StatsWindow = "24h"): Promise<KpiResponse> {
  return jsonFetch(`/kpis?window=${encodeURIComponent(window)}`);
}

export async function fetchTasks(
  filters: Partial<DashboardFilters> = {},
  opts: { limit?: number; cursor?: string | null; signal?: AbortSignal } = {},
): Promise<TaskListResponse> {
  const sp = new URLSearchParams(buildFilterQuery(filters));
  if (opts.limit) sp.set("limit", String(opts.limit));
  if (opts.cursor) sp.set("cursor", opts.cursor);
  const q = sp.toString();
  return jsonFetch(`/tasks${q ? `?${q}` : ""}`, opts.signal ? { signal: opts.signal } : undefined);
}

export async function fetchTaskDetail(taskId: string): Promise<TaskDetailResponse> {
  return jsonFetch(`/tasks/${encodeURIComponent(taskId)}`);
}

export async function fetchExecutions(
  filters: Partial<DashboardFilters> & {
    limit?: number;
    task_id?: string;
    cursor?: string | null;
    signal?: AbortSignal;
  } = {},
): Promise<ExecutionListResponse> {
  const sp = new URLSearchParams();
  if (filters.role) sp.set("role", filters.role);
  if (filters.scenario) sp.set("scenario", filters.scenario);
  if (filters.agent) sp.set("agent", filters.agent);
  if (filters.task_id) sp.set("task_id", filters.task_id);
  if (filters.limit) sp.set("limit", String(filters.limit));
  if (filters.cursor) sp.set("cursor", filters.cursor);
  const q = sp.toString();
  return jsonFetch(`/executions${q ? `?${q}` : ""}`, filters.signal ? { signal: filters.signal } : undefined);
}

export async function fetchStats(
  groupBy: StatsGroupBy,
  window: StatsWindow = "24h",
): Promise<StatsResponse> {
  return jsonFetch(
    `/stats?group_by=${encodeURIComponent(groupBy)}&window=${encodeURIComponent(window)}`,
  );
}

export async function runTaskNow(taskId: string): Promise<{ ok: boolean; execution_id: string | null }> {
  return jsonFetch(`/tasks/${encodeURIComponent(taskId)}/run`, { method: "POST" });
}

export async function toggleTaskEnabled(
  taskId: string,
  enabled: boolean,
): Promise<{ ok: boolean; enabled: boolean }> {
  return jsonFetch(`/tasks/${encodeURIComponent(taskId)}/toggle`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}

// ---------------------------------------------------------------------------
// Handler Manifest
// ---------------------------------------------------------------------------

export async function fetchHandlers(): Promise<HandlerListResponse> {
  return jsonFetch("/handlers");
}

/** 拉取指定 handler 的实现源码 + docstring + 描述（驱动任务详情抽屉「实现逻辑」区）。 */
export async function fetchHandlerSource(handlerKind: string): Promise<HandlerSourceResponse> {
  return jsonFetch(`/handlers/${encodeURIComponent(handlerKind)}/source`);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createTask(body: TaskWritePayload): Promise<ScheduledTaskDTO> {
  return jsonFetch("/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateTask(taskId: string, body: Partial<TaskWritePayload>): Promise<ScheduledTaskDTO> {
  return jsonFetch(`/tasks/${encodeURIComponent(taskId)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteTask(taskId: string): Promise<{ ok: boolean; deleted_task_id: string }> {
  return jsonFetch(`/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });
}
