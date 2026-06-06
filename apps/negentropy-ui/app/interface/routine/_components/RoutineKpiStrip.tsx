"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import type { RoutineKpis } from "@/features/routine";

interface RoutineKpiStripProps {
  kpis: RoutineKpis | null;
  loading: boolean;
}

function MetricCell({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex-1 min-w-0">
      <div className="text-xs uppercase tracking-overline text-text-secondary mb-1">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${color ?? "text-foreground"}`}>{value}</div>
      {sub && <div className="text-xs text-text-secondary mt-0.5">{sub}</div>}
    </div>
  );
}

function SkeletonCell() {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex-1 min-w-0">
      <Skeleton className="h-3 w-12 mb-2" />
      <Skeleton className="h-5 w-16" />
    </div>
  );
}

export function RoutineKpiStrip({ kpis, loading }: RoutineKpiStripProps) {
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

  return (
    <div className="flex gap-3">
      <MetricCell label="Total" value={String(kpis.total)} sub={`${kpis.pending} pending`} />
      <MetricCell label="Running" value={String(kpis.running)} color="text-sky-600 dark:text-sky-400" />
      <MetricCell label="Paused" value={String(kpis.paused)} color="text-amber-600 dark:text-amber-400" />
      <MetricCell label="Succeeded" value={String(kpis.succeeded)} color="text-emerald-600 dark:text-emerald-400" />
      <MetricCell label="Failed" value={String(kpis.failed)} color="text-red-600 dark:text-red-400" />
      <MetricCell label="Total Cost" value={`$${kpis.total_cost_usd.toFixed(2)}`} sub={`avg ${kpis.avg_iterations} iters`} />
    </div>
  );
}
