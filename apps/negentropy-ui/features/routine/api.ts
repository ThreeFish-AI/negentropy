/**
 * Routine API 客户端。
 *
 * 所有请求经 ``/api/routine/*`` 反向代理走到后端 ``/routines/*``。
 */

import type {
  IterationListResponse,
  RoutineCreatePayload,
  RoutineDTO,
  RoutineFilters,
  RoutineFromPresetPayload,
  RoutineKpis,
  RoutineListResponse,
  RoutineIterationDTO,
  RoutinePresetSummary,
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

export async function fetchRoutines(filters: Partial<RoutineFilters> = {}): Promise<RoutineListResponse> {
  const sp = new URLSearchParams();
  if (filters.status) sp.set("status", filters.status);
  if (filters.q) sp.set("q", filters.q);
  const q = sp.toString();
  return jsonFetch(`${q ? `?${q}` : ""}`);
}

export async function fetchRoutineDetail(routineId: string, recent = 20): Promise<RoutineDTO> {
  return jsonFetch(`/${encodeURIComponent(routineId)}?recent=${recent}`);
}

export async function fetchIterations(
  routineId: string,
  opts: { limit?: number; before_seq?: number } = {},
): Promise<IterationListResponse> {
  const sp = new URLSearchParams();
  if (opts.limit) sp.set("limit", String(opts.limit));
  if (opts.before_seq != null) sp.set("before_seq", String(opts.before_seq));
  const q = sp.toString();
  return jsonFetch(`/${encodeURIComponent(routineId)}/iterations${q ? `?${q}` : ""}`);
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

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export async function fetchPresets(): Promise<RoutinePresetSummary[]> {
  return jsonFetch("/presets");
}

export async function createRoutineFromPreset(
  body: RoutineFromPresetPayload,
): Promise<RoutineDTO> {
  return jsonFetch("/from-preset", { method: "POST", body: JSON.stringify(body) });
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
