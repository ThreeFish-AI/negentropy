/**
 * 转录渲染策略（机制 vs 策略正交分解）。
 *
 * ``TranscriptItemsView`` 是与语义无关的纯渲染器；``TranscriptPolicy`` 承载两类消费者
 * （Routine 迭代审计 vs Studio 中栏对话）的差异：
 *
 * 1. ``align``：物理左右对齐——Routine 把 ``human_reply``/``task_dispatch``/``engine`` 居右、
 *    其余居左；Studio 把 ``user`` 居右、其余（一核五翼 + Claude Code）全居左。
 * 2. ``roleHeaderFor``：是否在 item 上方渲染 ``RoleHeader`` 徽章——Routine 在机侧（Claude Code）
 *    「回合切换处」（上一条非机侧或无 prev）渲染 ``claude_code`` 徽章（连续机侧不重复刷；人侧
 *    engine/human_reply/task_dispatch 自带内嵌徽章，此处不重复）；Studio 在机侧 role 相对
 *    上一条变化时渲染（分组，避免同 agent 连续刷屏）。
 */

import type { AgentRole } from "@/features/agent-identity";

import type { TranscriptItem } from "./types";

/** 物理对齐侧。 */
export type Side = "left" | "right";

export interface TranscriptPolicy {
  /** item → 物理对齐侧。 */
  align(item: TranscriptItem): Side;
  /**
   * turn 间距判定的发言人分组（机制层 ``gapClass`` 据此决定 16px 换方间距）；缺省沿用 ``align``。
   * ROUTINE 用三分（cc/human/engine）保历史 ``TranscriptView`` 等价——``engine`` 与
   * ``human_reply``/``task_dispatch`` 都居右但分属不同 speaker，须以 speaker 维度（而非 align
   * 二态）触发换方间距；STUDIO 无此三分语义，缺省回落 align。
   */
  turnGroup?(item: TranscriptItem): string;
  /** 机侧 item 是否在上方渲染 per-agent 徽章；返回 null 表示不渲染。 */
  roleHeaderFor(item: TranscriptItem, prev: TranscriptItem | null): AgentRole | null;
  /** 在途尾部 ``WorkingIndicator`` 标签解析（可选；缺省沿用 Routine 逻辑）。 */
  workingLabel?(lastItem: TranscriptItem | undefined): string;
}

/**
 * Routine 策略：人 = 一核五翼 6 Agent + Engine（居右）；机 = Claude Code（居左）。
 *
 * ``roleHeaderFor`` 在机侧「回合切换处」显 ``claude_code`` 徽章，让人↔CC 对话结构显化（对齐
 * Conductor 机侧身份标注）；连续机侧不重复刷，人侧块（engine/human_reply/task_dispatch）自带
 * 内嵌徽章，此处返回 null 不重复。
 */
export const ROUTINE_POLICY: TranscriptPolicy = {
  align: (item) =>
    item.kind === "human_reply" || item.kind === "task_dispatch" || item.kind === "engine"
      ? "right"
      : "left",
  turnGroup: (item) => {
    if (item.kind === "human_reply" || item.kind === "task_dispatch") return "human";
    if (item.kind === "engine") return "engine";
    return "cc";
  },
  roleHeaderFor: (item, prev) => {
    if (!isMachineItem(item)) return null;
    return prev && isMachineItem(prev) ? null : "claude_code";
  },
  workingLabel: (last) => (last?.kind === "cc_request" && last.pending ? "Planning…" : "Working…"),
};

/**
 * Studio 策略：人 = 真实用户居右；机 = 一核五翼 + Claude Code 全居左，role 变化时显徽章。
 *
 * ``roleHeaderFor`` 仅对带 ``role`` 字段的机侧 item 生效；role 相对上一条机侧 item 变化时
 * 渲染（同 agent 连续回合不重复刷徽章）。``user`` / ``system_note`` 等无 role 的 item 永不挂徽章。
 */
export const STUDIO_POLICY: TranscriptPolicy = {
  align: (item) => (item.kind === "user" ? "right" : "left"),
  roleHeaderFor: (item, prev) => {
    const role = machineRoleOf(item);
    if (!role) return null;
    const prevRole = prev ? machineRoleOf(prev) : null;
    return role !== prevRole ? role : null;
  },
  workingLabel: (last) => (last?.kind === "cc_request" && last.pending ? "Planning…" : "Working…"),
};

/** 机侧 kind 集合（assistant/tool/tool_summary/cc_request）——Routine 与 Studio 共用判定。 */
const MACHINE_KINDS: ReadonlySet<TranscriptItem["kind"]> = new Set([
  "assistant",
  "tool",
  "tool_summary",
  "cc_request",
]);

/** 机侧 TranscriptItem（四个 kind 均携带可选 ``role``，供 ``machineRoleOf`` 收窄访问）。 */
type MachineTranscriptItem = Extract<
  TranscriptItem,
  { kind: "assistant" | "tool" | "tool_summary" | "cc_request" }
>;

/** item 是否为机侧 kind（类型守卫：收窄为 ``MachineTranscriptItem``）。 */
function isMachineItem(item: TranscriptItem): item is MachineTranscriptItem {
  return MACHINE_KINDS.has(item.kind);
}

/** 取机侧 item 的 role（仅机侧 kind 携带；其余返回 null）。 */
function machineRoleOf(item: TranscriptItem): AgentRole | null {
  return isMachineItem(item) ? (item.role ?? null) : null;
}
