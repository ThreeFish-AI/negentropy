"use client";

import type { KpiResponse } from "@/features/scheduler";

interface SchedulerKpiStripProps {
  kpis: KpiResponse | null;
  loading: boolean;
}

interface MetricCellProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

function MetricCell({ label, value, sub, color }: MetricCellProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      <div className={`text-lg font-bold ${color ?? "text-foreground"}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
      )}
    </div>
  );
}

function SkeletonCell() {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex-1 min-w-0 animate-pulse">
      <div className="h-3 w-12 rounded bg-muted/50 mb-2" />
      <div className="h-5 w-16 rounded bg-muted/50" />
    </div>
  );
}

export function SchedulerKpiStrip({ kpis, loading }: SchedulerKpiStripProps) {
  if (loading && !kpis) {
    return (
      <div className="flex gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCell key={i} />
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  const successRate = kpis.runs > 0 ? kpis.success_rate * 100 : 0;
  const rateColor =
    successRate >= 95
      ? "text-emerald-600 dark:text-emerald-400"
      : successRate >= 80
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="flex gap-3">
      <MetricCell
        label="Tasks"
        value={String(kpis.total_tasks)}
        sub={`${kpis.enabled_tasks} enabled`}
      />
      <MetricCell
        label="Runs"
        value={String(kpis.runs)}
      />
      <MetricCell
        label="Success Rate"
        value={`${successRate.toFixed(1)}%`}
        color={rateColor}
      />
      <MetricCell
        label="Running"
        value={String(kpis.running)}
        color="text-sky-600 dark:text-sky-400"
      />
      <MetricCell
        label="Failed"
        value={String(kpis.failed)}
        color="text-red-600 dark:text-red-400"
      />
      <MetricCell
        label="Avg Latency"
        value={`${Math.round(kpis.avg_latency_ms)}ms`}
      />
    </div>
  );
}
