/**
 * Routine 共享模块 — 统一导出类型、API 客户端和 hooks。
 */

export type {
  RoutineStatus,
  ApprovalMode,
  IterationStatus,
  Verdict,
  ExecStatus,
  RoutinePhase,
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
  RoutineActionStreamEvent,
  RoutineEventType,
  RoutineIterationEventDTO,
  IterationEventsResponse,
  TemplateSource,
  RoutineTemplateItem,
} from "./types";

export {
  fetchKpis,
  fetchRoutines,
  fetchRoutineDetail,
  fetchIterations,
  fetchIterationEvents,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  controlRoutine,
  approveIteration,
  rejectIteration,
  fetchTemplates,
} from "./api";

export { useRoutineData } from "./hooks/useRoutineData";
export { useRoutineStream } from "./hooks/useRoutineStream";
export { useRoutineLive, useFleetSeed, liteFromIteration } from "./hooks/useRoutineLive";
export { useRoutineDetailLive } from "./hooks/useRoutineDetailLive";
export type { LiveActionsByIteration } from "./hooks/useRoutineDetailLive";
