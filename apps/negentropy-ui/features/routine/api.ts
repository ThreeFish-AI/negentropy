/**
 * Routine API 客户端。
 *
 * 所有请求经 ``/api/routine/*`` 反向代理走到后端 ``/routines/*``。
 */

import type {
  IterationEventsResponse,
  IterationListResponse,
  RoutineCreatePayload,
  RoutineDTO,
  RoutineFilters,
  RoutineKpis,
  RoutineListResponse,
  RoutineIterationDTO,
  RoutineTemplateItem,
  RoutineUpdatePayload,
} from "./types";

const API_ROOT = "/api/routine";

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
    throw new Error(`routine API ${path} → ${res.status}: ${detail || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function fetchKpis(): Promise<RoutineKpis> {
  return jsonFetch("/kpis");
}

export async function fetchRoutines(
  filters: Partial<RoutineFilters> = {},
  opts: { limit?: number; cursor?: string | null; signal?: AbortSignal } = {},
): Promise<RoutineListResponse> {
  const sp = new URLSearchParams();
  if (filters.status) sp.set("status", filters.status);
  if (filters.q) sp.set("q", filters.q);
  if (filters.is_template != null) sp.set("is_template", String(filters.is_template));
  if (filters.source_task_key) sp.set("source_task_key", filters.source_task_key);
  if (opts.limit) sp.set("limit", String(opts.limit));
  if (opts.cursor) sp.set("cursor", opts.cursor);
  const q = sp.toString();
  return jsonFetch(`${q ? `?${q}` : ""}`, opts.signal ? { signal: opts.signal } : undefined);
}

export async function fetchRoutineDetail(routineId: string, recent = 20): Promise<RoutineDTO> {
  return jsonFetch(`/${encodeURIComponent(routineId)}?recent=${recent}`);
}

export async function fetchIterations(
  routineId: string,
  opts: { limit?: number; before_seq?: number; signal?: AbortSignal } = {},
): Promise<IterationListResponse> {
  const sp = new URLSearchParams();
  if (opts.limit) sp.set("limit", String(opts.limit));
  if (opts.before_seq != null) sp.set("before_seq", String(opts.before_seq));
  const q = sp.toString();
  return jsonFetch(
    `/${encodeURIComponent(routineId)}/iterations${q ? `?${q}` : ""}`,
    opts.signal ? { signal: opts.signal } : undefined,
  );
}

/** 拉取单次迭代的「全过程」动作级审计事件流（按 seq 升序，懒加载于审计抽屉打开时）。 */
export async function fetchIterationEvents(
  routineId: string,
  iterationId: string,
  opts: { limit?: number; after_seq?: number } = {},
): Promise<IterationEventsResponse> {
  const sp = new URLSearchParams();
  if (opts.limit) sp.set("limit", String(opts.limit));
  if (opts.after_seq != null) sp.set("after_seq", String(opts.after_seq));
  const q = sp.toString();
  return jsonFetch(
    `/${encodeURIComponent(routineId)}/iterations/${encodeURIComponent(iterationId)}/events${q ? `?${q}` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createRoutine(body: RoutineCreatePayload): Promise<RoutineDTO> {
  return jsonFetch("", { method: "POST", body: JSON.stringify(body) });
}

export async function updateRoutine(routineId: string, body: RoutineUpdatePayload): Promise<RoutineDTO> {
  return jsonFetch(`/${encodeURIComponent(routineId)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteRoutine(
  routineId: string,
): Promise<{ ok: boolean; deleted_routine_id: string }> {
  return jsonFetch(`/${encodeURIComponent(routineId)}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// 控制动作
// ---------------------------------------------------------------------------

type ControlAction = "start" | "pause" | "resume" | "cancel";

export async function controlRoutine(routineId: string, action: ControlAction): Promise<RoutineDTO> {
  return jsonFetch(`/${encodeURIComponent(routineId)}/${action}`, { method: "POST" });
}

/**
 * 重启失败 / 取消的 routine：复位运行态并重跑。`keep_reflections` 决定是否携带既往反思记忆。
 * 仅对 failed/cancelled 终态有效（后端守卫，否则 409）。
 */
export async function restartRoutine(
  routineId: string,
  body: { keep_reflections: boolean },
): Promise<RoutineDTO> {
  return jsonFetch(`/${encodeURIComponent(routineId)}/restart`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function approveIteration(
  routineId: string,
  iterationId: string,
): Promise<RoutineIterationDTO> {
  return jsonFetch(
    `/${encodeURIComponent(routineId)}/iterations/${encodeURIComponent(iterationId)}/approve`,
    { method: "POST" },
  );
}

export async function rejectIteration(
  routineId: string,
  iterationId: string,
): Promise<RoutineIterationDTO> {
  return jsonFetch(
    `/${encodeURIComponent(routineId)}/iterations/${encodeURIComponent(iterationId)}/reject`,
    { method: "POST" },
  );
}

/**
 * 手动回收终态 routine 的隔离 worktree（best-effort，不改变 routine 状态）。
 * 仅对 succeeded/failed/cancelled 终态且 worktree 仍活跃的 routine 有效（后端守卫，否则 409）。
 */
export async function cleanupWorktree(routineId: string): Promise<RoutineDTO> {
  return jsonFetch(`/${encodeURIComponent(routineId)}/cleanup-worktree`, { method: "POST" });
}

/** 手动同步 PR 合并状态（即时回写 pr_merged；后端经 gh pr view 检测并 SSE 推送）。 */
export async function syncRoutinePr(routineId: string): Promise<RoutineDTO> {
  return jsonFetch(`/${encodeURIComponent(routineId)}/sync-pr`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Templates（合并模板列表）
// ---------------------------------------------------------------------------

export async function fetchTemplates(category?: string): Promise<RoutineTemplateItem[]> {
  const sp = new URLSearchParams();
  if (category) sp.set("category", category);
  const q = sp.toString();
  return jsonFetch(`/templates${q ? `?${q}` : ""}`);
}
