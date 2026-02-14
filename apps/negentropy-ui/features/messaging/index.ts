/**
 * Messaging Feature Module
 *
 * 导出消息相关的组件、hooks、工具函数和类型
 *
 * 职责：
 * - 消息发送和管理
 * - 消息过滤和合并
 * - 消息流展示
 */

// Utils (re-export from utils/)
export { mergeOptimisticMessages } from "@/utils/message-merge";

// Hooks
export { useMessageSender } from "./hooks/useMessageSender";
export type { UseMessageSenderOptions, UseMessageSenderReturnValue } from "./hooks/useMessageSender";
