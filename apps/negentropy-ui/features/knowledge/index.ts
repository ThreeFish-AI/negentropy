/**
 * Knowledge Feature Module
 *
 * 导出知识库相关的 API 函数、Hooks、类型和异常类
 *
 * 职责：
 * - 知识库数据管理（Corpus、Graph、Memory、Pipelines）
 * - 知识检索和搜索
 * - 用户记忆治理
 * - 管线运行监控
 *
 * 遵循 AGENTS.md 原则：
 * - Single Source of Truth: 类型定义统一管理
 * - Boundary Management: 清晰的模块职责划分
 * - Reuse-Driven: 复用现有 API 客户端
 */

// ============================================================================
// Hooks
// ============================================================================

export { useKnowledgeBase } from "./hooks/useKnowledgeBase";
export type {
  UseKnowledgeBaseOptions,
  UseKnowledgeBaseReturnValue,
} from "./hooks/useKnowledgeBase";

export { useKnowledgeSearch } from "./hooks/useKnowledgeSearch";
export type {
  UseKnowledgeSearchOptions,
  UseKnowledgeSearchReturnValue,
} from "./hooks/useKnowledgeSearch";

// ============================================================================
// Utils (API Functions)
// ============================================================================

export {
  fetchDashboard,
  fetchCorpora,
  createCorpus,
  fetchCorpus,
  ingestText,
  replaceSource,
  searchKnowledge,
  fetchGraph,
  upsertGraph,
  fetchMemory,
  submitMemoryAudit,
  fetchPipelines,
  upsertPipelines,
} from "./utils/knowledge-api";

// ============================================================================
// Types
// ============================================================================

export type {
  SearchMode,
  ChunkingConfig,
  SearchConfig,
  KnowledgeErrorResponse,
  KnowledgeDashboard,
  CorpusRecord,
  KnowledgeMatch,
  KnowledgeGraphPayload,
  KnowledgeMemoryPayload,
  KnowledgePipelinesPayload,
  IngestResult,
  SearchResults,
  GraphUpsertResult,
  MemoryAuditResult,
  PipelineUpsertResult,
} from "./utils/knowledge-api";

// ============================================================================
// Error Classes
// ============================================================================

export {
  KnowledgeError,
  CorpusNotFoundError,
  VersionConflictError,
  ValidationError,
  InvalidChunkSizeError,
  InvalidSearchConfigError,
  InfrastructureError,
} from "./utils/knowledge-api";
