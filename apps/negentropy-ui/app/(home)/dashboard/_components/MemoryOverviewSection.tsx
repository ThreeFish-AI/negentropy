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
  fetchMemoryDashboard,
  fetchRetrievalMetrics,
  MemoryDashboard,
  RetrievalMetrics,
} from "@/features/memory";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

export function MemoryOverviewSection() {
  const [dashboard, setDashboard] = useState<MemoryDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [userId, setUserId] = useState("");
  const [activeUserId, setActiveUserId] = useState<string | undefined>(
    undefined,
  );

  const [showRetrieval, setShowRetrieval] = useState(false);
  const [retrievalMetrics, setRetrievalMetrics] =
    useState<RetrievalMetrics | null>(null);
  const [retrievalLoading, setRetrievalLoading] = useState(false);
  const [retrievalError, setRetrievalError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMemoryDashboard(APP_NAME, activeUserId);
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [activeUserId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleFilterUser = () => {
    const trimmed = userId.trim();
    setActiveUserId(trimmed || undefined);
  };

  const handleClearFilter = () => {
    setUserId("");
    setActiveUserId(undefined);
  };

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
  }, [activeUserId]);

  useEffect(() => {
    if (showRetrieval && activeUserId) {
      loadRetrievalMetrics();
    }
  }, [showRetrieval, activeUserId, loadRetrievalMetrics]);

  const cards = dashboard
    ? [
        { label: "Users", value: dashboard.user_count },
        { label: "Memories", value: dashboard.memory_count },
        { label: "Facts", value: dashboard.fact_count },
        {
          label: "Avg Retention",
          value: `${(dashboard.avg_retention_score * 100).toFixed(1)}%`,
        },
        {
          label: "Avg Importance",
          value: `${(dashboard.avg_importance_score * 100).toFixed(1)}%`,
        },
        { label: "Low Retention", value: dashboard.low_retention_count },
        { label: "High Importance", value: dashboard.high_importance_count },
        { label: "Recent Audits", value: dashboard.recent_audit_count },
      ]
    : [];

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          Memory Overview
        </h2>
        <span className="text-xs text-muted-foreground">Memory 指标概览</span>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <input
          className="w-64 rounded-lg border border-border bg-card px-3 py-2 text-xs placeholder:text-muted-foreground"
          placeholder="Filter by User ID (optional)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFilterUser()}
        />
        <button
          className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground/90"
          onClick={handleFilterUser}
        >
          Filter
        </button>
        {activeUserId && (
          <button
            className={outlineButtonClassName(
              "neutral",
              "rounded-lg px-3 py-2 text-xs",
            )}
            onClick={handleClearFilter}
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
          onClick={loadDashboard}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
        {activeUserId && (
          <span className="text-xs text-muted-foreground">
            Filtered: {activeUserId}
          </span>
        )}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
          {error}
        </div>
      ) : !dashboard ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <p className="text-caption uppercase tracking-overline text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {dashboard.low_retention_count > 0 && (
            <div className="mt-6 rounded-2xl border border-warning/30 bg-warning/5 p-5 text-xs text-warning-foreground">
              <p className="font-semibold">
                {dashboard.low_retention_count} memories with low retention
                score (&lt; 10%)
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

          <div className="mt-6">
            <button
              className="flex items-center gap-2 text-sm font-semibold text-foreground"
              onClick={() => setShowRetrieval(!showRetrieval)}
            >
              <span
                className={`transition-transform ${showRetrieval ? "rotate-90" : ""}`}
              >
                &#x25B6;
              </span>
              Retrieval Metrics
            </button>

            {showRetrieval && (
              <div className="mt-4">
                {!activeUserId ? (
                  <div className="rounded-2xl border border-border bg-card p-5 text-xs text-muted-foreground">
                    Filter by a User ID above to view retrieval quality metrics.
                  </div>
                ) : retrievalLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Loading retrieval metrics...
                  </p>
                ) : retrievalError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                    {retrievalError}
                  </div>
                ) : retrievalMetrics ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                        className="rounded-xl border border-border bg-card p-4 shadow-sm"
                      >
                        <p className="text-caption uppercase tracking-overline text-muted-foreground">
                          {m.label}
                        </p>
                        <p className="mt-1 text-xl font-bold text-foreground tabular-nums">
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
