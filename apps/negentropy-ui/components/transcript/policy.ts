/**
 * 转录渲染策略（机制 vs 策略正交分解）。
 *
 * ``TranscriptItemsView`` 是与语义无关的纯渲染器；``TranscriptPolicy`` 承载两类消费者
 * （Routine 迭代审计 vs Studio 中栏对话）的差异：
 *
 * 1. ``align``：物理左右对齐——Routine 把 ``human_reply``/``task_dispatch``/``engine`` 居右、
 *    其余居左；Studio 把 ``user`` 居右、其余（一核五翼 + Claude Code）全居左。
 * 2. ``roleHeaderFor``：是否在机侧 item 上方渲染 per-agent ``RoleHeader`` 徽章——Routine 恒
 *    不渲染（徽章仍内嵌在 Engine/Human/TaskDispatch 块中，观感不变）；Studio 在 role 相对
 *    上一条机侧 item 变化时渲染（分组，避免同 agent 连续刷屏）。
 */

import type { AgentRole } from "@/features/agent-identity";

import type { TranscriptItem } from "./types";

/** 物理对齐侧。 */
export type Side = "left" | "right";

export interface TranscriptPolicy {
  /** item → 物理对齐侧。 */
  align(item: TranscriptItem): Side;
  /** 机侧 item 是否在上方渲染 per-agent 徽章；返回 null 表示不渲染。 */
  roleHeaderFor(item: TranscriptItem, prev: TranscriptItem | null): AgentRole | null;
  /** 在途尾部 ``WorkingIndicator`` 标签解析（可选；缺省沿用 Routine 逻辑）。 */
  workingLabel?(lastItem: TranscriptItem | undefined): string;
}

/** Routine 策略：与历史 ``TranscriptView`` 行为逐像素等价。 */
export const ROUTINE_POLICY: TranscriptPolicy = {
  align: (item) =>
    item.kind === "human_reply" || item.kind === "task_dispatch" || item.kind === "engine"
      ? "right"
      : "left",
  roleHeaderFor: () => null,
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

/** 取机侧 item 的 role（仅 assistant/tool/tool_summary/cc_request 携带；其余返回 null）。 */
function machineRoleOf(item: TranscriptItem): AgentRole | null {
  if (
    item.kind === "assistant" ||
    item.kind === "tool" ||
    item.kind === "tool_summary" ||
    item.kind === "cc_request"
  ) {
    return item.role ?? null;
  }
  return null;
}
