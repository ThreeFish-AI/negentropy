import { EventType } from "@ag-ui/core";
import type {
  AssistantReplyDisplayBlock,
  AssistantReplyDisplaySegment,
  ChatDisplayBlock,
  ConversationNode,
  ConversationTree,
  ReplyErrorDisplaySegment,
  ReplyTextDisplaySegment,
  ReplyToolGroupDisplaySegment,
  ToolExecutionEntry,
  ToolGroupDisplayBlock,
} from "@/types/a2ui";
import type { ChatMessage, ToolCallStatus } from "@/types/common";
import { buildNodeSummary, safeJsonParse } from "@/utils/conversation-summary";

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
  builder.segments.push(segment);
  builder.timestamp = Math.min(builder.timestamp, segment.timestamp);
  builder.sourceOrder = Math.min(builder.sourceOrder, segment.sourceOrder);
  if (segment.kind === "text" && segment.content.trim()) {
    builder.textParts.push(segment.content);
  }
}

function buildAssistantReplyBlock(builder: ReplyBuilder): AssistantReplyDisplayBlock {
  const streaming = builder.segments.some(
    (segment) =>
      segment.kind === "text"
        ? segment.streaming
        : segment.kind === "tool-group"
          ? segment.status === "running"
          : false,
  );
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
      content: builder.textParts.join("\n\n"),
      author: builder.author,
      timestamp: builder.timestamp,
      runId: builder.runId,
      threadId: builder.threadId,
      streaming,
    },
    segments: builder.segments,
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
    if (child.type === "error") {
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

  return blocks;
}
