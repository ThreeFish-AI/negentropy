/**
 * Pipeline 运行记录、阶段事件与 Cancel / Retry / Upsert API
 */
import { handleKnowledgeError } from "./errors";

export interface KnowledgePipelinesData {
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
// Pipeline 阶段状态
export type PipelineStageStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelling"
  | "cancelled";

// Pipeline 操作类型
export type PipelineOperation =
  | "ingest_text"
  | "ingest_url"
  | "ingest_file"
  | "ingest_document"
  | "import_document"
  | "replace_source"
  | "sync_source"
  | "rebuild_source"
  | "translate";

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
// 异步 Pipeline 响应类型
export interface AsyncPipelineResult {
  run_id: string;
  status: "running";
  message: string;
}
export interface PipelineUpsertResult {
  status: string;
  pipeline?: unknown;
}
// ============================================================================
// Pipelines Data
// ============================================================================

export async function fetchPipelinesData(
  appName?: string,
): Promise<KnowledgePipelinesData> {
  const params = appName ? `?app_name=${encodeURIComponent(appName)}` : "";
  const res = await fetch(`/api/knowledge/pipelines/overview${params}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch pipelines data: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Pipeline Run Cancel
// ============================================================================

/** Cancel API 响应（KB & KG 共用）。`status` ∈ {cancelling, cancelled, noop}。 */
export interface PipelineCancelResult {
  status: "cancelling" | "cancelled" | "noop";
  run_id: string;
  in_process: boolean;
  record: Record<string, unknown>;
}

/**
 * 取消正在运行的 Pipeline Run（KB 或 KG）。
 *
 * - KB: `POST /api/knowledge/pipelines/{run_id}/cancel`
 * - KG: `POST /api/knowledge/base/{corpus_id}/graph/runs/{run_id}/cancel`
 *
 * 立即返回 cancelling/cancelled/noop，task 在下个检查点退出。前端轮询观察终态。
 */
export async function cancelPipelineRun(
  runId: string,
  source: "kb" | "kg",
  opts?: { corpusId?: string; appName?: string; reason?: string },
): Promise<PipelineCancelResult> {
  if (source === "kg" && !opts?.corpusId) {
    throw new Error("cancelPipelineRun: corpusId is required for KG runs");
  }
  const url =
    source === "kb"
      ? `/api/knowledge/pipelines/${encodeURIComponent(runId)}/cancel`
      : `/api/knowledge/base/${encodeURIComponent(opts!.corpusId!)}/graph/runs/${encodeURIComponent(runId)}/cancel`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      app_name: opts?.appName,
      reason: opts?.reason ?? "user_cancel",
    }),
  });
  return handleKnowledgeError<PipelineCancelResult>(res);
}

/**
 * 重试失败/取消的 ingest_file Pipeline（双入口）。
 *
 * - resume=true  断点续传：从最后完成的切片继续（复用 perceives checkpoint）；
 * - resume=false 重新开始：丢弃 checkpoint 全量重跑。
 *
 * 后端创建一个新的 Pipeline Run（fresh run_id），原 Run 记录保留。
 * `POST /api/knowledge/pipelines/{run_id}/retry`
 */
export async function retryPipelineRun(
  runId: string,
  resume: boolean,
  opts?: { appName?: string },
): Promise<AsyncPipelineResult> {
  const res = await fetch(
    `/api/knowledge/pipelines/${encodeURIComponent(runId)}/retry`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ app_name: opts?.appName, resume }),
    },
  );
  return handleKnowledgeError<AsyncPipelineResult>(res);
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
