"use client";

import { useMemo } from "react";

import type { FilterOption } from "../_hooks/filter-option";
import type { DashboardFilters, ScheduledTaskDTO, StatsWindow } from "../_lib/types";

interface FilterBarProps {
  filters: DashboardFilters;
  tasks: ScheduledTaskDTO[];
  /** Agent 下拉选项（一主五翼），来自 ``useDashboardAgentOptions``。 */
  agentOptions: FilterOption[];
  /** Owner 下拉选项（Admin 见所有 User / 非 Admin 仅自身），来自 ``useDashboardOwnerOptions``。 */
  ownerOptions: FilterOption[];
  onChange: (next: DashboardFilters) => void;
  onRefresh: () => void;
  connected: boolean;
}

const WINDOWS: StatsWindow[] = ["1h", "24h", "7d"];

function uniqueValues(items: Array<string | null | undefined>): string[] {
  return Array.from(new Set(items.filter((v): v is string => Boolean(v))));
}

/** 把 ``string[]`` 适配为 ``FilterOption[]``——value 与 label 同源。 */
function asOptions(values: string[]): FilterOption[] {
  return values.map((v) => ({ value: v, label: v }));
}

export function FilterBar({
  filters,
  tasks,
  agentOptions,
  ownerOptions,
  onChange,
  onRefresh,
  connected,
}: FilterBarProps) {
  // Category 不在 _lib/api.ts:buildFilterQuery 服务端过滤白名单内，从 tasks 推导
  // 与 filters 选中态正交，语义正确；
  // Role / Scenario 同样会被后端过滤（scheduler_api.py:228-231），与本 PR 修复的
  // Agent / Owner 同形——选中后 tasks 会塌缩到所选值，下拉随之收敛；但二者并无
  // 独立的全局枚举注册表（不像 Agent 注册表 / 用户表）可供 SSOT 解耦，暂沿用
  // tasks 推导，待后端补齐枚举全集接口后再迁移；
  // Agent / Owner 是全局枚举（Agent 注册表、用户表），由独立 hook 提供选项源。
  const roles = useMemo(() => asOptions(uniqueValues(tasks.map((t) => t.role)).sort()), [tasks]);
  const scenarios = useMemo(
    () => asOptions(uniqueValues(tasks.map((t) => t.scenario)).sort()),
    [tasks],
  );
  const categories = useMemo(
    () => asOptions(uniqueValues(tasks.map((t) => t.category)).sort()),
    [tasks],
  );

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
      <FilterSelect
        label="Agent"
        value={filters.agent}
        options={agentOptions}
        onSelect={(v) => selectOption("agent", v)}
      />
      <FilterSelect
        label="Owner"
        value={filters.owner}
        options={ownerOptions}
        onSelect={(v) => selectOption("owner", v)}
      />
      <div className="flex items-center gap-1 rounded-full bg-muted/50 px-1 py-0.5">
        {WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onChange({ ...filters, window: w })}
            className={`px-2 py-0.5 text-caption font-semibold rounded-full transition-colors ${
              filters.window === w
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {w}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-border"}`}
          title={connected ? "SSE connected" : "SSE disconnected"}
        />
        <span className="text-caption text-muted-foreground">{connected ? "Live" : "Reconnecting…"}</span>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md border border-border px-2 py-1 text-caption font-medium hover:bg-muted/50"
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
  options: FilterOption[];
  onSelect: (value: string) => void;
}

function FilterSelect({ label, value, options, onSelect }: FilterSelectProps) {
  return (
    <label className="flex items-center gap-1 text-caption text-muted-foreground">
      <span>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded-md border border-border bg-card px-2 py-1 text-foreground"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
