/**
 * Knowledge Feature Module
 *
 * 导出知识库相关的 API 函数、Hooks、类型和异常类
 *
 * 职责：
 * - 知识库数据管理（Corpus、Graph、Pipelines）
 * - 知识检索和搜索
 * - 管线运行监控
 *
 * 注意: Memory 已拆分为独立模块 (@/features/memory)
 *
 * 遵循 AGENTS.md 原则：
 * - Orthogonal Decomposition: Knowledge 与 Memory 正交拆分
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
  deleteCorpus,
  ingestText,
  ingestUrl,
  ingestFile,
  replaceSource,
  searchKnowledge,
  fetchGraph,
  upsertGraph,
  fetchPipelines,
  upsertPipelines,
  fetchKnowledgeItems,
  // Document Management
  fetchDocuments,
  fetchAllDocuments,
  deleteDocument,
  downloadDocument,
  // Graph Enhanced API (Phase 1)
  buildKnowledgeGraph,
  fetchCorpusGraph,
  searchKnowledgeGraph,
  findGraphNeighbors,
  findGraphPath,
  clearCorpusGraph,
  fetchGraphBuildHistory,
} from "./utils/knowledge-api";

// ============================================================================
// Types
// ============================================================================

export type {
  SearchMode,
  ChunkingStrategy,
  ChunkingConfig,
  SearchConfig,
  KnowledgeErrorResponse,
  KnowledgeDashboard,
  CorpusRecord,
  KnowledgeMatch,
  KnowledgeGraphPayload,
  KnowledgePipelinesPayload,
  PipelineRunRecord,
  PipelineStageResult,
  PipelineStageStatus,
  PipelineOperation,
  IngestResult,
  SearchResults,
  GraphUpsertResult,
  PipelineUpsertResult,
  KnowledgeItem,
  KnowledgeListResponse,
  // Document Management
  KnowledgeDocument,
  DocumentListResponse,
  // Graph Enhanced Types (Phase 1)
  GraphSearchMode,
  GraphBuildParams,
  GraphBuildResult,
  GraphSearchParams,
  GraphSearchResultItem,
  GraphSearchResults,
  GraphNeighborsParams,
  GraphNeighborsResult,
  GraphPathParams,
  GraphPathResult,
  GraphBuildRunRecord,
  GraphBuildHistoryResult,
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

// ============================================================================
// API Specs (for API Documentation)
// ============================================================================

export {
  KNOWLEDGE_API_ENDPOINTS,
  getEndpointById,
  getMethodColor,
} from "./utils/api-specs";

export type {
  HttpMethod,
  ApiParameter,
  ApiRequestBody,
  ApiResponse,
  CodeExamples,
  ApiEndpoint,
  FormFieldType,
  FormFieldConfig,
  InteractiveFormConfig,
} from "./utils/api-specs";

// ============================================================================
// Components
// ============================================================================

export { PipelineRunCard, PipelineRunList } from "./components/PipelineRunCard";
export type { PipelineRunCardProps } from "./components/PipelineRunCard";

// ============================================================================
// Utils (Pipeline Helpers)
// ============================================================================

export {
  // 常量
  OPERATION_LABELS,
  TRIGGER_LABELS,
  STAGE_ORDER,
  STAGE_LABELS,
  STAGE_COLORS,
  // 工具函数
  getPipelineStatusColor,
  getPipelineStatusTextColor,
  formatRelativeTime,
  truncateRunId,
  getStageColor,
  formatDuration,
  calculateStageWidth,
  getSortedStages,
} from "./utils/pipeline-helpers";
