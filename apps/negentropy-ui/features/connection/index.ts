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

// Components
export { ConnectionBadge } from "./components/ConnectionBadge";
export type { ConnectionBadgeProps } from "./components/ConnectionBadge";

// Hooks
export { useConnectionState } from "./hooks/useConnectionState";
export type { UseConnectionStateOptions, UseConnectionStateReturnValue } from "./hooks/useConnectionState";
