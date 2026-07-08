"use client";

import { ExternalLink, GitMerge, GitPullRequest, Loader2, OctagonX, RotateCcw, Trash2, X } from "lucide-react";

import { CopyButton } from "@/components/ui/CopyButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { TruncatedCell } from "@/components/ui/TruncatedCell";
import type { RoutineDTO } from "@/features/routine";

import { canCancel, canCleanupWorktree, canRestart } from "./routine-controls";
import {
  closedBadgeClass,
  composeStatusTitle,
  mergedBadgeClass,
  openBadgeClass,
  routineStatusClass,
  scoreColorClass,
} from "./status-style";

interface RoutineTableProps {
  routines: RoutineDTO[];
  loading: boolean;
  onSelect: (r: RoutineDTO) => void;
  onOpenFull: (r: RoutineDTO) => void;
  /** 失败 / 取消行内一键重启（打开确认对话框）。 */
  onRestart?: (r: RoutineDTO) => void;
  /** 运行中 / 暂停行内终止（打开确认对话框）。 */
  onTerminate?: (r: RoutineDTO) => void;
  /** 终态 + worktree 活跃时行内清理 worktree。 */
  onCleanupWorktree?: (r: RoutineDTO) => void;
  /** 正在清理的 routine id（行内按钮 busy/disabled + spinner，防二次点击；null 表示无在途）。 */
  cleanupBusyId?: string | null;
}

export function RoutineTable({ routines, loading, onSelect, onOpenFull, onRestart, onTerminate, onCleanupWorktree, cleanupBusyId }: RoutineTableProps) {
  if (loading && routines.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (routines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card py-12 text-center">
        <p className="text-sm text-text-secondary">No routines yet. Create your first autonomous task.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full table-fixed text-sm">
        {/* 固定列宽：百分比合计 100%，随容器等比缩放；与 <th> 解耦，超长内容由单元格 truncate 截断。
            8 列须与下方 <thead> 的 8 个 <th> 严格对齐（数量错配不报错但会静默错位所有列）。 */}
        <colgroup>
          <col className="w-[19%]" /> {/* Name */}
          <col className="w-[14%]" /> {/* ID */}
          <col className="w-[14%]" /> {/* Status */}
          <col className="w-[7%]" /> {/* Progress */}
          <col className="w-[7%]" /> {/* Best Score */}
          <col className="w-[10%]" /> {/* Cost */}
          <col className="w-[10%]" /> {/* Updated */}
          {/* Actions：预留足够宽度容纳「最多 3 个并发按钮」（Restart/Terminate 互斥，故至多 Restart+Clean Up+Full View），单行不折。 */}
          <col className="w-[19%]" /> {/* Actions */}
        </colgroup>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-overline text-text-secondary">
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">ID</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Progress</th>
            <th className="px-4 py-2.5 font-medium">Best Score</th>
            <th className="px-4 py-2.5 font-medium">Cost</th>
            <th className="px-4 py-2.5 font-medium">Updated</th>
            <th className="px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {routines.map((r) => (
            <tr
              key={r.id}
              onClick={() => onSelect(r)}
              className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
            >
              <TruncatedCell
                text={r.display_name || r.title}
                textClassName="font-medium text-foreground"
                trailing={
                  r.key.startsWith("pdf-fidelity-patrol/") ? (
                    <span className="inline-flex items-center rounded-full bg-violet-500/10 px-1.5 py-0.5 text-micro font-semibold text-violet-700 dark:text-violet-300 shrink-0">
                      巡检
                    </span>
                  ) : undefined
                }
              />
              {/* 任务 ID（独立列）：约半宽截断展示，全文经悬浮单行恢复 + 一键复制。 */}
              <TruncatedCell
                text={r.key}
                mono
                textClassName="text-text-secondary"
                trailing={<CopyButton value={r.key} ariaLabel="复制 ID" className="shrink-0" />}
              />
              {/* 状态芯片单行展示：不折行，溢出由 overflow-hidden 右缘裁切；悬浮 Tooltip（单行）显示完整组合标题。 */}
              <TruncatedCell text={composeStatusTitle(r)} showOnOverflowOnly={false}>
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${routineStatusClass(r.status)}`}
                  >
                    {r.status}
                  </span>
                  {r.pr_merged && (
                    <span className={`${mergedBadgeClass} shrink-0`}>
                      <GitMerge className="h-3 w-3" aria-hidden />
                      Merged
                    </span>
                  )}
                  {r.pr_state === "closed" && (
                    <span className={`${closedBadgeClass} shrink-0`}>
                      <X className="h-3 w-3" aria-hidden />
                      Closed
                    </span>
                  )}
                  {r.pr_state === "open" && (
                    <span className={`${openBadgeClass} shrink-0`}>
                      <GitPullRequest className="h-3 w-3" aria-hidden />
                      Open
                    </span>
                  )}
                  {/* 终止原因：succeeded 恒配 "success"，与状态芯片冗余故略去；其余（失败原因）内联同行截断。 */}
                  {r.termination_reason && r.termination_reason !== "success" && (
                    <span className="min-w-0 truncate text-xs text-text-secondary">
                      {r.termination_reason}
                    </span>
                  )}
                </div>
              </TruncatedCell>
              <TruncatedCell
                text={`${r.iteration_count}${r.max_iterations ? ` / ${r.max_iterations}` : ""}`}
                className="tabular-nums text-text-secondary"
              />
              <TruncatedCell
                text={r.best_score ?? "—"}
                className={`font-semibold tabular-nums ${scoreColorClass(r.best_score)}`}
              />
              <TruncatedCell
                className="tabular-nums text-text-secondary"
                text={`$${r.total_cost_usd.toFixed(3)}${r.max_cost_usd ? ` / $${r.max_cost_usd}` : ""}`}
              />
              <TruncatedCell
                text={r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}
                className="text-xs text-text-secondary"
              />
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2 overflow-hidden">
                  {onRestart && canRestart(r.status) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestart(r);
                      }}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded text-[11px] font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restart
                    </button>
                  )}
                  {onCleanupWorktree && canCleanupWorktree(r.status, r.worktree_path) && (
                    <button
                      type="button"
                      disabled={cleanupBusyId === r.id}
                      aria-busy={cleanupBusyId === r.id || undefined}
                      aria-label={`Clean Up worktree for ${r.display_name || r.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCleanupWorktree(r);
                      }}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded text-[11px] font-medium text-amber-600 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline dark:text-amber-400"
                    >
                      {cleanupBusyId === r.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Clean Up
                    </button>
                  )}
                  {onTerminate && canCancel(r.status) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTerminate(r);
                      }}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded text-[11px] font-medium text-red-600 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-red-400"
                    >
                      <OctagonX className="h-3 w-3" />
                      Terminate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenFull(r);
                    }}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary underline-offset-4 transition-colors hover:bg-muted/50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Full View
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
