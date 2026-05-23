/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";

import { outlineButtonClassName } from "@/components/ui/button-styles";
import {
  fetchRetrievalMetrics,
  type MemoryDashboard,
  type RetrievalMetrics,
} from "@/features/memory";

interface MemoryDetailPanelProps {
  dashboard: MemoryDashboard | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  activeUserId: string | undefined;
  onFilterUser: (userId: string) => void;
  onClearFilter: () => void;
}

export function MemoryDetailPanel({
  dashboard,
  loading,
  error,
  onRefresh,
  activeUserId,
  onFilterUser,
  onClearFilter,
}: MemoryDetailPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [userId, setUserId] = useState(activeUserId ?? "");

  useEffect(() => {
    setUserId(activeUserId ?? "");
  }, [activeUserId]);

  const [showRetrieval, setShowRetrieval] = useState(false);
  const [retrievalMetrics, setRetrievalMetrics] =
    useState<RetrievalMetrics | null>(null);
  const [retrievalLoading, setRetrievalLoading] = useState(false);
  const [retrievalError, setRetrievalError] = useState<string | null>(null);

  const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

  const loadRetrievalMetrics = useCallback(async () => {
    if (!activeUserId) return;
    setRetrievalLoading(true);
    setRetrievalError(null);
    try {
      const data = await fetchRetrievalMetrics({
        user_id: activeUserId,
        app_name: APP_NAME,
      });
      setRetrievalMetrics(data);
    } catch (err) {
      setRetrievalError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrievalLoading(false);
    }
  }, [activeUserId, APP_NAME]);

  useEffect(() => {
    if (showRetrieval && activeUserId) {
      loadRetrievalMetrics();
    }
  }, [showRetrieval, activeUserId, loadRetrievalMetrics]);

  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        Memory 详情
      </button>

      {expanded && (
        <div className="mt-2 space-y-3">
          {/* Filter bar */}
          <div className="flex items-center gap-3">
            <input
              className="w-64 rounded-lg border border-border bg-card px-3 py-2 text-xs placeholder:text-muted"
              placeholder="Filter by User ID (optional)"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onFilterUser(userId.trim())}
            />
            <button
              className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground/90"
              onClick={() => onFilterUser(userId.trim())}
            >
              Filter
            </button>
            {activeUserId && (
              <button
                className={outlineButtonClassName(
                  "neutral",
                  "rounded-lg px-3 py-2 text-xs",
                )}
                onClick={onClearFilter}
              >
                Clear
              </button>
            )}
            <div className="flex-1" />
            <button
              className={outlineButtonClassName(
                "neutral",
                "rounded-lg px-3 py-2 text-xs",
              )}
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            {activeUserId && (
              <span className="text-xs text-muted">
                Filtered: {activeUserId}
              </span>
            )}
          </div>

          {/* Error */}
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
              {error}
            </div>
          ) : null}

          {/* Low retention warning */}
          {dashboard && dashboard.low_retention_count > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-xs text-warning-foreground">
              <p className="font-semibold">
                {dashboard.low_retention_count} memories with low retention score
                (&lt; 10%)
              </p>
              <p className="mt-1">
                These memories may be forgotten soon. Consider reviewing them in
                the{" "}
                <a href="/memory/audit" className="underline">
                  Audit
                </a>{" "}
                page.
              </p>
            </div>
          )}

          {/* Recent Audits */}
          {dashboard && (
            <div className="text-xs text-muted">
              Recent Audits: <span className="font-semibold text-foreground">{dashboard.recent_audit_count}</span>
            </div>
          )}

          {/* Retrieval Metrics */}
          <div>
            <button
              className="flex items-center gap-2 text-xs font-semibold text-foreground"
              onClick={() => setShowRetrieval(!showRetrieval)}
            >
              <svg
                className={`h-3 w-3 transition-transform ${showRetrieval ? "rotate-90" : ""}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
              Retrieval Metrics
            </button>

            {showRetrieval && (
              <div className="mt-2">
                {!activeUserId ? (
                  <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted">
                    Filter by a User ID above to view retrieval quality metrics.
                  </div>
                ) : retrievalLoading ? (
                  <p className="text-xs text-muted">
                    Loading retrieval metrics...
                  </p>
                ) : retrievalError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                    {retrievalError}
                  </div>
                ) : retrievalMetrics ? (
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                    {[
                      {
                        label: "Total Retrievals",
                        value: retrievalMetrics.total_retrievals,
                      },
                      {
                        label: "Precision@K",
                        value: `${(retrievalMetrics.precision_at_k * 100).toFixed(1)}%`,
                      },
                      {
                        label: "Utilization Rate",
                        value: `${(retrievalMetrics.utilization_rate * 100).toFixed(1)}%`,
                      },
                      {
                        label: "Noise Rate",
                        value: `${(retrievalMetrics.noise_rate * 100).toFixed(1)}%`,
                      },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className="rounded-md border border-border bg-card p-3"
                      >
                        <p className="text-[10px] uppercase tracking-wide text-muted">
                          {m.label}
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
