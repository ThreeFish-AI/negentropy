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
  /** worktree 模式下为 git 仓库根（Project Path）；引擎据此派生隔离 worktree。 */
  cwd: string | null;
  /** 隔离 worktree 的基线分支 + PR base（如 origin/feature/1.x.x）。 */
  baseline_branch: string | null;
  /** 可选关联的已注册 Repository（单一事实源指针）；非空时由后端派生 cwd/baseline_branch。 */
  repository_id: string | null;
  verification_command: string | null;
  status: RoutineStatus;
  termination_reason: string | null;
  current_phase: RoutinePhase | null;
  pr_url: string | null;
  /** PR 是否已合并（true=已 Merge；null=未知/未检测，旧记录回退）。派生显示条件，非新状态值。 */
  pr_merged: boolean | null;
  /** PR 状态（open|closed|merged；null=未知/未检测，旧记录回退）。区分 Open 与 Closed-without-merge。 */
  pr_state: "open" | "closed" | "merged" | null;
  /** 引擎管理的运行期：本轮隔离工作分支（routine/<key>-<ts>）。 */
  work_branch: string | null;
  /** 引擎管理的运行期：隔离 worktree 文件系统路径（= CC 实际 cwd）。 */
  worktree_path: string | null;
  /** 计算的 worktree 生命周期状态（仅 detail 端点返回）。 */
  worktree_status?: "active" | "cleaned" | "orphaned" | "none" | null;
  /** 人可读的 worktree 磁盘占用估算（如 "42.3M"）。 */
  worktree_disk_usage?: string | null;
  /** 当前 worktree 自动清理策略。 */
  worktree_cleanup_policy?: "on_success" | "always" | "never" | null;
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
  metrics: RoutineIterationMetrics;
}

/** 迭代级度量快照（JSONB），由后端在分发时写入。 */
export interface RoutineIterationMetrics {
  mcp_servers?: McpServerSnapshot[];
}

/** 分发时快照的 MCP Server 元数据（仅公开信息，不含敏感 transport 配置）。 */
export interface McpServerSnapshot {
  name: string;
  display_name: string | null;
  description: string | null;
  transport_type: string;
  tools: McpToolSnapshot[];
}

/** MCP Server 下已激活的工具元数据。 */
export interface McpToolSnapshot {
  name: string;
  display_name: string | null;
  title: string | null;
  description: string | null;
}

/**
 * 「全过程」动作级审计事件类型：
 * - 执行阶段：system（init）/ system_retry（API 重试，含 401/429）/ assistant（中间消息）/ tool_use（工具调用）/ tool_result（工具结果）/ result（最终产出）
 * - 审阅阶段：plan_review（NegentropyEngine 自动审阅 Plan）
 * - 评估阶段：gate（命令门控）/ evaluation（LLM-as-Judge）
 * - _truncated：动作数超上限的哨兵
 */
export type RoutineEventType =
  | "system"
  | "system_retry"
  | "assistant"
  | "tool_use"
  | "tool_result"
  | "result"
  | "plan_review"
  | "auto_answer"
  | "gate"
  | "evaluation"
  | "perception"
  | "_truncated"
  | "unknown";

/**
 * 多 Agent 归因角色（后端 routine_iteration_events.agent_role）。
 *
 * 与 ``agent-role.ts`` 的 ``AgentRole`` 同集；后端 Phase 2 落地后，前端归一化优先读此字段，
 * 缺失时回退 ``deriveHumanRole`` 语义推导（详见 ADR 040）。
 */
export type EventAgentRole =
  | "engine"
  | "claude_code"
  | "perception"
  | "action"
  | "internalization"
  | "contemplation"
  | "influence";

/** Plan Review 事件的归一化载荷结构。 */
export interface PlanReviewPayload {
  /** Engine 审阅决策：approve（通过）/ refine（需完善）。 */
  verdict: "approve" | "refine";
  /** 审阅评分（0-100）。 */
  score: number;
  /** 各模块逐项评审结果。 */
  module_reviews: Array<{
    module: string;
    status: "pass" | "warn" | "fail";
    comment: string;
  }>;
  /** 给 Claude Code 的反馈文本（refine 时有效）。 */
  feedback: string;
  /** Engine 内部反思。 */
  reflection: string;
  /** 审阅 Prompt（审计用）。 */
  judge_prompt?: string;
  /** LLM 原始响应（审计用）。 */
  judge_raw?: string;
}

/** 单条「全过程」动作审计事件（与后端 ``_serialize_event`` 对齐）。 */
export interface RoutineIterationEventDTO {
  id: string;
  iteration_id: string;
  routine_id: string;
  /** 单迭代内单调递增序号；实时事件与持久化一致，据 (iteration_id, seq) 去重。 */
  seq: number;
  event_type: RoutineEventType;
  tool_name: string | null;
  title: string | null;
  /** 归一化结构化载荷（input/output/text/context/meta；字段截断到 ~16KB）。 */
  payload: Record<string, unknown>;
  cost_usd: number | null;
  /** 多 Agent 归因（Phase 2 后端落地）：产出此事件的 Agent 角色；NULL=未归因（回退前端推导）。 */
  agent_role?: EventAgentRole | null;
  created_at: string | null;
}

export interface IterationEventsResponse {
  items: RoutineIterationEventDTO[];
  has_more: boolean;
  next_after_seq: number | null;
}

/**
 * 实时 ``action`` 事件载荷 —— SSE 推送的动作事件（携带 routine_id/iteration_id/seq + 归一化字段）。
 * 无 ``id``（尚未落库）；``ts`` 为服务端 emit 时刻（ISO 串），合并时回填为在途行的 ``created_at``。
 * 前端据 ``(iteration_id, seq)`` 与持久化事件去重合并。
 */
export interface RoutineActionStreamEvent {
  type: "action";
  routine_id: string;
  iteration_id: string;
  seq: number;
  event_type: RoutineEventType;
  tool_name?: string | null;
  title?: string | null;
  payload?: Record<string, unknown>;
  cost_usd?: number | null;
  /** 服务端 emit 时刻（ISO 8601）；持久化前的实时行据此显示时间戳。 */
  ts?: string | null;
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
  /** 当前筛选下的全量计数（后端 COUNT）；旧后端可能缺省。 */
  total?: number;
}

export interface IterationListResponse {
  items: RoutineIterationDTO[];
  has_more: boolean;
  next_before_seq: number | null;
  /** 该 routine 的迭代全量计数（后端 COUNT）；旧后端可能缺省。 */
  total?: number;
}

export interface RoutineFilters {
  status: RoutineStatus | null;
  q: string;
  is_template?: boolean | null;
  source_task_key?: string | null;
}

/** 创建请求体 */
export interface RoutineCreatePayload {
  key: string;
  title: string;
  goal: string;
  acceptance_criteria: string;
  cwd?: string | null;
  baseline_branch?: string | null;
  /** 关联已注册 Repository（单一事实源指针）；选定后后端派生 cwd/baseline，二者可留空。 */
  repository_id?: string | null;
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

/** SSE 事件（routine 状态 / iteration 生命周期 / action 动作级实时） */
export interface RoutineStreamEvent {
  type: "routine" | "iteration" | "action";
  id?: string;
  routine_id?: string;
  iteration_id?: string;
  status?: string;
  seq?: number;
  event_type?: RoutineEventType;
  [key: string]: unknown;
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
