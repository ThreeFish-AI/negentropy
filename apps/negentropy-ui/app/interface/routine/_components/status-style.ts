import type { IterationStatus, RoutineStatus, Verdict } from "@/features/routine";

/** Routine 状态 → 徽章配色。 */
export function routineStatusClass(status: RoutineStatus): string {
  switch (status) {
    case "running":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "paused":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "succeeded":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "failed":
      return "bg-red-500/10 text-red-700 dark:text-red-300";
    case "cancelled":
      return "bg-muted text-text-secondary line-through";
    default: // pending
      return "bg-muted/60 text-foreground";
  }
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

/** 评分 → 文字配色（≥85 绿，≥50 琥珀，<50 红）。 */
export function scoreColorClass(score: number | null | undefined): string {
  if (score == null) return "text-text-muted";
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/** verdict → 徽章配色。 */
export function verdictClass(verdict: Verdict | null | undefined): string {
  switch (verdict) {
    case "pass":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "progressing":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "stalled":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "regressed":
      return "bg-orange-500/10 text-orange-700 dark:text-orange-300";
    case "unrecoverable":
      return "bg-red-500/10 text-red-700 dark:text-red-300";
    default:
      return "bg-muted/60 text-text-secondary";
  }
}
