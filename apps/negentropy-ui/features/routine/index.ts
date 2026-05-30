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
  RoutineKpis,
  RoutineListResponse,
  IterationListResponse,
  RoutineFilters,
  RoutineCreatePayload,
  RoutineUpdatePayload,
  RoutineStreamEvent,
  RoutinePresetSummary,
  RoutineFromPresetPayload,
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
  fetchPresets,
  createRoutineFromPreset,
} from "./api";

export { useRoutineData } from "./hooks/useRoutineData";
export { useRoutineStream } from "./hooks/useRoutineStream";
