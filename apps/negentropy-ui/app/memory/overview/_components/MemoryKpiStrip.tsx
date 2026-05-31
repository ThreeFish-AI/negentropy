"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import type { MemoryDashboard } from "@/features/memory";

/**
 * Memory Overview KPI 条 —— 复用 Scheduler/Routine KpiStrip 的 MetricCell/SkeletonCell 范式
 * （rounded-xl border bg-card、text-micro overline 标签、tabular-nums 数值、深色安全配色）。
 */

interface MemoryKpiStripProps {
  dashboard: MemoryDashboard | null;
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
      <div className="text-micro uppercase tracking-overline text-muted-foreground mb-1">
        {label}
      </div>
      <div className={`text-lg font-bold tabular-nums ${color ?? "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="text-micro text-muted-foreground mt-0.5">{sub}</div>}
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

function retentionColor(score: number): string {
  if (score >= 0.5) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 0.2) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function MemoryKpiStrip({ dashboard, loading }: MemoryKpiStripProps) {
  if (loading && !dashboard) {
    return (
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCell key={i} />
        ))}
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="flex flex-wrap gap-3">
      <MetricCell label="Users" value={String(dashboard.user_count)} />
      <MetricCell
        label="Memories"
        value={String(dashboard.memory_count)}
        sub={`${dashboard.fact_count} facts`}
      />
      <MetricCell
        label="Avg Retention"
        value={`${(dashboard.avg_retention_score * 100).toFixed(0)}%`}
        color={retentionColor(dashboard.avg_retention_score)}
      />
      <MetricCell
        label="Avg Importance"
        value={`${(dashboard.avg_importance_score * 100).toFixed(0)}%`}
      />
      <MetricCell
        label="Low Retention"
        value={String(dashboard.low_retention_count)}
        sub="decaying"
        color={
          dashboard.low_retention_count > 0
            ? "text-amber-600 dark:text-amber-400"
            : undefined
        }
      />
      <MetricCell label="Recent Audits" value={String(dashboard.recent_audit_count)} />
    </div>
  );
}
