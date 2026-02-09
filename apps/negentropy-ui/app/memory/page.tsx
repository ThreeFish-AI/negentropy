"use client";

import { useEffect, useState } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { fetchMemoryDashboard, MemoryDashboard } from "@/features/memory";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

export default function MemoryDashboardPage() {
  const [dashboard, setDashboard] = useState<MemoryDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchMemoryDashboard(APP_NAME)
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch((err) => {
        if (active) setError(String(err));
      });
    return () => {
      active = false;
    };
  }, []);

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
                  {dashboard.low_retention_count} memories with low retention score
                  (&lt; 10%)
                </p>
                <p className="mt-1">
                  These memories may be forgotten soon. Consider reviewing them in the{" "}
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
