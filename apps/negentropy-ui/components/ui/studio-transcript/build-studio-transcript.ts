/**
 * Studio 中栏对话 → 共享 ``TranscriptItem[]`` 适配器。
 *
 * 消费 ``buildChatDisplayBlocks`` 的输出（``ChatDisplayBlock[]``）——复用 Studio 既有的 turn/工具
 * 分组、6 层去重、ISSUE-070 时钟漂移排序、reasoning/agent-transfer 处理（~1000 行），**不重新排序**，
 * 仅按下表做展示模型映射，末尾经共享 ``collapseToolRuns`` 折叠 ≥3 连续工具。
 *
 * 语义：人 = 真实用户（``user``，居右）；机 = 一核五翼 + Claude Code（带 ``role``，居左）。
 * ``role`` 由 ``message.author`` 经 ``agentRoleFromAuthor`` 派生；徽章渲染交 ``STUDIO_POLICY`` 分组处理。
 */

import { collapseToolRuns, type TranscriptItem } from "@/components/transcript";
import { agentRoleFromAuthor, type AgentRole } from "@/features/agent-identity";
import { extractCitationsFromToolCalls } from "@/utils/citation-parser";
import type { Citation, ToolProgressMap } from "@/types/common";
import type { ChatDisplayBlock, ToolExecutionEntry } from "@/types/a2ui";

/** 工具入参 JSON 串 → 对象（兜底空对象，避免 derive-tool-detail 退化为 generic{input:string}）。 */
function parseToolInput(args: string | undefined): unknown {
  if (!args) return undefined;
  try {
    const parsed = JSON.parse(args);
    return typeof parsed === "object" && parsed !== null ? parsed : { value: parsed };
  } catch {
    return undefined;
  }
}

/** 取 assistant-reply 块的引用尾注：优先用已聚合的 message.citations，否则从 toolCalls 重提。 */
function replyCitations(message: {
  citations?: Citation[];
  toolCalls?: Array<{ result?: string }>;
}): Citation[] | undefined {
  if (message.citations && message.citations.length > 0) return message.citations;
  const extracted = extractCitationsFromToolCalls(
    message.toolCalls as Parameters<typeof extractCitationsFromToolCalls>[0],
  );
  return extracted.length > 0 ? extracted : undefined;
}

/** 单个工具 → tool TranscriptItem。 */
function toolItem(
  tool: ToolExecutionEntry,
  role: AgentRole,
  progressMap: ToolProgressMap | undefined,
  seq: number,
): Extract<TranscriptItem, { kind: "tool" }> {
  return {
    kind: "tool",
    seq,
    id: tool.id,
    toolName: tool.rawName || tool.name,
    title: null,
    input: parseToolInput(tool.args),
    output: tool.result ?? null,
    isError: tool.status === "error",
    running: tool.status === "running",
    taskStatus: null,
    role,
    progress: progressMap?.[tool.id] ?? null,
    nodeId: tool.nodeId,
  };
}

export interface BuildStudioTranscriptOptions {
  /** 工具流式进度旁路（state_delta 推送的 ``state.tool_progress[tool_call_id]``）。 */
  progressMap?: ToolProgressMap;
}

/**
 * ``ChatDisplayBlock[]`` → ``TranscriptItem[]``。保序映射，末尾折叠 ≥3 连续工具。
 * 空 → ``[]``（空态由调用方 ``StudioTranscript`` 处理）。
 */
export function buildStudioTranscript(
  blocks: ChatDisplayBlock[],
  opts: BuildStudioTranscriptOptions = {},
): TranscriptItem[] {
  const progressMap = opts.progressMap;
  const raw: TranscriptItem[] = [];
  let seq = 0;
  const nextSeq = () => seq++;

  for (const block of blocks) {
    switch (block.kind) {
      case "message": {
        const role = block.message.role;
        if (role === "user") {
          raw.push({
            kind: "user",
            seq: nextSeq(),
            id: block.message.id || block.id,
            text: block.message.content || "",
            streaming: block.message.streaming,
            nodeId: block.nodeId,
          });
        } else if (role === "assistant") {
          raw.push({
            kind: "assistant",
            seq: nextSeq(),
            id: block.message.id || block.id,
            text: block.message.content || "",
            thinking: false,
            streaming: block.message.streaming,
            role: agentRoleFromAuthor(block.message.author),
            nodeId: block.nodeId,
          });
        } else {
          // system / developer / tool —— 紧凑系统行
          raw.push({
            kind: "system_note",
            seq: nextSeq(),
            id: block.id,
            text: block.message.content || "",
            nodeId: block.nodeId,
          });
        }
        break;
      }

      case "assistant-reply": {
        const role = agentRoleFromAuthor(block.message.author);
        const citations = replyCitations(block.message);
        let citationsAttached = false;
        for (const segment of block.segments) {
          switch (segment.kind) {
            case "text": {
              const text = segment.content || "";
              if (!text.trim()) break; // 跳过空文本段
              raw.push({
                kind: "assistant",
                seq: nextSeq(),
                id: segment.id,
                text,
                thinking: false,
                streaming: segment.streaming,
                role,
                citations: !citationsAttached && citations?.length ? citations : undefined,
                nodeId: segment.nodeId,
              });
              citationsAttached = true;
              break;
            }
            case "reasoning": {
              const text = (segment.content ?? segment.title ?? "").trim();
              if (!text) break;
              raw.push({
                kind: "assistant",
                seq: nextSeq(),
                id: segment.id,
                text,
                thinking: true,
                role,
                nodeId: segment.nodeId,
              });
              break;
            }
            case "tool-group": {
              for (const tool of segment.tools) {
                raw.push(toolItem(tool, role, progressMap, nextSeq()));
              }
              break;
            }
            case "agent-transfer": {
              // 转交标记：紧凑系统行；后续子 agent 回复自带新 role 徽章
              raw.push({
                kind: "system_note",
                seq: nextSeq(),
                id: segment.id,
                text: `委派至 ${segment.toAgent}`,
                nodeId: segment.nodeId,
              });
              break;
            }
            case "error": {
              const text = [segment.title, segment.message].filter(Boolean).join("\n\n");
              if (!text) break;
              raw.push({
                kind: "assistant",
                seq: nextSeq(),
                id: segment.id,
                text,
                thinking: false,
                role,
                nodeId: segment.nodeId,
              });
              break;
            }
          }
        }
        break;
      }

      case "tool-group": {
        // 顶层 tool-group 块无父消息 author，工具默认归因 claude_code（典型执行者）
        for (const tool of block.tools) {
          raw.push(toolItem(tool, "claude_code", progressMap, nextSeq()));
        }
        break;
      }

      case "error": {
        const text = [block.title, block.message].filter(Boolean).join("\n\n");
        raw.push({
          kind: "assistant",
          seq: nextSeq(),
          id: block.id,
          text: text || "发生错误",
          thinking: false,
          role: "engine",
          nodeId: block.nodeId,
        });
        break;
      }

      case "turn-status": {
        const text = [block.title, block.detail].filter(Boolean).join(" · ");
        if (!text) break;
        raw.push({
          kind: "system_note",
          seq: nextSeq(),
          id: block.id,
          text,
          nodeId: block.nodeId,
        });
        break;
      }

      case "summary": {
        const text = [block.title, ...block.lines].filter(Boolean).join("\n");
        if (!text) break;
        raw.push({
          kind: "system_note",
          seq: nextSeq(),
          id: block.id,
          text,
          nodeId: block.nodeId,
        });
        break;
      }
    }
  }

  return collapseToolRuns(raw);
}
