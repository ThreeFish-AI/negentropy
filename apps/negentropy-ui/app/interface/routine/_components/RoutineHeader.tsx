"use client";

import { Info } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import type { RoutineKpis } from "@/features/routine";

interface RoutineHeaderProps {
  connected: boolean;
  onRefresh: () => void;
  loading: boolean;
  onCreate: () => void;
  onFromPreset?: () => void;
  /** 聚合 KPI；为 null 且非 loading 时展示占位文案，loading 时展示骨架。 */
  kpis: RoutineKpis | null;
}

interface KpiRow {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

/** Tooltip 内的 KPI 紧凑网格；复用原卡片条的状态语义色，并补全 `cancelled` 计数。 */
function KpiTooltipContent({ kpis, loading }: { kpis: RoutineKpis | null; loading: boolean }) {
  // loading 且无数据 → 骨架占位（图标仍可见，提示「正在聚合」）。
  if (loading && !kpis) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-0.5" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <Skeleton className="h-2.5 w-10" />
            <Skeleton className="h-3.5 w-8" />
          </div>
        ))}
      </div>
    );
  }
  // 无数据（非 loading）→ 简短占位；图标仍展示，保持布局稳定。
  if (!kpis) {
    return <span className="text-text-secondary">暂无指标数据</span>;
  }

  const rows: KpiRow[] = [
    { label: "Total", value: String(kpis.total), sub: `${kpis.pending} pending` },
    { label: "Running", value: String(kpis.running), color: "text-sky-400" },
    { label: "Paused", value: String(kpis.paused), color: "text-amber-400" },
    { label: "Succeeded", value: String(kpis.succeeded), color: "text-emerald-400" },
    { label: "Failed", value: String(kpis.failed), color: "text-red-400" },
    { label: "Cancelled", value: String(kpis.cancelled), color: "text-zinc-400" },
    { label: "Total Cost", value: `$${kpis.total_cost_usd.toFixed(2)}`, sub: `avg ${kpis.avg_iterations} iters` },
  ];

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-0.5">
      {rows.map((r) => (
        <div key={r.label} className="min-w-0">
          <div className="text-micro uppercase tracking-overline text-text-secondary">{r.label}</div>
          <div className={`text-caption font-bold tabular-nums ${r.color ?? "text-white dark:text-zinc-100"}`}>
            {r.value}
          </div>
          {r.sub && <div className="text-micro text-text-secondary">{r.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function RoutineHeader({ connected, onRefresh, loading, onCreate, onFromPreset, kpis }: RoutineHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-bold text-foreground">
          Routine
          <Tooltip
            side="right"
            align="center"
            contentClassName="w-72"
            triggerProps={{ "aria-label": "Routine 运行指标" }}
            content={<KpiTooltipContent kpis={kpis} loading={loading} />}
          >
            <Info className="h-4 w-4 text-text-muted hover:text-text-secondary" aria-hidden />
          </Tooltip>
        </h1>
        <p className="text-sm text-text-muted">
          Long-horizon autonomous task execution — Engine orchestrates, Claude Code executes
        </p>
      </div>

      <div className="flex items-center gap-3">
        {onFromPreset && (
          <Button
            variant="outline"
            size="sm"
            onClick={onFromPreset}
          >
            Template
          </Button>
        )}

        <Button
          variant="neutral"
          size="sm"
          onClick={onCreate}
          leftIcon={
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          New Routine
        </Button>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected ? "bg-emerald-500" : "bg-text-muted animate-pulse"
            }`}
          />
          {connected ? "Live" : "Reconnecting..."}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          leftIcon={
            <svg
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          }
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
