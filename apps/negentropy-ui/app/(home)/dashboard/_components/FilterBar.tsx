"use client";

import { useMemo } from "react";

import type { DashboardFilters, ScheduledTaskDTO, StatsWindow } from "../_lib/types";

interface FilterBarProps {
  filters: DashboardFilters;
  tasks: ScheduledTaskDTO[];
  onChange: (next: DashboardFilters) => void;
  onRefresh: () => void;
  connected: boolean;
}

const WINDOWS: StatsWindow[] = ["1h", "24h", "7d"];

function uniqueValues(items: Array<string | null | undefined>): string[] {
  return Array.from(new Set(items.filter((v): v is string => Boolean(v))));
}

export function FilterBar({ filters, tasks, onChange, onRefresh, connected }: FilterBarProps) {
  const roles = useMemo(() => uniqueValues(tasks.map((t) => t.role)).sort(), [tasks]);
  const scenarios = useMemo(() => uniqueValues(tasks.map((t) => t.scenario)).sort(), [tasks]);
  const owners = useMemo(() => uniqueValues(tasks.map((t) => t.owner_id)).sort(), [tasks]);
  const categories = useMemo(() => uniqueValues(tasks.map((t) => t.category)).sort(), [tasks]);
  const agents = useMemo(() => uniqueValues(tasks.map((t) => t.agent_id)).sort(), [tasks]);

  function selectOption(name: keyof DashboardFilters, value: string) {
    onChange({ ...filters, [name]: value || null });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/50 px-1 py-2">
      <FilterSelect label="Role" value={filters.role} options={roles} onSelect={(v) => selectOption("role", v)} />
      <FilterSelect
        label="Scenario"
        value={filters.scenario}
        options={scenarios}
        onSelect={(v) => selectOption("scenario", v)}
      />
      <FilterSelect
        label="Category"
        value={filters.category}
        options={categories}
        onSelect={(v) => selectOption("category", v)}
      />
      <FilterSelect label="Agent" value={filters.agent} options={agents} onSelect={(v) => selectOption("agent", v)} />
      <FilterSelect label="Owner" value={filters.owner} options={owners} onSelect={(v) => selectOption("owner", v)} />
      <div className="flex items-center gap-1 rounded-full bg-muted/50 px-1 py-0.5">
        {WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onChange({ ...filters, window: w })}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded-full transition-colors ${
              filters.window === w
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {w}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-400"}`}
          title={connected ? "SSE connected" : "SSE disconnected"}
        />
        <span className="text-[11px] text-muted">{connected ? "Live" : "Reconnecting…"}</span>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted/50"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string | null;
  options: string[];
  onSelect: (value: string) => void;
}

function FilterSelect({ label, value, options, onSelect }: FilterSelectProps) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-muted">
      <span>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded-md border border-border bg-card px-2 py-1 text-foreground"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
