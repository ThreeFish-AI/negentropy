/**
 * Knowledge 模块 API 客户端
 *
 * 通过 Next.js API Routes 代理到后端 Knowledge 服务
 * 对齐后端异常体系与配置验证规则
 */

// ============================================================================
// Types (对齐后端 types.py)
// ============================================================================

export type SearchMode = "semantic" | "keyword" | "hybrid";

export type ChunkingStrategy =
  | "fixed"
  | "recursive"
  | "semantic"
  | "hierarchical";

export interface FixedChunkingConfig {
  strategy: "fixed";
  chunk_size: number;
  overlap: number;
  preserve_newlines: boolean;
}

export interface RecursiveChunkingConfig {
  strategy: "recursive";
  chunk_size: number;
  overlap: number;
  preserve_newlines: boolean;
  separators: string[];
}

export interface SemanticChunkingConfig {
  strategy: "semantic";
  semantic_threshold: number;
  semantic_buffer_size: number;
  min_chunk_size: number;
  max_chunk_size: number;
}

export interface HierarchicalChunkingConfig {
  strategy: "hierarchical";
  preserve_newlines: boolean;
  separators: string[];
  hierarchical_parent_chunk_size: number;
  hierarchical_child_chunk_size: number;
  hierarchical_child_overlap: number;
}

export type ChunkingConfig =
  | FixedChunkingConfig
  | RecursiveChunkingConfig
  | SemanticChunkingConfig
  | HierarchicalChunkingConfig;

/**
 * 将 separators 数组编码为 textarea 可显示的文本。
 *
 * 每个 separator 中的特殊字符以转义序列表示（真实 \n → 字面量 \\n），
 * 然后以真实换行符 join 各项，实现「每行一个 separator」的体验。
 */
export function encodeSeparatorsForDisplay(separators: string[]): string {
  return separators
    .map((sep) => {
      if (sep === "") return "<empty>";
      return sep
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")
        .replace(/\r/g, "\\r");
    })
    .join("\n");
}

/**
 * 将 textarea 文本解码回 separators 数组。
 *
 * 按真实换行拆分行，每行做反转义处理。
 * 使用逐字符扫描避免正则替换的顺序依赖问题。
 */
export function decodeSeparatorsFromInput(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      if (line === "<empty>") return "";
      let result = "";
      let i = 0;
      while (i < line.length) {
        if (line[i] === "\\" && i + 1 < line.length) {
          const next = line[i + 1];
          switch (next) {
            case "n":
              result += "\n";
              i += 2;
              break;
            case "t":
              result += "\t";
              i += 2;
              break;
            case "r":
              result += "\r";
              i += 2;
              break;
            case "\\":
              result += "\\";
              i += 2;
              break;
            default:
              result += line[i];
              i += 1;
              break;
          }
        } else {
          result += line[i];
          i += 1;
        }
      }
      return result;
    });
}

/**
 * 防御式解码单个分隔符字符串。
 *
 * 用于兜底「DB 中残留字面量转义序列」的历史/导入数据：
 *   - 输入 `"\\n\\n"`（4 字符 `\n\n`）→ 输出 `"\n\n"`（2 字符真换行）
 *   - 输入 `"\n\n"`（已是真换行）→ 原样返回（idempotent）
 *
 * 复用 decodeSeparatorsFromInput 的逐字符扫描逻辑，仅当字符串包含字面量转义
 * 序列（`\n` / `\t` / `\r` / `\\`）但不含真实控制字符时触发解码，避免对正常数据的副作用。
 */
export function decodeLiteralEscapesIfNeeded(value: string): string {
  if (typeof value !== "string" || value.length === 0) return value;
  const hasLiteralEscape = /\\[ntr\\]/.test(value);
  const hasRealControl = /[\n\t\r]/.test(value);
  if (!hasLiteralEscape || hasRealControl) return value;
  // 复用 decodeSeparatorsFromInput 的核心扫描逻辑：单行解码后取首项
  const decoded = decodeSeparatorsFromInput(value);
  return decoded[0] ?? value;
}

function normalizeSeparatorsArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return (value as unknown[]).map((s) => decodeLiteralEscapesIfNeeded(String(s)));
}

/**
 * 逐元素比较两个 separators 数组的语义等价性。
 *
 * 用于受控文本域判别「外部 value 变化」是自身键入 round-trip 的回写还是真外部更新
 * （策略切换重置 defaults 等），避免以数组引用为判据导致的无谓重同步。
 */
export function separatorsArrayEqual(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function createDefaultChunkingConfig(
  strategy: ChunkingStrategy = "recursive",
): ChunkingConfig {
  switch (strategy) {
    case "fixed":
      return {
        strategy,
        chunk_size: 800,
        overlap: 100,
        preserve_newlines: true,
      };
    case "semantic":
      return {
        strategy,
        semantic_threshold: 0.85,
        semantic_buffer_size: 1,
        min_chunk_size: 50,
        max_chunk_size: 2000,
      };
    case "hierarchical":
      return {
        strategy,
        preserve_newlines: true,
        separators: ["\n"],
        hierarchical_parent_chunk_size: 1024,
        hierarchical_child_chunk_size: 256,
        hierarchical_child_overlap: 51,
      };
    case "recursive":
    default:
      return {
        strategy: "recursive",
        chunk_size: 800,
        overlap: 100,
        preserve_newlines: true,
        separators: ["\n"],
      };
  }
}

export function normalizeChunkingConfig(
  config?: Record<string, unknown> | null,
): ChunkingConfig {
  const strategy = (config?.strategy as ChunkingStrategy | undefined) || "recursive";

  switch (strategy) {
    case "fixed": {
      const defaults = createDefaultChunkingConfig("fixed") as FixedChunkingConfig;
      return {
        strategy,
        chunk_size: Number(config?.chunk_size ?? defaults.chunk_size),
        overlap: Number(config?.overlap ?? defaults.overlap),
        preserve_newlines:
          typeof config?.preserve_newlines === "boolean"
            ? config.preserve_newlines
            : defaults.preserve_newlines,
      };
    }
    case "semantic": {
      const defaults = createDefaultChunkingConfig("semantic") as SemanticChunkingConfig;
      return {
        strategy,
        semantic_threshold: Number(config?.semantic_threshold ?? defaults.semantic_threshold),
        semantic_buffer_size: Number(config?.semantic_buffer_size ?? defaults.semantic_buffer_size),
        min_chunk_size: Number(config?.min_chunk_size ?? defaults.min_chunk_size),
        max_chunk_size: Number(config?.max_chunk_size ?? defaults.max_chunk_size),
      };
    }
    case "hierarchical": {
      const defaults = createDefaultChunkingConfig("hierarchical") as HierarchicalChunkingConfig;
      return {
        strategy,
        preserve_newlines:
          typeof config?.preserve_newlines === "boolean"
            ? config.preserve_newlines
            : defaults.preserve_newlines,
        separators: normalizeSeparatorsArray(config?.separators, defaults.separators),
        hierarchical_parent_chunk_size: Number(
          config?.hierarchical_parent_chunk_size ?? defaults.hierarchical_parent_chunk_size,
        ),
        hierarchical_child_chunk_size: Number(
          config?.hierarchical_child_chunk_size ?? defaults.hierarchical_child_chunk_size,
        ),
        hierarchical_child_overlap: Number(
          config?.hierarchical_child_overlap ?? defaults.hierarchical_child_overlap,
        ),
      };
    }
    case "recursive":
    default: {
      const defaults = createDefaultChunkingConfig("recursive") as RecursiveChunkingConfig;
      return {
        strategy: "recursive",
        chunk_size: Number(config?.chunk_size ?? defaults.chunk_size),
        overlap: Number(config?.overlap ?? defaults.overlap),
        preserve_newlines:
          typeof config?.preserve_newlines === "boolean"
            ? config.preserve_newlines
            : defaults.preserve_newlines,
        separators: normalizeSeparatorsArray(config?.separators, defaults.separators),
      };
    }
  }
}

function buildChunkingConfigFromLegacyFields(
  params: LegacyChunkingFields,
): ChunkingConfig | undefined {
  const strategy = params.strategy;
  if (!strategy) return undefined;

  return normalizeChunkingConfig({
    strategy,
    chunk_size: params.chunk_size,
    overlap: params.overlap,
    preserve_newlines: params.preserve_newlines,
    separators: params.separators,
    semantic_threshold: params.semantic_threshold,
    semantic_buffer_size: params.semantic_buffer_size,
    min_chunk_size: params.min_chunk_size,
    max_chunk_size: params.max_chunk_size,
    hierarchical_parent_chunk_size: params.hierarchical_parent_chunk_size,
    hierarchical_child_chunk_size: params.hierarchical_child_chunk_size,
    hierarchical_child_overlap: params.hierarchical_child_overlap,
  });
}

function resolveChunkingConfig(
  params?: ChunkingRequestFields,
): ChunkingConfig | undefined {
  if (!params) return undefined;
  if (params.chunking_config) {
    return normalizeChunkingConfig(params.chunking_config as unknown as Record<string, unknown>);
  }
  return buildChunkingConfigFromLegacyFields(params as LegacyChunkingFields);
}

function validateChunkingConfig(config?: ChunkingConfig): void {
  if (!config) return;

  if (config.strategy === "fixed" || config.strategy === "recursive") {
    if (config.chunk_size < 1 || config.chunk_size > 100000) {
      throw new InvalidChunkSizeError({ chunk_size: config.chunk_size });
    }
    const maxOverlap = Math.floor(config.chunk_size * 0.5);
    if (config.overlap < 0 || config.overlap > maxOverlap) {
      throw new InvalidChunkSizeError({
        overlap: config.overlap,
        max_overlap: maxOverlap,
      });
    }
  }

  if (config.strategy === "semantic") {
    if (config.semantic_buffer_size < 1 || config.semantic_buffer_size > 5) {
      throw new ValidationError({
        field: "semantic_buffer_size",
        min: 1,
        max: 5,
        value: config.semantic_buffer_size,
      });
    }
    if (config.min_chunk_size < 1 || config.max_chunk_size < config.min_chunk_size) {
      throw new ValidationError({
        field: "semantic_chunk_size_range",
        min_chunk_size: config.min_chunk_size,
        max_chunk_size: config.max_chunk_size,
      });
    }
  }

  if (config.strategy === "hierarchical") {
    if (config.hierarchical_parent_chunk_size < config.hierarchical_child_chunk_size) {
      throw new ValidationError({
        field: "hierarchical_parent_chunk_size",
        parent: config.hierarchical_parent_chunk_size,
        child: config.hierarchical_child_chunk_size,
      });
    }
    if (
      config.hierarchical_child_overlap < 0 ||
      config.hierarchical_child_overlap >= config.hierarchical_child_chunk_size
    ) {
      throw new ValidationError({
        field: "hierarchical_child_overlap",
        overlap: config.hierarchical_child_overlap,
        max_overlap: config.hierarchical_child_chunk_size - 1,
      });
    }
  }
}

function buildJsonChunkingPayload(params?: ChunkingRequestFields): Record<string, unknown> {
  const config = resolveChunkingConfig(params);
  validateChunkingConfig(config);
  return config ? { chunking_config: config } : {};
}

function appendChunkingConfigToFormData(
  formData: FormData,
  params?: ChunkingRequestFields,
): void {
  const config = resolveChunkingConfig(params);
  validateChunkingConfig(config);

  if (!config) return;

  formData.set("strategy", config.strategy);

  if (config.strategy === "fixed") {
    formData.set("chunk_size", String(config.chunk_size));
    formData.set("overlap", String(config.overlap));
    formData.set("preserve_newlines", String(config.preserve_newlines));
    return;
  }

  if (config.strategy === "recursive") {
    formData.set("chunk_size", String(config.chunk_size));
    formData.set("overlap", String(config.overlap));
    formData.set("preserve_newlines", String(config.preserve_newlines));
    if (config.separators.length > 0) {
      formData.set("separators", JSON.stringify(config.separators));
    }
    return;
  }

  if (config.strategy === "semantic") {
    formData.set("semantic_threshold", String(config.semantic_threshold));
    formData.set("semantic_buffer_size", String(config.semantic_buffer_size));
    formData.set("min_chunk_size", String(config.min_chunk_size));
    formData.set("max_chunk_size", String(config.max_chunk_size));
    return;
  }

  formData.set("preserve_newlines", String(config.preserve_newlines));
  if (config.separators.length > 0) {
    formData.set("separators", JSON.stringify(config.separators));
  }
  formData.set(
    "hierarchical_parent_chunk_size",
    String(config.hierarchical_parent_chunk_size),
  );
  formData.set(
    "hierarchical_child_chunk_size",
    String(config.hierarchical_child_chunk_size),
  );
  formData.set(
    "hierarchical_child_overlap",
    String(config.hierarchical_child_overlap),
  );
}

export interface SearchConfig {
  mode?: SearchMode;
  limit?: number;
  semantic_weight?: number;
  keyword_weight?: number;
  metadata_filter?: Record<string, unknown>;
}

// 错误响应类型（对齐后端异常体系）
export interface KnowledgeErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Knowledge 异常类型
export class KnowledgeError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "KnowledgeError";
    this.code = code;
    this.details = details;
  }
}

// 领域异常
export class CorpusNotFoundError extends KnowledgeError {
  constructor(details?: Record<string, unknown>) {
    super("CORPUS_NOT_FOUND", "Corpus not found", details);
    this.name = "CorpusNotFoundError";
  }
}

export class VersionConflictError extends KnowledgeError {
  constructor(details?: Record<string, unknown>) {
    super("VERSION_CONFLICT", "Version conflict", details);
    this.name = "VersionConflictError";
  }
}

// 验证异常
export class ValidationError extends KnowledgeError {
  constructor(details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", "Validation error", details);
    this.name = "ValidationError";
  }
}

export class InvalidChunkSizeError extends ValidationError {
  constructor(details?: Record<string, unknown>) {
    super({ ...details, field: "chunk_size" });
    this.name = "InvalidChunkSizeError";
  }
}

export class InvalidSearchConfigError extends ValidationError {
  constructor(details?: Record<string, unknown>) {
    super({ ...details, field: "search_config" });
    this.name = "InvalidSearchConfigError";
  }
}

// 基础设施异常
export class InfrastructureError extends KnowledgeError {
  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(code, message, details);
    this.name = "InfrastructureError";
  }
}

export interface KnowledgeDashboard {
  corpus_count: number;
  knowledge_count: number;
  last_build_at?: string;
  pipeline_runs?: Array<{
    run_id: string;
    status: string;
    version: number;
    updated_at?: string;
    [key: string]: unknown;
  }>;
  alerts?: Array<unknown>;
}

export interface CorpusRecord {
  id: string;
  name: string;
  app_name: string;
  description?: string;
  knowledge_count: number;
  config?: Record<string, unknown>;
  rebuild_triggered?: { count: number; run_ids: string[] } | null;
}

export type ExtractorSourceKind = "url" | "file_pdf";

export interface McpExtractorTargetConfig {
  server_id: string;
  tool_name: string;
  priority: number;
  enabled: boolean;
  timeout_ms?: number;
  tool_options?: Record<string, unknown>;
}

export interface CorpusExtractorRouteConfig {
  targets: McpExtractorTargetConfig[];
}

export type CorpusExtractorRouteKey = "url" | "file_pdf";
export type CorpusExtractorTargets = McpExtractorTargetConfig[];
export type ExtractorDraftTarget = McpExtractorTargetConfig;
export type ExtractorDraftRoute = [ExtractorDraftTarget, ExtractorDraftTarget];
export type ExtractorDraftRoutes = Record<CorpusExtractorRouteKey, ExtractorDraftRoute>;

export interface ModelConfigItem {
  id: string;
  model_type: "llm" | "embedding" | "rerank";
  display_name: string;
  vendor: string;
  model_name: string;
  is_default: boolean;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface CorpusModelsConfig {
  llm_config_id?: string | null;
  embedding_config_id?: string | null;
}

export interface CorpusExtractorRoutes {
  url?: CorpusExtractorRouteConfig;
  file_pdf?: CorpusExtractorRouteConfig;
}

export type NormalizedCorpusExtractorRoutes = Record<
  CorpusExtractorRouteKey,
  CorpusExtractorRouteConfig
>;

export function createEmptyExtractorDraftTarget(
  priority: number,
): ExtractorDraftTarget {
  return {
    server_id: "",
    tool_name: "",
    priority,
    enabled: true,
  };
}

function createExtractorDraftRoute(
  targets: ReadonlyArray<McpExtractorTargetConfig>,
): ExtractorDraftRoute {
  return [0, 1].map((priority) => {
    const existing =
      targets.find((item) => item.priority === priority) || targets[priority];
    return existing
      ? {
          ...existing,
          priority,
          enabled: existing.enabled !== false,
        }
      : createEmptyExtractorDraftTarget(priority);
  }) as ExtractorDraftRoute;
}

function normalizeExtractorTargets(
  value: unknown,
): McpExtractorTargetConfig[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item) => ({
      server_id: String(item.server_id || ""),
      tool_name: String(item.tool_name || ""),
      priority: Number(item.priority || 0),
      enabled: item.enabled !== false,
      timeout_ms:
        item.timeout_ms === undefined ? undefined : Number(item.timeout_ms),
      tool_options:
        typeof item.tool_options === "object" && item.tool_options !== null
          ? (item.tool_options as Record<string, unknown>)
          : {},
    }))
    .filter((item) => item.server_id && item.tool_name)
    .sort((a, b) => a.priority - b.priority);
}

export function normalizeCorpusExtractorRoutes(
  config?: Record<string, unknown> | null,
): NormalizedCorpusExtractorRoutes {
  const raw =
    typeof config?.extractor_routes === "object" &&
    config.extractor_routes !== null
      ? (config.extractor_routes as Record<string, unknown>)
      : {};

  const normalizeRoute = (route: unknown): CorpusExtractorRouteConfig => ({
    targets: normalizeExtractorTargets(
      typeof route === "object" && route !== null
        ? (route as Record<string, unknown>).targets
        : undefined,
    ),
  });

  return {
    url: normalizeRoute(raw.url),
    file_pdf: normalizeRoute(raw.file_pdf),
  };
}

export function normalizeExtractorDraftRoutes(
  config?: Record<string, unknown> | null,
): ExtractorDraftRoutes {
  const normalized = normalizeCorpusExtractorRoutes(config);
  return {
    url: createExtractorDraftRoute(normalized.url.targets),
    file_pdf: createExtractorDraftRoute(normalized.file_pdf.targets),
  };
}

export function buildExtractorRoutesFromDraft(
  draft: ExtractorDraftRoutes,
): NormalizedCorpusExtractorRoutes {
  const buildTargets = (targets: ExtractorDraftRoute) =>
    targets
      .filter((item) => item.server_id && item.tool_name)
      .map((item, priority) => ({
        ...item,
        priority,
        enabled: item.enabled !== false,
      }));

  return {
    url: { targets: buildTargets(draft.url) },
    file_pdf: { targets: buildTargets(draft.file_pdf) },
  };
}

export function buildCorpusConfig(
  chunkingConfig: ChunkingConfig,
  extractorRoutes?: CorpusExtractorRoutes | NormalizedCorpusExtractorRoutes,
  models?: CorpusModelsConfig | null,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ...(chunkingConfig as unknown as Record<string, unknown>),
    extractor_routes: {
      url: { targets: extractorRoutes?.url?.targets || [] },
      file_pdf: { targets: extractorRoutes?.file_pdf?.targets || [] },
    },
  };
  if (models) {
    const clean: Record<string, string> = {};
    if (models.llm_config_id) clean.llm_config_id = models.llm_config_id;
    if (models.embedding_config_id) clean.embedding_config_id = models.embedding_config_id;
    if (Object.keys(clean).length > 0) result.models = clean;
  }
  return result;
}

export interface KnowledgeMatch {
  id: string;
  content: string;
  source_uri?: string;
  metadata?: Record<string, unknown>;
  semantic_score?: number;
  keyword_score?: number;
  combined_score: number;
}

export interface KnowledgeGraphPayload {
  nodes: Array<{
    id: string;
    label?: string;
    type?: string;
    [key: string]: unknown;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label?: string;
    [key: string]: unknown;
  }>;
  runs?: Array<{
    run_id?: string;
    status?: string;
    version?: number;
    updated_at?: string;
  }>;
}

// Pipeline 阶段状态
export type PipelineStageStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

// Pipeline 操作类型
export type PipelineOperation =
  | "ingest_text"
  | "ingest_url"
  | "ingest_file"
  | "replace_source"
  | "sync_source"
  | "rebuild_source";

/**
 * Pipeline 错误对象。
 *
 * 约定：
 * - `failure_category` 用于稳定的失败分类。
 * - `diagnostic_summary` 仅承载可直接展示的一句话摘要，默认面向契约类失败。
 * - `diagnostics` 保留完整的结构化诊断信息，供明细排障使用。
 */
export interface PipelineErrorPayload extends Record<string, unknown> {
  failure_category?: string;
  diagnostic_summary?: string;
  diagnostics?: Record<string, unknown>;
}

// MCP 工具调用子事件
export interface McpStageEvent {
  stage: string;
  status: string;
  title: string;
  timestamp: string;
  payload?: Record<string, unknown>;
  detail?: string;
}

// Pipeline 阶段结果
export interface PipelineStageResult {
  status: PipelineStageStatus;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  error?: PipelineErrorPayload;
  output?: Record<string, unknown>;
  reason?: string; // for skipped status
  mcp_events?: McpStageEvent[];
}

// Pipeline Run 记录
export interface PipelineRunRecord {
  id: string;
  run_id: string;
  status: string;
  operation?: PipelineOperation;
  trigger?: "api" | "ui" | "schedule";
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  duration?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  stages?: Record<string, PipelineStageResult>;
  error?: PipelineErrorPayload;
  version?: number;
}

export interface KnowledgePipelinesPayload {
  count?: number;
  last_updated_at?: string;
  runs?: PipelineRunRecord[];
}

export interface IngestResult {
  count: number;
  items: string[];
}

type LegacyChunkingFields = {
  strategy?: ChunkingStrategy;
  chunk_size?: number;
  overlap?: number;
  preserve_newlines?: boolean;
  separators?: string[];
  semantic_threshold?: number;
  semantic_buffer_size?: number;
  min_chunk_size?: number;
  max_chunk_size?: number;
  hierarchical_parent_chunk_size?: number;
  hierarchical_child_chunk_size?: number;
  hierarchical_child_overlap?: number;
};

type ChunkingRequestFields =
  | {
      chunking_config?: ChunkingConfig;
    }
  | (LegacyChunkingFields & {
      chunking_config?: ChunkingConfig;
    });

// 异步 Pipeline 响应类型
export interface AsyncPipelineResult {
  run_id: string;
  status: "running";
  message: string;
}

export interface SearchResultError {
  corpusId: string;
  /**
   * 后端返回的结构化错误码（如 `EMBEDDING_FAILED`）；
   * 仅当 rejection 为 `KnowledgeError` 时存在，便于调用方按 code 走差异化分支。
   */
  code?: string;
  message: string;
}

export interface SearchResults {
  count: number;
  items: KnowledgeMatch[];
  errors?: SearchResultError[];
}

export interface GraphUpsertResult {
  status: string;
  graph?: unknown;
}

export interface PipelineUpsertResult {
  status: string;
  pipeline?: unknown;
}

// ============================================================================
// 错误处理工具函数
// ============================================================================

/**
 * 从响应中解析错误并映射到对应的异常类型
 */
function extractKnowledgeErrorPayload(
  errorData: unknown,
): KnowledgeErrorResponse | null {
  if (!errorData || typeof errorData !== "object") {
    return null;
  }

  const normalizePayload = (
    payload: Record<string, unknown>,
  ): KnowledgeErrorResponse | null => {
    const code = typeof payload.code === "string" ? payload.code : undefined;
    const message =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.detail === "string"
          ? payload.detail
          : undefined;
    const details =
      payload.details && typeof payload.details === "object"
        ? (payload.details as Record<string, unknown>)
        : undefined;

    if (!code && !message) {
      return null;
    }

    return {
      code: code || "UNKNOWN_ERROR",
      message: message || "Unknown error",
      details,
    };
  };

  const root = errorData as Record<string, unknown>;

  const direct = normalizePayload(root);
  if (direct) return direct;

  if (root.error && typeof root.error === "object") {
    const nested = normalizePayload(root.error as Record<string, unknown>);
    if (nested) return nested;
  }

  if (root.detail && typeof root.detail === "object") {
    const nested = normalizePayload(root.detail as Record<string, unknown>);
    if (nested) return nested;
  }

  if (typeof root.detail === "string") {
    return {
      code: "UNKNOWN_ERROR",
      message: root.detail,
    };
  }

  return null;
}

async function parseKnowledgeError(res: Response): Promise<KnowledgeError> {
  let errorData: unknown;
  try {
    errorData = await res.json();
  } catch {
    errorData = null;
  }

  const errorResponse = extractKnowledgeErrorPayload(errorData);
  const code = errorResponse?.code || "UNKNOWN_ERROR";
  const message =
    errorResponse?.message ||
    res.statusText ||
    `Request failed with status ${res.status}`;
  const details = errorResponse?.details;

  switch (code) {
    case "CORPUS_NOT_FOUND":
      return new CorpusNotFoundError(details);
    case "VERSION_CONFLICT":
      return new VersionConflictError(details);
    case "INVALID_CHUNK_SIZE":
      return new InvalidChunkSizeError(details);
    case "INVALID_SEARCH_CONFIG":
      return new InvalidSearchConfigError(details);
    default:
      return new KnowledgeError(code, message, details);
  }
}

/**
 * 统一的错误处理包装器
 */
async function handleKnowledgeError<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await parseKnowledgeError(res);
    throw error;
  }
  return res.json() as Promise<T>;
}

// ============================================================================
// Dashboard
// ============================================================================

export async function fetchDashboard(
  appName?: string,
): Promise<KnowledgeDashboard> {
  const params = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(`/api/knowledge/dashboard${params}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Corpus (Knowledge Base)
// ============================================================================

export async function fetchModelConfigs(params?: {
  modelType?: string;
  enabled?: boolean;
}): Promise<ModelConfigItem[]> {
  const qs = new URLSearchParams();
  if (params?.modelType) qs.set("model_type", params.modelType);
  if (params?.enabled !== undefined) qs.set("enabled", String(params.enabled));
  const query = qs.toString();
  const res = await fetch(`/api/interface/models/configs${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch model configs: ${res.statusText}`);
  const data = await res.json();
  return data.items || [];
}

export async function fetchCorpora(appName?: string): Promise<CorpusRecord[]> {
  const params = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(`/api/knowledge/base${params}`, {
    cache: "no-store",
  });
  return handleKnowledgeError(res);
}

export async function createCorpus(params: {
  app_name?: string;
  name: string;
  description?: string;
  config?: Record<string, unknown>;
}): Promise<CorpusRecord> {
  const res = await fetch("/api/knowledge/base", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to create corpus: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchCorpus(
  id: string,
  appName?: string,
): Promise<CorpusRecord | null> {
  const params = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(`/api/knowledge/base/${id}${params}`, {
    cache: "no-store",
  });
  if (res.status === 404) {
    return null;
  }
  return handleKnowledgeError(res);
}

export interface KnowledgeItem {
  id: string;
  content: string;
  source_uri: string | null;
  created_at: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
}

export interface SourceSummary {
  source_uri: string | null;
  display_name?: string | null;
  count: number;
  archived: boolean;
  source_type: "file" | "url" | "text" | "unknown";
}

export interface KnowledgeListResponse {
  count: number;
  items: KnowledgeItem[];
  source_stats?: Record<string, number>;
  source_summaries?: SourceSummary[];
}

export async function fetchKnowledgeItems(
  corpusId: string,
  params: {
    appName?: string;
    sourceUri?: string | null;
    includeArchived?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<KnowledgeListResponse> {
  const query = new URLSearchParams();
  if (params.appName) query.set("app_name", params.appName);
  if (params.sourceUri !== undefined) {
    query.set("source_uri", params.sourceUri ?? "__null__");
  }
  if (params.includeArchived !== undefined) {
    query.set("include_archived", String(params.includeArchived));
  }
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/knowledge?${query.toString()}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch knowledge items: ${res.statusText}`);
  }
  return res.json();
}

export async function ingestText(
  id: string,
  params: {
    app_name?: string;
    text: string;
    source_uri?: string;
    metadata?: Record<string, unknown>;
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const { app_name, text, source_uri, metadata, ...chunkingParams } = params;
  const res = await fetch(`/api/knowledge/base/${id}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_name,
      text,
      source_uri,
      metadata,
      ...buildJsonChunkingPayload(chunkingParams),
    }),
  });
  return handleKnowledgeError(res);
}

export async function ingestUrl(
  id: string,
  params: {
    app_name?: string;
    url: string;
    as_document?: boolean;
    metadata?: Record<string, unknown>;
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const { app_name, url, as_document, metadata, ...chunkingParams } = params;
  const res = await fetch(`/api/knowledge/base/${id}/ingest_url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_name,
      url,
      as_document,
      metadata,
      ...buildJsonChunkingPayload(chunkingParams),
    }),
  });
  return handleKnowledgeError(res);
}

export async function ingestFile(
  id: string,
  params: {
    app_name?: string;
    file: File;
    source_uri?: string;
    metadata?: Record<string, unknown>;
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const formData = new FormData();

  if (params.app_name) formData.set("app_name", params.app_name);
  formData.set("file", params.file);
  if (params.source_uri) formData.set("source_uri", params.source_uri);
  if (params.metadata) formData.set("metadata", JSON.stringify(params.metadata));
  appendChunkingConfigToFormData(formData, params);

  const res = await fetch(`/api/knowledge/base/${id}/ingest_file`, {
    method: "POST",
    body: formData, // 不设置 Content-Type，让浏览器自动处理 multipart/form-data
  });
  return handleKnowledgeError(res);
}

// ============================================================================
// Document Management Types
// ============================================================================

export interface KnowledgeDocument {
  id: string;
  corpus_id: string;
  app_name: string;
  file_hash: string;
  original_filename: string;
  gcs_uri: string;
  content_type: string | null;
  file_size: number;
  status: string;
  created_at: string | null;
  created_by: string | null;
  created_by_name?: string | null;
  markdown_extract_status?: "pending" | "processing" | "completed" | "failed" | string;
  markdown_extracted_at?: string | null;
  markdown_extract_error?: string | null;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  markdown_content: string | null;
  markdown_gcs_uri: string | null;
}

export interface DocumentMarkdownRefreshResponse {
  document_id: string;
  status: string;
  message: string;
}

export interface DocumentListResponse {
  count: number;
  items: KnowledgeDocument[];
}

export interface DocumentChunkItem {
  id: string;
  content: string;
  source_uri: string | null;
  created_at: string | null;
  updated_at?: string | null;
  chunk_index: number;
  character_count: number;
  retrieval_count: number;
  display_retrieval_count: number;
  is_enabled: boolean;
  chunk_role: "parent" | "child" | "leaf" | string;
  parent_chunk_index?: number | null;
  child_chunk_index?: number | null;
  chunk_family_id?: string | null;
  child_chunks: DocumentChunkItem[];
  metadata: Record<string, unknown>;
}

export interface DocumentChunksMetadata {
  original_filename?: string | null;
  file_size?: number | null;
  upload_date?: string | null;
  last_update_date?: string | null;
  source?: string | null;
  chunk_specification?: string | null;
  chunk_length?: number | null;
  avg_paragraph_length?: number | null;
  paragraph_count?: number | null;
  retrieval_count?: number | null;
  embedding_time_ms?: number | null;
  embedded_tokens?: number | null;
}

export interface DocumentChunksResponse {
  count: number;
  page: number;
  page_size: number;
  document_metadata: DocumentChunksMetadata;
  items: DocumentChunkItem[];
}

export interface DocumentChunkDetailResponse {
  item: DocumentChunkItem;
  document_metadata: DocumentChunksMetadata;
}

// ============================================================================
// Document Management API Functions
// ============================================================================

const DOCUMENTS_PAGE_LIMIT_MAX = 100;
const DOCUMENTS_PAGE_LIMIT_DEFAULT = 50;
const DOCUMENT_CHUNKS_PAGE_LIMIT_MAX = 200;
const DOCUMENT_CHUNKS_PAGE_LIMIT_DEFAULT = 50;

function clampPositiveInt(
  value: number | undefined,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.min(Math.trunc(value), max);
}

export async function fetchDocuments(
  corpusId: string,
  params?: {
    appName?: string;
    limit?: number;
    offset?: number;
  },
): Promise<DocumentListResponse> {
  const query = new URLSearchParams();
  const limit = clampPositiveInt(
    params?.limit,
    DOCUMENTS_PAGE_LIMIT_MAX,
    DOCUMENTS_PAGE_LIMIT_DEFAULT,
  );
  if (params?.appName) query.set("app_name", params.appName);
  query.set("limit", String(limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

export async function fetchAllDocuments(
  params?: {
    appName?: string;
    limit?: number;
    offset?: number;
  },
): Promise<DocumentListResponse> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const res = await fetch(
    `/api/knowledge/documents?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

export async function deleteDocument(
  corpusId: string,
  documentId: string,
  params?: {
    appName?: string;
    hardDelete?: boolean;
  },
): Promise<void> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);
  if (params?.hardDelete) query.set("hard_delete", "true");

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}?${query.toString()}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    throw new Error(`Failed to delete document: ${res.statusText}`);
  }
}

export async function fetchDocumentDetail(
  corpusId: string,
  documentId: string,
  params?: {
    appName?: string;
  },
): Promise<KnowledgeDocumentDetail> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

export async function refreshDocumentMarkdown(
  corpusId: string,
  documentId: string,
  params?: {
    appName?: string;
  },
): Promise<DocumentMarkdownRefreshResponse> {
  const payload = JSON.stringify({
    app_name: params?.appName,
  });
  const requestInit: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  };

  let res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/refresh_markdown`,
    requestInit,
  );
  if (res.status === 404) {
    // Backward-compatible fallback for deployments using kebab-case route naming.
    res = await fetch(
      `/api/knowledge/base/${corpusId}/documents/${documentId}/refresh-markdown`,
      requestInit,
    );
  }

  return handleKnowledgeError(res);
}

export async function downloadDocument(
  corpusId: string,
  documentId: string,
  params?: {
    appName?: string;
  },
): Promise<void> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/download?${query.toString()}`,
  );

  if (!res.ok) {
    let errorMessage = `Failed to download document: ${res.statusText}`;
    try {
      const errorData = await res.json();
      if (errorData?.detail?.message) {
        errorMessage = errorData.detail.message;
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  // 获取文件名
  const contentDisposition = res.headers.get("Content-Disposition");
  let filename = "document";
  if (contentDisposition) {
    // Try UTF-8 encoded filename first
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/);
    if (utf8Match) {
      filename = decodeURIComponent(utf8Match[1]);
    } else {
      // Fallback to standard filename
      const standardMatch = contentDisposition.match(/filename="?(.+?)"?(?:;|$)/);
      if (standardMatch) {
        filename = standardMatch[1];
      }
    }
  }

  // 下载并触发浏览器保存
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

export async function fetchDocumentChunks(
  corpusId: string,
  documentId: string,
  params?: {
    appName?: string;
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
  },
): Promise<DocumentChunksResponse> {
  const query = new URLSearchParams();
  const limit = clampPositiveInt(
    params?.limit,
    DOCUMENT_CHUNKS_PAGE_LIMIT_MAX,
    DOCUMENT_CHUNKS_PAGE_LIMIT_DEFAULT,
  );
  if (params?.appName) query.set("app_name", params.appName);
  query.set("limit", String(limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  if (params?.includeArchived !== undefined) {
    query.set("include_archived", String(params.includeArchived));
  }

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/chunks?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

export async function fetchDocumentChunkDetail(
  corpusId: string,
  documentId: string,
  chunkId: string,
  params?: { appName?: string },
): Promise<DocumentChunkDetailResponse> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/chunks/${chunkId}?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

export async function updateDocumentChunk(
  corpusId: string,
  documentId: string,
  chunkId: string,
  params: { appName?: string; content?: string; is_enabled?: boolean },
): Promise<DocumentChunkDetailResponse> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/chunks/${chunkId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: params.appName,
        content: params.content,
        is_enabled: params.is_enabled,
      }),
    },
  );
  return handleKnowledgeError(res);
}

export async function regenerateDocumentChunkFamily(
  corpusId: string,
  documentId: string,
  chunkId: string,
  params: { appName?: string; content?: string; is_enabled?: boolean },
): Promise<DocumentChunkDetailResponse> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/chunks/${chunkId}/regenerate-family`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: params.appName,
        content: params.content,
        is_enabled: params.is_enabled,
      }),
    },
  );
  return handleKnowledgeError(res);
}

async function postDocumentAction(
  corpusId: string,
  documentId: string,
  action: "sync" | "rebuild" | "replace" | "archive" | "unarchive",
  params: Record<string, unknown>,
): Promise<AsyncPipelineResult | ArchiveSourceResult> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/documents/${documentId}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
  );
  return handleKnowledgeError(res);
}

export async function syncDocument(
  corpusId: string,
  documentId: string,
  params: {
    app_name?: string;
  } & ChunkingRequestFields = {},
): Promise<AsyncPipelineResult> {
  const { app_name, ...chunkingParams } = params;
  return postDocumentAction(corpusId, documentId, "sync", {
    app_name,
    ...buildJsonChunkingPayload(chunkingParams),
  }) as Promise<AsyncPipelineResult>;
}

export async function rebuildDocument(
  corpusId: string,
  documentId: string,
  params: {
    app_name?: string;
  } & ChunkingRequestFields = {},
): Promise<AsyncPipelineResult> {
  const { app_name, ...chunkingParams } = params;
  return postDocumentAction(corpusId, documentId, "rebuild", {
    app_name,
    ...buildJsonChunkingPayload(chunkingParams),
  }) as Promise<AsyncPipelineResult>;
}

export async function replaceDocument(
  corpusId: string,
  documentId: string,
  params: {
    app_name?: string;
    text: string;
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const { app_name, text, ...chunkingParams } = params;
  return postDocumentAction(corpusId, documentId, "replace", {
    app_name,
    text,
    ...buildJsonChunkingPayload(chunkingParams),
  }) as Promise<AsyncPipelineResult>;
}

export async function archiveDocument(
  corpusId: string,
  documentId: string,
  params: {
    app_name?: string;
  } = {},
): Promise<ArchiveSourceResult> {
  return postDocumentAction(corpusId, documentId, "archive", params) as Promise<ArchiveSourceResult>;
}

export async function unarchiveDocument(
  corpusId: string,
  documentId: string,
  params: {
    app_name?: string;
  } = {},
): Promise<ArchiveSourceResult> {
  return postDocumentAction(corpusId, documentId, "unarchive", params) as Promise<ArchiveSourceResult>;
}

export async function replaceSource(
  id: string,
  params: {
    app_name?: string;
    text: string;
    source_uri: string;
    metadata?: Record<string, unknown>;
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const { app_name, text, source_uri, metadata, ...chunkingParams } = params;
  const res = await fetch(`/api/knowledge/base/${id}/replace_source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_name,
      text,
      source_uri,
      metadata,
      ...buildJsonChunkingPayload(chunkingParams),
    }),
  });
  return handleKnowledgeError(res);
}

export async function syncSource(
  id: string,
  params: {
    app_name?: string;
    source_uri: string;
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const { app_name, source_uri, ...chunkingParams } = params;
  const res = await fetch(`/api/knowledge/base/${id}/sync_source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_name,
      source_uri,
      ...buildJsonChunkingPayload(chunkingParams),
    }),
  });
  return handleKnowledgeError(res);
}

export async function rebuildSource(
  id: string,
  params: {
    app_name?: string;
    source_uri: string;
  } & ChunkingRequestFields,
): Promise<AsyncPipelineResult> {
  const { app_name, source_uri, ...chunkingParams } = params;
  const res = await fetch(`/api/knowledge/base/${id}/rebuild_source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_name,
      source_uri,
      ...buildJsonChunkingPayload(chunkingParams),
    }),
  });
  return handleKnowledgeError(res);
}

// ============================================================================
// Source Management API
// ============================================================================

export interface DeleteSourceResult {
  deleted_count: number;
  deleted_documents?: number;
  deleted_gcs_objects?: number;
  warnings?: string[];
}

export interface ArchiveSourceResult {
  updated_count: number;
  archived: boolean;
}

/**
 * 删除指定 source_uri 的所有知识块
 */
export async function deleteSource(
  id: string,
  params: {
    app_name?: string;
    source_uri: string;
  },
): Promise<DeleteSourceResult> {
  const res = await fetch(`/api/knowledge/base/${id}/delete_source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

/**
 * 归档或解档指定 source_uri
 */
export async function archiveSource(
  id: string,
  params: {
    app_name?: string;
    source_uri: string;
    archived?: boolean;
  },
): Promise<ArchiveSourceResult> {
  const res = await fetch(`/api/knowledge/base/${id}/archive_source`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

export async function updateCorpus(
  id: string,
  params: {
    name?: string;
    description?: string;
    config?: Record<string, unknown>;
  },
): Promise<CorpusRecord> {
  const res = await fetch(`/api/knowledge/base/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to update corpus: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteCorpus(id: string): Promise<void> {
  const res = await fetch(`/api/knowledge/base/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete corpus: ${res.statusText}`);
  }
}

export async function searchKnowledge(
  id: string,
  params: {
    app_name?: string;
    query: string;
    mode?: SearchMode;
    limit?: number;
    semantic_weight?: number;
    keyword_weight?: number;
    metadata_filter?: Record<string, unknown>;
  },
): Promise<SearchResults> {
  // 前端配置验证（对齐后端 types.py）
  const { limit, semantic_weight, keyword_weight, mode } = params;

  if (limit !== undefined && (limit < 1 || limit > 1000)) {
    throw new InvalidSearchConfigError({ limit, min: 1, max: 1000 });
  }

  if (
    semantic_weight !== undefined &&
    (semantic_weight < 0 || semantic_weight > 1)
  ) {
    throw new InvalidSearchConfigError({ semantic_weight, min: 0, max: 1 });
  }

  if (
    keyword_weight !== undefined &&
    (keyword_weight < 0 || keyword_weight > 1)
  ) {
    throw new InvalidSearchConfigError({ keyword_weight, min: 0, max: 1 });
  }

  if (mode !== undefined && !["semantic", "keyword", "hybrid"].includes(mode)) {
    throw new InvalidSearchConfigError({
      mode,
      allowed: ["semantic", "keyword", "hybrid"],
    });
  }

  const res = await fetch(`/api/knowledge/base/${id}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

export async function searchAcrossCorpora(
  corpusIds: string[],
  params: {
    app_name?: string;
    query: string;
    mode?: SearchMode;
    limit?: number;
    semantic_weight?: number;
    keyword_weight?: number;
    metadata_filter?: Record<string, unknown>;
  },
): Promise<SearchResults> {
  const settled = await Promise.allSettled(
    corpusIds.map((corpusId) =>
      searchKnowledge(corpusId, params).then((results) =>
        results.items.map((item) => ({
          ...item,
          metadata: {
            ...(item.metadata || {}),
            corpus_id: corpusId,
          },
        })),
      ),
    ),
  );

  const mergedItems: KnowledgeMatch[] = [];
  const errors: SearchResultError[] = [];
  settled.forEach((item, idx) => {
    if (item.status === "fulfilled") {
      mergedItems.push(...item.value);
    } else {
      const corpusId = corpusIds[idx];
      const reason = item.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unknown error";
      const code =
        reason instanceof KnowledgeError ? reason.code : undefined;
      errors.push(code ? { corpusId, code, message } : { corpusId, message });
    }
  });

  // 全部失败 → 抛聚合 KnowledgeError（保留 code 与逐条 errors，
  // 让调用方既能按上游 vs 自身错误分流，又能拿到完整失败明细）。
  if (errors.length === corpusIds.length && corpusIds.length > 0) {
    const merged = errors
      .map((e) => `[${e.corpusId.slice(0, 8)}] ${e.message}`)
      .join("; ");
    const codes = errors
      .map((e) => e.code)
      .filter((c): c is string => Boolean(c));
    const allSameCode =
      codes.length === errors.length && codes.every((c) => c === codes[0]);
    const aggregatedCode =
      allSameCode && codes.length > 0 ? codes[0] : "AGGREGATED_SEARCH_ERRORS";
    throw new KnowledgeError(aggregatedCode, merged.slice(0, 200), {
      errors,
    });
  }

  mergedItems.sort((a, b) => (b.combined_score ?? 0) - (a.combined_score ?? 0));

  return {
    count: mergedItems.length,
    items: params.limit ? mergedItems.slice(0, params.limit) : mergedItems,
    ...(errors.length > 0 ? { errors } : {}),
  };
}

// ============================================================================
// Knowledge Graph
// ============================================================================

export async function fetchGraph(
  appName?: string,
): Promise<KnowledgeGraphPayload> {
  const params = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(`/api/knowledge/graph${params}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch graph: ${res.statusText}`);
  }
  return res.json();
}

export async function upsertGraph(params: {
  app_name?: string;
  run_id: string;
  status?: string;
  graph: KnowledgeGraphPayload;
  expected_version?: number;
  idempotency_key?: string;
}): Promise<GraphUpsertResult> {
  const res = await fetch("/api/knowledge/graph", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to upsert graph: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Knowledge Graph Enhanced API (Phase 1)
// ============================================================================

export type GraphSearchMode = "semantic" | "graph" | "hybrid";

export interface GraphBuildParams {
  app_name?: string;
  enable_llm_extraction?: boolean;
  llm_model?: string;
  min_entity_confidence?: number;
  min_relation_confidence?: number;
  batch_size?: number;
  incremental?: boolean;
}

export interface GraphBuildResult {
  run_id: string;
  corpus_id: string;
  status: string;
  entity_count: number;
  relation_count: number;
  chunks_processed: number;
  elapsed_seconds: number;
  error_message?: string;
  warnings?: { algorithm: string; error: string }[];
  failed_chunk_count?: number;
}

export interface GraphSearchParams {
  app_name?: string;
  query: string;
  mode?: GraphSearchMode;
  limit?: number;
  max_depth?: number;
  semantic_weight?: number;
  graph_weight?: number;
  include_neighbors?: boolean;
  neighbor_limit?: number;
  /** ISO-8601 时态快照时刻；提供时仅纳入在该时刻仍有效的关系（G3 时间穿梭）。 */
  as_of?: string;
}

export interface GraphSearchResultItem {
  entity: {
    id: string;
    label?: string;
    type?: string;
    metadata?: Record<string, unknown>;
  };
  semantic_score: number;
  graph_score: number;
  combined_score: number;
  neighbors: Array<{
    id: string;
    label?: string;
    type?: string;
  }>;
}

export interface GraphSearchResults {
  count: number;
  query_time_ms: number;
  items: GraphSearchResultItem[];
}

export interface GraphNeighborsParams {
  app_name?: string;
  entity_id: string;
  max_depth?: number;
  limit?: number;
  /** ISO-8601 时态快照时刻（G3）。 */
  as_of?: string;
}

export interface GraphNeighborsResult {
  entity_id: string;
  count: number;
  neighbors: Array<{
    id: string;
    label?: string;
    type?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface GraphPathParams {
  app_name?: string;
  source_id: string;
  target_id: string;
  max_depth?: number;
  /** ISO-8601 时态快照时刻（G3）。 */
  as_of?: string;
}

export interface GraphTimelineBucket {
  date: string;
  active_count: number;
  expired_count: number;
}

export interface GraphTimelineResult {
  corpus_id: string;
  bucket: "day" | "week" | "month";
  points: GraphTimelineBucket[];
}

export interface GraphPathResult {
  source_id: string;
  target_id: string;
  found: boolean;
  path?: string[];
  length: number;
}

export interface GraphBuildRunRecord {
  id: string;
  run_id: string;
  status: string;
  entity_count: number;
  relation_count: number;
  extractor_config?: Record<string, unknown>;
  model_name?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
  progress_percent?: number;
  warnings?: { algorithm: string; error: string }[];
}

export interface GraphBuildHistoryResult {
  corpus_id: string;
  count: number;
  runs: GraphBuildRunRecord[];
}

// ============================================================================
// Graph Entity Types
// ============================================================================

export interface GraphEntityItem {
  id: string;
  name: string;
  entity_type: string;
  confidence: number;
  mention_count: number;
  importance_score?: number | null;
  community_id?: number | null;
  description?: string;
  is_active: boolean;
}

export interface GraphEntityListResponse {
  count: number;
  items: GraphEntityItem[];
}

export interface GraphEntityRelationItem {
  id: string;
  direction: "outgoing" | "incoming";
  relation_type: string;
  weight: number;
  confidence: number;
  evidence_text?: string;
  peer_entity_id: string;
  peer_entity_name: string;
  peer_entity_type: string;
}

export interface GraphEntityDetailResponse {
  id: string;
  name: string;
  entity_type: string;
  confidence: number;
  mention_count: number;
  description?: string;
  aliases?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  is_active: boolean;
  relations: GraphEntityRelationItem[];
}

export interface GraphStatsResponse {
  total_entities: number;
  edge_count: number;
  by_type: Record<string, number>;
  avg_confidence: number;
  density: number;
  avg_degree: number;
  community_count: number;
  community_distribution: Record<string, number>;
}

/**
 * 构建知识图谱
 * 从语料库的知识块中提取实体和关系，构建知识图谱。
 */
export async function buildKnowledgeGraph(
  corpusId: string,
  params: GraphBuildParams = {},
): Promise<GraphBuildResult> {
  const res = await fetch(`/api/knowledge/base/${corpusId}/graph/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

/**
 * 获取语料库的知识图谱
 */
export async function fetchCorpusGraph(
  corpusId: string,
  appName?: string,
  includeRuns = false,
  asOf?: string,
): Promise<KnowledgeGraphPayload> {
  const query = new URLSearchParams();
  if (appName) query.set("app_name", appName);
  if (includeRuns) query.set("include_runs", "true");
  if (asOf) query.set("as_of", asOf);

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

export interface GlobalSearchEvidenceItem {
  community_id: number;
  partial_answer: string;
  similarity: number;
  top_entities: string[];
}

export interface GlobalSearchResult {
  query: string;
  answer: string;
  evidence: GlobalSearchEvidenceItem[];
  candidates_total: number;
  latency_ms: number;
  summaries_dirty: boolean;
}

export interface MultiHopEvidenceEdge {
  source_id: string;
  target_id: string;
  source_label: string;
  target_label: string;
  relation: string;
  evidence_text: string;
  weight: number;
}

export interface MultiHopEvidenceChain {
  target_entity_id: string;
  target_label: string;
  score: number;
  seed_entity_id?: string | null;
  path: string[];
  edges: MultiHopEvidenceEdge[];
}

export interface MultiHopReasonResult {
  query: string;
  seeds: string[];
  answer_entities: string[];
  evidence_chain: MultiHopEvidenceChain[];
  latency_ms: number;
}

/**
 * 多跳推理 + Provenance 证据链（G4 PPR + HippoRAG）
 */
export async function multiHopReasonKnowledgeGraph(
  corpusId: string,
  params: {
    query: string;
    seedEntities?: string[];
    topK?: number;
    maxHops?: number;
  },
): Promise<MultiHopReasonResult> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/multi_hop_reason`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: params.query,
        seed_entities: params.seedEntities ?? [],
        top_k: params.topK ?? 10,
        max_hops: params.maxHops ?? 3,
      }),
    },
  );
  return handleKnowledgeError(res);
}

/**
 * GraphRAG Global Search Map-Reduce（G1）
 */
export async function globalSearchKnowledgeGraph(
  corpusId: string,
  params: { query: string; maxCommunities?: number },
): Promise<GlobalSearchResult> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/global_search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: params.query,
        max_communities: params.maxCommunities ?? 10,
      }),
    },
  );
  return handleKnowledgeError(res);
}

/**
 * 获取以指定实体为锚点的子图（G2 Cytoscape 增量加载）
 */
export async function fetchGraphSubgraph(
  corpusId: string,
  params: {
    centerId: string;
    radius?: 1 | 2 | 3;
    limit?: number;
    appName?: string;
    asOf?: string;
  },
): Promise<{
  center_id: string;
  radius: number;
  nodes: Array<{
    id: string;
    label?: string;
    type?: string;
    importance?: number | null;
    community_id?: number | null;
    metadata?: Record<string, unknown>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label?: string;
    type?: string;
    weight?: number;
    metadata?: Record<string, unknown>;
  }>;
}> {
  const query = new URLSearchParams();
  query.set("center_id", params.centerId);
  // 数值用 != null 显式判空；后端目前 ge=1 拒绝 0，但放开下界后 truthy 判断会
  // 静默丢失 radius=0 / limit=0 的语义（隐性 bug）。
  if (params.radius != null) query.set("radius", String(params.radius));
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.appName) query.set("app_name", params.appName);
  if (params.asOf) query.set("as_of", params.asOf);

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/subgraph?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

/**
 * 获取关系时间轴密度直方图（G3 时间穿梭检索）
 */
export async function fetchGraphTimeline(
  corpusId: string,
  bucket: "day" | "week" | "month" = "day",
): Promise<GraphTimelineResult> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/timeline?bucket=${bucket}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

/**
 * 图谱混合检索
 * 结合向量相似度和图结构分数进行检索。
 */
export async function searchKnowledgeGraph(
  corpusId: string,
  params: GraphSearchParams,
): Promise<GraphSearchResults> {
  const res = await fetch(`/api/knowledge/base/${corpusId}/graph/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

/**
 * 查询实体邻居
 */
export async function findGraphNeighbors(
  params: GraphNeighborsParams,
): Promise<GraphNeighborsResult> {
  const res = await fetch("/api/knowledge/graph/neighbors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

/**
 * 查询两点间最短路径
 */
export async function findGraphPath(
  params: GraphPathParams,
): Promise<GraphPathResult> {
  const res = await fetch("/api/knowledge/graph/path", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

/**
 * 清除语料库的图谱数据
 */
export async function clearCorpusGraph(
  corpusId: string,
  appName?: string,
): Promise<void> {
  const query = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(`/api/knowledge/base/${corpusId}/graph${query}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to clear graph: ${res.statusText}`);
  }
}

/**
 * 获取图谱构建历史
 */
export async function fetchGraphBuildHistory(
  corpusId: string,
  appName?: string,
  limit = 20,
): Promise<GraphBuildHistoryResult> {
  const query = new URLSearchParams();
  if (appName) query.set("app_name", appName);
  query.set("limit", String(limit));

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/history?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

/**
 * 获取语料库的实体列表
 */
export async function fetchGraphEntities(
  corpusId: string,
  params?: {
    entity_type?: string;
    search?: string;
    sort_by?: string;
    limit?: number;
    offset?: number;
  },
): Promise<GraphEntityListResponse> {
  const query = new URLSearchParams();
  if (params?.entity_type) query.set("entity_type", params.entity_type);
  if (params?.search) query.set("search", params.search);
  if (params?.sort_by) query.set("sort_by", params.sort_by);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/entities?${query.toString()}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

/**
 * 获取实体详情（含关系列表）
 */
export async function fetchGraphEntityDetail(
  corpusId: string,
  entityId: string,
): Promise<GraphEntityDetailResponse> {
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/entities/${entityId}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

/**
 * 获取图谱统计信息
 */
export async function fetchGraphStats(
  corpusId: string,
  appName?: string,
): Promise<GraphStatsResponse> {
  const query = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(
    `/api/knowledge/base/${corpusId}/graph/stats${query}`,
    { cache: "no-store" },
  );
  return handleKnowledgeError(res);
}

// ============================================================================
// Pipelines
// ============================================================================

export async function fetchPipelines(
  appName?: string,
  options?: { limit?: number; offset?: number },
): Promise<KnowledgePipelinesPayload> {
  const query = new URLSearchParams();
  if (appName) query.set("app_name", appName);
  if (options?.limit != null) query.set("limit", String(options.limit));
  if (options?.offset != null) query.set("offset", String(options.offset));
  const qs = query.toString();
  const res = await fetch(`/api/knowledge/pipelines${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch pipelines: ${res.statusText}`);
  }
  return res.json();
}

export async function upsertPipelines(params: {
  app_name?: string;
  run_id: string;
  status?: string;
  payload?: Record<string, unknown>;
  expected_version?: number;
  idempotency_key?: string;
}): Promise<PipelineUpsertResult> {
  const res = await fetch("/api/knowledge/pipelines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to upsert pipelines: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Catalog Types (目录编册 — 对齐后端 catalog_dao.py)
// ============================================================================

/**
 * 目录节点类型（对齐后端 0010 收敛）：
 *   - `folder`：用户可见的目录容器（合并自历史 CATEGORY + COLLECTION）；
 *   - `document_ref`：系统内部软引用，仅由 `assign_document` 自动创建，UI 不暴露创建入口。
 *
 * 历史值 `category` / `collection` 仍可能从老 API 响应中返回，前端按 `folder` 兜底渲染。
 */
export type CatalogNodeType =
  | "folder"
  | "document_ref"
  | "category" // legacy
  | "collection"; // legacy

/** 全局 Catalog 元数据 — 对齐后端 DocCatalog ORM */
export interface DocCatalog {
  id: string;
  name: string;
  slug: string;
  app_name: string;
  description: string | null;
  visibility: "private" | "internal" | "public";
  is_archived: boolean;
  version: number;
  owner_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DocCatalogListResponse {
  items: DocCatalog[];
  total: number;
}

export interface DocCatalogDocumentsResponse {
  items: KnowledgeDocument[];
  total: number;
}

/** 目录节点 — 对齐后端 DocCatalogEntry + CTE 扩展字段 */
export interface CatalogNode {
  id: string;
  catalog_id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  node_type: CatalogNodeType;
  description: string | null;
  sort_order: number;
  config: Record<string, unknown>;
  /** CTE 计算字段：层级深度（根节点为 0） */
  depth?: number;
  /** CTE 计算字段：从根到当前节点的 ID 路径数组 */
  path?: string[];
  /** 前端派生：子节点数量 */
  children_count?: number;
  /** 前端派生：关联文档数量 */
  document_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCatalogNodeParams {
  catalog_id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
  node_type?: CatalogNodeType;
  description?: string;
  sort_order?: number;
  config?: Record<string, unknown>;
}

export interface UpdateCatalogNodeParams {
  name?: string;
  slug?: string;
  parent_id?: string | null;
  node_type?: CatalogNodeType;
  description?: string;
  sort_order?: number;
  config?: Record<string, unknown>;
}

export interface CatalogTreeResponse {
  tree: CatalogNode[];
}

export interface CatalogNodesResponse {
  nodes: CatalogNode[];
  total: number;
}

export interface CatalogNodeDocumentsResponse {
  documents: KnowledgeDocument[];
  total: number;
}

// ============================================================================
// Catalog API Functions
// ============================================================================

/** 获取目录树（CTE 扁平化列表，含 depth/path） */
export async function fetchCatalogTree(catalogId: string): Promise<CatalogNode[]> {
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/tree`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch catalog tree: ${res.statusText}`);
  const data = await res.json();
  return data.tree ?? data;
}

/** 获取目录节点列表（分页） */
export async function fetchCatalogNodes(params: {
  catalog_id: string;
  limit?: number;
  offset?: number;
}): Promise<CatalogNodesResponse> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();
  const res = await fetch(`/api/knowledge/catalogs/${params.catalog_id}/entries${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch catalog nodes: ${res.statusText}`);
  return res.json();
}

/** 创建目录节点
 *
 * 后端契约（knowledge/api.py POST /catalogs/{catalog_id}/entries）：
 *   catalog_id 作为路径参数；body 中其他字段。
 */
export async function createCatalogNode(params: CreateCatalogNodeParams): Promise<CatalogNode> {
  const { catalog_id, ...body } = params;
  // 防御性校验：catalog_id 若为空字符串，模板字符串会降级出 `/api/knowledge/catalogs//entries`，
  // 经 Next.js URL 归一化后等效命中 `[catalogId]/route.ts`（catalogId="entries"），该路由无 POST 导致 405。
  // 在此前置显式报错，避免低可观测性的静默漂移。
  if (!catalog_id) {
    throw new Error("catalog_id is required to create a catalog node");
  }
  const res = await fetch(`/api/knowledge/catalogs/${catalog_id}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to create catalog node: ${res.statusText}`);
  return res.json();
}

/** 获取单个目录节点详情 */
export async function fetchCatalogNode(catalogId: string, nodeId: string): Promise<CatalogNode> {
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/entries/${nodeId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch catalog node: ${res.statusText}`);
  return res.json();
}

/** 更新目录节点 */
export async function updateCatalogNode(
  catalogId: string,
  nodeId: string,
  params: UpdateCatalogNodeParams,
): Promise<CatalogNode> {
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/entries/${nodeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to update catalog node: ${res.statusText}`);
  return res.json();
}

/** 删除目录节点 */
export async function deleteCatalogNode(catalogId: string, nodeId: string): Promise<void> {
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/entries/${nodeId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete catalog node: ${res.statusText}`);
}

/** 获取目录节点下的文档列表（分页） */
export async function fetchCatalogNodeDocuments(
  catalogId: string,
  nodeId: string,
  options?: { limit?: number; offset?: number },
): Promise<CatalogNodeDocumentsResponse> {
  const query = new URLSearchParams();
  if (options?.limit != null) query.set("limit", String(options.limit));
  if (options?.offset != null) query.set("offset", String(options.offset));
  const qs = query.toString();
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/entries/${nodeId}/documents${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch node documents: ${res.statusText}`);
  return res.json();
}

/** 将文档分配到目录节点（通过批量端点） */
export async function assignDocumentToNode(
  catalogId: string,
  nodeId: string,
  docId: string,
): Promise<void> {
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/entries/${nodeId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_ids: [docId] }),
  });
  if (!res.ok) throw new Error(`Failed to assign document: ${res.statusText}`);
}

/** 从目录节点移除文档 */
export async function unassignDocumentFromNode(
  catalogId: string,
  nodeId: string,
  docId: string,
): Promise<void> {
  const res = await fetch(`/api/knowledge/catalogs/${catalogId}/entries/${nodeId}/documents/${docId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to unassign document: ${res.statusText}`);
}

/** 列出全局 Catalog（按 app_name 过滤） */
export async function fetchCatalogs(params?: {
  appName?: string;
  limit?: number;
  offset?: number;
}): Promise<DocCatalogListResponse> {
  const query = new URLSearchParams();
  if (params?.appName) query.set("app_name", params.appName);
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();
  const res = await fetch(`/api/knowledge/catalogs${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch catalogs: ${res.statusText}`);
  return res.json();
}

/** 创建全局 Catalog */
export async function createCatalog(params: {
  app_name: string;
  name: string;
  slug: string;
  visibility?: string;
}): Promise<DocCatalog> {
  const res = await fetch("/api/knowledge/catalogs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to create catalog: ${res.statusText}`);
  return res.json();
}

/** 获取 Catalog 下可用文档（跨 corpus，用于 AddDocumentsDialog） */
export async function fetchCatalogDocuments(
  catalogId: string,
  params?: { limit?: number; offset?: number },
): Promise<DocCatalogDocumentsResponse> {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();
  const res = await fetch(
    `/api/knowledge/catalogs/${catalogId}/documents${qs ? `?${qs}` : ""}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to fetch catalog documents: ${res.statusText}`);
  return res.json();
}

// ============================================================================
// Wiki Publishing Types
// ============================================================================

export type WikiPublicationStatus = "draft" | "published" | "archived";
export type WikiTheme = "default" | "book" | "docs";

export type WikiPublishMode = "live" | "snapshot";

export interface WikiPublication {
  id: string;
  catalog_id: string;
  app_name: string;
  publish_mode: WikiPublishMode;
  name: string;
  slug: string;
  description: string | null;
  status: WikiPublicationStatus;
  theme: WikiTheme;
  version: number;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  entries_count: number;
}

export interface WikiPublicationListResponse {
  items: WikiPublication[];
  total: number;
}

export interface CreateWikiPublicationParams {
  catalog_id: string;
  name: string;
  slug?: string;
  description?: string;
  theme?: WikiTheme;
  publish_mode?: WikiPublishMode;
}

export interface UpdateWikiPublicationParams {
  name?: string;
  description?: string;
  theme?: WikiTheme;
}

export interface WikiEntry {
  id: string;
  publication_id: string;
  document_id: string;
  entry_slug: string;
  entry_title: string | null;
  is_index_page: boolean;
  /** Materialized Path（list[str] 序列化为 JSON 字符串）。后端列名 entry_path（migration 0009）。 */
  entry_path: string | null;
  created_at: string | null;
}

export interface WikiEntryContent {
  entry_id: string;
  document_id: string;
  entry_slug: string;
  entry_title: string | null;
  markdown_content: string | null;
  document_filename: string;
}

/**
 * Wiki 导航树 item（自 0011 起）。
 *
 * 历史「容器节点 entry_id=null」语义现仅在缺失 CONTAINER 条目时回退；
 * 正常路径下 CONTAINER 条目持有真实 entry_id 与 catalog_node_id。
 */
export interface WikiNavTreeItem {
  /** 叶/容器条目的 entry UUID；仅在缺 CONTAINER 时回退为 null */
  entry_id: string | null;
  /** 叶节点的源文档；容器节点为 null */
  document_id: string | null;
  /** 容器节点关联的 Catalog 节点 ID；DOCUMENT 节点为 null */
  catalog_node_id?: string | null;
  /** 条目类型；老响应缺省时按 `document_id` 是否非空推导 */
  entry_kind?: "CONTAINER" | "DOCUMENT";
  entry_slug: string;
  entry_title: string;
  is_index_page: boolean;
  children?: WikiNavTreeItem[];
}

export interface WikiNavTreeResponse {
  publication_id: string;
  nav_tree: { items: WikiNavTreeItem[] };
}

export type WikiRevalidationStatus = "dispatched" | "failed" | "not_configured";

export interface WikiPublishActionResponse {
  publication_id: string;
  status: WikiPublicationStatus;
  version: number;
  published_at: string | null;
  entries_count: number;
  message: string;
  revalidation?: WikiRevalidationStatus;
}

export interface SyncFromCatalogParams {
  catalog_node_ids: string[];
}

export interface SyncFromCatalogResponse {
  synced_count: number;
  errors: string[];
  removed_count: number;
}

// ============================================================================
// Wiki Publishing API Functions
// ============================================================================

/** 列出 Wiki 发布记录 */
export async function fetchWikiPublications(params?: {
  catalogId?: string;
  status?: WikiPublicationStatus;
  offset?: number;
  limit?: number;
}): Promise<WikiPublicationListResponse> {
  const query = new URLSearchParams();
  if (params?.catalogId) query.set("catalog_id", params.catalogId);
  if (params?.status) query.set("status", params.status);
  if (params?.offset != null) query.set("offset", String(params.offset));
  if (params?.limit != null) query.set("limit", String(params.limit));
  const qs = query.toString();
  const res = await fetch(`/api/knowledge/wiki/publications${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch wiki publications: ${res.statusText}`);
  return res.json();
}

/** 获取单个 Wiki 发布 */
export async function fetchWikiPublication(pubId: string): Promise<WikiPublication> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch wiki publication: ${res.statusText}`);
  return res.json();
}

/** 创建 Wiki 发布
 *
 * 错误体由 `parseKnowledgeError` 解析后端 `{code, message, details}` 结构，
 * 例如 409 `WIKI_PUB_CATALOG_LIVE_CONFLICT` / `WIKI_PUB_SLUG_CONFLICT` 会带上
 * 中文 message 透传到上层 toast。 */
export async function createWikiPublication(
  params: CreateWikiPublicationParams,
): Promise<WikiPublication> {
  const res = await fetch(`/api/knowledge/wiki/publications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError<WikiPublication>(res);
}

/** 更新 Wiki 发布 */
export async function updateWikiPublication(
  pubId: string,
  params: UpdateWikiPublicationParams,
): Promise<WikiPublication> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to update wiki publication: ${res.statusText}`);
  return res.json();
}

/** 删除 Wiki 发布 */
export async function deleteWikiPublication(pubId: string): Promise<void> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete wiki publication: ${res.statusText}`);
}

/** 发布 Wiki（draft/published → published，递增版本号） */
export async function publishWiki(pubId: string): Promise<WikiPublishActionResponse> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}/publish`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to publish wiki: ${res.statusText}`);
  return res.json();
}

/** 取消发布（published → draft） */
export async function unpublishWiki(pubId: string): Promise<WikiPublishActionResponse> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}/unpublish`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to unpublish wiki: ${res.statusText}`);
  return res.json();
}

/** 列出 Wiki 发布的条目 */
export async function fetchWikiEntries(pubId: string): Promise<WikiEntry[]> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}/entries`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch wiki entries: ${res.statusText}`);
  return res.json();
}

/** 获取 Wiki 导航树 */
export async function fetchWikiNavTree(pubId: string): Promise<WikiNavTreeResponse> {
  const res = await fetch(`/api/knowledge/wiki/publications/${pubId}/nav-tree`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch wiki nav tree: ${res.statusText}`);
  return res.json();
}

/** 获取 Wiki 条目内容（含 Markdown） */
export async function fetchWikiEntryContent(entryId: string): Promise<WikiEntryContent> {
  const res = await fetch(`/api/knowledge/wiki/entries/${entryId}/content`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch wiki entry content: ${res.statusText}`);
  return res.json();
}

/** 从 Catalog 全量同步文档到 Wiki（幂等：未覆盖条目会被删除） */
export async function syncWikiEntriesFromCatalog(
  pubId: string,
  params: SyncFromCatalogParams,
): Promise<SyncFromCatalogResponse> {
  const res = await fetch(
    `/api/knowledge/wiki/publications/${pubId}/sync-from-catalog`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
  );
  if (!res.ok) throw new Error(`Failed to sync wiki from catalog: ${res.statusText}`);
  return res.json();
}
