/**
 * Evaluator-Optimizer 闭环阶段派生 —— 单一事实源。
 *
 * 一个 Routine 的每次迭代经历 4 个规范阶段：
 *   Dispatch（构建提示并派发） → Execute（Claude Code 执行） → Evaluate（门控 + LLM 评审） → Decide（继续/终止）
 * 本模块把「最新迭代的 ``status``」+「Routine 级 ``status``」映射为可供步进器/卡片渲染的快照，
 * 颜色与 [[status-style]] 的 ``iterationDotClass`` 同源，使阶段条与时间线点位一致。
 */

import type {
  IterationStatus,
  RoutineDTO,
  RoutineStatus,
  Verdict,
} from "@/features/routine";

/** 4 个规范闭环阶段（按时序）。 */
export type LoopStage = "dispatch" | "execute" | "evaluate" | "decide";

export const LOOP_STAGES: readonly LoopStage[] = [
  "dispatch",
  "execute",
  "evaluate",
  "decide",
] as const;

/** 闭环整体模式。 */
export type LoopMode =
  | "looping" // 正常迭代中（某阶段进行）
  | "waiting-approval" // 等待人工审批后才派发
  | "paused" // 已暂停（冻结）
  | "done" // 终态（succeeded/failed/cancelled）
  | "idle"; // 未启动 / 无迭代

/** 单阶段在步进器中的状态。 */
export type StageState = "pending" | "active" | "done";

/** 闭环快照 —— 供 RoutineLoopBar / RoutineLoopDiagram / FleetCard 渲染。 */
export interface LoopSnapshot {
  mode: LoopMode;
  /** 当前活动阶段（仅 looping / waiting-approval 有意义，否则 null）。 */
  activeStage: LoopStage | null;
  /** 活动阶段是否脉冲（执行中 / 评估中 / 等待审批时为 true）。 */
  pulsing: boolean;
  /** 每阶段状态，用于步进器分段着色。 */
  stageStates: Record<LoopStage, StageState>;
  /** decided 时的 verdict（若有）。 */
  verdict: Verdict | null;
  /** done 时的终止原因（若有）。 */
  terminationReason: string | null;
  /** 透传 Routine 级状态，便于渲染层做整体判断。 */
  routineStatus: RoutineStatus;
}

/** 阶段静态元数据：标签、点位配色（与 iterationDotClass 同源）、描述。 */
export const LOOP_STAGE_META: Record<
  LoopStage,
  { label: string; dot: string; desc: string }
> = {
  dispatch: { label: "Dispatch", dot: "bg-sky-400", desc: "构建提示并派发迭代" },
  execute: { label: "Execute", dot: "bg-sky-500", desc: "Claude Code 执行（多轮）" },
  evaluate: { label: "Evaluate", dot: "bg-violet-500", desc: "命令门控 + LLM 评审" },
  decide: { label: "Decide", dot: "bg-emerald-500", desc: "继续迭代或终止" },
};

/** loopStageOf 入参：只读取 status / verdict，兼容完整 DTO 与精简 Lite。 */
export type LatestIterationInput =
  | { status: IterationStatus; verdict?: Verdict | null }
  | null
  | undefined;

const TERMINAL_ROUTINE: ReadonlySet<RoutineStatus> = new Set([
  "succeeded",
  "failed",
  "cancelled",
]);

const ALL_PENDING = (): Record<LoopStage, StageState> => ({
  dispatch: "pending",
  execute: "pending",
  evaluate: "pending",
  decide: "pending",
});

const ALL_DONE = (): Record<LoopStage, StageState> => ({
  dispatch: "done",
  execute: "done",
  evaluate: "done",
  decide: "done",
});

/** 由迭代状态推导各阶段进度。 */
function stageStatesFor(status: IterationStatus | undefined): Record<LoopStage, StageState> {
  switch (status) {
    case "dispatched":
    case "pending_approval":
      return { dispatch: "active", execute: "pending", evaluate: "pending", decide: "pending" };
    case "in_flight":
      return { dispatch: "done", execute: "active", evaluate: "pending", decide: "pending" };
    case "executed":
      return { dispatch: "done", execute: "done", evaluate: "active", decide: "pending" };
    case "evaluated":
      return ALL_DONE();
    default: // reaped / aborted / undefined
      return ALL_PENDING();
  }
}

/** 由迭代状态推导活动阶段与脉冲。 */
function activeFor(status: IterationStatus): { stage: LoopStage | null; pulsing: boolean } {
  switch (status) {
    case "dispatched":
      return { stage: "dispatch", pulsing: false };
    case "in_flight":
      return { stage: "execute", pulsing: true };
    case "executed":
      return { stage: "evaluate", pulsing: true };
    case "evaluated":
      return { stage: "decide", pulsing: false };
    default:
      return { stage: null, pulsing: false };
  }
}

/**
 * 推导闭环快照。
 *
 * 优先级：终态 > 暂停 > 未启动/无迭代 > 等待审批 > 正常循环。
 */
export function loopStageOf(
  latest: LatestIterationInput,
  routine: Pick<RoutineDTO, "status" | "termination_reason">,
): LoopSnapshot {
  // 终态：全部完成
  if (TERMINAL_ROUTINE.has(routine.status)) {
    return {
      mode: "done",
      activeStage: null,
      pulsing: false,
      stageStates: ALL_DONE(),
      verdict: latest?.verdict ?? null,
      terminationReason: routine.termination_reason ?? null,
      routineStatus: routine.status,
    };
  }

  // 暂停：保留最后阶段进度但冻结（不脉冲）
  if (routine.status === "paused") {
    return {
      mode: "paused",
      activeStage: null,
      pulsing: false,
      stageStates: stageStatesFor(latest?.status),
      verdict: latest?.verdict ?? null,
      terminationReason: null,
      routineStatus: routine.status,
    };
  }

  // 未启动 / 尚无迭代信息
  if (routine.status === "pending" || !latest) {
    return {
      mode: "idle",
      activeStage: null,
      pulsing: false,
      stageStates: ALL_PENDING(),
      verdict: null,
      terminationReason: null,
      routineStatus: routine.status,
    };
  }

  // 等待人工审批（派发前门控）
  if (latest.status === "pending_approval") {
    return {
      mode: "waiting-approval",
      activeStage: "dispatch",
      pulsing: true,
      stageStates: stageStatesFor("pending_approval"),
      verdict: null,
      terminationReason: null,
      routineStatus: routine.status,
    };
  }

  // 正常循环
  const { stage, pulsing } = activeFor(latest.status);
  return {
    mode: "looping",
    activeStage: stage,
    pulsing,
    stageStates: stageStatesFor(latest.status),
    verdict: latest.verdict ?? null,
    terminationReason: null,
    routineStatus: routine.status,
  };
}
