"use client";

import { useMemo } from "react";

import type { DashboardFilters, ExecutionStatus, ScheduledTaskDTO, StatsWindow } from "@/features/scheduler";
import type { FilterOption } from "@/features/scheduler/hooks/filter-option";
import { useDashboardAgentOptions } from "@/app/(home)/dashboard/_hooks/useDashboardAgentOptions";
import { useDashboardOwnerOptions } from "@/app/(home)/dashboard/_hooks/useDashboardOwnerOptions";

/** 执行状态过滤（"" = 全部）。 */
export type ExecutionStatusFilter = "" | ExecutionStatus;

function uniqueOptions(tasks: ScheduledTaskDTO[], field: keyof ScheduledTaskDTO): FilterOption[] {
  const seen = new Set<string>();
  const opts: FilterOption[] = [];
  for (const t of tasks) {
    const v = t[field];
    if (typeof v === "string" && v && !seen.has(v)) {
      seen.add(v);
      opts.push({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) });
    }
  }
  return opts;
}

interface SchedulerFilterBarProps {
  filters: DashboardFilters;
  tasks: ScheduledTaskDTO[];
  onFiltersChange: (f: DashboardFilters) => void;
  /** 当前激活 tab；status 下拉仅在 executions tab 渲染（tasks tab 无此概念）。 */
  activeTab?: string;
  /** 执行状态过滤值（executions tab 专用）。 */
  executionStatus?: ExecutionStatusFilter;
  onExecutionStatusChange?: (s: ExecutionStatusFilter) => void;
}

/** 时间窗下拉选项（原 1h/24h/7d pills，改下拉以缩短控件宽度）。 */
const TIME_WINDOWS: { value: StatsWindow; label: string }[] = [
  { value: "1h", label: "Last 1h" },
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7d" },
];

/** 执行状态下拉选项（"" = All）。 */
const STATUS_OPTIONS: { value: ExecutionStatusFilter; label: string }[] = [
  { value: "", label: "All Status" },
  { value: "ok", label: "OK" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
];

/** 统一下拉视觉：bg-input + focus ring + 固定紧凑宽度（对齐既有 SelectFilter）。 */
const SELECT_CLS =
  "w-28 truncate rounded-md border border-border bg-input px-2 py-1.5 text-xs text-foreground focus:border-border focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50";

interface SelectFilterProps {
  label: string;
  value: string | null;
  options: FilterOption[];
  loading: boolean;
  onChange: (v: string | null) => void;
}

function SelectFilter({ label, value, options, loading, onChange }: SelectFilterProps) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={loading}
      // 固定紧凑宽度 + truncate：原生 <select> 默认撑到最宽选项宽度会溢出换行，故 w-28 封顶 + 超长值省略号截断。
      className={SELECT_CLS}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SchedulerFilterBar({
  filters,
  tasks,
  onFiltersChange,
  activeTab,
  executionStatus = "",
  onExecutionStatusChange,
}: SchedulerFilterBarProps) {
  const { options: agentOptions, loading: agentsLoading } = useDashboardAgentOptions();
  const { options: ownerOptions, loading: ownersLoading } = useDashboardOwnerOptions();

  const roleOptions = useMemo<FilterOption[]>(() => uniqueOptions(tasks, "role"), [tasks]);
  const scenarioOptions = useMemo<FilterOption[]>(() => uniqueOptions(tasks, "scenario"), [tasks]);
  const categoryOptions = useMemo<FilterOption[]>(() => uniqueOptions(tasks, "category"), [tasks]);

  const patch = (partial: Partial<DashboardFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  // 状态下拉仅在 executions tab 且提供了回调时渲染（tasks tab 无「执行状态」概念）。
  const showStatus = activeTab === "executions" && onExecutionStatusChange != null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SelectFilter
        label="Role"
        value={filters.role}
        options={roleOptions}
        loading={false}
        onChange={(v) => patch({ role: v })}
      />
      <SelectFilter
        label="Scenario"
        value={filters.scenario}
        options={scenarioOptions}
        loading={false}
        onChange={(v) => patch({ scenario: v })}
      />
      <SelectFilter
        label="Category"
        value={filters.category}
        options={categoryOptions}
        loading={false}
        onChange={(v) => patch({ category: v })}
      />
      <SelectFilter
        label="Agent"
        value={filters.agent}
        options={agentOptions}
        loading={agentsLoading}
        onChange={(v) => patch({ agent: v })}
      />
      <SelectFilter
        label="Owner"
        value={filters.owner}
        options={ownerOptions}
        loading={ownersLoading}
        onChange={(v) => patch({ owner: v })}
      />

      {/* 时间窗下拉（原 1h/24h/7d pills，改下拉以缩短控件宽度） */}
      <select
        value={filters.window}
        onChange={(e) => patch({ window: e.target.value as StatsWindow })}
        aria-label="时间窗"
        className={SELECT_CLS}
      >
        {TIME_WINDOWS.map((tw) => (
          <option key={tw.value} value={tw.value}>
            {tw.label}
          </option>
        ))}
      </select>

      {/* 执行状态下拉：紧随时间窗之后，仅 executions tab 渲染。 */}
      {showStatus && (
        <select
          value={executionStatus}
          onChange={(e) => onExecutionStatusChange(e.target.value as ExecutionStatusFilter)}
          aria-label="执行状态"
          className={SELECT_CLS}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
