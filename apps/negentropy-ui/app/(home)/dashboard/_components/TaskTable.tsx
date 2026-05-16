"use client";

import { useMemo } from "react";

import type { DashboardFilters, ScheduledTaskDTO } from "../_lib/types";

interface TaskTableProps {
  tasks: ScheduledTaskDTO[];
  filters: DashboardFilters;
  onSelect: (task: ScheduledTaskDTO) => void;
}

function applyClientFilters(tasks: ScheduledTaskDTO[], filters: DashboardFilters) {
  return tasks.filter((t) => {
    if (filters.category && t.category !== filters.category) return false;
    return true;
  });
}

function relativeFromNow(iso: string | null): string {
  if (!iso) return "—";
  try {
    const dt = new Date(iso);
    const diffMs = dt.getTime() - Date.now();
    const abs = Math.abs(diffMs);
    const minutes = Math.round(abs / 60_000);
    if (minutes < 1) return diffMs >= 0 ? "soon" : "just now";
    if (minutes < 60) return diffMs >= 0 ? `in ${minutes}m` : `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return diffMs >= 0 ? `in ${hours}h` : `${hours}h ago`;
    const days = Math.round(hours / 24);
    return diffMs >= 0 ? `in ${days}d` : `${days}d ago`;
  } catch {
    return iso;
  }
}

function StatusDots({ statuses }: { statuses: string[] }) {
  const slots = [0, 1, 2].map((i) => statuses[i] ?? null);
  return (
    <div className="flex items-center gap-0.5">
      {slots.map((s, i) => (
        <span
          key={i}
          className={`inline-block h-2 w-2 rounded-full ${
            s === "ok"
              ? "bg-emerald-500"
              : s === "failed"
                ? "bg-red-500"
                : s === "running"
                  ? "bg-sky-500"
                  : "bg-zinc-300 dark:bg-zinc-700"
          }`}
          title={s ?? "—"}
        />
      ))}
    </div>
  );
}

export function TaskTable({ tasks, filters, onSelect }: TaskTableProps) {
  const filtered = useMemo(() => applyClientFilters(tasks, filters), [tasks, filters]);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wider text-muted">
        Tasks ({filtered.length})
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card text-muted">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">Task</th>
              <th className="px-3 py-2 text-left font-medium">Handler</th>
              <th className="px-3 py-2 text-left font-medium">Trigger</th>
              <th className="px-3 py-2 text-left font-medium">Last</th>
              <th className="px-3 py-2 text-left font-medium">Next</th>
              <th className="px-3 py-2 text-left font-medium">Recent</th>
              <th className="px-3 py-2 text-left font-medium">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted">
                  No tasks match current filters.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{t.display_name || t.key}</div>
                    <div className="text-[10px] text-muted">{t.key}</div>
                  </td>
                  <td className="px-3 py-2 text-muted">{t.handler_kind}</td>
                  <td className="px-3 py-2 text-muted">
                    {t.trigger_type === "cron" ? t.cron_expr : t.trigger_type === "interval" ? `${t.interval_seconds}s` : "oneshot"}
                  </td>
                  <td className="px-3 py-2 text-muted">{relativeFromNow(t.last_fire_at)}</td>
                  <td className="px-3 py-2 text-muted">{relativeFromNow(t.next_fire_at)}</td>
                  <td className="px-3 py-2">
                    <StatusDots statuses={t.recent} />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        t.enabled
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {t.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
