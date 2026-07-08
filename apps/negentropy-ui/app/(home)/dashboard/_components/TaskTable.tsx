"use client";

import { useMemo } from "react";

import { TextTooltip } from "@/components/ui/TextTooltip";
import { TruncatedCell } from "@/components/ui/TruncatedCell";

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

/** 触发器展示串（cron 表达式 / 间隔秒 / oneshot），对齐 SchedulerTaskTable.triggerText。 */
function triggerText(t: ScheduledTaskDTO): string {
  if (t.trigger_type === "cron") return t.cron_expr ?? "cron";
  if (t.trigger_type === "interval") return `${t.interval_seconds}s`;
  return "oneshot";
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

export function TaskTable({ tasks, filters, onSelect }: TaskTableProps) {
  const filtered = useMemo(() => applyClientFilters(tasks, filters), [tasks, filters]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5 text-xs uppercase tracking-overline text-text-secondary">
        Tasks ({filtered.length})
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full table-fixed text-sm">
          {/* 固定列宽（合计 100%，随容器等比缩放；超长内容由 TextTooltip + truncate 恢复全文）：
              Task 28 · Handler 16 · Trigger 16 · Last 11 · Next 11 · Recent 8 · Enabled 10。
              7 列须与下方 7 个 <th> 严格对齐。colgroup 内不得夹带空白文本节点（hydration 报错）。 */}
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-left text-xs uppercase tracking-overline text-text-secondary">
              <th className="px-4 py-2.5 font-medium">Task</th>
              <th className="px-4 py-2.5 font-medium">Handler</th>
              <th className="px-4 py-2.5 font-medium">Trigger</th>
              <th className="px-4 py-2.5 font-medium">Last</th>
              <th className="px-4 py-2.5 font-medium">Next</th>
              <th className="px-4 py-2.5 font-medium">Recent</th>
              <th className="px-4 py-2.5 font-medium">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No tasks match current filters.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    {/* Task 双行：display_name（主）+ key（次），各行独立截断 + 悬浮全文。 */}
                    <div className="font-medium text-foreground">
                      <TextTooltip content={t.display_name || t.key}>
                        <span className="block truncate">{t.display_name || t.key}</span>
                      </TextTooltip>
                    </div>
                    <div className="font-mono text-xs text-text-secondary">
                      <TextTooltip content={t.key}>
                        <span className="block truncate">{t.key}</span>
                      </TextTooltip>
                    </div>
                  </td>
                  <TruncatedCell text={t.handler_kind} textClassName="text-text-secondary" />
                  <TruncatedCell text={triggerText(t)} mono textClassName="text-text-secondary" />
                  <td className="px-4 py-3 text-text-secondary">
                    <span className="block truncate">{relativeFromNow(t.last_fire_at)}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    <span className="block truncate">{relativeFromNow(t.next_fire_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusDots statuses={t.recent} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-micro font-semibold ${
                        t.enabled
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-text-secondary"
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
