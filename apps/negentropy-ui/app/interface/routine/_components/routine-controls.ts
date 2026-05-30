import type { RoutineStatus } from "@/features/routine";

/**
 * Routine 控制动作 —— 抽屉（RoutineDetailDrawer）与 Run 全过程页（[id]/page）共享的单一事实源，
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
