/**
 * Agent 身份注册表（跨域单一事实源）。
 *
 * 抽离自 ``features/routine/agent-role``：本模块只承载**与具体业务事件类型无关**的
 * Agent 身份元信息（一核五翼 6 Agent + Claude Code 的图标/标签/徽章配色），
 * 供 Routine 转录 UI 与 Studio 中栏对话共用。Routine 专有的「事件类型→角色」推导
 * 仍留在 ``features/routine/agent-role``，依赖 ``RoutineEventType``。
 */

import { Bot, BrainCircuit, Cpu, Eye, Hand, Megaphone, Sparkles, type LucideIcon } from "lucide-react";

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
// 已知角色集合（校验后端 agent_role 字符串）
// ---------------------------------------------------------------------------

/** 已知 AgentRole 取值集合——用于校验后端 agent_role 字符串的有效性。 */
export const KNOWN_AGENT_ROLES = new Set<AgentRole>([
  "engine",
  "claude_code",
  "perception",
  "action",
  "internalization",
  "contemplation",
  "influence",
]);

/** 后端 agent_role 字符串归一化为 ``AgentRole``；未知值回退到 ``fallback``（默认 engine）。 */
export function normalizeAgentRole(
  value: string | null | undefined,
  fallback: AgentRole = "engine",
): AgentRole {
  if (value && KNOWN_AGENT_ROLES.has(value as AgentRole)) return value as AgentRole;
  return fallback;
}
