/**
 * Definition Registry 前端 API 客户端（走 BFF /api/interface/definitions/*）。
 *
 * 复用项目通行的 jsonFetch 模式（参见 features/routine/api.ts）：no-store + JSON
 * header + 非 2xx 抛错并透传后端 detail（如 422 校验失败正文）。
 */

import type {
  DefinitionCreatePayload,
  DefinitionDTO,
  DefinitionListFilters,
  DefinitionListResponse,
  DefinitionUpdatePayload,
} from "./types";

const API_ROOT = "/api/interface/definitions";

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
    let detail: string | undefined;
    try {
      const body = await res.json();
      detail = body?.detail || body?.error?.message || body?.message;
    } catch {
      // body not JSON
    }
    throw new Error(detail || `definitions API ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchDefinitions(
  filters: DefinitionListFilters = {},
): Promise<DefinitionListResponse> {
  const sp = new URLSearchParams();
  if (filters.kind) sp.set("kind", filters.kind);
  if (filters.is_enabled !== undefined) sp.set("is_enabled", String(filters.is_enabled));
  if (filters.limit !== undefined) sp.set("limit", String(filters.limit));
  if (filters.offset !== undefined) sp.set("offset", String(filters.offset));
  const q = sp.toString();
  return jsonFetch(q ? `?${q}` : "");
}

export async function getDefinition(id: string): Promise<DefinitionDTO> {
  return jsonFetch(`/${encodeURIComponent(id)}`);
}

export async function createDefinition(
  body: DefinitionCreatePayload,
): Promise<DefinitionDTO> {
  return jsonFetch("", { method: "POST", body: JSON.stringify(body) });
}

export async function updateDefinition(
  id: string,
  body: DefinitionUpdatePayload,
): Promise<DefinitionDTO> {
  return jsonFetch(`/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteDefinition(id: string): Promise<{ status: string; id: string }> {
  return jsonFetch(`/${encodeURIComponent(id)}`, { method: "DELETE" });
}
