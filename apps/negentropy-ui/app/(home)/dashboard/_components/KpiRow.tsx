"use client";

import type { KpiResponse } from "../_lib/types";

interface KpiRowProps {
  kpis: KpiResponse | null;
  loading: boolean;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMs(value: number) {
  if (value < 1000) return `${value.toFixed(0)}ms`;
  return `${(value / 1000).toFixed(2)}s`;
}

export function KpiRow({ kpis, loading }: KpiRowProps) {
  const cards = [
    { label: "Tasks", value: kpis?.total_tasks ?? "—", hint: `enabled ${kpis?.enabled_tasks ?? "—"}` },
    { label: `Runs (${kpis?.window ?? "24h"})`, value: kpis?.runs ?? "—" },
    {
      label: "Success rate",
      value: kpis ? formatPercent(kpis.success_rate) : "—",
      tone: kpis && kpis.success_rate >= 0.95 ? "good" : "warn",
    },
    { label: "Running", value: kpis?.running ?? "—" },
    {
      label: "Failed",
      value: kpis?.failed ?? "—",
      tone: kpis && kpis.failed > 0 ? "warn" : "neutral",
    },
    {
      label: "Avg latency",
      value: kpis ? formatMs(kpis.avg_latency_ms) : "—",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-border bg-card p-3 shadow-sm"
          aria-busy={loading}
        >
          <div className="text-[10px] uppercase tracking-wider text-muted">{card.label}</div>
          <div
            className={`mt-1 text-xl font-semibold ${
              card.tone === "warn"
                ? "text-amber-600 dark:text-amber-400"
                : card.tone === "good"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
            }`}
          >
            {loading && card.value === "—" ? "…" : card.value}
          </div>
          {card.hint ? <div className="text-[11px] text-muted">{card.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}
