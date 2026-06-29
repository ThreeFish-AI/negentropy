/**
 * Transcript 视图模型类型（本地，仅服务于渲染层）。
 *
 * 刻意不放入 ``features/routine/types.ts``——后者是「与后端序列化契约对齐」的层，
 * 而这里是由 ``RoutineIterationEventDTO`` 派生的纯展示中间表示（IR），属 UI 关注点。
 * 仿 paseo：``ToolCallDetail`` 判别联合是单一中间表示，displayName/图标/分节渲染皆基于它。
 */

import type { AgentRole, PlanReviewPayload, RoutineIterationEventDTO } from "@/features/routine";

import type { EventGroup, TaskStatus } from "../status-style";

// ---------------------------------------------------------------------------
// 工具调用细节（判别联合）—— 由 (tool_name, input, output) 派生
// ---------------------------------------------------------------------------

/** 单次工具调用的归一化细节，决定展开区如何渲染。 */
export type ToolCallDetail =
  /** Bash / BashOutput：命令 + 输出。 */
  | { type: "shell"; command: string; output: string | null; isError: boolean }
  /** Read：读取的文件路径 + 内容。 */
  | { type: "read"; filePath: string; content: string | null }
  /** Edit / MultiEdit / NotebookEdit：路径 + 一组 old→new 替换。 */
  | { type: "edit"; filePath: string; edits: Array<{ oldString: string | null; newString: string | null }>; output: string | null }
  /** Write：写入的文件路径 + 内容。 */
  | { type: "write"; filePath: string; content: string | null }
  /** Grep / Glob / WebSearch：查询串 + 命中输出。 */
  | { type: "search"; query: string; output: string | null }
  /** WebFetch：URL + 抓取结果。 */
  | { type: "fetch"; url: string; output: string | null }
  /** Task / TaskCreate / TaskUpdate：子代理/任务描述 + 子代理类型 + 输出。 */
  | { type: "sub_agent"; description: string | null; subagentType: string | null; output: string | null }
  /** ExitPlanMode：规划文本。 */
  | { type: "plan"; text: string }
  /** 兜底（含 mcp__* 及未知工具）：原始 input + output。 */
  | { type: "generic"; input: unknown; output: string | null };

// ---------------------------------------------------------------------------
// 转录项（扁平流的单元）
// ---------------------------------------------------------------------------

/** CC 向「人」提交的请求类型（machine → human）。 */
export type CcRequestMode =
  /** ExitPlanMode：退出 plan 模式，提交规划文本等待批准。 */
  | "exit_plan"
  /** AskUserQuestion（开放式 / 命中审阅关键词）：提交方案等待 Review。 */
  | "plan_submit"
  /** AskUserQuestion（结构化选项）：澄清问题等待回答。 */
  | "question";

/** 「人」（6 Agent）对 CC 的应答类型（human → machine）。 */
export type HumanReplyMode =
  /** Plan 审阅通过。 */
  | "approve_plan"
  /** Plan 审阅需完善（refine）。 */
  | "refine_plan"
  /** 回答结构化问题。 */
  | "answer_question"
  /** 批准退出 plan 模式。 */
  | "approve_exit"
  /** 拒绝工具调用（PreToolUse deny）。 */
  | "deny_tool";

/**
 * 一条转录项：人机对话流的单元。
 *
 * - 机（Claude Code）侧：``assistant`` 文本 / ``tool`` 调用 / ``tool_summary`` 折叠 / ``cc_request`` 提交。
 * - 人（一核五翼 6 Agent）侧：``human_reply`` 应答。
 * - 其余：``engine``（编排产出 gate/evaluation/result）/ ``system`` / ``truncated``。
 */
export type TranscriptItem =
  | { kind: "assistant"; seq: number; id: string; text: string; thinking: boolean }
  | {
      kind: "tool";
      seq: number;
      id: string;
      toolName: string;
      title: string | null;
      input: unknown;
      output: string | null;
      isError: boolean;
      /** tool_use 无配对 tool_result 且处于在途实时态 → 仍在运行。 */
      running: boolean;
      taskStatus: TaskStatus | null;
    }
  /** 连续 ≥3 个工具调用折叠为 summary 行（Conductor 范式），可展开还原。 */
  | {
      kind: "tool_summary";
      seq: number;
      id: string;
      count: number;
      /** 去重后的工具显示名集合。 */
      toolNames: string[];
      collapsed: Extract<TranscriptItem, { kind: "tool" }>[];
    }
  /** machine → human：CC 通过 ExitPlanMode / AskUserQuestion 向「人」提交 Plan / 问题，等待裁决。 */
  | {
      kind: "cc_request";
      seq: number;
      id: string;
      mode: CcRequestMode;
      toolName: string;
      toolUseId: string | null;
      /** 提交正文：ExitPlanMode 的规划文本 / AskUserQuestion 的问题列表。 */
      body: { text?: string; questions?: unknown[] };
      /** 无配对「人」应答且处于在途实时态 → 等待中。 */
      pending: boolean;
    }
  /** human → machine：「人」（6 Agent）对 CC 的应答；role 标识扮演该动作的 Agent。 */
  | {
      kind: "human_reply";
      seq: number;
      id: string;
      mode: HumanReplyMode;
      /** 应答正文（answer_preview / feedback / deny reason）。 */
      text: string | null;
      /** 结构化审阅载荷（plan_review 来路有值，供 PlanReviewBody 复用渲染）。 */
      review?: PlanReviewPayload;
      /** 扮演此动作的 Agent 角色（Phase 1 前端推导；Phase 2 读后端 agent_role）。 */
      role: AgentRole;
      /** 配对的 CC 提交 seq（hook 模式无法精确配对时为 null）。 */
      requestSeq: number | null;
    }
  | { kind: "engine"; seq: number; id: string; event: RoutineIterationEventDTO; group: EventGroup }
  | { kind: "system"; seq: number; id: string; event: RoutineIterationEventDTO }
  | { kind: "truncated"; seq: number; id: string; title: string | null };
