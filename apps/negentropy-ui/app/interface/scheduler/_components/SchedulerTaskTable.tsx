"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import type { ScheduledTaskDTO } from "@/features/scheduler";

interface SchedulerTaskTableProps {
  tasks: ScheduledTaskDTO[];
  loading: boolean;
  onToggle: (id: string, enabled: boolean) => void;
  onRun: (id: string) => void;
  onSelect: (task: ScheduledTaskDTO) => void;
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
                  : "bg-border"
          }`}
          title={s ?? "—"}
        />
      ))}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border last:border-b-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <Skeleton className="h-4" style={{ width: `${50 + (i * 13) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function SchedulerTaskTable({
  tasks,
  loading,
  onToggle,
  onRun,
  onSelect,
}: SchedulerTaskTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        Tasks ({tasks.length})
      </div>
      <div className="max-h-[540px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card text-muted-foreground z-10">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">Task</th>
              <th className="px-3 py-2 text-left font-medium">Handler</th>
              <th className="px-3 py-2 text-left font-medium">Trigger</th>
              <th className="px-3 py-2 text-left font-medium">Last</th>
              <th className="px-3 py-2 text-left font-medium">Next</th>
              <th className="px-3 py-2 text-left font-medium">Recent</th>
              <th className="px-3 py-2 text-left font-medium">Enabled</th>
              <th className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && tasks.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  No tasks match current filters.
                </td>
              </tr>
            ) : (
              tasks.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">
                      {t.display_name || t.key}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{t.key}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{t.handler_kind}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {t.trigger_type === "cron"
                      ? t.cron_expr
                      : t.trigger_type === "interval"
                        ? `${t.interval_seconds}s`
                        : "oneshot"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {relativeFromNow(t.last_fire_at)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {relativeFromNow(t.next_fire_at)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusDots statuses={t.recent} />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        t.enabled
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-text-secondary"
                      }`}
                    >
                      {t.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onToggle(t.id, !t.enabled)}
                        className={`rounded-md px-2 py-1 text-[10px] border border-border transition-colors ${
                          t.enabled
                            ? "text-foreground hover:bg-muted/50"
                            : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                        }`}
                      >
                        {t.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => onRun(t.id)}
                        className="rounded-md px-2 py-1 text-[10px] bg-foreground text-background hover:opacity-80 transition-opacity"
                      >
                        Run Now
                      </button>
                    </div>
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
