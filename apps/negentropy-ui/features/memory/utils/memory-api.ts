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
  users: Array<{ id: string; label: string }>;
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

export interface MemoryAutomationFunction {
  name: string;
  schema: string;
  status: string;
  definition: string;
  managed: boolean;
}

export interface MemoryAutomationJob {
  job_key: string;
  process_label: string;
  function_name: string;
  enabled: boolean;
  status: string;
  job_id?: number | null;
  schedule: string;
  command: string;
  active: boolean;
}

export interface MemoryAutomationProcess {
  key: string;
  label: string;
  description: string;
  config: Record<string, unknown>;
  job?: MemoryAutomationJob | null;
  functions: MemoryAutomationFunction[];
}

export interface MemoryAutomationSnapshot {
  capabilities: {
    pg_cron_installed: boolean;
    pg_cron_available: boolean;
    pg_cron_logs_accessible?: boolean;
    management_mode: string;
    degraded_reasons: string[];
  };
  config: {
    retention: {
      decay_lambda: number;
      low_retention_threshold: number;
      min_age_days: number;
      auto_cleanup_enabled: boolean;
      cleanup_schedule: string;
    };
    consolidation: {
      enabled: boolean;
      schedule: string;
      lookback_interval: string;
    };
    context_assembler: {
      max_tokens: number;
      memory_ratio: number;
      history_ratio: number;
    };
  };
  processes: MemoryAutomationProcess[];
  functions: MemoryAutomationFunction[];
  jobs: MemoryAutomationJob[];
  health: {
    status: string;
    recent_log_count: number;
  };
}

export interface MemoryAutomationLog {
  job_id?: number | null;
  run_id?: number | null;
  database?: string | null;
  username?: string | null;
  command?: string | null;
  status?: string | null;
  return_message?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

export interface MemoryAutomationLogsPayload {
  count: number;
  items: MemoryAutomationLog[];
}

export interface MemoryAutomationRunResponse {
  job_key: string;
  process_label: string;
  result?: number | null;
  snapshot: MemoryAutomationSnapshot;
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
    throw new Error(`Failed to fetch memories: ${res.statusText}`);
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
    throw new Error(`Failed to search memories: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Facts
// ============================================================================

export async function fetchFacts(
  userId: string,
  appName?: string,
  factType?: string,
  limit?: number,
): Promise<FactListPayload> {
  const params = new URLSearchParams();
  params.set("user_id", userId);
  if (appName) params.set("app_name", appName);
  if (factType) params.set("fact_type", factType);
  if (limit) params.set("limit", String(limit));

  const res = await fetch(`/api/memory/facts?${params.toString()}`, {
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
// Automation
// ============================================================================

export async function fetchMemoryAutomation(
  appName?: string,
): Promise<MemoryAutomationSnapshot> {
  const params = new URLSearchParams();
  if (appName) params.set("app_name", appName);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`/api/memory/automation${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch memory automation: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchMemoryAutomationLogs(
  appName?: string,
  limit?: number,
): Promise<MemoryAutomationLogsPayload> {
  const params = new URLSearchParams();
  if (appName) params.set("app_name", appName);
  if (limit) params.set("limit", String(limit));

  const res = await fetch(`/api/memory/automation/logs?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch memory automation logs: ${res.statusText}`);
  }
  return res.json();
}

export async function updateMemoryAutomationConfig(params: {
  app_name?: string;
  config: MemoryAutomationSnapshot["config"];
}): Promise<MemoryAutomationSnapshot> {
  const res = await fetch("/api/memory/automation/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to update memory automation config: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerMemoryAutomationJobAction(
  jobKey: string,
  action: "enable" | "disable" | "reconcile",
  appName?: string,
): Promise<MemoryAutomationSnapshot> {
  const params = new URLSearchParams();
  if (appName) params.set("app_name", appName);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`/api/memory/automation/jobs/${jobKey}/${action}${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) {
    throw new Error(`Failed to ${action} memory automation job: ${res.statusText}`);
  }
  return res.json();
}

export async function runMemoryAutomationJob(
  jobKey: string,
  appName?: string,
): Promise<MemoryAutomationRunResponse> {
  const params = new URLSearchParams();
  if (appName) params.set("app_name", appName);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`/api/memory/automation/jobs/${jobKey}/run${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) {
    throw new Error(`Failed to run memory automation job: ${res.statusText}`);
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
  user_id: string;
  app_name?: string;
  days?: number;
}): Promise<RetrievalMetrics> {
  const qs = new URLSearchParams();
  qs.set("user_id", params.user_id);
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
