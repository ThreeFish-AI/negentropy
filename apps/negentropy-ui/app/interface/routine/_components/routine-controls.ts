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
  cancel: "Terminate",
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
 * 是否可「终止」——非终态（pending / running / paused）均可。
 * 供列表页行内 Terminate 按钮 + 确认对话框门控。
 */
export function canCancel(status: RoutineStatus): boolean {
  return status === "pending" || status === "running" || status === "paused";
}

/**
 * 是否可「重新启动」——仅非成功终态（failed / cancelled）。
 * Restart 不走即时控制（controlsFor），需对话框门控（反思选择 + 代价确认），故单列判定。
 */
export function canRestart(status: RoutineStatus): boolean {
  return status === "failed" || status === "cancelled";
}

/**
 * 是否可「清理 worktree」——精确镜像后端 `cleanup-worktree` 端点守卫：终态 + `worktree_path` 非空。
 *
 * 不依赖 `worktree_status`：列表端点为避免 N+1 磁盘检查不计算该字段（恒为 null），而 `worktree_path`
 * 由 DB 直出始终可用。依 `compute_worktree_status` 逻辑，`worktree_path != null` 严格等价于
 * 状态 active / orphaned（cleaned / none 均要求 worktree_path 为空），故两者判定结果一致。
 *
 * 供列表页行内 Clean Up 按钮 + RoutineWorkspaceCard 共享的单一事实源。
 */
export function canCleanupWorktree(
  status: RoutineStatus,
  worktreePath?: string | null,
): boolean {
  return (
    (status === "succeeded" || status === "failed" || status === "cancelled") &&
    worktreePath != null
  );
}
