"use client";

import { useMemo } from "react";

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
      className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
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
    <div className="flex flex-wrap items-center gap-2">
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

      {/* Time window pills */}
      <div className="flex items-center bg-muted/50 p-1 rounded-full ml-2">
        {TIME_WINDOWS.map((tw) => (
          <button
            key={tw.key}
            onClick={() => patch({ window: tw.key })}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filters.window === tw.key
                ? "bg-foreground text-background shadow-sm ring-1 ring-border"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tw.label}
          </button>
        ))}
      </div>
    </div>
  );
}
