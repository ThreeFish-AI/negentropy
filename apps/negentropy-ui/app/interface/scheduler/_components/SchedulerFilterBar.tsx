"use client";

import { useMemo } from "react";

import {
  navPillClassName,
  navRailContainerClassName,
} from "@/components/ui/nav-styles";
import type { DashboardFilters, ScheduledTaskDTO, StatsWindow } from "@/features/scheduler";
import type { FilterOption } from "@/features/scheduler/hooks/filter-option";
import { useDashboardAgentOptions } from "@/app/(home)/dashboard/_hooks/useDashboardAgentOptions";
import { useDashboardOwnerOptions } from "@/app/(home)/dashboard/_hooks/useDashboardOwnerOptions";

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
}

const TIME_WINDOWS: { key: StatsWindow; label: string }[] = [
  { key: "1h", label: "1h" },
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
];

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
      // bg-input + focus ring 对齐 RoutineFilterBar；px 收窄以在窄屏单行容纳 5 下拉 + 3 时间窗。
      className="rounded-md border border-border bg-input px-2 py-1.5 text-xs text-foreground focus:border-border focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
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

export function SchedulerFilterBar({ filters, tasks, onFiltersChange }: SchedulerFilterBarProps) {
  const { options: agentOptions, loading: agentsLoading } = useDashboardAgentOptions();
  const { options: ownerOptions, loading: ownersLoading } = useDashboardOwnerOptions();

  const roleOptions = useMemo<FilterOption[]>(() => uniqueOptions(tasks, "role"), [tasks]);
  const scenarioOptions = useMemo<FilterOption[]>(() => uniqueOptions(tasks, "scenario"), [tasks]);
  const categoryOptions = useMemo<FilterOption[]>(() => uniqueOptions(tasks, "category"), [tasks]);

  const patch = (partial: Partial<DashboardFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

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

      {/* Time window pills（ml-2 由父级 gap-1.5 统一间距取代） */}
      <div className={navRailContainerClassName}>
        {TIME_WINDOWS.map((tw) => (
          <button
            key={tw.key}
            onClick={() => patch({ window: tw.key })}
            className={navPillClassName(
              filters.window === tw.key,
              "px-2 font-medium",
            )}
          >
            {tw.label}
          </button>
        ))}
      </div>
    </div>
  );
}
