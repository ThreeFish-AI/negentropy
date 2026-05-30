"use client";

import { Activity, CheckCircle, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

interface ApiStatsData {
  total_calls: number;
  success_count: number;
  failed_count: number;
  avg_latency_ms: number;
}

interface ApiStatsProps {
  stats: ApiStatsData;
}

export function ApiStats({ stats }: ApiStatsProps) {
  const successRate =
    stats.total_calls > 0
      ? ((stats.success_count / stats.total_calls) * 100).toFixed(1)
      : "0.0";

  const metrics = [
    {
      label: "总调用",
      value: stats.total_calls.toLocaleString(),
      icon: Activity,
      iconColor: "text-blue-500",
    },
    {
      label: "成功率",
      value: `${successRate}%`,
      icon: CheckCircle,
      iconColor: "text-emerald-500",
    },
    {
      label: "平均延迟",
      value: `${stats.avg_latency_ms.toFixed(1)}ms`,
      icon: Zap,
      iconColor: "text-amber-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <metric.icon className={`h-4 w-4 ${metric.iconColor}`} />
            <p className="text-xs uppercase tracking-wider text-text-muted">
              {metric.label}
            </p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground tabular-nums">
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ApiStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="mt-2 h-8 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}
