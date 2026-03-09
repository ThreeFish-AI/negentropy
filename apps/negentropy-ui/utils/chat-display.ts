import { EventType } from "@ag-ui/core";
import type {
  ChatDisplayBlock,
  ConversationNode,
  ConversationTree,
  ToolExecutionEntry,
  ToolGroupDisplayBlock,
} from "@/types/a2ui";
import type { ChatMessage, ToolCallStatus } from "@/types/common";
import { buildNodeSummary, safeJsonParse } from "@/utils/conversation-summary";

const displayBlockTypeOrder: Record<ChatDisplayBlock["kind"], number> = {
  message: 0,
  "tool-group": 1,
  error: 2,
  "turn-status": 3,
  summary: 4,
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
  nodes: ConversationNode[];
}): ToolGroupDisplayBlock {
  const tools = input.nodes.map(createToolEntry);
  const status = getGroupStatus(tools);
  const parallel = tools.length > 1;
  const toolNames = [...new Set(tools.map((tool) => tool.name))];
  return {
    id: `tool-group:${input.anchorNodeId || input.turnId}:${input.nodes.map((node) => node.id).join(":")}`,
    kind: "tool-group",
    nodeId: input.nodes[0]?.id || input.turnId,
    anchorNodeId: input.anchorNodeId,
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

function pushGroupedTools(
  blocks: ChatDisplayBlock[],
  input: {
    turnId: string;
    anchorNodeId?: string;
    nodes: ConversationNode[];
  },
) {
  if (input.nodes.length === 0) {
    return;
  }
  blocks.push(createToolGroupBlock(input));
}

function walkTextNode(
  node: ConversationNode,
  turnId: string,
  blocks: ChatDisplayBlock[],
) {
  blocks.push(createMessageBlock(node));

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
      pushGroupedTools(blocks, {
        turnId,
        anchorNodeId: node.id,
        nodes: pendingToolNodes,
      });
      pendingToolNodes = [];
      walkTextNode(child, turnId, blocks);
      return;
    }
    if (child.type === "error") {
      pushGroupedTools(blocks, {
        turnId,
        anchorNodeId: node.id,
        nodes: pendingToolNodes,
      });
      pendingToolNodes = [];
      blocks.push(createErrorBlock(child));
    }
  });

  pushGroupedTools(blocks, {
    turnId,
    anchorNodeId: node.id,
    nodes: pendingToolNodes,
  });
}

function walkTurnNode(node: ConversationNode, blocks: ChatDisplayBlock[]) {
  let pendingToolNodes: ConversationNode[] = [];
  let hasDisplayContent = false;

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
      pushGroupedTools(blocks, {
        turnId: node.id,
        nodes: pendingToolNodes,
      });
      pendingToolNodes = [];
      hasDisplayContent = true;
      walkTextNode(child, node.id, blocks);
      return;
    }
    if (child.type === "error") {
      pushGroupedTools(blocks, {
        turnId: node.id,
        nodes: pendingToolNodes,
      });
      pendingToolNodes = [];
      hasDisplayContent = true;
      blocks.push(createErrorBlock(child));
    }
  });

  pushGroupedTools(blocks, {
    turnId: node.id,
    nodes: pendingToolNodes,
  });

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
      walkTextNode(root, root.id, blocks);
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
