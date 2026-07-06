"use client";

import Link from "next/link";

import { Skeleton } from "@/components/ui/Skeleton";
import { TextTooltip } from "@/components/ui/TextTooltip";
import type { ExecutionStatus, TaskExecutionDTO } from "@/features/scheduler";
import { patrolReasonLabel, patrolReasonStyle } from "@/features/scheduler/patrol-reason";

interface SchedulerExecutionPanelProps {
  /** 当前页执行记录（由页面 execList 服务端游标分页切片；状态/时间窗过滤已在筛选栏 + 后端完成）。 */
  executions: TaskExecutionDTO[];
  loading: boolean;
}

const STATUS_STYLES: Record<ExecutionStatus, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "bg-red-500/10 text-red-700 dark:text-red-300",
  running: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  cancelled: "bg-muted text-text-secondary",
  timeout: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

/** 从 HandlerResult.metrics 提取派生 Routine 深链（如巡检 routine_id/doc_id）。 */
function SpawnedRoutineLink({ metrics }: { metrics: Record<string, unknown> | undefined }) {
  const rid = typeof metrics?.routine_id === "string" ? metrics.routine_id : null;
  if (!rid) return null;
  const docId = typeof metrics?.doc_id === "string" ? metrics.doc_id : null;
  return (
    <Link
      href={`/interface/routine?sel=${encodeURIComponent(rid)}`}
      className="inline-flex items-center gap-1 text-micro text-blue-600 dark:text-blue-400 hover:underline w-fit"
    >
      派生 Routine →{docId ? `（doc ${docId.slice(0, 8)}）` : ""}
    </Link>
  );
}

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
    <tr className="border-b border-border/60 last:border-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton
            className="h-4"
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
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full table-fixed text-sm">
        {/* 固定列宽（合计 100%）：Started 16 · Status 10 · Task 16 · Duration 8 · Reason 14 · Output 36。
            6 列须与下方 6 个 <th> 严格对齐。注意：colgroup 内不得夹带空白文本节点（含 <col/> 后行内注释），
            否则触发 "whitespace text nodes cannot be a child of colgroup" hydration 报错。 */}
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[10%]" />
          <col className="w-[16%]" />
          <col className="w-[8%]" />
          <col className="w-[14%]" />
          <col className="w-[36%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-overline text-text-secondary">
            <th className="px-4 py-2.5 font-medium">Started</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Task</th>
            <th className="px-4 py-2.5 font-medium">Duration</th>
            <th className="px-4 py-2.5 font-medium">Reason</th>
            <th className="px-4 py-2.5 font-medium">Output</th>
          </tr>
        </thead>
        <tbody>
          {loading && executions.length === 0 ? (
            Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
          ) : executions.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                No executions match the current filter.
              </td>
            </tr>
          ) : (
            executions.map((e) => (
              <tr
                key={e.id}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
              >
                <td className="px-4 py-3 text-muted-foreground">
                  <TextTooltip content={formatTime(e.started_at)}>
                    <span className="block truncate">{formatTime(e.started_at)}</span>
                  </TextTooltip>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-micro font-semibold ${STATUS_STYLES[e.status]}`}
                  >
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground font-medium">
                  <TextTooltip content={e.task_key ?? "—"}>
                    <span className="block truncate">{e.task_key ?? "—"}</span>
                  </TextTooltip>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <span className="block truncate">{formatDuration(e.duration_ms)}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <TextTooltip content={e.fire_reason}>
                    <span className="block truncate">{e.fire_reason}</span>
                  </TextTooltip>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {e.error ? (
                    <TextTooltip content={e.error}>
                      <span className="block truncate text-red-600 dark:text-red-400">{e.error}</span>
                    </TextTooltip>
                  ) : (
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {patrolReasonLabel(e.metrics?.reason) && (
                          <span
                            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-micro font-semibold shrink-0 ${patrolReasonStyle(
                              e.metrics?.reason,
                            )}`}
                          >
                            {patrolReasonLabel(e.metrics?.reason)}
                          </span>
                        )}
                        <TextTooltip content={e.output_summary ?? "—"}>
                          <span className="block min-w-0 flex-1 truncate">{e.output_summary ?? "—"}</span>
                        </TextTooltip>
                      </div>
                      <SpawnedRoutineLink metrics={e.metrics} />
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
