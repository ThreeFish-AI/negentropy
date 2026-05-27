"use client";

import type { StatsResponse } from "@/features/scheduler";

interface SchedulerStatsPanelProps {
  statsByRole: StatsResponse | null;
  statsByScenario: StatsResponse | null;
  statsByOwner: StatsResponse | null;
  loading: boolean;
}

interface StatsSectionProps {
  title: string;
  stats: StatsResponse | null;
}

function StatsSection({ title, stats }: StatsSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-[11px] uppercase tracking-wider text-muted mb-3">
        {title}
      </h3>
      {!stats || stats.buckets.length === 0 ? (
        <div className="text-xs text-muted text-center py-4">No data</div>
      ) : (
        <div className="space-y-0.5">
          {stats.buckets.map((b) => (
            <div
              key={b.key}
              className="flex justify-between items-center py-1.5 text-xs border-b border-border last:border-b-0"
            >
              <span className="text-foreground font-medium truncate mr-2">
                {b.label}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-muted">{b.runs} runs</span>
                <span
                  className={`font-medium tabular-nums ${
                    b.success_rate >= 0.95
                      ? "text-emerald-600 dark:text-emerald-400"
                      : b.success_rate >= 0.8
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {(b.success_rate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonSection() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="h-3 w-20 rounded bg-muted/40 mb-4" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex justify-between items-center py-1.5">
          <div className="h-3 w-24 rounded bg-muted/40" />
          <div className="h-3 w-16 rounded bg-muted/40" />
        </div>
      ))}
    </div>
  );
}

export function SchedulerStatsPanel({
  statsByRole,
  statsByScenario,
  statsByOwner,
  loading,
}: SchedulerStatsPanelProps) {
  if (loading && !statsByRole && !statsByScenario && !statsByOwner) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SkeletonSection />
        <SkeletonSection />
        <SkeletonSection />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <StatsSection title="By Role" stats={statsByRole} />
      <StatsSection title="By Scenario" stats={statsByScenario} />
      <StatsSection title="By Owner" stats={statsByOwner} />
    </div>
  );
}
