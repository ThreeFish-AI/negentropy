/**
 * Scheduler 前后端共享类型定义。
 * 与后端 ``interface/scheduler_api.py::_serialize_task / _serialize_execution`` 对齐。
 */

export type TriggerType = "interval" | "cron" | "oneshot";
export type ExecutionStatus = "ok" | "failed" | "running" | "cancelled" | "timeout";
export type FireReason = "tick" | "manual" | "replay";
export type StatsGroupBy =
  | "role"
  | "scenario"
  | "agent"
  | "owner"
  | "handler_kind"
  | "category";
export type StatsWindow = "1h" | "24h" | "7d";

export interface ScheduledTaskDTO {
  id: string;
  key: string;
  handler_kind: string;
  trigger_type: TriggerType;
  interval_seconds: number | null;
  cron_expr: string | null;
  enabled: boolean;
  owner_id: string | null;
  participant_id: string | null;
  agent_id: string | null;
  role: string | null;
  scenario: string | null;
  category: string | null;
  display_name: string | null;
  description: string | null;
  last_fire_at: string | null;
  next_fire_at: string | null;
  last_status: string | null;
  last_error: string | null;
  consecutive_failures: number;
  total_runs: number;
  max_concurrency: number;
  token_budget: number | null;
  backoff_until: string | null;
  created_at: string | null;
  updated_at: string | null;
  payload: Record<string, unknown>;
  recent: string[];
  is_system: boolean;
}

export interface TaskExecutionDTO {
  id: string;
  task_id: string;
  task_key: string | null;
  handler_kind: string | null;
  role: string | null;
  scenario: string | null;
  category: string | null;
  started_at: string | null;
  finished_at: string | null;
  status: ExecutionStatus;
  duration_ms: number | null;
  tokens_used: number | null;
  output_summary: string | null;
  error: string | null;
  fire_reason: FireReason;
  skill_id: string | null;
  skill_schedule_id: string | null;
  memory_id: string | null;
  pipeline_run_id: string | null;
  thread_id: string | null;
}

export interface KpiResponse {
  window: StatsWindow;
  total_tasks: number;
  enabled_tasks: number;
  runs: number;
  success: number;
  failed: number;
  running: number;
  success_rate: number;
  avg_latency_ms: number;
}

export interface StatsBucket {
  key: string;
  label: string;
  runs: number;
  success: number;
  failed: number;
  success_rate: number;
  avg_ms: number;
}

export interface StatsResponse {
  group_by: StatsGroupBy;
  window: StatsWindow;
  buckets: StatsBucket[];
}

export interface TaskListResponse {
  items: ScheduledTaskDTO[];
  next_cursor: string | null;
}

export interface ExecutionListResponse {
  items: TaskExecutionDTO[];
  next_cursor: string | null;
}

export interface TaskDetailResponse extends ScheduledTaskDTO {
  recent_executions: TaskExecutionDTO[];
}

export interface DashboardFilters {
  role: string | null;
  scenario: string | null;
  agent: string | null;
  owner: string | null;
  category: string | null;
  window: StatsWindow;
}

// ---------------------------------------------------------------------------
// Handler Manifest — 统一定义协议
// ---------------------------------------------------------------------------

export type PayloadFieldType = "string" | "number" | "integer" | "boolean" | "enum";

export interface PayloadFieldSchema {
  name: string;
  label: string;
  type: PayloadFieldType;
  required?: boolean;
  default?: unknown;
  enum_options?: string[];
  help_text?: string;
  applies_when?: string[];
}

export interface HandlerDescriptor {
  handler_kind: string;
  label: string;
  description: string;
  trigger_types: TriggerType[];
  payload_fields: PayloadFieldSchema[];
  discriminator_field: string | null;
  default_trigger_type: string | null;
  supports_token_budget: boolean;
}

export interface HandlerListResponse {
  items: HandlerDescriptor[];
}

// ---------------------------------------------------------------------------
// CRUD 请求载荷
// ---------------------------------------------------------------------------

export interface TaskWritePayload {
  key?: string; // 仅 create 时必填
  handler_kind: string;
  trigger_type: TriggerType;
  interval_seconds: number | null;
  cron_expr: string | null;
  enabled?: boolean;
  owner_id?: string | null;
  participant_id?: string | null;
  agent_id?: string | null;
  role?: string | null;
  scenario?: string | null;
  category?: string | null;
  display_name?: string | null;
  description?: string | null;
  payload?: Record<string, unknown>;
  max_concurrency?: number;
  token_budget?: number | null;
}
