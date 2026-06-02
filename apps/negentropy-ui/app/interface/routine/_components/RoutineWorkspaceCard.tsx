"use client";

import { FolderTree, HardDrive, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { RoutineDTO } from "@/features/routine";

import {
  worktreePolicyDescription,
  worktreeStatusClass,
  worktreeStatusLabel,
} from "./status-style";

type WorktreeStatus = "active" | "cleaned" | "orphaned" | "none";

const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

interface RoutineWorkspaceCardProps {
  routine: Pick<
    RoutineDTO,
    | "baseline_branch"
    | "work_branch"
    | "worktree_path"
    | "worktree_status"
    | "worktree_disk_usage"
    | "worktree_cleanup_policy"
    | "status"
  >;
  onCleanup: () => void;
  cleanupBusy?: boolean;
}

/**
 * 隔离工作区卡片 —— 可视化 Routine 任务的 git worktree 生命周期状态。
 *
 * 状态模型：
 *   active   — worktree_path 非空且目录存在（正在使用或待清理）
 *   cleaned  — worktree_path 为空但 work_branch 非空（已清理）
 *   orphaned — worktree_path 非空但目录已不存在（异常残留）
 *   none     — baseline_branch 为空（非 worktree routine，不渲染）
 *
 * 清理按钮仅对终态 routine（succeeded/failed/cancelled）+ active/orphaned 状态可见。
 */
export function RoutineWorkspaceCard({ routine, onCleanup, cleanupBusy }: RoutineWorkspaceCardProps) {
  if (!routine.baseline_branch) return null;

  const ws = (routine.worktree_status ?? "none") as WorktreeStatus;
  const isTerminal = TERMINAL.has(routine.status);
  const canCleanup =
    isTerminal && (ws === "active" || ws === "orphaned") && routine.worktree_path != null;

  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-sm">
      {/* 标题行 + 状态徽章 */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <FolderTree className="h-3.5 w-3.5" />
          Isolated Workspace
        </h3>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            worktreeStatusClass(ws),
          )}
        >
          {/* 状态指示点 */}
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              ws === "active" && "bg-emerald-500 animate-pulse",
              ws === "cleaned" && "bg-muted-foreground/40",
              ws === "orphaned" && "bg-amber-500",
            )}
          />
          {worktreeStatusLabel(ws)}
        </span>
      </div>

      {/* 信息网格 */}
      <dl className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
        <dt className="text-text-muted">Baseline</dt>
        <dd className="break-all font-mono text-text-secondary">{routine.baseline_branch}</dd>

        <dt className="text-text-muted">Work branch</dt>
        <dd className="break-all font-mono text-text-secondary">{routine.work_branch ?? "—"}</dd>

        {ws === "active" && routine.worktree_path && (
          <>
            <dt className="text-text-muted">Worktree</dt>
            <dd className="break-all font-mono text-text-secondary">{routine.worktree_path}</dd>
          </>
        )}

        {routine.worktree_disk_usage && ws === "active" && (
          <>
            <dt className="flex items-center gap-1 text-text-muted">
              <HardDrive className="h-3 w-3" />
              Disk usage
            </dt>
            <dd className="font-mono tabular-nums text-text-secondary">
              {routine.worktree_disk_usage}
            </dd>
          </>
        )}
      </dl>

      {/* 操作行 + 策略文案 */}
      {(canCleanup || routine.worktree_cleanup_policy) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canCleanup && (
            <Button
              variant="outline"
              size="sm"
              disabled={cleanupBusy}
              onClick={onCleanup}
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
            >
              Clean Up Worktree
            </Button>
          )}
          {routine.worktree_cleanup_policy && (
            <span className="text-[10px] text-text-muted">
              {worktreePolicyDescription(routine.worktree_cleanup_policy)}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
