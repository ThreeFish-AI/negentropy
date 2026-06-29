/**
 * 机制层（人机回合归一化的纯函数缝）：识别 CC 向「人」提交的请求、提取提交正文。
 *
 * CC 通过 ``ExitPlanMode`` / ``AskUserQuestion`` 两类 tool_use 向「人」（一核五翼 6 Agent）
 * 提交 Plan / 问题。本文件镜像后端 ``engine/claude_code/service.py`` 的判别逻辑，使前端能
 * 把这两类 tool_use 升格为 ``cc_request`` 节点（machine → human），与后端口径一致。
 *
 * ⚠️ 关键词表与判据须与后端 ``ClaudeCodeService._is_plan_review_question`` /
 * ``_extract_plan_from_input`` 保持同源——两端漂移会导致前端把 ``question`` 误判为
 * ``plan_submit``。修改时请同步两处。
 */

import type { CcRequestMode } from "./types";

/**
 * Plan Review 问题识别关键词。
 *
 * 同源：``service.py`` 的 ``ClaudeCodeService._PLAN_REVIEW_KEYWORDS``。
 */
const PLAN_REVIEW_KEYWORDS = ["审阅", "review", "plan", "方案", "计划", "approve", "refine", "完善"];

/** 安全取对象。 */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * 判断 AskUserQuestion 是否属于「提交 Plan 等待审阅」（vs 结构化选项问题）。
 *
 * 同源：``service.py`` 的 ``ClaudeCodeService._is_plan_review_question``。判据：
 * 1. 无任何 question 带 options → 开放式问答，视为 Plan 提交；
 * 2. 首个 question 文本命中 ``PLAN_REVIEW_KEYWORDS`` → 明确的审阅请求；
 * 3. 否则 → 结构化选项问题。
 */
export function isPlanReviewQuestion(input: unknown): boolean {
  const inp = asRecord(input);
  const questions = inp.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return true; // 无问题内容，默认走 plan review
  }
  // 判据 1：没有任何 question 带 options
  const hasAnyOptions = questions.some((q) => {
    const opts = asRecord(q).options;
    return Array.isArray(opts) && opts.length > 0;
  });
  if (!hasAnyOptions) return true; // 开放式问题 → Plan 提交
  // 判据 2：首个 question 文本命中审阅关键词
  const firstQ = asRecord(questions[0]);
  const qText = (typeof firstQ.question === "string" ? firstQ.question : "").toLowerCase();
  return PLAN_REVIEW_KEYWORDS.some((kw) => qText.includes(kw));
}

/**
 * 判定 CC 提交请求的 mode：``exit_plan`` / ``plan_submit`` / ``question``。
 *
 * @param toolName tool_use 的工具名（ExitPlanMode / AskUserQuestion）
 * @param input    tool_use 的 payload.input
 */
export function deriveCcRequestMode(toolName: string, input: unknown): CcRequestMode {
  const name = (toolName || "").toLowerCase();
  if (name === "exitplanmode") return "exit_plan";
  // AskUserQuestion
  return isPlanReviewQuestion(input) ? "plan_submit" : "question";
}

/**
 * 从 CC 提交请求的 input 提取正文（供 ``cc_request.body`` 渲染）。
 *
 * - ExitPlanMode：取 ``plan`` 字段为 text。
 * - AskUserQuestion：取 ``questions`` 数组；若整体即一段开放式方案，亦保留 questions 供渲染。
 *
 * 镜像后端 ``_extract_plan_from_input`` 的字段优先级（plan > questions[].question/header）。
 */
export function extractRequestBody(input: unknown): { text?: string; questions?: unknown[] } {
  const inp = asRecord(input);
  const plan = inp.plan;
  if (typeof plan === "string" && plan.trim()) {
    return { text: plan.trim() };
  }
  const questions = inp.questions;
  if (Array.isArray(questions) && questions.length > 0) {
    return { questions };
  }
  return {};
}

/** 该 tool_use 是否为「CC 向人提交」类（ExitPlanMode / AskUserQuestion）。 */
export function isCcRequestTool(toolName: string | null | undefined): boolean {
  const name = (toolName || "").toLowerCase();
  return name === "exitplanmode" || name === "askuserquestion";
}
