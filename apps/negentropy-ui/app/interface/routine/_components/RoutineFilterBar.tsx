"use client";

import type { RoutineFilters, RoutineStatus } from "@/features/routine";

interface RoutineFilterBarProps {
  filters: Partial<RoutineFilters>;
  onChange: (filters: Partial<RoutineFilters>) => void;
}

const STATUS_OPTIONS: { value: RoutineStatus | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "paused", label: "Paused" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export function RoutineFilterBar({ filters, onChange }: RoutineFilterBarProps) {
  const inputCls =
    "rounded-md border border-border bg-input px-3 py-1.5 text-xs text-foreground focus:border-border focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={filters.status ?? ""}
        onChange={(e) => onChange({ ...filters, status: (e.target.value || null) as RoutineStatus | null })}
        className={inputCls}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={filters.q ?? ""}
        placeholder="Search key / title..."
        onChange={(e) => onChange({ ...filters, q: e.target.value })}
        className={`${inputCls} min-w-[200px] flex-1`}
      />
    </div>
  );
}
