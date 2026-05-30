/**
 * Routine 共享模块 — 统一导出类型、API 客户端和 hooks。
 */

export type {
  RoutineStatus,
  ApprovalMode,
  IterationStatus,
  Verdict,
  ExecStatus,
  RoutineDTO,
  RoutineIterationDTO,
  RoutineIterationLite,
  RoutineKpis,
  RoutineListResponse,
  IterationListResponse,
  RoutineFilters,
  RoutineCreatePayload,
  RoutineUpdatePayload,
  RoutineStreamEvent,
} from "./types";

export {
  fetchKpis,
  fetchRoutines,
  fetchRoutineDetail,
  fetchIterations,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  controlRoutine,
  approveIteration,
  rejectIteration,
} from "./api";

export { useRoutineData } from "./hooks/useRoutineData";
export { useRoutineStream } from "./hooks/useRoutineStream";
export { useRoutineLive, useFleetSeed, liteFromIteration } from "./hooks/useRoutineLive";
export { useRoutineDetailLive } from "./hooks/useRoutineDetailLive";
