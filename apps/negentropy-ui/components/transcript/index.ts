/**
 * 转录渲染器 barrel（跨域共享）。
 *
 * Routine 薄壳 ``TranscriptView`` 与 Studio ``StudioTranscript`` 均从此处引入渲染原语。
 */

export { TranscriptItemsView } from "./TranscriptItemsView";
export { ROUTINE_POLICY, STUDIO_POLICY, type TranscriptPolicy, type Side } from "./policy";
export { collapseToolRuns } from "./collapse-tool-runs";
export type {
  TranscriptItem,
  ToolCallDetail,
  CcRequestMode,
  HumanReplyMode,
} from "./types";
