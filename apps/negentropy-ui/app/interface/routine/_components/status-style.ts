import {
  Bot,
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
  ListChecks,
  MessageSquare,
  Scale,
  Search,
  Settings2,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";

import type {
  IterationStatus,
  RoutineEventType,
  RoutineIterationEventDTO,
  RoutinePhase,
  RoutineStatus,
  Verdict,
} from "@/features/routine";

// ---------------------------------------------------------------------------
// 事件标题翻译层
// ---------------------------------------------------------------------------

/** 已知事件 title → 中文标签映射（跨 event_type 共享）。
 *
 * 后端 _normalize_stream_event 将 subtype 存入 title 字段（如 "init"、"api_retry"），
 * 前端据此翻译为用户友好的中文标签。不在映射表中的 title 值（如 tool_use 的描述性标题）
 * 会被原样透传。 */
export const EVENT_TITLE_LABELS: Record<string, string> = {
  // system subtypes
  init: "会话初始化",
  api_retry: "API 重试",
  task_started: "后台任务启动",
  task_completed: "后台任务完成",
  task_progress: "任务进度",
  task_notification: "任务通知",
  task_updated: "任务状态更新",
  // assistant subtypes
  thinking: "思考",
  // result subtypes
  success: "成功",
  error: "执行错误",
  timeout: "执行超时",
  // CC 内置 Task 工具（向后兼容：旧事件 title 为裸工具名时的中文兜底）
  TaskCreate: "创建任务",
  TaskUpdate: "更新任务",
};

/** 解析事件行标题：翻译已知 title，未知 title 透传，无 title 走 eventTypeLabel 兜底。 */
export function resolveEventTitle(
  eventType: RoutineEventType,
  title: string | null | undefined,
  toolName: string | null | undefined,
): string {
  if (title && title in EVENT_TITLE_LABELS) return EVENT_TITLE_LABELS[title];
  return title || toolName || eventTypeLabel(eventType);
}

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

/** 「PR 已合并」徽章配色（violet = GitHub merged 色 + 仓库 PR/finalize 强调色；区别于绿色 succeeded）。
 *  列表行与详情头复用，保持「Merged」视觉单一事实源。 */
export const mergedBadgeClass =
  "inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-micro font-semibold text-violet-700 dark:text-violet-300";

/** 「PR 已关闭（未合并）」徽章配色（muted/灰，区别于 failed-红 / merged-紫 / succeeded-绿）。 */
export const closedBadgeClass =
  "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-micro font-semibold text-text-secondary";

/** 「PR 开启中（待合并）」徽章配色（sky/天蓝 = 活跃待处理；区别于 succeeded-绿/merged-紫/closed-灰/failed-红）。 */
export const openBadgeClass =
  "inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-micro font-semibold text-sky-700 dark:text-sky-300";

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

// ---------------------------------------------------------------------------
// 「全过程」动作级审计事件：图标 + 配色 + 分组（图标+颜色双编码，绝不仅靠颜色）
// ---------------------------------------------------------------------------

/** 工具名（Read/Edit/Write/Bash/Grep/Glob…）→ Lucide 图标。
 *  导出以供 transcript 模块复用，保持图标注册表单一事实源。 */
export function toolIcon(toolName: string | null | undefined): LucideIcon {
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
    // CC 内置 Task 管理工具（ListChecks：任务列表语义）
    case "taskcreate":
    case "taskupdate":
      return ListChecks;
    // 子代理 Task 工具（Bot：代理语义）
    case "task":
      return Bot;
    // 退出 Plan 模式（Brain：规划语义）
    case "exitplanmode":
      return Brain;
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
    case "plan_review":
      return Scale;
    default:
      return CircleDot;
  }
}

/** 动作事件类型 → 图标容器配色（语义色，深色模式安全对比）。 */
export function eventTypeClass(eventType: RoutineEventType, isError?: boolean): string {
  if (isError) return "bg-red-500/15 text-red-800 dark:text-red-200";
  switch (eventType) {
    case "tool_use":
      return "bg-sky-500/15 text-sky-800 dark:text-sky-200";
    case "tool_result":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
    case "assistant":
      return "bg-violet-500/15 text-violet-800 dark:text-violet-200";
    case "result":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
    case "gate":
      return "bg-sky-500/15 text-sky-800 dark:text-sky-200";
    case "evaluation":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
    case "plan_review":
      return "bg-sky-500/15 text-sky-800 dark:text-sky-200";
    case "system":
      return "bg-muted text-text-secondary";
    default:
      return "bg-muted/60 text-text-secondary";
  }
}

/** 动作事件类型 → 简短标签（无 title 时兜底）。 */
export function eventTypeLabel(eventType: RoutineEventType): string {
  switch (eventType) {
    case "system":
      return "系统事件";
    case "system_retry":
      return "API 重试";
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
    case "plan_review":
      return "Plan 审阅";
    case "_truncated":
      return "已截断";
    default:
      return "动作";
  }
}

/** 动作事件 → 时间线分组键（执行 / Plan 审阅 / 结果 / 门控 / 评估）。 */
export type EventGroup = "execution" | "plan_review" | "result" | "gate" | "evaluation";

export function eventGroup(eventType: RoutineEventType): EventGroup {
  switch (eventType) {
    case "plan_review":
      return "plan_review";
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
  plan_review: "Plan 审阅 · Review",
  result: "结果 · Result",
  gate: "门控 · Gate",
  evaluation: "评估 · Evaluation",
};

/** 已完成图标（用于 result 成功态等）。 */
export const SuccessIcon = CheckCircle2;

// ---------------------------------------------------------------------------
// CC Task 工具状态指示（TaskCreate / TaskUpdate 的动态状态追踪）
// ---------------------------------------------------------------------------

/** Claude Code Task 工具内置状态枚举。 */
export type TaskStatus = "pending" | "in_progress" | "completed" | "deleted";

const TASK_STATUS_SET = new Set<string>(["pending", "in_progress", "completed", "deleted"]);

/** 任务状态 → 状态圆点 CSS（复用 iterationDotClass 色彩语言）。 */
export function taskStatusDotClass(status: TaskStatus | null | undefined): string {
  switch (status) {
    case "pending":
      return "bg-text-muted";
    case "in_progress":
      return "bg-sky-500 animate-pulse";
    case "completed":
      return "bg-emerald-500";
    case "deleted":
      return "bg-red-500";
    default:
      return "";
  }
}

/** 任务状态 → 短标签。 */
export function taskStatusLabel(status: TaskStatus | null | undefined): string {
  switch (status) {
    case "pending":
      return "pending";
    case "in_progress":
      return "in progress";
    case "completed":
      return "completed";
    case "deleted":
      return "deleted";
    default:
      return "";
  }
}

/** 从 tool_use 事件的 payload.input 派生任务状态。
 *
 * - TaskCreate：input.status（缺省时默认 "pending"）
 * - TaskUpdate：input.status（必须显式提供） */
export function deriveTaskStatus(ev: RoutineIterationEventDTO): TaskStatus | null {
  if (ev.event_type !== "tool_use") return null;
  const toolName = (ev.tool_name || "").toLowerCase();
  if (toolName !== "taskcreate" && toolName !== "taskupdate") return null;

  const input = ev.payload?.input;
  if (typeof input === "object" && input !== null) {
    const status = (input as Record<string, unknown>).status;
    if (typeof status === "string" && TASK_STATUS_SET.has(status)) {
      return status as TaskStatus;
    }
  }
  // TaskCreate 无显式 status 时默认 pending
  if (toolName === "taskcreate") return "pending";
  return null;
}
