/**
 * HITL (Human-in-the-Loop) Feature Module
 *
 * 导出 HITL 确认流程相关的组件、hooks 和类型
 *
 * 职责：
 * - HITL 确认流程管理
 * - 确认卡片展示
 * - 用户交互处理
 */

// Components
export { ConfirmationCard } from "./components/ConfirmationCard";
export type { ConfirmationCardProps, ConfirmationStatus, ConfirmationToolArgs } from "./components/ConfirmationCard";

// Hooks
export { useConfirmationTool } from "@/hooks/useConfirmationTool";
export type { ConfirmationToolArgs } from "@/hooks/useConfirmationTool";
