"use client";

import { Fragment } from "react";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  navPillClassName,
  navRailContainerClassName,
} from "@/components/ui/nav-styles";
import type { DashboardFilters, KpiResponse, ScheduledTaskDTO } from "@/features/scheduler";

import { SchedulerFilterBar } from "./SchedulerFilterBar";

interface SchedulerHeaderProps {
  connected: boolean;
  activeTab: string;
  onTabChange: (tab: "tasks" | "executions" | "stats") => void;
  onRefresh: () => void;
  loading: boolean;
  onCreateTask?: () => void;
  /** 聚合 KPI；为 null 且非 loading 时展示占位文案，loading 时展示骨架。 */
  kpis: KpiResponse | null;
  /** 筛选状态（role/scenario/category/agent/owner/window）；变更触发列表 reset 回第 1 页。 */
  filters: DashboardFilters;
  /** 全量任务快照，用于派生 Role/Scenario/Category 下拉选项。 */
  tasks: ScheduledTaskDTO[];
  onFiltersChange: (filters: DashboardFilters) => void;
}

const TABS: { key: "tasks" | "executions" | "stats"; label: string }[] = [
  { key: "tasks", label: "Tasks" },
  { key: "executions", label: "Executions" },
  { key: "stats", label: "Stats" },
];

interface KpiRow {
  label: string;
  value: string;
  color?: string;
}

/** Tooltip 顶部的作用说明（原头部 <p>，迁入以收敛纵向空间）。 */
const SCHEDULER_DESCRIPTION = "Unified task scheduling and execution management";

/** 单行 KPI：语义色 + 中点分隔，chip 不内部断行（对齐 Routine KpiStats）。 */
function KpiStats({ kpis }: { kpis: KpiResponse }) {
  const successRate = kpis.runs > 0 ? kpis.success_rate * 100 : 0;
  // 色号恒 -400：宿主为恒暗 Tooltip（bg-zinc-800/dark:zinc-700），-600 在 light 模式对比度不足（对齐 RoutineHeader）。
  const rateColor =
    successRate >= 95
      ? "text-emerald-400"
      : successRate >= 80
        ? "text-amber-400"
        : "text-red-400";

  const rows: KpiRow[] = [
    { label: "Tasks", value: String(kpis.total_tasks) },
    { label: "Enabled", value: String(kpis.enabled_tasks) },
    { label: "Runs", value: String(kpis.runs) },
    { label: "Success Rate", value: `${successRate.toFixed(1)}%`, color: rateColor },
    { label: "Running", value: String(kpis.running), color: "text-sky-400" },
    { label: "Failed", value: String(kpis.failed), color: "text-red-400" },
    { label: "Avg Latency", value: `${Math.round(kpis.avg_latency_ms)}ms` },
  ];

  return (
    <div className="flex items-baseline gap-x-2">
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
  );
}

/** Tooltip：作用说明 → hairline → 单行 KPI / 骨架 / 占位。 */
function KpiTooltipContent({ kpis, loading }: { kpis: KpiResponse | null; loading: boolean }) {
  return (
    <>
      <p className="whitespace-nowrap text-caption leading-relaxed text-zinc-400">{SCHEDULER_DESCRIPTION}</p>
      <div className="my-2 h-px bg-white/10" />
      {/* loading 且无数据 → 骨架占位（保持 Tooltip 形态稳定）。 */}
      {loading && !kpis ? (
        <div className="flex items-center gap-2" aria-busy="true">
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

export function SchedulerHeader({
  connected,
  activeTab,
  onTabChange,
  onRefresh,
  loading,
  onCreateTask,
  kpis,
  filters,
  tasks,
  onFiltersChange,
}: SchedulerHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {/* 标题 + 运行指标 info */}
      <h1 className="flex shrink-0 items-center gap-1.5 text-2xl font-bold text-foreground">
        Scheduler
        <Tooltip
          side="right"
          align="start"
          contentClassName="w-max max-w-[92vw]"
          triggerProps={{ "aria-label": "Scheduler 运行指标" }}
          content={<KpiTooltipContent kpis={kpis} loading={loading} />}
        >
          <Info className="h-4 w-4 text-text-muted hover:text-text-secondary" aria-hidden />
        </Tooltip>
      </h1>

      {/* 筛选栏：居右、可伸缩；空间紧时最先让位。 */}
      <div className="flex min-w-[240px] flex-1 flex-wrap items-center justify-end gap-2">
        <SchedulerFilterBar filters={filters} tasks={tasks} onFiltersChange={onFiltersChange} />
      </div>

      {/* 动作按钮组：不收缩、不内部换行 */}
      <div className="flex shrink-0 items-center gap-3">
        {/* New Task button */}
        {onCreateTask && (
          <Button
            variant="neutral"
            size="sm"
            onClick={onCreateTask}
            leftIcon={
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            New Task
          </Button>
        )}

        {/* Tab pills */}
        <div className={navRailContainerClassName}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={navPillClassName(activeTab === tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected ? "bg-emerald-500" : "bg-text-muted animate-pulse"
            }`}
          />
          {connected ? "Live" : "Reconnecting..."}
        </div>

        {/* Refresh button */}
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
