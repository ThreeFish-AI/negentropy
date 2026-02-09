"use client";

import { useCallback, useEffect, useState } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { fetchMemoryDashboard, MemoryDashboard } from "@/features/memory";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

export default function MemoryDashboardPage() {
  const [dashboard, setDashboard] = useState<MemoryDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // D3: 用户筛选
  const [userId, setUserId] = useState("");
  const [activeUserId, setActiveUserId] = useState<string | undefined>(
    undefined,
  );

  // D3: 可刷新的加载逻辑
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

  const cards = dashboard
    ? [
        { label: "Users", value: dashboard.user_count },
        { label: "Memories", value: dashboard.memory_count },
        { label: "Facts", value: dashboard.fact_count },
        {
          label: "Avg Retention",
          value: `${(dashboard.avg_retention_score * 100).toFixed(1)}%`,
        },
        { label: "Low Retention", value: dashboard.low_retention_count },
        { label: "Recent Audits", value: dashboard.recent_audit_count },
      ]
    : [];

  return (
    <div className="min-h-screen bg-zinc-50">
      <MemoryNav title="Dashboard" description="Memory 指标概览" />
      <div className="px-6 py-6">
        {/* D3: 操作栏 — 用户筛选 + 刷新 */}
        <div className="mb-6 flex items-center gap-3">
          <input
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs w-64"
            placeholder="Filter by User ID (optional)"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFilterUser()}
          />
          <button
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white"
            onClick={handleFilterUser}
          >
            Filter
          </button>
          {activeUserId && (
            <button
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 transition-colors"
              onClick={handleClearFilter}
            >
              Clear
            </button>
          )}
          <div className="flex-1" />
          <button
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 transition-colors"
            onClick={loadDashboard}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
          {activeUserId && (
            <span className="text-xs text-zinc-500">
              Filtered: {activeUserId}
            </span>
          )}
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-xs text-rose-700">
            {error}
          </div>
        ) : !dashboard ? (
          <p className="text-xs text-zinc-500">Loading...</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-[11px] uppercase tracking-wide text-zinc-400">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-zinc-900">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            {dashboard.low_retention_count > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-700">
                <p className="font-semibold">
                  {dashboard.low_retention_count} memories with low retention
                  score (&lt; 10%)
                </p>
                <p className="mt-1">
                  These memories may be forgotten soon. Consider reviewing them
                  in the{" "}
                  <a href="/memory/audit" className="underline">
                    Audit
                  </a>{" "}
                  page.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
