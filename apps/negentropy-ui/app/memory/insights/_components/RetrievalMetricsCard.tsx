"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchX } from "lucide-react";
import type { RetrievalMetrics } from "@/features/memory";

/**
 * 检索质量卡 —— Insights 主区，全员可见。
 * 来源 /retrieval/metrics：Precision@K、利用率、噪声率。
 */

interface RetrievalMetricsCardProps {
  metrics: RetrievalMetrics | null;
  loading: boolean;
}

interface MetricCellProps {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}

function MetricCell({ label, value, hint, color }: MetricCellProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex-1 min-w-0">
      <div className="text-micro uppercase tracking-overline text-muted-foreground mb-1">
        {label}
      </div>
      <div className={`text-lg font-bold tabular-nums ${color ?? "text-foreground"}`}>
        {value}
      </div>
      {hint && <div className="text-micro text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export function RetrievalMetricsCard({
  metrics,
  loading,
}: RetrievalMetricsCardProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold text-foreground">Retrieval Quality</h2>
        <span className="text-micro text-muted-foreground">/retrieval/metrics</span>
      </div>

      {loading && !metrics ? (
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-3 flex-1 min-w-0"
            >
              <Skeleton className="h-3 w-12 mb-2" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      ) : !metrics || metrics.total_retrievals === 0 ? (
        <EmptyState
          size="sm"
          icon={SearchX}
          title="暂无检索活动"
          description="一旦发生记忆检索，质量指标将在此呈现。"
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <MetricCell
            label="Retrievals"
            value={metrics.total_retrievals.toLocaleString()}
          />
          <MetricCell
            label="Precision@K"
            value={`${(metrics.precision_at_k * 100).toFixed(0)}%`}
            color="text-emerald-600 dark:text-emerald-400"
          />
          <MetricCell
            label="Utilization"
            value={`${(metrics.utilization_rate * 100).toFixed(0)}%`}
            hint="被引用占比"
          />
          <MetricCell
            label="Noise Rate"
            value={`${(metrics.noise_rate * 100).toFixed(0)}%`}
            color={
              metrics.noise_rate > 0.5
                ? "text-amber-600 dark:text-amber-400"
                : undefined
            }
          />
        </div>
      )}
    </section>
  );
}
