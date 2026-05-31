"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/Skeleton";
import type { MemorySystemMetrics } from "@/features/memory";

/**
 * 系统聚合指标面板 —— Insights 主区，仅 admin 渲染（来源 /metrics）。
 * 分组：Search（24h）/ Consolidation / Retention 分布（recharts 柱）/ PII & Graph。
 */

interface SystemMetricsPanelProps {
  metrics: MemorySystemMetrics | null;
  loading: boolean;
}

interface StatProps {
  label: string;
  value: string;
  color?: string;
}

function Stat({ label, value, color }: StatProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-micro uppercase tracking-overline text-muted-foreground mb-1">
        {label}
      </div>
      <div className={`text-base font-bold tabular-nums ${color ?? "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-micro uppercase tracking-overline text-muted-foreground">
      {children}
    </p>
  );
}

const RETENTION_BAR_COLORS = ["#f43f5e", "#3b82f6", "#10b981"]; // p10 / avg / p90

function RetentionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { name: string; value: number } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] shadow-md">
      <div className="font-semibold text-foreground">{row.name}</div>
      <div className="text-text-secondary tabular-nums">
        {(row.value * 100).toFixed(1)}%
      </div>
    </div>
  );
}

export function SystemMetricsPanel({ metrics, loading }: SystemMetricsPanelProps) {
  if (loading && !metrics) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!metrics) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-5 shadow-sm">
        <h2 className="text-xs font-semibold text-foreground">System Metrics</h2>
        <p className="mt-2 text-caption text-muted-foreground">
          指标端点不可用（可能已禁用 memory.observability.metrics_enabled）。
        </p>
      </section>
    );
  }

  const retentionData = [
    { name: "P10", value: metrics.retention_score_p10 },
    { name: "Avg", value: metrics.retention_score_avg },
    { name: "P90", value: metrics.retention_score_p90 },
  ];

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold text-foreground">System Metrics</h2>
        <span className="text-micro text-muted-foreground">/metrics · admin</span>
      </div>

      {/* Search 24h */}
      <div>
        <GroupTitle>Search · 24h</GroupTitle>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total" value={metrics.search_total_24h.toLocaleString()} />
          <Stat
            label="Reference Rate"
            value={`${(metrics.search_reference_rate * 100).toFixed(0)}%`}
          />
          <Stat
            label="Helpful Rate"
            value={`${(metrics.search_helpful_rate * 100).toFixed(0)}%`}
            color="text-emerald-600 dark:text-emerald-400"
          />
        </div>
      </div>

      {/* Consolidation + Retention */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <GroupTitle>Consolidation · 24h</GroupTitle>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total" value={metrics.consolidation_total_24h.toLocaleString()} />
            <Stat
              label="Retain Rate"
              value={`${(metrics.consolidation_retain_rate * 100).toFixed(0)}%`}
            />
          </div>
        </div>
        <div>
          <GroupTitle>Retention Distribution</GroupTitle>
          <div className="h-28 w-full rounded-xl border border-border bg-muted/20 p-2">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={retentionData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<RetentionTooltip />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {retentionData.map((_, i) => (
                    <Cell key={i} fill={RETENTION_BAR_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-micro text-muted-foreground">
            {metrics.low_retention_count.toLocaleString()} memories below 0.1 ·{" "}
            {metrics.memory_total.toLocaleString()} total
          </p>
        </div>
      </div>

      {/* PII & Graph */}
      <div>
        <GroupTitle>PII & Knowledge Graph</GroupTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="PII Rate"
            value={`${(metrics.pii_detection_rate * 100).toFixed(0)}%`}
            color={
              metrics.pii_detection_rate > 0
                ? "text-amber-600 dark:text-amber-400"
                : undefined
            }
          />
          <Stat label="PII Count" value={metrics.pii_detected_count.toLocaleString()} />
          <Stat label="Associations" value={metrics.association_count.toLocaleString()} />
          <Stat label="KG Entities" value={metrics.kg_entity_count.toLocaleString()} />
        </div>
      </div>
    </section>
  );
}
