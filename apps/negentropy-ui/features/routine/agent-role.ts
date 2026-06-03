/**
 * Routine 迭代步骤「主导人」归属标识。
 *
 * 基于 event_type 推导当前步骤的执行者（Negentropy Engine / Claude Code / 五翼 Faculty）。
 * Phase 1：纯前端推导，零迁移成本；Phase 2（五翼 Faculty 接入后）改为从后端 agent_role 字段读取。
 */

import { Bot, BrainCircuit, Cpu, Eye, Hand, Megaphone, Sparkles, type LucideIcon } from "lucide-react";

import type { RoutineEventType, IterationStatus } from "./types";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** Agent 主导人角色（当前实际参与者 + 五翼 Faculty 预留）。 */
export type AgentRole =
  | "engine"
  | "claude_code"
  | "perception"
  | "action"
  | "internalization"
  | "contemplation"
  | "influence";

/** 角色元数据。 */
export interface AgentRoleMeta {
  /** 用户可见的显示名。 */
  label: string;
  /** 英文显示名。 */
  labelEn: string;
  /** Lucide 图标。 */
  icon: LucideIcon;
  /** 徽章 Tailwind 配色（深色模式安全高对比度）。 */
  badgeClass: string;
}

// ---------------------------------------------------------------------------
// 角色元数据映射表
// ---------------------------------------------------------------------------

export const AGENT_ROLE_META: Record<AgentRole, AgentRoleMeta> = {
  engine: {
    label: "Negentropy",
    labelEn: "Negentropy",
    icon: Cpu,
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  claude_code: {
    label: "Claude Code",
    labelEn: "Claude Code",
    icon: Bot,
    badgeClass: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  perception: {
    label: "慧眼",
    labelEn: "Perception",
    icon: Eye,
    badgeClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  action: {
    label: "妙手",
    labelEn: "Action",
    icon: Hand,
    badgeClass: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  internalization: {
    label: "本心",
    labelEn: "Internalization",
    icon: BrainCircuit,
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  contemplation: {
    label: "元神",
    labelEn: "Contemplation",
    icon: Sparkles,
    badgeClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  influence: {
    label: "喉舌",
    labelEn: "Influence",
    icon: Megaphone,
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

// ---------------------------------------------------------------------------
// 推导函数
// ---------------------------------------------------------------------------

/**
 * 事件类型 → 主导人推导。
 *
 * - gate / evaluation → Engine（命令门控 / LLM-as-Judge）
 * - 其余（system / assistant / tool_use / tool_result / result）→ Claude Code（执行者）
 */
export function deriveAgentRole(eventType: RoutineEventType): AgentRole {
  switch (eventType) {
    case "gate":
    case "evaluation":
    case "plan_review":
      return "engine";
    default:
      return "claude_code";
  }
}

/**
 * 迭代状态 → 当前阶段主导人推导（用于迭代卡片指示器）。
 *
 * - `pending_approval` / `dispatched` / `executed` → Engine（编排/评估阶段）
 * - `in_flight` → Claude Code（执行阶段）
 * - 终态 → null（已完成/已终止）
 */
export function deriveIterationDriver(status: IterationStatus): AgentRole | null {
  switch (status) {
    case "pending_approval":
    case "dispatched":
    case "executed":
      return "engine";
    case "in_flight":
      return "claude_code";
    default:
      return null;
  }
}

/**
 * 统计一组事件中各主导人的事件数。
 *
 * 返回按事件数降序排列的 `[AgentRole, count][]`，用于主导人摘要 pill 列表。
 */
export function countAgentRoles(
  events: Array<{ event_type: RoutineEventType }>,
): Array<[AgentRole, number]> {
  const counts = new Map<AgentRole, number>();
  for (const ev of events) {
    const role = deriveAgentRole(ev.event_type);
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
