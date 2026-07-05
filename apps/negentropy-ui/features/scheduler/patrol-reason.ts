/**
 * 巡检 handler（pdf_fidelity_patrol）`metrics.reason` → 人话 + 徽标样式映射。
 *
 * Scheduler 执行面板（每 tick 行）与任务详情「派生 Routine」空态共用，
 * 取代从前的 silent ok / 泛泛「暂无派生 Routine」——让管理员一眼看清
 * 「为何这次没派生 Routine」。
 *
 * 与后端 ``handlers/pdf_fidelity_patrol.py`` 各 early-return 的 metrics.reason 对齐。
 */

export type PatrolReason =
  | "spawned"
  | "no_pending_docs"
  | "repo_not_configured"
  | "in_progress"
  | "patrol_disabled"
  | "routine_disabled"
  | "stage_source_pdf_failed";

export const PATROL_REASON_LABEL: Record<PatrolReason, string> = {
  spawned: "已派生 Routine",
  no_pending_docs: "无待检 PDF 文档",
  repo_not_configured: "仓库未配置",
  in_progress: "上一轮仍在跑",
  patrol_disabled: "巡检已禁用",
  routine_disabled: "Routine 子系统未启用",
  stage_source_pdf_failed: "源 PDF 预取失败",
};

/** 徽标 tailwind class（成功 / 警示 / 中性 / 错误）。 */
export const PATROL_REASON_STYLE: Record<PatrolReason, string> = {
  spawned: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  no_pending_docs: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  repo_not_configured: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  in_progress: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  patrol_disabled: "bg-muted text-text-secondary",
  routine_disabled: "bg-muted text-text-secondary",
  stage_source_pdf_failed: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const ORDER: PatrolReason[] = [
  "spawned",
  "no_pending_docs",
  "repo_not_configured",
  "in_progress",
  "patrol_disabled",
  "routine_disabled",
  "stage_source_pdf_failed",
];

export function isPatrolReason(value: unknown): value is PatrolReason {
  return typeof value === "string" && (ORDER as string[]).includes(value);
}

export function patrolReasonLabel(reason: unknown): string | null {
  return isPatrolReason(reason) ? PATROL_REASON_LABEL[reason] : null;
}

export function patrolReasonStyle(reason: unknown): string {
  return isPatrolReason(reason) ? PATROL_REASON_STYLE[reason] : "bg-muted text-text-secondary";
}
