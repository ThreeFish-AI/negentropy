/**
 * 机制层：把扁平的 ``RoutineIterationEventDTO[]`` 折叠为 ``TranscriptItem[]``。
 *
 * - 先建 ``Map<tool_use_id, tool_result>``，再单遍发射：``tool_use`` 取配对 result 的
 *   output/is_error；无配对且处于在途实时态 → ``running``。``tool_result`` 自身被消费，不再单独发射。
 * - 空 assistant（仅 ``{raw}``，无 text）丢弃，避免空气泡。
 * - 人机回合（machine ↔ human）：
 *   - CC 的 ``ExitPlanMode`` / ``AskUserQuestion`` tool_use 升格为 ``cc_request``（machine → human）；
 *   - Engine 的 ``plan_review`` 事件 + ``system/auto_answer`` 事件升格为 ``human_reply``（human → machine），
 *     按动作语义投射到一核五翼角色（``deriveHumanRole``）。
 *   - 配对：``auto_answer`` 类用 ``tool_use_id`` 精确配对；``plan_review`` 类用就近 seq 配对
 *     （hook 模式下 plan_review 不携 tool_use_id）。
 * - Engine 事件（gate/evaluation/result）原样携带，交 EngineMessageBlock 渲染。
 * - 配对键：``tool_use.payload.tool_id === tool_result.payload.tool_use_id``。
 */

import { deriveHumanRole } from "@/features/routine";
import type { PlanReviewPayload, RoutineIterationEventDTO } from "@/features/routine";

import { deriveTaskStatus, eventGroup } from "../status-style";
import { deriveCcRequestMode, extractRequestBody, isCcRequestTool } from "./human-node";
import { unwrapText } from "./payload-util";
import type { HumanReplyMode, TranscriptItem } from "./types";

/**
 * 提取 auto_answer 事件的归一化字段（tool_use_id / tool_name / answer）。
 *
 * 兼容两种后端形态：
 * - Phase 2 起：一等 ``event_type==="auto_answer"``，字段在 payload 顶层（含全文 answer）；
 * - Phase 2 前（旧数据）：``event_type==="system"`` + ``title==="auto_answer"``，字段嵌在 payload.raw。
 */
function autoAnswerRaw(ev: RoutineIterationEventDTO): Record<string, unknown> | null {
  // 新形态：一等 auto_answer 事件
  if (ev.event_type === "auto_answer") {
    return ev.payload ?? null;
  }
  // 旧形态：system + title=auto_answer + payload.raw（防御性兜底）
  if (ev.event_type === "system" && ev.title === "auto_answer") {
    const raw = ev.payload?.raw;
    if (typeof raw === "object" && raw !== null) return raw as Record<string, unknown>;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function normalizeTranscript(
  events: RoutineIterationEventDTO[],
  opts: { live: boolean },
): TranscriptItem[] {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);

  // 预扫 1：tool_use_id → tool_result 事件
  const resultByToolId = new Map<string, RoutineIterationEventDTO>();
  // 预扫 2：tool_use_id → auto_answer 事件（exit_plan 批准 / question 回答的「人」侧应答）
  const autoAnswerByToolId = new Map<string, RoutineIterationEventDTO>();
  // 预扫 3：plan_review 事件总数——plan_submit 用就近 seq 配对，据此判定末尾未应答的 plan_submit。
  let planReviewCount = 0;
  for (const ev of sorted) {
    if (ev.event_type === "tool_result") {
      const id = ev.payload?.tool_use_id;
      if (typeof id === "string") resultByToolId.set(id, ev);
    } else if (ev.event_type === "plan_review") {
      planReviewCount += 1;
    } else {
      const raw = autoAnswerRaw(ev);
      const id = raw?.tool_use_id;
      if (typeof id === "string") autoAnswerByToolId.set(id, ev);
    }
  }

  // 就近 seq 配对：记录最近一个未配对的 plan_submit cc_request 的 seq（栈，支持多轮）。
  const pendingPlanSubmitSeq: number[] = [];
  // plan_submit 的序号（第几个）——超过 plan_review 总数者即末尾未应答（in-flight）。
  let planSubmitOrdinal = 0;

  const items: TranscriptItem[] = [];
  for (const ev of sorted) {
    switch (ev.event_type) {
      case "tool_result":
        continue; // 已被对应 tool_use 消费

      case "assistant": {
        const text = typeof ev.payload?.text === "string" ? ev.payload.text : "";
        if (!text.trim()) continue; // 空 / 仅 raw → 丢弃
        items.push({ kind: "assistant", seq: ev.seq, id: ev.id, text, thinking: ev.title === "thinking" });
        break;
      }

      case "tool_use": {
        // CC 向「人」提交 Plan / 问题（ExitPlanMode / AskUserQuestion）→ 升格 cc_request
        if (isCcRequestTool(ev.tool_name)) {
          const toolId = typeof ev.payload?.tool_id === "string" ? (ev.payload.tool_id as string) : null;
          const mode = deriveCcRequestMode(ev.tool_name ?? "", ev.payload?.input);
          // pending 判定：
          // - plan_submit：本次是第 N 个 plan_submit，若 N > plan_review 总数则尚无对应审阅（in-flight）；
          // - exit_plan / question：按 tool_use_id 在 auto_answer 预扫表中探测有无应答。
          let pending = false;
          if (mode === "plan_submit") {
            planSubmitOrdinal += 1;
            pendingPlanSubmitSeq.push(ev.seq);
            pending = planSubmitOrdinal > planReviewCount && opts.live;
          } else {
            const hasReply = toolId ? autoAnswerByToolId.has(toolId) : false;
            pending = !hasReply && opts.live;
          }
          items.push({
            kind: "cc_request",
            seq: ev.seq,
            id: ev.id,
            mode,
            toolName: ev.tool_name ?? "",
            toolUseId: toolId,
            body: extractRequestBody(ev.payload?.input),
            pending,
          });
          break;
        }
        // 普通工具调用
        const toolId = typeof ev.payload?.tool_id === "string" ? (ev.payload.tool_id as string) : null;
        const result = toolId ? resultByToolId.get(toolId) : undefined;
        const output = result ? unwrapText(result.payload?.output) : null;
        const isError = result ? result.payload?.is_error === true : false;
        items.push({
          kind: "tool",
          seq: ev.seq,
          id: ev.id,
          toolName: ev.tool_name ?? "",
          title: ev.title,
          input: ev.payload?.input,
          output,
          isError,
          running: !result && opts.live,
          taskStatus: deriveTaskStatus(ev),
        });
        break;
      }

      case "plan_review": {
        // Engine（元神）对 CC 提交方案的审阅 → human_reply（approve/refine）
        const review = ev.payload as unknown as PlanReviewPayload;
        const mode: HumanReplyMode = review?.verdict === "approve" ? "approve_plan" : "refine_plan";
        items.push({
          kind: "human_reply",
          seq: ev.seq,
          id: ev.id,
          mode,
          text: typeof review?.feedback === "string" && review.feedback ? review.feedback : null,
          review,
          // Phase 2 优先读后端归因，缺失回退前端语义投射（详见 ADR 040）
          role: ev.agent_role ?? deriveHumanRole("plan_review"),
          requestSeq: pendingPlanSubmitSeq.shift() ?? null, // 就近配对最早未应答的 plan_submit
        });
        break;
      }

      case "gate":
      case "evaluation":
      case "result":
        items.push({ kind: "engine", seq: ev.seq, id: ev.id, event: ev, group: eventGroup(ev.event_type) });
        break;

      case "_truncated":
        items.push({ kind: "truncated", seq: ev.seq, id: ev.id, title: ev.title });
        break;

      default: {
        // system/auto_answer → 「人」侧应答（本心答问 / 元神批准退出）
        const raw = autoAnswerRaw(ev);
        if (raw) {
          const toolName = typeof raw.tool_name === "string" ? raw.tool_name : "";
          // ExitPlanMode 的 auto_answer 是「批准退出」；AskUserQuestion 的是「回答问题」
          const isExitPlan = toolName.toLowerCase() === "exitplanmode";
          const mode: HumanReplyMode = isExitPlan ? "approve_exit" : "answer_question";
          // 优先全文 answer（Phase 2 去截断），回退 answer_preview（旧数据）
          const answer =
            typeof raw.answer === "string" && raw.answer
              ? raw.answer
              : typeof raw.answer_preview === "string"
                ? raw.answer_preview
                : null;
          const toolUseId = typeof raw.tool_use_id === "string" ? raw.tool_use_id : null;
          // 反查配对的 cc_request seq
          const reqItem = toolUseId
            ? items.find((it) => it.kind === "cc_request" && it.toolUseId === toolUseId)
            : undefined;
          const action = isExitPlan ? "approve_exit" : "answer_question";
          items.push({
            kind: "human_reply",
            seq: ev.seq,
            id: ev.id,
            mode,
            text: answer,
            // Phase 2 优先读后端归因，缺失回退前端语义投射
            role: ev.agent_role ?? deriveHumanRole(action),
            requestSeq: reqItem && reqItem.kind === "cc_request" ? reqItem.seq : null,
          });
          break;
        }
        // system / system_retry / system_compact / unknown 等
        items.push({ kind: "system", seq: ev.seq, id: ev.id, event: ev });
        break;
      }
    }
  }

  return collapseToolRuns(items);
}

/**
 * 连续 ≥3 个工具调用折叠为 ``tool_summary`` 行（Conductor 范式）：减少工具刷屏。
 *
 * - 仅折叠**连续**的 ``tool`` 项（被任何非 tool 项打断即 flush）；
 * - < 3 个不折叠，原样保留；
 * - 在途运行中（``running``）的工具不参与折叠，避免折叠实时态。
 */
function collapseToolRuns(items: TranscriptItem[]): TranscriptItem[] {
  const out: TranscriptItem[] = [];
  let run: Extract<TranscriptItem, { kind: "tool" }>[] = [];

  const flush = () => {
    if (run.length === 0) return;
    if (run.length < 3) {
      out.push(...run);
    } else {
      const toolNames = [...new Set(run.map((t) => t.toolName).filter(Boolean))];
      const first = run[0];
      out.push({
        kind: "tool_summary",
        seq: first.seq,
        id: `tool-summary-${first.id}`,
        count: run.length,
        toolNames,
        collapsed: run,
      });
    }
    run = [];
  };

  for (const item of items) {
    if (item.kind === "tool" && !item.running) {
      run.push(item);
    } else {
      flush();
      out.push(item);
    }
  }
  flush();
  return out;
}
