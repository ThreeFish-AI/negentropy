/**
 * Connection Feature Module
 *
 * 导出连接状态相关的组件、hooks 和类型
 *
 * 职责：
 * - 连接状态管理
 * - Agent 指标追踪
 * - 连接状态展示
 */

// Components (re-export from components/ui/)
export { ConnectionBadge } from "@/components/ui/ConnectionBadge";
export type { ConnectionBadgeProps } from "@/components/ui/ConnectionBadge";

// Hooks
export { useConnectionState } from "./hooks/useConnectionState";
export type { UseConnectionStateOptions, UseConnectionStateReturnValue } from "./hooks/useConnectionState";
