/**
 * Knowledge 模块 API 客户端
 *
 * 通过 Next.js API Routes 代理到后端 Knowledge 服务
 * 对齐后端异常体系与配置验证规则
 */
// ============================================================================
// 域子模块（正交分解自原单文件 knowledge-api.ts，外部符号集不变）
// ============================================================================
// ---- errors
export {
  KnowledgeError,
  CorpusNotFoundError,
  VersionConflictError,
  ValidationError,
  InvalidChunkSizeError,
  InvalidSearchConfigError,
  InfrastructureError,
} from "./errors";
export type {
  KnowledgeErrorResponse,
} from "./errors";
// ---- chunking-config
export {
  encodeSeparatorsForDisplay,
  decodeSeparatorsFromInput,
  decodeLiteralEscapesIfNeeded,
  separatorsArrayEqual,
  createDefaultChunkingConfig,
  normalizeChunkingConfig,
} from "./chunking-config";
export type {
  ChunkingStrategy,
  FixedChunkingConfig,
  RecursiveChunkingConfig,
  SemanticChunkingConfig,
  HierarchicalChunkingConfig,
  ChunkingConfig,
} from "./chunking-config";
// ---- pipelines
export {
  fetchPipelinesData,
  cancelPipelineRun,
  retryPipelineRun,
  fetchPipelines,
  upsertPipelines,
} from "./pipelines";
export type {
  KnowledgePipelinesData,
  PipelineStageStatus,
  PipelineOperation,
  PipelineErrorPayload,
  McpStageEvent,
  PipelineStageResult,
  PipelineRunRecord,
  KnowledgePipelinesPayload,
  AsyncPipelineResult,
  PipelineUpsertResult,
  PipelineCancelResult,
} from "./pipelines";
// ---- corpus
export {
  fetchCorpora,
  createCorpus,
  fetchCorpus,
  fetchKnowledgeItems,
  ingestText,
  ingestUrl,
  ingestFile,
  ingestDocument,
  updateCorpus,
  deleteCorpus,
} from "./corpus";
export type {
  CorpusRecord,
  IngestResult,
  KnowledgeItem,
  SourceSummary,
  KnowledgeListResponse,
} from "./corpus";
// ---- model-configs
export {
  fetchModelConfigs,
  createEmptyExtractorDraftTarget,
  normalizeCorpusExtractorRoutes,
  normalizeExtractorDraftRoutes,
  buildExtractorRoutesFromDraft,
  buildCorpusConfig,
} from "./model-configs";
export type {
  ExtractorSourceKind,
  McpExtractorTargetConfig,
  CorpusExtractorRouteConfig,
  CorpusExtractorRouteKey,
  CorpusExtractorTargets,
  ExtractorDraftTarget,
  ExtractorDraftRoute,
  ExtractorDraftRoutes,
  ModelConfigItem,
  CorpusModelsConfig,
  CorpusExtractorRoutes,
  NormalizedCorpusExtractorRoutes,
} from "./model-configs";
// ---- documents
export {
  LIBRARY_CORPUS_SEGMENT,
  importDocumentUrl,
  importDocumentFile,
  effectiveDocumentName,
  effectiveDisplayName,
  isPdfDocument,
  fetchDocuments,
  fetchAllDocuments,
  documentPreviewUrl,
  deleteDocument,
  fetchDocumentDetail,
  updateDocument,
  refreshDocumentMarkdown,
  resetDocumentPatrol,
  translateDocuments,
  downloadDocument,
  fetchDocumentChunks,
  fetchDocumentChunkDetail,
  updateDocumentChunk,
  regenerateDocumentChunkFamily,
  syncDocument,
  rebuildDocument,
  replaceDocument,
  archiveDocument,
  unarchiveDocument,
  replaceSource,
  syncSource,
  rebuildSource,
  deleteSource,
  archiveSource,
} from "./documents";
export type {
  KnowledgeDocument,
  KnowledgeDocumentDetail,
  DocumentMarkdownRefreshResponse,
  DocumentTranslationMeta,
  DocumentTranslateSkipped,
  DocumentTranslateResponse,
  DocumentListResponse,
  DocumentChunkItem,
  DocumentChunksMetadata,
  DocumentChunksResponse,
  DocumentChunkDetailResponse,
  DeleteSourceResult,
  ArchiveSourceResult,
} from "./documents";
// ---- search
export {
  searchKnowledge,
  searchAcrossCorpora,
} from "./search";
export type {
  SearchMode,
  SearchConfig,
  KnowledgeMatch,
  SearchResultError,
  SearchResults,
} from "./search";
// ---- graph
export {
  fetchGraph,
  upsertGraph,
  buildKnowledgeGraph,
  fetchCorpusGraph,
  multiHopReasonKnowledgeGraph,
  globalSearchKnowledgeGraph,
  fetchGraphSubgraph,
  fetchGraphTimeline,
  searchKnowledgeGraph,
  findGraphNeighbors,
  findGraphPath,
  clearCorpusGraph,
  fetchGraphBuildHistory,
  fetchGraphEntities,
  fetchGraphEntityDetail,
  fetchGraphStats,
} from "./graph";
export type {
  KnowledgeGraphPayload,
  GraphUpsertResult,
  GraphSearchMode,
  GraphBuildParams,
  GraphBuildResult,
  GraphSearchParams,
  GraphSearchResultItem,
  GraphSearchResults,
  GraphNeighborsParams,
  GraphNeighborsResult,
  GraphPathParams,
  GraphTimelineBucket,
  GraphTimelineResult,
  GraphPathResult,
  GraphBuildRunRecord,
  GraphBuildHistoryResult,
  GraphEntityItem,
  GraphEntityListResponse,
  GraphEntityRelationItem,
  GraphEntityDetailResponse,
  GraphStatsResponse,
  GlobalSearchEvidenceItem,
  GlobalSearchResult,
  MultiHopEvidenceEdge,
  MultiHopEvidenceChain,
  MultiHopReasonResult,
} from "./graph";
// ---- catalog
export {
  fetchCatalogTree,
  fetchCatalogNodes,
  createCatalogNode,
  fetchCatalogNode,
  updateCatalogNode,
  deleteCatalogNode,
  fetchCatalogNodeDocuments,
  assignDocumentToNode,
  unassignDocumentFromNode,
  fetchCatalogs,
  createCatalog,
  fetchCatalogDocuments,
  fetchAllCatalogDocuments,
} from "./catalog";
export type {
  CatalogNodeType,
  DocCatalog,
  DocCatalogListResponse,
  DocCatalogDocumentsResponse,
  CatalogNode,
  CreateCatalogNodeParams,
  UpdateCatalogNodeParams,
  CatalogTreeResponse,
  CatalogNodesResponse,
  CatalogNodeDocumentsResponse,
} from "./catalog";
// ---- wiki
export {
  fetchWikiPublications,
  fetchWikiPublication,
  createWikiPublication,
  updateWikiPublication,
  deleteWikiPublication,
  publishWiki,
  unpublishWiki,
  fetchWikiEntries,
  fetchWikiNavTree,
  fetchWikiEntryContent,
  syncWikiEntriesFromCatalog,
} from "./wiki";
export type {
  WikiPublicationStatus,
  WikiTheme,
  WikiPublishMode,
  WikiPublication,
  WikiPublicationListResponse,
  CreateWikiPublicationParams,
  UpdateWikiPublicationParams,
  WikiEntry,
  WikiEntryContent,
  WikiNavTreeItem,
  WikiNavTreeResponse,
  WikiRevalidationStatus,
  WikiPublishTarget,
  WikiPublishActionResponse,
  SyncFromCatalogParams,
  SyncFromCatalogResponse,
} from "./wiki";
