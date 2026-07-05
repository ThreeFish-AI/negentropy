/**
 * 转录 UI 通用状态/图标/标签工具（跨域共享）。
 *
 * 抽离自 ``app/interface/routine/_components/status-style``：本模块承载转录渲染器
 * （``components/transcript``）所需的工具图标、事件标签翻译、任务状态、评分配色等
 * **通用**展示工具。``RoutineEventType`` / ``RoutineIterationEventDTO`` 仅作为**类型**
 * 出现在签名中（``import type``，运行时零耦合），因为转录的 ``system`` / ``engine``
 * item 仍携带这些 Routine DTO；Studio 不产出这些 item，故不受影响。
 *
 * Routine 侧 ``status-style.ts`` 通过 re-export 垫片继续暴露这些符号，保持现有引用零改动。
 */

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

import type { RoutineEventType, RoutineIterationEventDTO } from "@/features/routine";

// ---------------------------------------------------------------------------
// 事件标题翻译层
// ---------------------------------------------------------------------------

/** 已知事件 title → 中文标签映射（跨 event_type 共享）。 */
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

// ---------------------------------------------------------------------------
// 评分配色
// ---------------------------------------------------------------------------

/** 评分 → 文字配色（≥85 绿，≥50 琥珀，<50 红）。 */
export function scoreColorClass(score: number | null | undefined): string {
  if (score == null) return "text-text-muted";
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

// ---------------------------------------------------------------------------
// 「全过程」动作级审计事件：图标 + 配色 + 分组（图标+颜色双编码，绝不仅靠颜色）
// ---------------------------------------------------------------------------

/** 工具名（Read/Edit/Write/Bash/Grep/Glob…）→ Lucide 图标。 */
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
    case "taskcreate":
    case "taskupdate":
      return ListChecks;
    case "task":
      return Bot;
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

/** 任务状态 → 状态圆点 CSS。 */
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
