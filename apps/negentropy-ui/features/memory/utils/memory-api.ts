/**
 * Memory 模块 API 客户端
 *
 * 通过 Next.js API Routes 代理到后端 Memory 服务
 * Memory 与 Knowledge 正交: Memory 是动态/个人/受遗忘曲线影响
 */

// ============================================================================
// Types
// ============================================================================

export interface MemoryDashboard {
  user_count: number;
  memory_count: number;
  fact_count: number;
  avg_retention_score: number;
  avg_importance_score: number;
  low_retention_count: number;
  high_importance_count: number;
  recent_audit_count: number;
}

export interface MemoryItem {
  id: string;
  user_id: string;
  app_name: string;
  memory_type: string;
  content: string;
  retention_score: number;
  importance_score: number;
  access_count: number;
  created_at?: string;
  last_accessed_at?: string;
  metadata: Record<string, unknown>;
}

export interface MemoryListPayload {
  users: Array<{
    id: string;
    label: string;
    name?: string;
    picture?: string;
    email?: string;
    count: number;
  }>;
  timeline: MemoryItem[];
  policies: Record<string, unknown>;
}

export interface MemorySearchResult {
  count: number;
  items: Array<{
    id: string;
    content: string;
    timestamp?: string;
    relevance_score?: number;
    metadata: Record<string, unknown>;
  }>;
}

export interface FactItem {
  id: string;
  user_id: string;
  app_name: string;
  fact_type: string;
  key: string;
  value: Record<string, unknown>;
  confidence: number;
  /** 重要度评分 (0–1)，后端 `/api/memory/facts` 返回；缺省视为未知不渲染。 */
  importance_score?: number;
  valid_from?: string;
  valid_until?: string;
  created_at?: string;
}

export interface FactListPayload {
  count: number;
  items: FactItem[];
}

export interface AuditRecord {
  memory_id: string;
  decision: string;
  version?: number;
  note?: string;
  created_at?: string;
}

export interface AuditResponse {
  status: string;
  audits: AuditRecord[];
}

export interface AuditHistoryPayload {
  count: number;
  items: AuditRecord[];
}

// ============================================================================
// Conflicts
// ============================================================================

export interface ConflictItem {
  id: string;
  user_id: string;
  app_name: string;
  old_fact_id?: string | null;
  new_fact_id?: string | null;
  conflict_type: string;
  resolution: string;
  detected_by: string;
  created_at?: string | null;
}

export interface ConflictListPayload {
  count: number;
  items: ConflictItem[];
}

// ============================================================================
// Fact History
// ============================================================================

export interface FactHistoryItem {
  id: string;
  key: string;
  value: Record<string, unknown>;
  confidence: number;
  status: string;
  superseded_by?: string | null;
  created_at?: string | null;
}

// ============================================================================
// Retrieval Metrics
// ============================================================================

export interface RetrievalMetrics {
  total_retrievals: number;
  precision_at_k: number;
  utilization_rate: number;
  noise_rate: number;
}

// ============================================================================
// Observability — Health
// ============================================================================

/** `/memory/health` 的 feature flag 实时快照（含 PII 引擎实际运行态探测）。 */
export interface MemoryHealthFeatures {
  hipporag: boolean;
  reflection: boolean;
  consolidation_legacy: boolean;
  consolidation_policy: string;
  consolidation_steps: string[];
  pii_engine: string;
  /** 探测到的实际 PII 检测器（"presidio" / "regex" / "unavailable"）；与 pii_engine 不一致即静默降级。 */
  pii_engine_actual?: string;
  relevance_enabled: boolean;
  gatekeeper_enabled: boolean;
  // 探测异常时后端返回 {status, detail} 而非上述字段
  status?: string;
  detail?: string;
}

export interface MemoryHealth {
  status: "healthy" | "degraded";
  checks: {
    db: { status: string; detail?: string };
    features: MemoryHealthFeatures;
    tables: { memories?: number; facts?: number; status?: string; detail?: string };
  };
}

// ============================================================================
// Observability — Aggregate Metrics (admin)
// ============================================================================

/** `/memory/metrics` 聚合指标（SRE 黄金信号 + USE 方法），仅 admin 可读。 */
export interface MemorySystemMetrics {
  // 搜索（24h）
  search_total_24h: number;
  search_reference_rate: number;
  search_helpful_rate: number;
  // 巩固（24h）
  consolidation_total_24h: number;
  consolidation_retain_rate: number;
  // Retention 分布
  retention_score_avg: number;
  retention_score_p10: number;
  retention_score_p90: number;
  low_retention_count: number;
  memory_total: number;
  // PII
  pii_detection_rate: number;
  pii_detected_count: number;
  // Facts & 图谱
  fact_count: number;
  association_count: number;
  kg_entity_count: number;
}

// ============================================================================
// Core Blocks（身份记忆块：persona/human，λ=0.0 永久 always-injected）
// ============================================================================

export interface CoreBlockItem {
  id: string;
  user_id: string;
  app_name: string;
  scope: "user" | "app" | "thread";
  thread_id?: string | null;
  label: string;
  content: string;
  token_count: number;
  version: number;
  updated_by?: string | null;
  metadata: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CoreBlockListPayload {
  count: number;
  items: CoreBlockItem[];
}

export interface CoreBlockUpsertResult {
  id: string;
  version: number;
  scope: string;
  label: string;
  token_count: number;
  truncated: boolean;
}

// ============================================================================
// Associations（记忆/事实关联图，per-memory）
// ============================================================================

export interface MemoryAssociation {
  id: string;
  source_id: string;
  source_type: string;
  target_id: string;
  target_type: string;
  association_type: string;
  weight: number;
}

export interface AssociationListPayload {
  count: number;
  items: MemoryAssociation[];
}

// ============================================================================
// Dashboard
// ============================================================================

export async function fetchMemoryDashboard(
  appName?: string,
  userId?: string,
): Promise<MemoryDashboard> {
  const params = new URLSearchParams();
  if (appName) params.set("app_name", appName);
  if (userId) params.set("user_id", userId);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`/api/memory/dashboard${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch memory dashboard: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Memory Timeline
// ============================================================================

export async function fetchMemories(
  appName?: string,
  userId?: string,
  limit?: number,
): Promise<MemoryListPayload> {
  const params = new URLSearchParams();
  if (appName) params.set("app_name", appName);
  if (userId) params.set("user_id", userId);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`/api/memory${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    // Memory 列表 backend 当前在无 user_id 时会返回 500（与 ADK session_service
    // 边界相关，参见 docs/issue.md M3）。对前端而言"无内容"与"5xx"在用户侧应有
    // 一致的可重试 UX；这里把错误信息本地化并保留状态码，由调用方根据 statusCode
    // 决定是否显示"重试"按钮。
    throw buildMemoryRetryableError("加载记忆失败", res);
  }
  return res.json();
}

export async function searchMemories(params: {
  app_name?: string;
  user_id: string;
  query: string;
}): Promise<MemorySearchResult> {
  const res = await fetch("/api/memory/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    // 评审 #4：搜索路径同样应注入 retryable，让 RetryableErrorBanner 的 retryable
    // 协议成为唯一判据，避免回退正则 /5\d\d/ 在默认 Error.message（如
    // "Internal Server Error"，无数字）下不命中导致 5xx 不显示重试按钮。
    throw buildMemoryRetryableError("搜索记忆失败", res);
  }
  return res.json();
}

/**
 * 构造 `/api/memory*` 路径下的可重试错误对象。
 *
 * - `statusCode` 透传 HTTP 状态码，便于上层做精细化分支；
 * - `retryable` 标记 `5xx` 为可重试（用户侧可一键重试，避免刷新整页）。
 *   注：浏览器 fetch 在网络层失败（DNS/连接/超时）会直接 throw 而非走 `!res.ok`，
 *   `res.status === 0` 仅出现在 `mode: "no-cors"` 的 opaque response，本调用未声明
 *   该模式，因此原先 `res.status === 0` 分支属 dead code，已移除（评审 #8）。
 */
function buildMemoryRetryableError(
  prefix: string,
  res: Response,
): Error & { statusCode: number; retryable: boolean } {
  const error = new Error(
    `${prefix}：${res.status} ${res.statusText || "Internal Server Error"}`,
  ) as Error & { statusCode: number; retryable: boolean };
  error.statusCode = res.status;
  error.retryable = res.status >= 500;
  return error;
}

// ============================================================================
// Facts
// ============================================================================

export async function fetchFacts(
  userId?: string,
  appName?: string,
  factType?: string,
  limit?: number,
): Promise<FactListPayload> {
  const params = new URLSearchParams();
  if (userId) params.set("user_id", userId);
  if (appName) params.set("app_name", appName);
  if (factType) params.set("fact_type", factType);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`/api/memory/facts${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch facts: ${res.statusText}`);
  }
  return res.json();
}

export async function searchFacts(params: {
  app_name?: string;
  user_id: string;
  query: string;
  limit?: number;
}): Promise<FactListPayload> {
  const res = await fetch("/api/memory/facts/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to search facts: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Audit
// ============================================================================

export async function submitAudit(params: {
  app_name?: string;
  user_id: string;
  decisions: Record<string, string>;
  expected_versions?: Record<string, number>;
  note?: string;
  idempotency_key?: string;
}): Promise<AuditResponse> {
  const res = await fetch("/api/memory/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to submit audit: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAuditHistory(
  userId: string,
  appName?: string,
  limit?: number,
): Promise<AuditHistoryPayload> {
  const params = new URLSearchParams();
  params.set("user_id", userId);
  if (appName) params.set("app_name", appName);
  if (limit) params.set("limit", String(limit));

  const res = await fetch(`/api/memory/audit/history?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch audit history: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Conflicts
// ============================================================================

export async function fetchConflicts(params?: {
  user_id?: string;
  app_name?: string;
  resolution?: string;
  limit?: number;
  offset?: number;
}): Promise<ConflictListPayload> {
  const qs = new URLSearchParams();
  if (params?.user_id) qs.set("user_id", params.user_id);
  if (params?.app_name) qs.set("app_name", params.app_name);
  if (params?.resolution) qs.set("resolution", params.resolution);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const search = qs.toString() ? `?${qs.toString()}` : "";

  const res = await fetch(`/api/memory/conflicts${search}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch conflicts: ${res.statusText}`);
  }
  return res.json();
}

export async function resolveConflict(
  conflictId: string,
  resolution: string,
): Promise<{ status: string; conflict_id: string; resolution: string }> {
  const res = await fetch(`/api/memory/conflicts/${conflictId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolution }),
  });
  if (!res.ok) {
    throw new Error(`Failed to resolve conflict: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Fact History
// ============================================================================

export async function fetchFactHistory(
  factId: string,
): Promise<{ count: number; items: FactHistoryItem[] }> {
  const res = await fetch(`/api/memory/facts/${factId}/history`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch fact history: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Retrieval Feedback
// ============================================================================

export async function submitRetrievalFeedback(
  logId: string,
  outcome: string,
): Promise<{ status: string }> {
  const res = await fetch("/api/memory/retrieval/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ log_id: logId, outcome }),
  });
  if (!res.ok) {
    throw new Error(`Failed to submit retrieval feedback: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchRetrievalMetrics(params: {
  user_id?: string;
  app_name?: string;
  days?: number;
}): Promise<RetrievalMetrics> {
  const qs = new URLSearchParams();
  if (params.user_id) qs.set("user_id", params.user_id);
  if (params.app_name) qs.set("app_name", params.app_name);
  if (params.days) qs.set("days", String(params.days));

  const res = await fetch(`/api/memory/retrieval/metrics?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch retrieval metrics: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Observability — Health & Metrics
// ============================================================================

/** 拉取 Memory 系统健康快照（无鉴权；端点被禁用时后端返回 404，由调用方吞掉降级）。 */
export async function fetchMemoryHealth(): Promise<MemoryHealth> {
  const res = await fetch("/api/memory/health", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch memory health: ${res.statusText}`);
  }
  return res.json();
}

/**
 * 拉取 Memory 系统聚合指标（admin only）。
 *
 * 非 admin 触达时后端 `_require_admin` 返回 403；端点被禁用返回 404。两者均由调用方
 * （Overview / Insights）吞掉并降级为 null，绝不冒泡为整页错误。
 */
export async function fetchMemoryMetrics(params?: {
  user_id?: string;
  app_name?: string;
}): Promise<MemorySystemMetrics> {
  const qs = new URLSearchParams();
  if (params?.user_id) qs.set("user_id", params.user_id);
  if (params?.app_name) qs.set("app_name", params.app_name);
  const search = qs.toString() ? `?${qs.toString()}` : "";

  const res = await fetch(`/api/memory/metrics${search}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch memory metrics: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Core Blocks
// ============================================================================

export async function fetchCoreBlocks(params: {
  user_id: string;
  app_name?: string;
  thread_id?: string;
}): Promise<CoreBlockListPayload> {
  const qs = new URLSearchParams();
  qs.set("user_id", params.user_id);
  if (params.app_name) qs.set("app_name", params.app_name);
  if (params.thread_id) qs.set("thread_id", params.thread_id);

  const res = await fetch(`/api/memory/core-blocks?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch core blocks: ${res.statusText}`);
  }
  return res.json();
}

export async function upsertCoreBlock(payload: {
  user_id: string;
  app_name?: string;
  scope?: "user" | "app" | "thread";
  thread_id?: string | null;
  label: string;
  content: string;
  updated_by?: string;
  metadata?: Record<string, unknown>;
}): Promise<CoreBlockUpsertResult> {
  const res = await fetch("/api/memory/core-blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to upsert core block: ${res.statusText}`);
  }
  return res.json();
}

/** 删除 Core Block —— 标识参数走 query string（与后端 Query(...) 契约一致），无 body。 */
export async function deleteCoreBlock(params: {
  user_id: string;
  app_name?: string;
  scope?: string;
  thread_id?: string;
  label: string;
}): Promise<{ status: string }> {
  const qs = new URLSearchParams();
  qs.set("user_id", params.user_id);
  if (params.app_name) qs.set("app_name", params.app_name);
  if (params.scope) qs.set("scope", params.scope);
  if (params.thread_id) qs.set("thread_id", params.thread_id);
  qs.set("label", params.label);

  const res = await fetch(`/api/memory/core-blocks?${qs.toString()}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete core block: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Associations
// ============================================================================

export async function fetchMemoryAssociations(
  memoryId: string,
  params?: {
    association_type?: string;
    direction?: "in" | "out" | "both";
    limit?: number;
  },
): Promise<AssociationListPayload> {
  const qs = new URLSearchParams();
  if (params?.association_type) qs.set("association_type", params.association_type);
  if (params?.direction) qs.set("direction", params.direction);
  if (params?.limit) qs.set("limit", String(params.limit));
  const search = qs.toString() ? `?${qs.toString()}` : "";

  const res = await fetch(
    `/api/memory/${encodeURIComponent(memoryId)}/associations${search}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch associations: ${res.statusText}`);
  }
  return res.json();
}
