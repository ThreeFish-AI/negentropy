import { EventType } from "@ag-ui/core";
import type {
  AssistantReplyDisplayBlock,
  AssistantReplyDisplaySegment,
  ChatDisplayBlock,
  ConversationNode,
  ConversationTree,
  ReplyErrorDisplaySegment,
  ReplyReasoningDisplaySegment,
  ReplyTextDisplaySegment,
  ReplyToolGroupDisplaySegment,
  ToolExecutionEntry,
  ToolGroupDisplayBlock,
} from "@/types/a2ui";
import type { ChatMessage, ToolCallStatus } from "@/types/common";
import { buildNodeSummary, safeJsonParse } from "@/utils/conversation-summary";
import { isNonCriticalError } from "@/utils/error-filter";
import {
  bigramJaccardSimilarity,
  isEquivalentMessageContent,
} from "@/utils/message";

const displayBlockTypeOrder: Record<ChatDisplayBlock["kind"], number> = {
  message: 0,
  "assistant-reply": 1,
  "tool-group": 2,
  error: 3,
  "turn-status": 4,
  summary: 5,
};

function formatToolName(name: string): string {
  const toolNameMap: Record<string, string> = {
    google_search: "Google Search",
    web_search: "Web Search",
    code_interpreter: "Code Interpreter",
    "ui.confirmation": "Confirmation",
  };
  return (
    toolNameMap[name] ||
    name.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function getToolResultNode(toolNode: ConversationNode): ConversationNode | undefined {
  return toolNode.children.find((child) => child.type === "tool-result");
}

function getToolStatus(toolNode: ConversationNode): ToolCallStatus {
  const resultNode = getToolResultNode(toolNode);
  if (toolNode.status === "error" || resultNode?.status === "error") {
    return "error";
  }
  if (resultNode) {
    return "completed";
  }
  if (toolNode.status === "done") {
    return "done";
  }
  return "running";
}

function getToolSummary(toolNode: ConversationNode, resultNode?: ConversationNode): string[] {
  const args = safeJsonParse(toolNode.payload.args);
  const result = resultNode ? safeJsonParse(resultNode.payload.content) : null;
  const lines: string[] = [];

  if (typeof args === "object" && args !== null && !Array.isArray(args)) {
    const argsRecord = args as Record<string, unknown>;
    const query =
      typeof argsRecord.q === "string"
        ? argsRecord.q
        : typeof argsRecord.query === "string"
          ? argsRecord.query
          : null;
    if (query) {
      lines.push(`查询: ${query}`);
    }
    if (lines.length === 0) {
      const keys = Object.keys(argsRecord).slice(0, 3);
      if (keys.length > 0) {
        lines.push(`参数: ${keys.join("、")}`);
      }
    }
  } else if (typeof args === "string" && args.trim()) {
    lines.push(args.trim().slice(0, 80));
  }

  if (typeof result === "object" && result !== null && !Array.isArray(result)) {
    const resultRecord = result as Record<string, unknown>;
    const items =
      Array.isArray(resultRecord.items) ? resultRecord.items :
      Array.isArray(resultRecord.results) ? resultRecord.results :
      null;
    if (items) {
      lines.push(`结果 ${items.length} 条`);
    } else if (typeof resultRecord.status === "string") {
      lines.push(`状态: ${resultRecord.status}`);
    } else {
      lines.push(`${Object.keys(resultRecord).length} 个字段`);
    }
  } else if (typeof result === "string" && result.trim()) {
    lines.push(result.trim().slice(0, 80));
  }

  return lines.slice(0, 2);
}

function createToolEntry(toolNode: ConversationNode): ToolExecutionEntry {
  const resultNode = getToolResultNode(toolNode);
  const name = String(toolNode.payload.toolCallName || toolNode.title || "工具调用");
  return {
    id: toolNode.toolCallId || toolNode.id,
    nodeId: toolNode.id,
    resultNodeId: resultNode?.id,
    name: formatToolName(name),
    args: String(toolNode.payload.args || ""),
    result:
      typeof resultNode?.payload.content === "string"
        ? String(resultNode.payload.content)
        : undefined,
    status: getToolStatus(toolNode),
    startedAt: toolNode.timeRange.start,
    endedAt: resultNode?.timeRange.end || toolNode.timeRange.end,
    summary: getToolSummary(toolNode, resultNode),
  };
}

function getToolGroupStableId(input: {
  turnId: string;
  anchorNodeId?: string;
  anchorMessageId?: string;
  nodes: ConversationNode[];
}): string {
  const toolIds = input.nodes
    .map((node) => node.toolCallId || node.id)
    .sort()
    .join(":");
  const anchorIdentity =
    input.anchorMessageId || input.anchorNodeId || input.turnId;
  return `tool-group:${anchorIdentity}:${toolIds}`;
}

function getGroupStatus(tools: ToolExecutionEntry[]): ToolCallStatus {
  if (tools.some((tool) => tool.status === "error")) {
    return "error";
  }
  if (tools.some((tool) => tool.status === "running")) {
    return "running";
  }
  if (tools.some((tool) => tool.status === "completed")) {
    return "completed";
  }
  return "done";
}

function createToolGroupBlock(input: {
  turnId: string;
  anchorNodeId?: string;
  anchorMessageId?: string;
  nodes: ConversationNode[];
}): ToolGroupDisplayBlock {
  const tools = input.nodes.map(createToolEntry);
  const status = getGroupStatus(tools);
  const parallel = tools.length > 1;
  const toolNames = [...new Set(tools.map((tool) => tool.name))];
  return {
    id: getToolGroupStableId(input),
    kind: "tool-group",
    nodeId: input.nodes[0]?.id || input.turnId,
    anchorNodeId: input.anchorNodeId,
    anchorMessageId: input.anchorMessageId,
    timestamp: Math.min(...input.nodes.map((node) => node.timeRange.start)),
    sourceOrder: Math.min(...input.nodes.map((node) => node.sourceOrder)),
    parallel,
    defaultExpanded: status === "running" || status === "error",
    status,
    title:
      toolNames.length === 1
        ? parallel
          ? `${toolNames[0]} 并行执行`
          : toolNames[0]
        : `工具并行执行`,
    summary:
      status === "running"
        ? `执行中，${tools.length} 个工具`
        : status === "error"
          ? `执行失败，${tools.length} 个工具`
          : `已完成，${tools.length} 个工具`,
    tools,
  };
}

function createReplyToolGroupSegment(input: {
  turnId: string;
  anchorNodeId?: string;
  anchorMessageId?: string;
  nodes: ConversationNode[];
}): ReplyToolGroupDisplaySegment {
  const block = createToolGroupBlock(input);
  return {
    ...block,
    segmentId: `reply-segment:${block.id}`,
  };
}

function createMessageBlock(node: ConversationNode): ChatDisplayBlock {
  const message: ChatMessage = {
    id: node.messageId || node.id,
    role:
      node.role === "user"
        ? "user"
        : node.role === "system"
          ? "system"
          : "assistant",
    content: String(node.payload.content || ""),
    author:
      typeof node.payload.author === "string"
        ? String(node.payload.author)
        : undefined,
    timestamp: node.timestamp,
    runId: node.runId,
    threadId: node.threadId,
    streaming:
      typeof node.payload.streaming === "boolean"
        ? node.payload.streaming
        : node.sourceEventTypes.includes(String(EventType.TEXT_MESSAGE_CONTENT)) &&
          !node.sourceEventTypes.includes(String(EventType.TEXT_MESSAGE_END)),
  };

  return {
    id: `display-message:${node.id}`,
    kind: "message",
    nodeId: node.id,
    timestamp: node.timeRange.start,
    sourceOrder: node.sourceOrder,
    message,
  };
}

function createReplyTextSegment(node: ConversationNode): ReplyTextDisplaySegment | null {
  const content = String(node.payload.content || "");
  if (!content.trim()) {
    return null;
  }
  return {
    id: `reply-text:${node.id}`,
    kind: "text",
    nodeId: node.id,
    timestamp: node.timeRange.start,
    sourceOrder: node.sourceOrder,
    content,
    streaming:
      typeof node.payload.streaming === "boolean"
        ? node.payload.streaming
        : node.sourceEventTypes.includes(String(EventType.TEXT_MESSAGE_CONTENT)) &&
          !node.sourceEventTypes.includes(String(EventType.TEXT_MESSAGE_END)),
  };
}

function createErrorBlock(node: ConversationNode): ChatDisplayBlock {
  return {
    id: `display-error:${node.id}`,
    kind: "error",
    nodeId: node.id,
    timestamp: node.timeRange.start,
    sourceOrder: node.sourceOrder,
    title: node.title,
    message: String(node.payload.message || "运行失败"),
    code:
      typeof node.payload.code === "string"
        ? String(node.payload.code)
        : undefined,
  };
}

function createReplyErrorSegment(node: ConversationNode): ReplyErrorDisplaySegment {
  return {
    id: `reply-error:${node.id}`,
    kind: "error",
    nodeId: node.id,
    timestamp: node.timeRange.start,
    sourceOrder: node.sourceOrder,
    title: node.title,
    message: String(node.payload.message || "运行失败"),
    code:
      typeof node.payload.code === "string"
        ? String(node.payload.code)
        : undefined,
  };
}

function createReplyReasoningSegment(
  node: ConversationNode,
): ReplyReasoningDisplaySegment {
  return {
    id: `reply-reasoning:${node.id}`,
    kind: "reasoning",
    nodeId: node.id,
    timestamp: node.timeRange.start,
    sourceOrder: node.sourceOrder,
    title: node.title,
    phase: node.status === "done" || node.status === "finished" ? "finished" : "started",
    stepId: String(node.payload.stepId || node.id),
    result: node.payload.result,
  };
}

function collectReasoningSegments(
  stepNode: ConversationNode,
  builder: ReplyBuilder,
) {
  const reasoningChildren = stepNode.children.filter(
    (child) => child.type === "reasoning" && child.visibility !== "debug-only",
  );
  if (reasoningChildren.length > 0) {
    reasoningChildren.forEach((reasoningNode) => {
      appendReplySegment(builder, createReplyReasoningSegment(reasoningNode));
    });
  } else {
    appendReplySegment(builder, createReplyReasoningSegment(stepNode));
  }
}

function createSummaryBlock(node: ConversationNode): ChatDisplayBlock {
  return {
    id: `display-summary:${node.id}`,
    kind: "summary",
    nodeId: node.id,
    timestamp: node.timeRange.start,
    sourceOrder: node.sourceOrder,
    title: node.title,
    lines: buildNodeSummary(node),
  };
}

type ReplyBuilder = {
  turnId: string;
  anchorNodeId: string;
  anchorMessageId?: string;
  threadId: string;
  runId?: string;
  author?: string;
  timestamp: number;
  sourceOrder: number;
  segments: AssistantReplyDisplaySegment[];
  textParts: string[];
};

function createReplyBuilder(node: ConversationNode, turnId: string): ReplyBuilder {
  return {
    turnId,
    anchorNodeId: node.id,
    anchorMessageId: node.messageId,
    threadId: node.threadId,
    runId: node.runId,
    author:
      typeof node.payload.author === "string"
        ? String(node.payload.author)
        : undefined,
    timestamp: node.timeRange.start,
    sourceOrder: node.sourceOrder,
    segments: [],
    textParts: [],
  };
}

function appendReplySegment(builder: ReplyBuilder, segment: AssistantReplyDisplaySegment) {
  // Reasoning segment 去重（按 stepId 维度，覆盖以下两种回归场景，详见 docs/issue.md ISSUE-053）：
  //   场景 A — collectReasoningSegments fallback：step 自身被当作 reasoning + step 含 reasoning 子节点
  //           （id 相同，由 nodeId 衍生）
  //   场景 B — 同一 stepId 下 step 节点 + reasoning 子节点 nodeId 不同（id 不同但 stepId 相同）
  //           触发条件：B 实机 hydration 中 ConversationTree 把 step 与其 reasoning child 都生成节点。
  // 旧实现只比较 segment.id，对场景 B 漏判 → 视觉上"思考完成 · 推理阶段"渲染 2 次。
  // 修复：以 stepId 为权威键，完全相同 stepId 视为同一推理段，保留 phase=finished 优先（更晚的 step 终态）。
  if (segment.kind === "reasoning") {
    // 三层等价判定（自上而下，命中即视为重复，丢弃 incoming 或以 finished 覆盖 started）：
    //   L1 — 完全相同 segment.id（场景 A：collectReasoningSegments fallback）
    //   L2 — 相同 stepId（场景 B：step 节点 + 其 reasoning 子节点 nodeId 不同但 stepId 相同）
    //   L3 — 同 phase 下相同 title（场景 C：实机 hydration 把 step 节点与 synth-step
    //         投影成两份 reasoning，nodeId/stepId 都不同但语义相同 — "思考完成 · 推理阶段" 渲染 2 次）
    const dupIdx = builder.segments.findIndex((existing) => {
      if (existing.kind !== "reasoning") return false;
      if (existing.id === segment.id) return true; // L1
      if (existing.stepId && existing.stepId === segment.stepId) return true; // L2
      if (
        existing.title &&
        existing.title === segment.title &&
        existing.phase === segment.phase
      )
        return true; // L3
      return false;
    });
    if (dupIdx >= 0) {
      const existing = builder.segments[dupIdx] as typeof segment;
      const incomingFinished = segment.phase === "finished";
      const existingFinished = existing.phase === "finished";
      if (incomingFinished && !existingFinished) {
        builder.segments[dupIdx] = segment;
      }
      return;
    }
  }
  builder.segments.push(segment);
  builder.timestamp = Math.min(builder.timestamp, segment.timestamp);
  builder.sourceOrder = Math.min(builder.sourceOrder, segment.sourceOrder);
  if (segment.kind === "text" && segment.content.trim()) {
    builder.textParts.push(segment.content);
  }
}

const REDUNDANT_TEXT_SIMILARITY_THRESHOLD = 0.5;
const REDUNDANT_TEXT_JACCARD_MIN_LENGTH = 30;

/**
 * ISSUE-049 兜底层：检测「流式累积残缺版 + final 完整版」共存于同一 message 的双内容。
 *
 * 触发场景：流式期间 ledger 累积出残缺中间态（"Hello, test1234"，无空格、缺字），
 * hydration / final 事件到达后又携带完整正确版（"Hello, test 1234..."），但 message-ledger
 * 的 isSemanticEquivalentEntry 因严格前缀检查失败未合并 → conversation-tree 产出两个
 * 独立 ReplyTextDisplaySegment，已有四层判定的相似度 / 长度阈值不能同时命中。
 *
 * 本函数判定双方是否为「同源不同完成度」：
 * 1. 共享 ≥ 80% 字符 multiset（覆盖大量 markdown 段落差异，但能 catch 残缺版 vs 完整版）；
 * 2. 双方 trimmed length ≥ 12（避免误删合理短回复 "Pong!" 之类）；
 * 3. 较长一方至少比较短一方多 1.2x（避免相似但平级的两段被误判为同源）。
 *
 * 命中后丢弃较短一方（保留更完备的最终版本）。
 */
const STREAMING_DUPLICATE_MULTISET_RATIO = 0.8;
const STREAMING_DUPLICATE_MIN_LENGTH = 12;
// 1.15 而非 1.2：实测 ISSUE-049 残缺版与 final 版长度比约 1.18（参见 chat-display.test.ts
// 真实场景测试），1.2 阈值会漏检。multiset coverage 0.8 + min length 12 已构成主要防误删
// 屏障，长度比仅作辅助过滤"长度持平但内容大相径庭的两段独立消息"。
const STREAMING_DUPLICATE_LENGTH_RATIO = 1.15;

function characterMultiset(content: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const ch of content) {
    map.set(ch, (map.get(ch) || 0) + 1);
  }
  return map;
}

function multisetCoverage(shorter: string, longer: string): number {
  if (!shorter) return 0;
  const longerCounts = characterMultiset(longer);
  let matched = 0;
  for (const ch of shorter) {
    const remaining = longerCounts.get(ch) || 0;
    if (remaining > 0) {
      longerCounts.set(ch, remaining - 1);
      matched += 1;
    }
  }
  return matched / shorter.length;
}

export function isStreamingDuplicateOfLater(
  earlierContent: string,
  laterContent: string,
): boolean {
  const earlierLen = earlierContent.length;
  const laterLen = laterContent.length;
  if (earlierLen < STREAMING_DUPLICATE_MIN_LENGTH) return false;
  if (laterLen < STREAMING_DUPLICATE_MIN_LENGTH) return false;
  if (laterLen < earlierLen * STREAMING_DUPLICATE_LENGTH_RATIO) return false;
  // 较短一段是否被较长一段以 ≥ 80% multiset 覆盖（流式残缺版的字符几乎都来自 final）。
  const coverage = multisetCoverage(earlierContent, laterContent);
  return coverage >= STREAMING_DUPLICATE_MULTISET_RATIO;
}

/**
 * 折叠同一 assistant-reply 内的「冗余文本片段」，四层判定（自上而下越来越宽松,
 * 也越来越保守，全部命中后丢弃前段，因为工具反馈后的「后段」通常是更完备的最终版本）：
 *
 * 1. **精确匹配**：trim 后两段完全相等 → 丢弃前段（不限长度）。
 *    覆盖典型场景：ADK 双轮 LLM 模式下短回复（如 "Pong!"）被切成两个独立
 *    `TEXT_MESSAGE_*` 序列，messageId 不同但内容字节级相同。
 * 2. **严格前缀**：后段以前段开头（如 "Pong!" → "Pong!\n\n下一步建议..."）→
 *    丢弃前段（不限长度）。覆盖第二轮 LLM 在首轮基础上追加补充信息的场景。
 * 3. **等价内容**：`isEquivalentMessageContent` 命中（含 containment + 长度比 0.8 +
 *    word jaccard 兜底）且双方均 ≥ 30 字 → 丢弃前段。覆盖中等长度的近似但非前缀
 *    场景（如标点/空白差异）。
 * 4. **字符二元组 Jaccard**：双方均 ≥ 30 字且 Jaccard ≥ 0.5 → 丢弃前段。
 *    覆盖「主动导航 prompt 在工具前后各产出一段几乎相同总结」的长回复场景。
 *
 * 工具组（tool-group）等非文本片段的相对顺序原样保留。
 *
 * 这是 UI 层的兜底防御，不修改 conversation tree、不影响 ledger 去重，仅在
 * 渲染阶段消除视觉双气泡。短回复（<30 字）若内容确实不同（如「先查询资料」→
 * 「查询完成」）由于精确/前缀均不命中、等价与 Jaccard 因长度阈值不进入，会被
 * 原样保留，避免误删合理中间消息。
 */
function dedupeRedundantTextSegments(
  segments: AssistantReplyDisplaySegment[],
): AssistantReplyDisplaySegment[] {
  const textIndices = segments
    .map((segment, index) => (segment.kind === "text" ? index : -1))
    .filter((index) => index >= 0);
  if (textIndices.length < 2) {
    return segments;
  }

  const droppedIndices = new Set<number>();
  for (let i = 1; i < textIndices.length; i += 1) {
    const laterIdx = textIndices[i];
    const laterSegment = segments[laterIdx];
    if (laterSegment.kind !== "text") continue;
    const laterContent = laterSegment.content.trim();
    if (!laterContent) continue;

    for (let j = 0; j < i; j += 1) {
      const earlierIdx = textIndices[j];
      if (droppedIndices.has(earlierIdx)) continue;
      const earlierSegment = segments[earlierIdx];
      if (earlierSegment.kind !== "text") continue;
      const earlierContent = earlierSegment.content.trim();
      if (!earlierContent) continue;

      // 四层判定均统一为「丢弃前段」：
      // 在 LLM 双轮（tool 调用前后）产出近似总结的场景下，后段一般是经工具反馈
      // 修正后的最终版本（见 ISSUE-036），保留后段更符合用户预期的「最新答复」。

      // 1. 精确匹配：任何长度都触发。
      if (earlierContent === laterContent) {
        droppedIndices.add(earlierIdx);
        continue;
      }

      // 2. 严格前缀关系：后段以前段为开头（如 "Pong!" → "Pong!\n\n下一步建议..."）。
      //    短文本场景的核心情形：第二轮 LLM 在第一轮基础上「追加」补充信息。
      //    要求双方非空，避免 "" 被任意串视为前缀。
      if (laterContent.startsWith(earlierContent)) {
        droppedIndices.add(earlierIdx);
        continue;
      }
      if (earlierContent.startsWith(laterContent)) {
        // 罕见：后段是前段前缀（被截短），保留信息更完备的前段。
        droppedIndices.add(laterIdx);
        break;
      }

      // 3. 等价内容（containment + 长度比 0.8 + word jaccard 兜底）。
      //    覆盖前缀关系不成立但内容近似的较长文本场景。
      if (
        isEquivalentMessageContent(earlierContent, laterContent) &&
        Math.min(earlierContent.length, laterContent.length) >=
          REDUNDANT_TEXT_JACCARD_MIN_LENGTH
      ) {
        droppedIndices.add(earlierIdx);
        continue;
      }

      // 4. 字符二元组 Jaccard 兜底：双方均 ≥ 30 字，避免误删短文本。
      if (
        earlierContent.length >= REDUNDANT_TEXT_JACCARD_MIN_LENGTH &&
        laterContent.length >= REDUNDANT_TEXT_JACCARD_MIN_LENGTH
      ) {
        const similarity = bigramJaccardSimilarity(earlierContent, laterContent);
        if (similarity >= REDUNDANT_TEXT_SIMILARITY_THRESHOLD) {
          droppedIndices.add(earlierIdx);
          continue;
        }
      }

      // 5. ISSUE-049 流式双内容兜底：同源不同完成度的两段（残缺版 + 完整版）。
      //    覆盖前 4 层未命中、但字符 multiset 高度互含、长度差显著的场景。
      if (isStreamingDuplicateOfLater(earlierContent, laterContent)) {
        droppedIndices.add(earlierIdx);
      }
    }
  }

  if (droppedIndices.size === 0) {
    return segments;
  }
  return segments.filter((_, index) => !droppedIndices.has(index));
}

function buildAssistantReplyBlock(builder: ReplyBuilder): AssistantReplyDisplayBlock {
  const dedupedSegments = dedupeRedundantTextSegments(builder.segments);
  const streaming = dedupedSegments.some(
    (segment) =>
      segment.kind === "text"
        ? segment.streaming
        : segment.kind === "tool-group"
          ? segment.status === "running"
          : false,
  );
  const dedupedTextParts = dedupedSegments
    .filter((segment): segment is ReplyTextDisplaySegment => segment.kind === "text")
    .map((segment) => segment.content)
    .filter((content) => content.trim().length > 0);
  const messageId =
    builder.anchorMessageId || `assistant-reply:${builder.turnId}:${builder.anchorNodeId}`;
  return {
    id: `assistant-reply:${builder.turnId}:${messageId}`,
    kind: "assistant-reply",
    nodeId: builder.anchorNodeId,
    timestamp: builder.timestamp,
    sourceOrder: builder.sourceOrder,
    message: {
      id: messageId,
      role: "assistant",
      content: dedupedTextParts.join("\n\n"),
      author: builder.author,
      timestamp: builder.timestamp,
      runId: builder.runId,
      threadId: builder.threadId,
      streaming,
    },
    segments: dedupedSegments,
  };
}

function pushGroupedTools(
  blocks: ChatDisplayBlock[],
  input: {
    turnId: string;
    anchorNodeId?: string;
    anchorMessageId?: string;
    nodes: ConversationNode[];
  },
) {
  if (input.nodes.length === 0) {
    return;
  }
  blocks.push(createToolGroupBlock(input));
}

function pushGroupedToolsToReply(
  builder: ReplyBuilder,
  input: {
    turnId: string;
    anchorNodeId?: string;
    anchorMessageId?: string;
    nodes: ConversationNode[];
  },
) {
  if (input.nodes.length === 0) {
    return;
  }
  appendReplySegment(builder, createReplyToolGroupSegment(input));
}

function collectAssistantSegmentsFromTextNode(
  node: ConversationNode,
  turnId: string,
  builder: ReplyBuilder,
) {
  const selfSegment = createReplyTextSegment(node);
  if (selfSegment) {
    appendReplySegment(builder, selfSegment);
  }
  let pendingToolNodes: ConversationNode[] = [];

  node.children.forEach((child) => {
    if (child.visibility === "debug-only") {
      return;
    }
    if (child.type === "tool-call") {
      pendingToolNodes.push(child);
      return;
    }
    if (child.type === "text") {
      pushGroupedToolsToReply(builder, {
        turnId,
        anchorNodeId: node.id,
        anchorMessageId: node.messageId,
        nodes: pendingToolNodes,
      });
      pendingToolNodes = [];
      if (child.role === "assistant" || child.role === "developer") {
        collectAssistantSegmentsFromTextNode(child, turnId, builder);
      }
      return;
    }
    if (child.type === "step" || child.type === "reasoning") {
      pushGroupedToolsToReply(builder, {
        turnId,
        anchorNodeId: node.id,
        anchorMessageId: node.messageId,
        nodes: pendingToolNodes,
      });
      pendingToolNodes = [];
      collectReasoningSegments(
        child.type === "step" ? child : child,
        builder,
      );
      return;
    }
    if (child.type === "error") {
      pushGroupedToolsToReply(builder, {
        turnId,
        anchorNodeId: node.id,
        anchorMessageId: node.messageId,
        nodes: pendingToolNodes,
      });
      pendingToolNodes = [];
      appendReplySegment(builder, createReplyErrorSegment(child));
    }
  });

  pushGroupedToolsToReply(builder, {
    turnId,
    anchorNodeId: node.id,
    anchorMessageId: node.messageId,
    nodes: pendingToolNodes,
  });
}

function walkTurnNode(node: ConversationNode, blocks: ChatDisplayBlock[]) {
  let pendingToolNodes: ConversationNode[] = [];
  let hasDisplayContent = false;
  let replyBuilder: ReplyBuilder | null = null;

  const flushReply = () => {
    if (!replyBuilder || replyBuilder.segments.length === 0) {
      replyBuilder = null;
      return;
    }
    blocks.push(buildAssistantReplyBlock(replyBuilder));
    replyBuilder = null;
  };

  const flushPendingTools = (nextAnchorNode?: ConversationNode) => {
    if (pendingToolNodes.length === 0) {
      return;
    }
    if (replyBuilder) {
      pushGroupedToolsToReply(replyBuilder, {
        turnId: node.id,
        anchorNodeId: nextAnchorNode?.id || replyBuilder.anchorNodeId,
        anchorMessageId:
          nextAnchorNode?.messageId || replyBuilder.anchorMessageId,
        nodes: pendingToolNodes,
      });
    } else {
      pushGroupedTools(blocks, {
        turnId: node.id,
        anchorNodeId: nextAnchorNode?.id,
        anchorMessageId: nextAnchorNode?.messageId,
        nodes: pendingToolNodes,
      });
    }
    pendingToolNodes = [];
  };

  node.children.forEach((child) => {
    if (child.visibility === "debug-only") {
      return;
    }
    if (child.type === "tool-call") {
      pendingToolNodes.push(child);
      hasDisplayContent = true;
      return;
    }
    if (child.type === "text") {
      hasDisplayContent = true;
      if (child.role === "assistant" || child.role === "developer") {
        if (!replyBuilder) {
          replyBuilder = createReplyBuilder(child, node.id);
        }
        flushPendingTools(child);
        collectAssistantSegmentsFromTextNode(child, node.id, replyBuilder);
        return;
      }
      flushPendingTools();
      flushReply();
      blocks.push(createMessageBlock(child));
      return;
    }
    if (child.type === "step" || child.type === "reasoning") {
      hasDisplayContent = true;
      if (!replyBuilder) {
        replyBuilder = createReplyBuilder(child, node.id);
      }
      flushPendingTools(child);
      collectReasoningSegments(child, replyBuilder);
      return;
    }
    if (child.type === "error") {
      if (isNonCriticalError(String(child.payload.message || ""))) {
        return;
      }
      hasDisplayContent = true;
      flushPendingTools();
      if (replyBuilder) {
        appendReplySegment(replyBuilder, createReplyErrorSegment(child));
      } else {
        blocks.push(createErrorBlock(child));
      }
    }
  });

  flushPendingTools();
  flushReply();

  if (!hasDisplayContent || node.status === "blocked") {
    blocks.push({
      id: `turn-status:${node.id}`,
      kind: "turn-status",
      nodeId: node.id,
      timestamp: node.timeRange.start,
      sourceOrder: node.sourceOrder,
      status:
        node.status === "blocked"
          ? "blocked"
          : node.status === "error"
            ? "error"
            : node.status === "finished"
              ? "finished"
              : "running",
      title: node.title,
      detail:
        node.status === "blocked"
          ? "等待用户确认后继续"
          : !hasDisplayContent && node.status === "finished"
            ? "本轮未生成可展示回复"
            : !hasDisplayContent
              ? "NE 正在生成回复..."
              : undefined,
    });
  }
}

export function buildChatDisplayBlocks(tree: ConversationTree): ChatDisplayBlock[] {
  const blocks: ChatDisplayBlock[] = [];

  tree.roots.forEach((root) => {
    if (root.visibility === "debug-only") {
      return;
    }
    if (root.type === "turn") {
      walkTurnNode(root, blocks);
      return;
    }
    if (root.type === "text") {
      if (root.role === "assistant" || root.role === "developer") {
        const builder = createReplyBuilder(root, root.id);
        collectAssistantSegmentsFromTextNode(root, root.id, builder);
        blocks.push(buildAssistantReplyBlock(builder));
      } else {
        blocks.push(createMessageBlock(root));
      }
      return;
    }
    if (root.type === "error") {
      blocks.push(createErrorBlock(root));
      return;
    }
    if (root.type === "tool-call") {
      blocks.push(
        createToolGroupBlock({
          turnId: root.id,
          nodes: [root],
        }),
      );
      return;
    }
    blocks.push(createSummaryBlock(root));
  });

  blocks.sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp;
    }
    if (left.sourceOrder !== right.sourceOrder) {
      return left.sourceOrder - right.sourceOrder;
    }
    const typeDiff = displayBlockTypeOrder[left.kind] - displayBlockTypeOrder[right.kind];
    if (typeDiff !== 0) {
      return typeDiff;
    }
    return left.id.localeCompare(right.id);
  });

  return dedupeAdjacentAssistantBlocks(blocks);
}

// ISSUE-041: 跨 turn 的 assistant-reply block 去重。当 Layer 1
// (collapseOverlappingTurns) 因两个 concrete turn 都非 synthetic 而无法折叠时，
// 这里作为安全网——对时间窗内内容高度相似的相邻 assistant-reply block 保留更完整的一个。
// ISSUE-041: ChatDisplayBlock.timestamp 来源于 node.timeRange.start（秒级），
// 此处单位为秒，与 conversation-tree::turnsOverlapInTime 的 toleranceSec 对齐。
const CROSS_BLOCK_TIME_WINDOW_SEC = 120;
const CROSS_BLOCK_JACCARD_MIN_LENGTH = 30;

function extractAssistantBlockText(block: ChatDisplayBlock): string {
  if (block.kind !== "assistant-reply") return "";
  return (block as AssistantReplyDisplayBlock).segments
    .filter((s) => s.kind === "text")
    .map((s) => s.content || "")
    .join("")
    .trim();
}

function dedupeAdjacentAssistantBlocks(blocks: ChatDisplayBlock[]): ChatDisplayBlock[] {
  const assistantBlocks = blocks.filter(
    (b): b is AssistantReplyDisplayBlock => b.kind === "assistant-reply",
  );
  if (assistantBlocks.length < 2) return blocks;

  const droppedIds = new Set<string>();

  for (let i = 1; i < assistantBlocks.length; i++) {
    const later = assistantBlocks[i];
    const laterText = extractAssistantBlockText(later);
    if (!laterText) continue;

    for (let j = 0; j < i; j++) {
      if (droppedIds.has(assistantBlocks[j].id)) continue;
      const earlier = assistantBlocks[j];
      const earlierText = extractAssistantBlockText(earlier);
      if (!earlierText) continue;

      // 时间窗外的 block 一定是不同 turn，跳过
      if (Math.abs(later.timestamp - earlier.timestamp) > CROSS_BLOCK_TIME_WINDOW_SEC) continue;

      // 内容覆盖判定：如果一方是另一方的超集/子集，保留更完整的
      const shorterLen = Math.min(earlierText.length, laterText.length);

      // 精确匹配
      if (earlierText === laterText) {
        droppedIds.add(earlier.id);
        break;
      }
      // 前缀关系：保留更长（更完整）的
      if (laterText.startsWith(earlierText)) {
        droppedIds.add(earlier.id);
        break;
      }
      if (earlierText.startsWith(laterText)) {
        droppedIds.add(later.id);
        break;
      }
      // 子串包含 + Jaccard 兜底（≥30 字）
      if (shorterLen >= CROSS_BLOCK_JACCARD_MIN_LENGTH) {
        if (earlierText.includes(laterText) || laterText.includes(earlierText)) {
          droppedIds.add(earlierText.length <= laterText.length ? earlier.id : later.id);
          break;
        }
        if (bigramJaccardSimilarity(earlierText, laterText) >= REDUNDANT_TEXT_SIMILARITY_THRESHOLD) {
          droppedIds.add(earlierText.length <= laterText.length ? earlier.id : later.id);
          break;
        }
      }
    }
  }

  if (droppedIds.size === 0) return blocks;
  return blocks.filter((b) => !droppedIds.has(b.id));
}
