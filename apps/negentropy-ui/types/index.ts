/**
 * 类型定义统一导出
 *
 * 集中导出所有类型定义，提供单一事实源
 */

// AG-UI 事件类型（迁移到 @negentropy/agents-chat-core/protocol 后保留聚合导出
// 以兼容下游 `import { ... } from "@/types"` 的既有用法）
export * from "@negentropy/agents-chat-core/protocol";

// 通用类型
export * from "./common";
