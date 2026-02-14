/**
 * Timeline Feature Module
 *
 * 导出时间线相关的组件、hooks 和类型
 *
 * 职责：
 * - 事件时间线展示
 * - 状态快照展示
 * - 事件过滤和查询
 */

// Components (re-export from ui/ for now)
export { EventTimeline } from "@/components/ui/EventTimeline";
export type { TimelineItem } from "@/components/ui/EventTimeline";

export { StateSnapshot } from "@/components/ui/StateSnapshot";

// Hooks
export { useEventFilter } from "./hooks/useEventFilter";
export type { UseEventFilterOptions, UseEventFilterReturnValue } from "./hooks/useEventFilter";
