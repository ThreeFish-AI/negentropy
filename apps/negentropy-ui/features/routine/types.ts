/**
 * Routine 共享类型 — 与后端 ``routine_api.py`` 的序列化契约对齐。
 */

export type RoutineStatus =
  | "pending"
  | "running"
  | "paused"
  | "succeeded"
  | "failed"
  | "cancelled";

export type ApprovalMode = "auto" | "first" | "every";

export type IterationStatus =
  | "pending_approval"
  | "dispatched"
  | "in_flight"
  | "executed"
  | "evaluated"
  | "reaped"
  | "aborted";

export type Verdict = "pass" | "progressing" | "stalled" | "regressed" | "unrecoverable";

export type ExecStatus = "success" | "error" | "timeout";

/** 相位状态机：仅 phased 工作流推进三相位；扁平工作流恒为 implement。 */
export type RoutinePhase = "plan" | "implement" | "finalize";

export interface RoutineDTO {
  id: string;
  key: string;
  title: string;
  display_name: string | null;
  description: string | null;
  goal: string;
  acceptance_criteria: string;
  cwd: string | null;
  verification_command: string | null;
  status: RoutineStatus;
  termination_reason: string | null;
  current_phase: RoutinePhase | null;
  pr_url: string | null;
  max_iterations: number | null;
  max_cost_usd: number | null;
  deadline_at: string | null;
  success_score_threshold: number;
  no_progress_patience: number;
  approval_mode: ApprovalMode;
  iteration_count: number;
  total_cost_usd: number;
  best_score: number | null;
  last_score: number | null;
  claude_session_id: string | null;
  reflections: string[];
  config: Record<string, unknown>;
  owner_id: string | null;
  agent_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** true 时本行为 Routine Template */
  is_template: boolean;
  // 仅 detail 端点返回
  iterations?: RoutineIterationDTO[];
}

export interface RoutineIterationDTO {
  id: string;
  routine_id: string;
  seq: number;
  status: IterationStatus;
  phase: RoutinePhase | null;
  prompt: string | null;
  resume_session_id: string | null;
  exec_status: ExecStatus | null;
  summary: string | null;
  claude_session_id: string | null;
  cost_usd: number;
  turn_count: number;
  exec_error: string | null;
  score: number | null;
  verdict: Verdict | null;
  reflection: string | null;
  eval_error: string | null;
  gate_exit_code: number | null;
  started_at: string | null;
  finished_at: string | null;
}

/**
 * 迭代的精简快照 —— 由 SSE ``iteration`` 事件或 ``recent=1`` 探测填充，
 * 供 Fleet 卡片在不拉取完整详情的前提下推导当前闭环阶段与实时耗时。
 * 字段为 ``RoutineIterationDTO`` 的子集（全部可选，SSE 载荷可能不完整）。
 */
export interface RoutineIterationLite {
  /** 迭代 ID —— 用于辨识「换了一个新迭代」（SSE 事件恒带 id）。 */
  id?: string;
  seq?: number;
  status: IterationStatus;
  phase?: RoutinePhase | null;
  score?: number | null;
  verdict?: Verdict | null;
  turn_count?: number;
  cost_usd?: number;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface RoutineKpis {
  total: number;
  running: number;
  paused: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  pending: number;
  total_cost_usd: number;
  avg_iterations: number;
}

export interface RoutineListResponse {
  items: RoutineDTO[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface IterationListResponse {
  items: RoutineIterationDTO[];
  has_more: boolean;
  next_before_seq: number | null;
}

export interface RoutineFilters {
  status: RoutineStatus | null;
  q: string;
}

/** 创建请求体 */
export interface RoutineCreatePayload {
  key: string;
  title: string;
  goal: string;
  acceptance_criteria: string;
  cwd?: string | null;
  verification_command?: string | null;
  max_iterations?: number | null;
  max_cost_usd?: number | null;
  deadline_at?: string | null;
  success_score_threshold?: number;
  no_progress_patience?: number;
  approval_mode?: ApprovalMode;
  config?: Record<string, unknown>;
  display_name?: string | null;
  description?: string | null;
  is_template?: boolean;
}

/** 更新请求体（全部可选） */
export type RoutineUpdatePayload = Partial<Omit<RoutineCreatePayload, "key">>;

/** SSE 事件 */
export interface RoutineStreamEvent {
  type: "routine" | "iteration";
  id: string;
  routine_id?: string;
  status?: string;
  [key: string]: unknown;
}

/** GET /routines/presets 返回的预设摘要 */
export interface RoutinePresetSummary {
  preset_id: string;
  display_name: string;
  description: string;
  category: string;
  version: string;
  features_showcase: string[];
  approval_mode: ApprovalMode;
  has_verification_command: boolean;
}

/** POST /routines/from-preset 请求体 */
export interface RoutineFromPresetPayload {
  preset_id?: string;
  template_id?: string;
  key: string;
  cwd: string;
}

// ---------------------------------------------------------------------------
// Template（合并模板列表）
// ---------------------------------------------------------------------------

/** 模板来源判别器 */
export type TemplateSource = "builtin" | "user";

/** GET /routines/templates 返回的统一模板条目（内置 + 用户合并） */
export interface RoutineTemplateItem {
  id: string;
  source: TemplateSource;
  key: string;
  display_name: string;
  description: string;
  category: string;
  version: string;
  features_showcase: string[];
  title: string;
  goal: string;
  acceptance_criteria: string;
  verification_command: string | null;
  max_iterations: number | null;
  max_cost_usd: number | null;
  success_score_threshold: number;
  no_progress_patience: number;
  approval_mode: ApprovalMode;
  config: Record<string, unknown>;
  has_verification_command: boolean;
  owner_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}
