import {
  Brain,
  CheckCircle2,
  CircleDot,
  FilePen,
  FilePlus,
  FileText,
  Flag,
  FolderSearch,
  Globe,
  type LucideIcon,
  MessageSquare,
  Scale,
  Search,
  Settings2,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";

import type { IterationStatus, RoutineEventType, RoutinePhase, RoutineStatus, Verdict } from "@/features/routine";

/** 相位 → 徽章配色（规划=琥珀/实现=天蓝/收尾=紫，深色模式安全对比）。 */
export function phaseClass(phase: RoutinePhase | null | undefined): string {
  switch (phase) {
    case "plan":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "implement":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "finalize":
      return "bg-violet-500/10 text-violet-700 dark:text-violet-300";
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

/** 预算/守卫逼近度（0-1）→ 进度条填充配色（<80% 绿，<95% 琥珀，≥95% 红）。 */
export function limitFillClass(ratio: number | null | undefined): string {
  if (ratio == null) return "bg-muted-foreground/40";
  if (ratio >= 0.95) return "bg-red-500";
  if (ratio >= 0.8) return "bg-amber-500";
  return "bg-emerald-500";
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

// ---------------------------------------------------------------------------
// 「全过程」动作级审计事件：图标 + 配色 + 分组（图标+颜色双编码，绝不仅靠颜色）
// ---------------------------------------------------------------------------

/** 工具名（Read/Edit/Write/Bash/Grep/Glob…）→ Lucide 图标。 */
function toolIcon(toolName: string | null | undefined): LucideIcon {
  switch ((toolName || "").toLowerCase()) {
    case "read":
      return FileText;
    case "edit":
    case "multiedit":
    case "notebookedit":
      return FilePen;
    case "write":
      return FilePlus;
    case "bash":
    case "bashoutput":
      return Terminal;
    case "grep":
      return Search;
    case "glob":
      return FolderSearch;
    case "webfetch":
    case "websearch":
      return Globe;
    default:
      return Wrench;
  }
}

/** 动作事件类型 → Lucide 图标（tool_use 进一步按工具名细分）。 */
export function eventTypeIcon(eventType: RoutineEventType, toolName?: string | null): LucideIcon {
  switch (eventType) {
    case "system":
      return Settings2;
    case "assistant":
      return Brain;
    case "tool_use":
      return toolIcon(toolName);
    case "tool_result":
      return MessageSquare;
    case "result":
      return Flag;
    case "gate":
      return ShieldCheck;
    case "evaluation":
      return Scale;
    default:
      return CircleDot;
  }
}

/** 动作事件类型 → 图标容器配色（语义色，深色模式安全对比）。 */
export function eventTypeClass(eventType: RoutineEventType, isError?: boolean): string {
  if (isError) return "bg-red-500/10 text-red-600 dark:text-red-400";
  switch (eventType) {
    case "tool_use":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "tool_result":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "assistant":
      return "bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "result":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "gate":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "evaluation":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "system":
      return "bg-muted text-text-secondary";
    default:
      return "bg-muted/60 text-text-muted";
  }
}

/** 动作事件类型 → 简短标签（无 title 时兜底）。 */
export function eventTypeLabel(eventType: RoutineEventType): string {
  switch (eventType) {
    case "system":
      return "会话初始化";
    case "assistant":
      return "推理";
    case "tool_use":
      return "工具调用";
    case "tool_result":
      return "工具结果";
    case "result":
      return "执行产出";
    case "gate":
      return "命令门控";
    case "evaluation":
      return "评估";
    case "_truncated":
      return "已截断";
    default:
      return "动作";
  }
}

/** 动作事件 → 时间线分组键（执行 / 结果 / 门控 / 评估）。 */
export type EventGroup = "execution" | "result" | "gate" | "evaluation";

export function eventGroup(eventType: RoutineEventType): EventGroup {
  switch (eventType) {
    case "result":
      return "result";
    case "gate":
      return "gate";
    case "evaluation":
      return "evaluation";
    default:
      return "execution"; // system / assistant / tool_use / tool_result / 其它
  }
}

export const EVENT_GROUP_LABEL: Record<EventGroup, string> = {
  execution: "执行 · Execution",
  result: "结果 · Result",
  gate: "门控 · Gate",
  evaluation: "评估 · Evaluation",
};

/** 已完成图标（用于 result 成功态等）。 */
export const SuccessIcon = CheckCircle2;
