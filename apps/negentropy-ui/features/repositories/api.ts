/**
 * Repository 数据访问层 —— 经 /api/interface/repositories 代理转发到后端 /interface/repositories。
 */

import type {
  BranchInspectResponse,
  RepositoryCreatePayload,
  RepositoryDTO,
  RepositoryUpdatePayload,
} from "./types";

const API_ROOT = "/api/interface/repositories";

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_ROOT}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail || body?.error?.message || body?.message || JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function fetchRepositories(): Promise<RepositoryDTO[]> {
  return jsonFetch("");
}

export async function createRepository(body: RepositoryCreatePayload): Promise<RepositoryDTO> {
  return jsonFetch("", { method: "POST", body: JSON.stringify(body) });
}

export async function updateRepository(
  id: string,
  body: RepositoryUpdatePayload,
): Promise<RepositoryDTO> {
  return jsonFetch(`/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteRepository(id: string): Promise<void> {
  return jsonFetch(`/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** 给定本地仓库根路径枚举其 git 分支（填好 local_path 后调用，类比 Test Connection）。 */
export async function inspectBranches(localPath: string): Promise<BranchInspectResponse> {
  return jsonFetch("/inspect", {
    method: "POST",
    body: JSON.stringify({ local_path: localPath }),
  });
}
