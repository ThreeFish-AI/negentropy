"use client";

/**
 * 拉取一主五翼 6 Agents 元数据。
 *
 * 通过 next.config rewrites 透明代理到 ui 端 BFF `/api/interface/subagents`，
 * 避免在 wiki 重复实现 SubAgent 字段裁剪与鉴权头转发。
 *
 * 缓存策略：sessionStorage 缓存（每 tab 一份），TTL 由调用方控制。
 * 设计权衡：SubAgent 列表低频变更（运维事件），用 sessionStorage 而非 SWR /
 * react-query —— wiki 端不引入额外数据层依赖，保持 client bundle 轻量。
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface SubAgentSummary {
  /** SubAgent 名称（如 PerceptionFaculty），用作 forwardedProps.preferred_subagent。 */
  name: string;
  /** UI 友好名（display_name 或 fallback 到 name）。 */
  displayName: string;
  /** 角色定位描述。 */
  description?: string;
  /** 是否启用（仅暴露启用项给 wiki UI）。 */
  enabled: boolean;
  /** 是否为 root（即「一主」NegentropyEngine）。 */
  isRoot: boolean;
}

const STORAGE_KEY = "wiki:agent-chat:subagents:v1";
const TTL_MS = 5 * 60 * 1000; // 5 分钟

type CachePayload = {
  ts: number;
  data: SubAgentSummary[];
};

type RawSubAgent = {
  name?: unknown;
  display_name?: unknown;
  description?: unknown;
  enabled?: unknown;
  is_root?: unknown;
  is_active?: unknown;
};

function normalize(raw: unknown): SubAgentSummary[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): SubAgentSummary | null => {
      const r = item as RawSubAgent;
      if (typeof r?.name !== "string" || r.name.length === 0) return null;
      const enabled =
        typeof r.enabled === "boolean"
          ? r.enabled
          : typeof r.is_active === "boolean"
            ? r.is_active
            : true;
      return {
        name: r.name,
        displayName:
          typeof r.display_name === "string" && r.display_name.length > 0
            ? r.display_name
            : r.name,
        description:
          typeof r.description === "string" ? r.description : undefined,
        enabled,
        isRoot: r.is_root === true,
      };
    })
    .filter((x): x is SubAgentSummary => x !== null);
}

function readCache(): SubAgentSummary[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (
      typeof parsed?.ts !== "number" ||
      Date.now() - parsed.ts > TTL_MS ||
      !Array.isArray(parsed.data)
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data: SubAgentSummary[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachePayload = { ts: Date.now(), data };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / disabled storage
  }
}

export interface UseSubAgentsResult {
  agents: SubAgentSummary[];
  /** 默认主 Agent（root），无则 null。 */
  rootAgent: SubAgentSummary | null;
  /** 五翼 SubAgents（非 root 且 enabled）。 */
  faculties: SubAgentSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSubAgents(): UseSubAgentsResult {
  const [agents, setAgents] = useState<SubAgentSummary[]>(() => readCache() ?? []);
  const [loading, setLoading] = useState<boolean>(() => readCache() === null);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch("/api/interface/subagents", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const body = (await res.json()) as { items?: unknown } | unknown[];
      const items = Array.isArray(body)
        ? body
        : Array.isArray((body as { items?: unknown }).items)
          ? ((body as { items?: unknown }).items as unknown[])
          : [];
      const normalized = normalize(items);
      setAgents(normalized);
      writeCache(normalized);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (agents.length > 0) return;
    void fetchOnce();
  }, [agents.length, fetchOnce]);

  const rootAgent = agents.find((a) => a.isRoot && a.enabled) ?? null;
  const faculties = agents.filter((a) => !a.isRoot && a.enabled);

  return {
    agents,
    rootAgent,
    faculties,
    loading,
    error,
    refresh: fetchOnce,
  };
}
