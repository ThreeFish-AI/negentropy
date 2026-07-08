/**
 * PDF Fidelity Patrol 巡检态徽标（Documents 列表「巡检状态」列用）。
 *
 * 4 态映射（对齐后端 ``knowledge_documents.patrol_status`` 列，SSOT）：
 * - ``null``/缺省 → 未巡检（muted 中性）
 * - ``in_progress`` → 正在巡检（sky + 脉冲点）
 * - ``unfixable`` → 巡检失败（red）
 * - ``done`` → 拟合成功（emerald）+ 拟合分数
 *
 * 配色对齐黄金标准 ``app/interface/routine/_components/status-style.ts``（routineStatusClass）
 * 与巡检语义表 ``features/scheduler/patrol-reason.ts``；分数上色复用 ``scoreColorClass``。
 */
import { scoreColorClass } from "@/components/transcript/status-shared";
import { cn } from "@/lib/utils";

export type PatrolStatus = "in_progress" | "done" | "unfixable" | null | undefined;

const BADGE_BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap";

/** 巡检态 → 徽标配色（与 routineStatusClass / PATROL_REASON_STYLE 同款 -500/15 口径）。 */
export function patrolStatusBadgeClass(status: PatrolStatus): string {
  switch (status) {
    case "in_progress":
      return "bg-sky-500/15 text-sky-800 dark:text-sky-200";
    case "done":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
    case "unfixable":
      return "bg-red-500/15 text-red-800 dark:text-red-200";
    default:
      return "bg-muted/60 text-text-secondary";
  }
}

/** 巡检态 → 中文标签（对齐巡检模块术语）。 */
export function patrolStatusLabel(status: PatrolStatus): string {
  switch (status) {
    case "in_progress":
      return "正在巡检";
    case "done":
      return "拟合成功";
    case "unfixable":
      return "巡检失败";
    default:
      return "未巡检";
  }
}

export function PatrolStatusBadge({
  status,
  score,
  className,
}: {
  status: PatrolStatus;
  score?: number | null;
  className?: string;
}) {
  const showScore = score != null && (status === "done" || status === "unfixable");
  return (
    <span className={cn(BADGE_BASE, patrolStatusBadgeClass(status), className)}>
      {status === "in_progress" && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500 animate-pulse" />
      )}
      <span>{patrolStatusLabel(status)}</span>
      {showScore && (
        <span className={cn("tabular-nums", scoreColorClass(score))}>· {score}</span>
      )}
    </span>
  );
}
