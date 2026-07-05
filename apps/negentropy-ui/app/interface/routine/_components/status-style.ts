import type {
  IterationStatus,
  RoutineDTO,
  RoutinePhase,
  RoutineStatus,
  Verdict,
} from "@/features/routine";

// ---------------------------------------------------------------------------
// 转录通用状态/图标/标签已抽离至 ``@/components/transcript/status-shared``，
// 此处 re-export 保持现有 ``../status-style`` 引用面零改动（Routine 仪表盘/列表 + 转录归一化层）。
// ---------------------------------------------------------------------------

export {
  EVENT_TITLE_LABELS,
  resolveEventTitle,
  scoreColorClass,
  toolIcon,
  eventTypeIcon,
  eventTypeClass,
  eventTypeLabel,
  eventGroup,
  EVENT_GROUP_LABEL,
  SuccessIcon,
  taskStatusDotClass,
  taskStatusLabel,
  deriveTaskStatus,
} from "@/components/transcript/status-shared";
export type { EventGroup, TaskStatus } from "@/components/transcript/status-shared";

// ---------------------------------------------------------------------------
// Routine 仪表盘 / 列表专用样式（与转录 UI 无关，留在此处）
// ---------------------------------------------------------------------------

/** 相位 → 徽章配色（规划=琥珀/实现=天蓝/收尾=紫，深色模式安全对比）。 */
export function phaseClass(phase: RoutinePhase | null | undefined): string {
  switch (phase) {
    case "plan":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
    case "implement":
      return "bg-sky-500/15 text-sky-800 dark:text-sky-200";
    case "finalize":
      return "bg-violet-500/15 text-violet-800 dark:text-violet-200";
    default:
      return "bg-muted/60 text-text-secondary";
  }
}

/** 相位 → 中文标签。 */
export function phaseLabel(phase: RoutinePhase | null | undefined): string {
  switch (phase) {
    case "plan":
      return "规划";
    case "implement":
      return "实现";
    case "finalize":
      return "收尾";
    default:
      return "—";
  }
}

/** Routine 状态 → 徽章配色。 */
export function routineStatusClass(status: RoutineStatus): string {
  switch (status) {
    case "running":
      return "bg-sky-500/15 text-sky-800 dark:text-sky-200";
    case "paused":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
    case "succeeded":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
    case "failed":
      return "bg-red-500/15 text-red-800 dark:text-red-200";
    case "cancelled":
      return "bg-muted text-text-secondary line-through";
    default: // pending
      return "bg-muted/60 text-foreground";
  }
}

/** 「PR 已合并」徽章配色（violet = GitHub merged 色 + 仓库 PR/finalize 强调色；区别于绿色 succeeded）。 */
export const mergedBadgeClass =
  "inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-micro font-semibold text-violet-700 dark:text-violet-300";

/** 「PR 已关闭（未合并）」徽章配色（muted/灰，区别于 failed-红 / merged-紫 / succeeded-绿）。 */
export const closedBadgeClass =
  "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-micro font-semibold text-text-secondary";

/** 「PR 开启中（待合并）」徽章配色（sky/天蓝 = 活跃待处理；区别于 succeeded-绿/merged-紫/closed-灰/failed-红）。 */
export const openBadgeClass =
  "inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-micro font-semibold text-sky-700 dark:text-sky-300";

/** 组合 STATUS 单元格的悬浮全文（单一事实源）：状态 + PR 态 + 非冗余终止原因。 */
export function composeStatusTitle(
  r: Pick<RoutineDTO, "status" | "pr_merged" | "pr_state" | "termination_reason">,
): string {
  return [
    r.status,
    r.pr_merged ? "Merged" : null,
    r.pr_state === "closed" ? "Closed" : null,
    r.pr_state === "open" ? "Open" : null,
    r.termination_reason && r.termination_reason !== "success" ? r.termination_reason : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** 迭代状态 → 状态点配色。 */
export function iterationDotClass(status: IterationStatus): string {
  switch (status) {
    case "in_flight":
      return "bg-sky-500 animate-pulse";
    case "dispatched":
      return "bg-sky-400";
    case "pending_approval":
      return "bg-amber-500 animate-pulse";
    case "executed":
      return "bg-violet-500";
    case "evaluated":
      return "bg-emerald-500";
    case "reaped":
    case "aborted":
      return "bg-text-muted";
    default:
      return "bg-text-muted";
  }
}

/** 预算/守卫逼近度（0-1）→ 进度条填充配色（<80% 绿，<95% 琥珀，≥95% 红）。 */
export function limitFillClass(ratio: number | null | undefined): string {
  if (ratio == null) return "bg-muted-foreground/40";
  if (ratio >= 0.95) return "bg-red-500";
  if (ratio >= 0.8) return "bg-amber-500";
  return "bg-emerald-500";
}

// ---------------------------------------------------------------------------
// Worktree 生命周期状态
// ---------------------------------------------------------------------------

/** Worktree 生命周期状态 → 徽章配色。 */
export function worktreeStatusClass(status: string | null | undefined): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
    case "cleaned":
      return "bg-muted text-text-secondary";
    case "orphaned":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
    default:
      return "bg-muted/60 text-text-secondary";
  }
}

/** Worktree 生命周期状态 → 中文标签。 */
export function worktreeStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "active":
      return "Active";
    case "cleaned":
      return "Cleaned";
    case "orphaned":
      return "Orphaned";
    default:
      return "—";
  }
}

/** Worktree 清理策略 → 人可读说明文案。 */
export function worktreePolicyDescription(policy: string | null | undefined): string {
  switch (policy) {
    case "on_success":
      return "Auto-cleanup: on success (failed/cancelled worktrees preserved for debugging)";
    case "always":
      return "Auto-cleanup: all terminal routines";
    case "never":
      return "Auto-cleanup: disabled";
    default:
      return "";
  }
}

/** 评分 → 温度条填充配色（≥阈值 绿，≥阈值·0.6 琥珀，否则 红）。 */
export function scoreFillClass(score: number | null | undefined, threshold = 85): string {
  if (score == null) return "bg-muted-foreground/40";
  if (score >= threshold) return "bg-emerald-500";
  if (score >= threshold * 0.6) return "bg-amber-500";
  return "bg-red-500";
}

/** verdict → 徽章配色。 */
export function verdictClass(verdict: Verdict | null | undefined): string {
  switch (verdict) {
    case "pass":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
    case "progressing":
      return "bg-sky-500/15 text-sky-800 dark:text-sky-200";
    case "stalled":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
    case "regressed":
      return "bg-orange-500/15 text-orange-800 dark:text-orange-200";
    case "unrecoverable":
      return "bg-red-500/15 text-red-800 dark:text-red-200";
    default:
      return "bg-muted/60 text-text-secondary";
  }
}
