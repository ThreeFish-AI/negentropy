/**
 * Memory Feature Module
 *
 * 导出记忆相关的 API 函数、Hooks 和类型
 *
 * 职责：
 * - 用户记忆时间线 (Timeline)
 * - 语义记忆管理 (Facts)
 * - 记忆审计治理 (Audit)
 * - 记忆指标概览 (Dashboard)
 *
 * 遵循 AGENTS.md 原则：
 * - Orthogonal Decomposition: Memory 与 Knowledge 正交拆分
 * - Single Source of Truth: 类型定义统一管理
 * - Boundary Management: 清晰的模块职责划分
 * - Reuse-Driven: 复用现有 API 客户端模式
 */

// ============================================================================
// Hooks
// ============================================================================

export { useMemoryTimeline } from "./hooks/useMemoryTimeline";
export type {
  UseMemoryTimelineOptions,
  UseMemoryTimelineReturnValue,
} from "./hooks/useMemoryTimeline";

export { useMemoryFacts } from "./hooks/useMemoryFacts";
export type {
  UseMemoryFactsOptions,
  UseMemoryFactsReturnValue,
} from "./hooks/useMemoryFacts";

export { useMemoryAudit } from "./hooks/useMemoryAudit";
export type {
  UseMemoryAuditOptions,
  UseMemoryAuditReturnValue,
} from "./hooks/useMemoryAudit";

// ============================================================================
// Components
// ============================================================================

export {
  RetryableErrorBanner,
  isRetryable,
} from "./components/RetryableErrorBanner";
export { MemoryTimelineCard } from "./components/MemoryTimelineCard";
export { MemoryUserSelect } from "./components/MemoryUserSelect";
export { MemoryUserPillFilter } from "./components/MemoryUserPillFilter";
export { MemorySidebarLayout } from "./components/MemorySidebarLayout";
export { SidebarCard } from "./components/SidebarCard";
export { RetentionPolicyCard } from "./components/RetentionPolicyCard";
export { LegendCard } from "./components/LegendCard";
export type {
  RetryableError,
  RetryableErrorBannerProps,
} from "./components/RetryableErrorBanner";

// ============================================================================
// Utils (API Functions)
// ============================================================================

export {
  fetchMemoryDashboard,
  fetchMemories,
  searchMemories,
  fetchFacts,
  searchFacts,
  submitAudit,
  fetchAuditHistory,
  fetchConflicts,
  resolveConflict,
  fetchFactHistory,
  submitRetrievalFeedback,
  fetchRetrievalMetrics,
} from "./utils/memory-api";

// ============================================================================
// Types
// ============================================================================

export type {
  MemoryDashboard,
  MemoryItem,
  MemoryListPayload,
  MemorySearchResult,
  FactItem,
  FactListPayload,
  AuditRecord,
  AuditResponse,
  AuditHistoryPayload,
  ConflictItem,
  ConflictListPayload,
  FactHistoryItem,
  RetrievalMetrics,
} from "./utils/memory-api";
