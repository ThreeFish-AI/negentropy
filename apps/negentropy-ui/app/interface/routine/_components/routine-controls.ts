import type { RoutineStatus } from "@/features/routine";

/**
 * Routine 控制动作 —— 抽屉（RoutineEditDrawer）与 Run 全过程页（[id]/page）共享的单一事实源，
 * 避免「允许的状态转换 / 文案」在两处手工同步而静默分叉。
 */
export type ControlAction = "start" | "pause" | "resume" | "cancel";

/** 动作 → 按钮文案。 */
export const CONTROL_LABEL: Record<ControlAction, string> = {
  start: "Start",
  pause: "Pause",
  resume: "Resume",
  cancel: "Cancel",
};

/** 依 Routine 状态计算可用控制动作。 */
export function controlsFor(status: RoutineStatus): ControlAction[] {
  switch (status) {
    case "pending":
      return ["start"];
    case "running":
      return ["pause", "cancel"];
    case "paused":
      return ["resume", "cancel"];
    default:
      return [];
  }
}

/**
 * 是否可「重新启动」——仅非成功终态（failed / cancelled）。
 * Restart 不走即时控制（controlsFor），需对话框门控（反思选择 + 代价确认），故单列判定。
 */
export function canRestart(status: RoutineStatus): boolean {
  return status === "failed" || status === "cancelled";
}
