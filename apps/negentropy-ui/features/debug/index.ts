/**
 * Debug Feature Module
 *
 * 导出调试相关的组件、hooks 和类型
 *
 * 职责：
 * - 日志缓冲管理
 * - 日志面板展示
 * - 历史视图指示器
 */

// Components (re-export from ui/ for now)
export { LogBufferPanel } from "@/components/ui/LogBufferPanel";

// Hooks
export { useLogBuffer } from "./hooks/useLogBuffer";
export type { UseLogBufferOptions, UseLogBufferReturnValue } from "./hooks/useLogBuffer";
