"use client";

import { useMemo, useState } from "react";

import type { ExecutionStatus, TaskExecutionDTO } from "@/features/scheduler";

interface SchedulerExecutionPanelProps {
  executions: TaskExecutionDTO[];
  loading: boolean;
}

type StatusFilter = "all" | ExecutionStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ok", label: "OK" },
  { key: "failed", label: "Failed" },
  { key: "running", label: "Running" },
];

const STATUS_STYLES: Record<ExecutionStatus, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "bg-red-500/10 text-red-700 dark:text-red-300",
  running: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  cancelled: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  timeout: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border last:border-b-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <div
            className="h-4 rounded bg-muted/40 animate-pulse"
            style={{ width: `${50 + (i * 17) % 40}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

export function SchedulerExecutionPanel({
  executions,
  loading,
}: SchedulerExecutionPanelProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    if (statusFilter === "all") return executions;
    return executions.filter((e) => e.status === statusFilter);
  }, [executions, statusFilter]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Status filter pills */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Executions ({filtered.length})
        </span>
        <div className="flex items-center bg-muted/50 p-0.5 rounded-full">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.key}
              onClick={() => setStatusFilter(sf.key)}
              className={`px-3 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                statusFilter === sf.key
                  ? "bg-foreground text-background shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[540px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card text-muted-foreground z-10">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">Started</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Task</th>
              <th className="px-3 py-2 text-left font-medium">Duration</th>
              <th className="px-3 py-2 text-left font-medium">Reason</th>
              <th className="px-3 py-2 text-left font-medium">Output</th>
            </tr>
          </thead>
          <tbody>
            {loading && executions.length === 0 ? (
              Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No executions match the current filter.
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {formatTime(e.started_at)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[e.status]}`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-foreground font-medium">
                    {e.task_key ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDuration(e.duration_ms)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{e.fire_reason}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                    {e.error ? (
                      <span className="text-red-600 dark:text-red-400">{e.error}</span>
                    ) : (
                      e.output_summary ?? "—"
                    )}
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
