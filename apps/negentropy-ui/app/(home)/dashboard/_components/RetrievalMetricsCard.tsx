/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchMemories,
  fetchRetrievalMetrics,
  type RetrievalMetrics,
} from "@/features/memory";

import { MetricCell } from "./MetricCell";

/* ---------- helpers ---------- */

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function precisionTone(v: number): "good" | "warn" | "neutral" {
  return v >= 0.7 ? "good" : v < 0.4 ? "warn" : "neutral";
}

function utilizationTone(v: number): "good" | "warn" | "neutral" {
  return v >= 0.5 ? "good" : v < 0.2 ? "warn" : "neutral";
}

function noiseTone(v: number): "good" | "warn" | "neutral" {
  return v >= 0.3 ? "warn" : "neutral";
}

/* ---------- constants ---------- */

const DAY_OPTIONS = [
  { label: "7d", value: 7 },
  { label: "14d", value: 14 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
] as const;

const MAX_VISIBLE_USERS = 10;

/* ---------- types ---------- */

interface UserOption {
  id: string;
  displayName: string;
}

interface RetrievalMetricsCardProps {
  appName: string;
}

/* ---------- pill button ---------- */

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
        active
          ? "bg-foreground text-background"
          : "border border-border text-muted hover:text-foreground hover:border-foreground/30"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------- main component ---------- */

export function RetrievalMetricsCard({ appName }: RetrievalMetricsCardProps) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const [metrics, setMetrics] = useState<RetrievalMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeq = useRef(0);

  // Fetch user list on mount
  useEffect(() => {
    async function loadUsers() {
      try {
        const payload = await fetchMemories(appName);
        const userOptions: UserOption[] = (payload.users ?? []).map((u) => ({
          id: u.id,
          displayName: u.name || u.label || u.id,
        }));
        setUsers(userOptions);
      } catch {
        // User list is non-critical — proceed with empty list
      } finally {
        setUsersLoading(false);
      }
    }
    loadUsers();
  }, [appName]);

  // Fetch metrics when filter changes
  const loadMetrics = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setMetricsLoading(true);
    setError(null);
    try {
      const data = await fetchRetrievalMetrics({
        user_id: activeUserId ?? undefined,
        app_name: appName,
        days,
      });
      if (seq !== fetchSeq.current) return;
      setMetrics(data);
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (seq !== fetchSeq.current) return;
      setMetricsLoading(false);
    }
  }, [activeUserId, appName, days]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const visibleUsers = users.slice(0, MAX_VISIBLE_USERS);
  const hiddenCount = users.length - MAX_VISIBLE_USERS;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground">
            Retrieval Metrics
          </h3>
          <span className="text-[10px] text-muted">检索效果指标</span>
        </div>
        <select
          aria-label="Time window"
          className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted cursor-pointer"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {DAY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* User filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Pill active={activeUserId === null} onClick={() => setActiveUserId(null)}>
          All Users
        </Pill>
        {usersLoading ? (
          <span className="text-[10px] text-muted animate-pulse">Loading users...</span>
        ) : (
          <>
            {visibleUsers.map((u) => (
              <Pill
                key={u.id}
                active={activeUserId === u.id}
                onClick={() => setActiveUserId(u.id)}
              >
                {u.displayName}
              </Pill>
            ))}
            {hiddenCount > 0 && (
              <span className="rounded-full px-3 py-1 text-xs text-muted border border-dashed border-border">
                +{hiddenCount} more
              </span>
            )}
          </>
        )}
      </div>

      {/* Metrics grid */}
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <MetricCell
            label="Retrievals"
            value={metrics?.total_retrievals ?? "—"}
            loading={metricsLoading}
          />
          <MetricCell
            label="Precision@K"
            value={metrics ? formatPercent(metrics.precision_at_k) : "—"}
            tone={metrics ? precisionTone(metrics.precision_at_k) : "neutral"}
            loading={metricsLoading}
          />
          <MetricCell
            label="Utilization"
            value={metrics ? formatPercent(metrics.utilization_rate) : "—"}
            tone={metrics ? utilizationTone(metrics.utilization_rate) : "neutral"}
            loading={metricsLoading}
          />
          <MetricCell
            label="Noise Rate"
            value={metrics ? formatPercent(metrics.noise_rate) : "—"}
            tone={metrics ? noiseTone(metrics.noise_rate) : "neutral"}
            loading={metricsLoading}
          />
        </div>
      )}
    </div>
  );
}
