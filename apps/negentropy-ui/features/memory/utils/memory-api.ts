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
  low_retention_count: number;
  recent_audit_count: number;
}

export interface MemoryItem {
  id: string;
  user_id: string;
  app_name: string;
  memory_type: string;
  content: string;
  retention_score: number;
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
