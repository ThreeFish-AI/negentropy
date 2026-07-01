"use client";

import { Fragment } from "react";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import type { RoutineFilters, RoutineKpis } from "@/features/routine";

import { RoutineFilterBar } from "./RoutineFilterBar";

interface RoutineHeaderProps {
  connected: boolean;
  onRefresh: () => void;
  loading: boolean;
  onCreate: () => void;
  onFromPreset?: () => void;
  /** 聚合 KPI；为 null 且非 loading 时展示占位文案，loading 时展示骨架。 */
  kpis: RoutineKpis | null;
  /** 筛选状态（status / q）；由页面 state 透传，变更触发列表 reset 回第 1 页。 */
  filters: Partial<RoutineFilters>;
  onFiltersChange: (filters: Partial<RoutineFilters>) => void;
}

interface KpiRow {
  label: string;
  value: string;
  color?: string;
}

/** Tooltip 顶部的作用说明（原头部 <p>，迁入以收敛纵向空间）。 */
const ROUTINE_DESCRIPTION =
  "Long-horizon autonomous task execution — Engine orchestrates, Claude Code executes";

/** 单行 KPI：语义色 + 中点分隔，chip 不内部断行；底部脚注保留唯一独有指标 avg iters。 */
function KpiStats({ kpis }: { kpis: RoutineKpis }) {
  const rows: KpiRow[] = [
    { label: "Total", value: String(kpis.total) },
    { label: "Running", value: String(kpis.running), color: "text-sky-400" },
    { label: "Paused", value: String(kpis.paused), color: "text-amber-400" },
    { label: "Succeeded", value: String(kpis.succeeded), color: "text-emerald-400" },
    { label: "Failed", value: String(kpis.failed), color: "text-red-400" },
    { label: "Cancelled", value: String(kpis.cancelled), color: "text-zinc-400" },
    { label: "Total Cost", value: `$${kpis.total_cost_usd.toFixed(2)}` },
  ];

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {rows.map((r, i) => (
          <Fragment key={r.label}>
            {i > 0 && (
              <span className="select-none text-zinc-500" aria-hidden>
                ·
              </span>
            )}
            <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-micro uppercase tracking-overline text-zinc-400">{r.label}</span>
              <span className={`text-caption font-bold tabular-nums ${r.color ?? "text-white dark:text-zinc-100"}`}>
                {r.value}
              </span>
            </span>
          </Fragment>
        ))}
      </div>
      <div className="mt-2 text-micro text-zinc-400">avg {kpis.avg_iterations} iters/run</div>
    </>
  );
}

/** Tooltip：作用说明 → hairline → 单行 KPI / 骨架 / 占位。 */
function KpiTooltipContent({ kpis, loading }: { kpis: RoutineKpis | null; loading: boolean }) {
  return (
    <>
      <p className="text-caption leading-relaxed text-zinc-400">{ROUTINE_DESCRIPTION}</p>
      <div className="my-2 h-px bg-white/10" />
      {/* loading 且无数据 → 骨架占位（保持 Tooltip 形态稳定）。 */}
      {loading && !kpis ? (
        <div className="flex flex-wrap items-center gap-2" aria-busy="true">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-12" />
          ))}
        </div>
      ) : !kpis ? (
        // 无数据（非 loading）→ 简短占位。
        <span className="text-zinc-400">暂无指标数据</span>
      ) : (
        <KpiStats kpis={kpis} />
      )}
    </>
  );
}

export function RoutineHeader({
  connected,
  onRefresh,
  loading,
  onCreate,
  onFromPreset,
  kpis,
  filters,
  onFiltersChange,
}: RoutineHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {/* 标题 + 运行指标 info */}
      <h1 className="flex shrink-0 items-center gap-1.5 text-2xl font-bold text-foreground">
        Routine
        <Tooltip
          side="right"
          align="start"
          contentClassName="w-[28rem] max-w-[92vw]"
          triggerProps={{ "aria-label": "Routine 运行指标" }}
          content={<KpiTooltipContent kpis={kpis} loading={loading} />}
        >
          <Info className="h-4 w-4 text-text-muted hover:text-text-secondary" aria-hidden />
        </Tooltip>
      </h1>

      {/* 筛选栏：居右、可伸缩；空间紧时最先让位（min-w 保证搜索输入框 min-w-[200px] 生效）。 */}
      <div className="flex min-w-[240px] flex-1 flex-wrap items-center justify-end gap-2">
        <RoutineFilterBar filters={filters} onChange={onFiltersChange} />
      </div>

      {/* 动作按钮组：不收缩、不内部换行 */}
      <div className="flex shrink-0 items-center gap-3">
        {onFromPreset && (
          <Button variant="outline" size="sm" onClick={onFromPreset}>
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
