"use client";

import { CopyButton } from "@/components/ui/CopyButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { TruncatedCell } from "@/components/ui/TruncatedCell";
import type { ScheduledTaskDTO } from "@/features/scheduler";

interface SchedulerTaskTableProps {
  /** 要渲染的任务（由调用方提供当前页的 TASK_PAGE_SIZE 条，后端 updated_at 倒序）。 */
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

/** 触发器展示串（cron 表达式 / 间隔秒 / oneshot）。 */
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

function SkeletonRow() {
  return (
    <tr className="border-b border-border/60 last:border-0">
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
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
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full table-fixed text-sm">
        {/* 固定列宽（合计 100%，随容器等比缩放；超长内容由 TextTooltip + truncate 恢复全文，所有列单行不折）：
            Task 14 · ID 12 · Description 18 · Handler 10 · Trigger 10 · Last 7 · Next 7 · Recent 5 · Enabled 7 · Actions 10。
            10 列须与下方 10 个 <th> 严格对齐。注意：colgroup 内不得夹带空白文本节点（含 <col/> 后行内注释），
            否则触发 "whitespace text nodes cannot be a child of colgroup" hydration 报错。 */}
        <colgroup>
          <col className="w-[14%]" />
          <col className="w-[12%]" />
          <col className="w-[18%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
          <col className="w-[5%]" />
          <col className="w-[7%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-overline text-text-secondary">
            <th className="px-4 py-2.5 font-medium">Task</th>
            <th className="px-4 py-2.5 font-medium">ID</th>
            <th className="px-4 py-2.5 font-medium">Description</th>
            <th className="px-4 py-2.5 font-medium">Handler</th>
            <th className="px-4 py-2.5 font-medium">Trigger</th>
            <th className="px-4 py-2.5 font-medium">Last</th>
            <th className="px-4 py-2.5 font-medium">Next</th>
            <th className="px-4 py-2.5 font-medium">Recent</th>
            <th className="px-4 py-2.5 font-medium">Enabled</th>
            <th className="px-4 py-2.5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && tasks.length === 0 ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
          ) : tasks.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">
                No tasks match current filters.
              </td>
            </tr>
          ) : (
            tasks.map((t) => (
              <tr
                key={t.id}
                onClick={() => onSelect(t)}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
              >
                <TruncatedCell
                  text={t.display_name || t.key}
                  textClassName="font-medium text-foreground"
                />
                {/* 任务 ID（独立列）：约半宽截断展示，全文经悬浮单行恢复 + 一键复制（对齐 RoutineTable ID 列）。 */}
                <TruncatedCell
                  text={t.key}
                  mono
                  textClassName="text-text-secondary"
                  trailing={<CopyButton value={t.key} ariaLabel="复制 ID" className="shrink-0" />}
                />
                {t.description ? (
                  <TruncatedCell text={t.description} textClassName="text-muted-foreground" />
                ) : (
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                )}
                <TruncatedCell text={t.handler_kind} textClassName="text-muted-foreground" />
                <TruncatedCell text={triggerText(t)} mono textClassName="text-muted-foreground" />
                <td className="px-4 py-3 text-muted-foreground">
                  <span className="block truncate">{relativeFromNow(t.last_fire_at)}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
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
                <td className="px-4 py-3">
                  <div
                    className="flex items-center gap-1 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onToggle(t.id, !t.enabled)}
                      className={`shrink-0 whitespace-nowrap rounded-md border border-border px-2 py-1 text-micro transition-colors ${
                        t.enabled
                          ? "text-foreground hover:bg-muted/50"
                          : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                      }`}
                    >
                      {t.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => onRun(t.id)}
                      className="shrink-0 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-micro text-background transition-opacity hover:opacity-80"
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
  );
}
