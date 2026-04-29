import { EventType, type BaseEvent, type Message } from "@ag-ui/core";
import type {
  BuildConversationTreeOptions,
  ConversationNode,
  ConversationNodeType,
  ConversationTree,
} from "@/types/a2ui";
import {
  asAgUiEvent,
  getCustomEventData,
  getCustomEventType,
  getEventAuthor,
  getEventMessageId,
  getEventRunId,
  getEventThreadId,
  getEventToolCallId,
  getMessageCreatedAt,
  getMessageStreaming,
  getMessageRunId,
  getMessageThreadId,
  normalizeCompatibleMessageRole,
  type CanonicalMessageRole,
} from "@/types/agui";
import { createAgUiMessage } from "@/types/agui";
import type { MessageLedgerEntry } from "@/types/common";
import {
  buildNodeSummary,
  classifyNodeVisibility,
  isNodePayloadEmpty,
} from "@/utils/conversation-summary";
import {
  accumulateTextContent,
  isEquivalentMessageContent,
  normalizeMessageContent,
} from "@/utils/message";
import { isNonCriticalError } from "@/utils/error-filter";
import { buildMessageLedger, isSyntheticRunId } from "@/utils/message-ledger";

type MutableNode = ConversationNode;

type LinkInstruction = {
  childId: string;
  parentId: string;
};

const DEFAULT_THREAD_ID = "default";
const DEFAULT_RUN_ID = "default";

function normalizeRunId(value: string | undefined, fallbackRunId?: string): string {
  if (!value || value === DEFAULT_RUN_ID) {
    return fallbackRunId || DEFAULT_RUN_ID;
  }
  return value;
}

function isRunCompatible(left?: string, right?: string): boolean {
  if (!left || !right) {
    return true;
  }
  if (left === right) {
    return true;
  }
  return left === DEFAULT_RUN_ID || right === DEFAULT_RUN_ID;
}

function normalizeRole(value: unknown): CanonicalMessageRole {
  return normalizeCompatibleMessageRole(
    typeof value === "string" ? value : undefined,
  );
}

function isAssistantLikeRole(role: CanonicalMessageRole): boolean {
  return role === "assistant" || role === "developer";
}

function normalizeTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Date.now() / 1000;
}

function createNode(input: {
  id: string;
  type: ConversationNodeType;
  parentId?: string | null;
  threadId?: string;
  runId?: string;
  messageId?: string;
  toolCallId?: string;
  timestamp?: number;
  sourceOrder?: number;
  title: string;
  status?: string;
  role?: CanonicalMessageRole;
  summary?: string;
  payload?: Record<string, unknown>;
  sourceEventTypes?: string[];
  relatedMessageIds?: string[];
}): MutableNode {
  const timestamp = normalizeTimestamp(input.timestamp);
  return {
    id: input.id,
    type: input.type,
    parentId: input.parentId ?? null,
    children: [],
    threadId: input.threadId || DEFAULT_THREAD_ID,
    runId: input.runId,
    messageId: input.messageId,
    toolCallId: input.toolCallId,
    timestamp,
    timeRange: { start: timestamp, end: timestamp },
    sourceOrder: input.sourceOrder ?? Number.MAX_SAFE_INTEGER,
    title: input.title,
    status: input.status,
    role: input.role,
    summary: input.summary,
    visibility: "chat",
    isStructural: false,
    payload: input.payload || {},
    sourceEventTypes: input.sourceEventTypes || [],
    relatedMessageIds: input.relatedMessageIds || [],
  };
}

function addChild(parent: MutableNode, child: MutableNode) {
  if (parent.children.some((existing) => existing.id === child.id)) {
    return;
  }
  parent.children.push(child);
}

function removeChild(parent: MutableNode, childId: string) {
  parent.children = parent.children.filter((child) => child.id !== childId);
}

function mergeEventMeta(node: MutableNode, event: BaseEvent) {
  const eventType = String(event.type);
  if (!node.sourceEventTypes.includes(eventType)) {
    node.sourceEventTypes.push(eventType);
  }
  const timestamp = normalizeTimestamp(event.timestamp);
  node.timestamp = Math.min(node.timestamp, timestamp);
  node.timeRange.start = Math.min(node.timeRange.start, timestamp);
  node.timeRange.end = Math.max(node.timeRange.end, timestamp);
  const messageId = getEventMessageId(event);
  if (messageId) {
    node.messageId = messageId;
    if (!node.relatedMessageIds.includes(messageId)) {
      node.relatedMessageIds.push(messageId);
    }
  }
}

function ensureTurn(
  turns: Map<string, MutableNode>,
  roots: MutableNode[],
  event: BaseEvent,
  fallbackRunId?: string,
  sourceOrder?: number,
): MutableNode {
  const runId = normalizeRunId(getEventRunId(event), fallbackRunId);
  const existing = turns.get(runId);
  if (existing) {
    mergeEventMeta(existing, event);
    return existing;
  }

  const turn = createNode({
    id: `turn:${runId}`,
    type: "turn",
    threadId: getEventThreadId(event) || DEFAULT_THREAD_ID,
    runId,
    timestamp: event.timestamp,
    sourceOrder,
    title: runId === DEFAULT_RUN_ID ? "默认轮次" : `轮次 ${runId.slice(0, 8)}`,
    status: event.type === EventType.RUN_FINISHED ? "finished" : "running",
    payload: {},
    sourceEventTypes: [String(event.type)],
  });
  turns.set(runId, turn);
  roots.push(turn);
  return turn;
}

function upsertNode(
  nodeIndex: Map<string, MutableNode>,
  roots: MutableNode[],
  turns: Map<string, MutableNode>,
  input: Parameters<typeof createNode>[0],
): MutableNode {
  const existing = nodeIndex.get(input.id);
  if (existing) {
    if (input.parentId !== undefined) {
      existing.parentId = input.parentId;
    }
    if (input.threadId && !existing.threadId) {
      existing.threadId = input.threadId;
    }
    if (input.runId && (!existing.runId || existing.runId === DEFAULT_RUN_ID)) {
      existing.runId = input.runId;
    }
    if (input.messageId && !existing.messageId) {
      existing.messageId = input.messageId;
    }
    if (input.toolCallId && !existing.toolCallId) {
      existing.toolCallId = input.toolCallId;
    }
    if (input.status) {
      existing.status = input.status;
    }
    if (input.summary) {
      existing.summary = input.summary;
    }
    if (input.role) {
      existing.role = input.role;
    }
    existing.title = input.title || existing.title;
    existing.payload = { ...existing.payload, ...(input.payload || {}) };
    existing.timestamp = Math.min(
      existing.timestamp,
      normalizeTimestamp(input.timestamp),
    );
    existing.timeRange.start = Math.min(
      existing.timeRange.start,
      normalizeTimestamp(input.timestamp),
    );
    existing.timeRange.end = Math.max(
      existing.timeRange.end,
      normalizeTimestamp(input.timestamp),
    );
    existing.sourceOrder = Math.min(
      existing.sourceOrder,
      input.sourceOrder ?? Number.MAX_SAFE_INTEGER,
    );
    (input.sourceEventTypes || []).forEach((eventType) => {
      if (!existing.sourceEventTypes.includes(eventType)) {
        existing.sourceEventTypes.push(eventType);
      }
    });
    (input.relatedMessageIds || []).forEach((messageId) => {
      if (!existing.relatedMessageIds.includes(messageId)) {
        existing.relatedMessageIds.push(messageId);
      }
    });
    return existing;
  }

  const node = createNode(input);
  nodeIndex.set(node.id, node);

  if (!node.parentId) {
    roots.push(node);
    return node;
  }

  const parent =
    nodeIndex.get(node.parentId) ||
    turns.get(node.parentId.replace(/^turn:/, ""));
  if (parent) {
    addChild(parent, node);
  } else {
    roots.push(node);
  }
  return node;
}

function attachNode(
  nodeIndex: Map<string, MutableNode>,
  roots: MutableNode[],
  turns: Map<string, MutableNode>,
  childId: string,
  parentId: string | null,
) {
  const child = nodeIndex.get(childId);
  if (!child) return;

  if (child.parentId) {
    const previousParent =
      nodeIndex.get(child.parentId) ||
      turns.get(child.parentId.replace(/^turn:/, ""));
    if (previousParent) {
      removeChild(previousParent, childId);
    }
  } else if (!child.parentId) {
    const rootIndex = roots.findIndex((node) => node.id === childId);
    if (rootIndex >= 0) {
      roots.splice(rootIndex, 1);
    }
  }

  child.parentId = parentId;
  if (!parentId) {
    roots.push(child);
    return;
  }
  const parent = nodeIndex.get(parentId) || turns.get(parentId.replace(/^turn:/, ""));
  if (parent) {
    addChild(parent, child);
  } else {
    roots.push(child);
  }
}

function chooseParentMessageId(
  assistantByRun: Map<string, string>,
  runId: string,
  messageId?: string,
  messageNodeIndex?: Map<string, string>,
): string | null {
  if (messageId && messageNodeIndex?.has(messageId)) {
    return messageNodeIndex.get(messageId) || null;
  }
  return assistantByRun.get(runId) || null;
}

function findFallbackTurnByTimestamp(
  turns: Map<string, MutableNode>,
  timestamp: number,
): MutableNode | null {
  const orderedTurns = [...turns.values()].sort(
    (a, b) => a.timeRange.start - b.timeRange.start,
  );

  const containingTurn = orderedTurns.find(
    (turn) => timestamp >= turn.timeRange.start && timestamp <= turn.timeRange.end + 0.001,
  );
  if (containingTurn) {
    return containingTurn;
  }

  const futureTurn = orderedTurns.find((turn) => timestamp <= turn.timeRange.end + 0.001);
  return futureTurn || null;
}

function hasTechnicalChildren(node: MutableNode): boolean {
  return node.children.some((child) => child.type !== "text");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getMessageTimestamp(message: Message): number {
  const createdAt = getMessageCreatedAt(message);
  return createdAt instanceof Date ? createdAt.getTime() / 1000 : Date.now() / 1000;
}

function findMatchingTextNodeId(
  nodeIndex: Map<string, MutableNode>,
  input: {
    threadId: string;
    runId?: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
    author?: string;
  },
): string | null {
  const normalizedContent = input.content.trim();
  if (!normalizedContent) {
    return null;
  }

  const timeWindowSeconds = input.role === "assistant" ? 30 : 5;

  for (const node of nodeIndex.values()) {
    if (node.type !== "text" || node.role !== input.role) {
      continue;
    }
    if (node.payload.streaming !== true) {
      // 防御性收敛：当 hydrated TEXT_MESSAGE_* 因 messageId 不同而到达此处，
      // 而 realtime 节点已收尾，且二者内容严格相等时，仍允许复用同一节点，
      // 避免在已 closed 的同内容节点旁新建第二个节点。仅对 assistant 路径
      // 放宽，user 仍要求节点处于流式态以避免误并历史用户消息。
      const existingContent = String(node.payload.content || "").trim();
      if (
        input.role !== "assistant" ||
        !existingContent ||
        existingContent !== normalizedContent
      ) {
        continue;
      }
    }
    if (hasTechnicalChildren(node)) {
      continue;
    }
    if (node.threadId !== input.threadId) {
      continue;
    }
    if (!isRunCompatible(node.runId, input.runId)) {
      continue;
    }
    if (
      input.author &&
      typeof node.payload.author === "string" &&
      node.payload.author !== input.author
    ) {
      continue;
    }
    if (Math.abs(node.timeRange.end - input.timestamp) > timeWindowSeconds) {
      continue;
    }

    const existingContent = String(node.payload.content || "").trim();
    if (!existingContent) {
      continue;
    }

    const isMatch =
      input.role === "assistant"
        ? (existingContent.startsWith(normalizedContent) ||
            normalizedContent.startsWith(existingContent)) &&
          isEquivalentMessageContent(existingContent, normalizedContent)
        : existingContent === normalizedContent;
    if (isMatch) {
      return node.id;
    }
  }

  return null;
}

function finalizeTextNodeFromCanonicalMessage(
  node: MutableNode,
  message: {
    content: string;
    streaming: boolean;
    resolvedRole: CanonicalMessageRole;
    sourceEventTypes?: string[];
    relatedMessageIds?: string[];
    author?: string;
  },
) {
  const nextContent = message.content.trim();
  if (nextContent) {
    const existingContent = String(node.payload.content || "");
    node.payload.content =
      nextContent.length >= existingContent.trim().length
        ? nextContent
        : accumulateTextContent(existingContent, nextContent);
  }
  node.payload.streaming =
    typeof node.payload.streaming === "boolean"
      ? node.payload.streaming && message.streaming
      : message.streaming;
  if (message.author && !node.payload.author) {
    node.payload.author = message.author;
  }
  node.role = message.resolvedRole;
  node.title = message.resolvedRole === "user" ? "用户消息" : "助手消息";
  if (!message.streaming && !node.sourceEventTypes.includes(String(EventType.TEXT_MESSAGE_END))) {
    node.sourceEventTypes.push(String(EventType.TEXT_MESSAGE_END));
  }
  (message.sourceEventTypes || []).forEach((eventType) => {
    if (!node.sourceEventTypes.includes(eventType)) {
      node.sourceEventTypes.push(eventType);
    }
  });
  (message.relatedMessageIds || []).forEach((messageId) => {
    if (!node.relatedMessageIds.includes(messageId)) {
      node.relatedMessageIds.push(messageId);
    }
  });
}

function pruneNode(node: MutableNode): MutableNode | null {
  node.children = node.children
    .map((child) => pruneNode(child))
    .filter((child): child is MutableNode => child !== null);

  const summaryLines = buildNodeSummary(node);
  node.summary = node.summary || summaryLines.join(" · ");
  node.visibility = classifyNodeVisibility(node);
  node.isStructural =
    node.type === "custom" && String(node.payload.eventType || "") === "ne.a2ui.link";

  const isEmptyTextNode =
    node.type === "text" &&
    String(node.payload.content || "").trim().length === 0 &&
    node.children.length === 0;
  const isEmptyNode =
    node.type !== "turn" &&
    node.type !== "text" &&
    isNodePayloadEmpty(node) &&
    node.children.length === 0;

  if (node.type === "turn" && node.children.length === 0) {
    return null;
  }
  if (node.visibility === "debug-only" && node.children.length === 0) {
    return null;
  }
  if (isEmptyTextNode || isEmptyNode) {
    return null;
  }

  return node;
}

function sortNodeChildren(node: MutableNode) {
  const typeOrder: Record<ConversationNodeType, number> = {
    turn: 0,
    text: 1,
    "tool-call": 2,
    "tool-result": 3,
    activity: 4,
    reasoning: 5,
    step: 6,
    "state-delta": 7,
    "state-snapshot": 8,
    custom: 9,
    raw: 10,
    event: 11,
    error: 12,
  };

  node.children.sort((a, b) => {
    const timeDiff = a.timeRange.start - b.timeRange.start;
    if (timeDiff !== 0) {
      return timeDiff;
    }
    const sourceOrderDiff = a.sourceOrder - b.sourceOrder;
    if (sourceOrderDiff !== 0) {
      return sourceOrderDiff;
    }
    const typeDiff = typeOrder[a.type] - typeOrder[b.type];
    if (typeDiff !== 0) {
      return typeDiff;
    }
    return a.id.localeCompare(b.id);
  });

  node.children.forEach(sortNodeChildren);
}

function findSubsumingTextNode(
  turn: MutableNode,
  candidate: MutableNode,
): MutableNode | null {
  const candidateContent = String(candidate.payload.content || "").trim();
  if (!candidateContent) {
    return null;
  }

  return (
    turn.children.find((child) => {
      if (child.type !== "text" || child.role !== candidate.role) {
        return false;
      }
      const childContent = String(child.payload.content || "").trim();
      if (!childContent.startsWith(candidateContent)) {
        return false;
      }
      return isEquivalentMessageContent(childContent, candidateContent);
    }) || null
  );
}

function isSyntheticTurnNode(node: MutableNode): boolean {
  if (node.type !== "turn") return false;
  if (!node.runId || node.runId === DEFAULT_RUN_ID) return true;
  // ISSUE-041: hydration 在后端 ADK Web 不透传 runId 时回退到 threadId / sessionId，
  // 形成 `runId === threadId` 的合成 turn；这类 turn 没有独立 run 语义，可被
  // 同 threadId 的真 runId turn 兼并。
  return Boolean(node.threadId) && node.runId === node.threadId;
}

function collapseSyntheticTurnDuplicates(roots: MutableNode[]): MutableNode[] {
  const concreteTurns = roots.filter(
    (node) => node.type === "turn" && !isSyntheticTurnNode(node),
  );

  return roots.filter((node) => {
    if (!isSyntheticTurnNode(node)) return true;
    if (node.children.length === 0) return false; // 空合成 turn 直接丢弃

    return !node.children.every((child) => {
      // reasoning / step 类型在合成 turn 内可被无条件吸收（它们本身只是元数据）
      if (child.type === "reasoning" || child.type === "step") return true;
      if (child.type !== "text") return false;
      // 仅 assistant / developer text 允许被合成 turn 吸收
      if (child.role !== "assistant" && child.role !== "developer") return false;
      // ISSUE-041: 时间窗按 child.timestamp 与 concrete turn 的 timeRange 比较，
      // 而非 synthetic turn 的全局 timeRange.start —— 多轮场景下 synthetic turn
      // 的时间跨度可能横跨多个 concrete turn，全局比较会错放过期外 turn。
      const childTimestamp = child.timestamp;
      return concreteTurns.some((turn) => {
        if (turn.threadId !== node.threadId) return false;
        // child 时间戳应落在 concrete turn 时间范围内（±30s 容差）
        const turnStart = turn.timeRange.start;
        const turnEnd = turn.timeRange.end;
        if (childTimestamp < turnStart - 30) return false;
        if (childTimestamp > turnEnd + 30) return false;
        return Boolean(findSubsumingTextNode(turn, child));
      });
    });
  });
}

export function buildConversationTree(
  options: BuildConversationTreeOptions,
): ConversationTree {
  const { events, fallbackMessages = [], messageLedger = [] } = options;
  const effectiveMessageLedger =
    messageLedger.length > 0
      ? messageLedger
      : buildMessageLedger({
          events,
          fallbackMessages,
        });
  const roots: MutableNode[] = [];
  const nodeIndex = new Map<string, MutableNode>();
  const messageNodeIndex = new Map<string, string>();
  const toolNodeIndex = new Map<string, string>();
  const turns = new Map<string, MutableNode>();
  const assistantMessageByRun = new Map<string, string>();
  const messageRoleById = new Map<string, CanonicalMessageRole>();
  const messageMetaById = new Map<
    string,
    {
      threadId: string;
      runId: string;
      timestamp: number;
      sourceOrder: number;
    }
  >();
  const pendingConfirmationCountByRun = new Map<string, number>();
  const pendingLinks: LinkInstruction[] = [];
  const ledgerByMessageId = new Map<string, MessageLedgerEntry>();
  const canonicalMessageIdByRelatedId = new Map<string, string>();
  let activeRunId: string | undefined;

  effectiveMessageLedger.forEach((entry) => {
    ledgerByMessageId.set(entry.id, entry);
    messageRoleById.set(entry.id, entry.resolvedRole);
    entry.relatedMessageIds.forEach((relatedMessageId) => {
      canonicalMessageIdByRelatedId.set(relatedMessageId, entry.id);
      if (!ledgerByMessageId.has(relatedMessageId)) {
        ledgerByMessageId.set(relatedMessageId, entry);
      }
    });
  });

  const orderedEvents = [...events].sort((a, b) => {
    const timeDiff = normalizeTimestamp(a.timestamp) - normalizeTimestamp(b.timestamp);
    if (timeDiff !== 0) return timeDiff;
    return String(a.type).localeCompare(String(b.type));
  });

  orderedEvents.forEach((event, eventIndex) => {
    const normalizedRunId = normalizeRunId(getEventRunId(event), activeRunId);
    const normalizedEvent = asAgUiEvent({
      ...event,
      runId: normalizedRunId,
    });
    const turn = ensureTurn(turns, roots, normalizedEvent, activeRunId, eventIndex);
    const runId = turn.runId || DEFAULT_RUN_ID;
    const messageId = getEventMessageId(normalizedEvent);
    const eventType = String(normalizedEvent.type);

    switch (normalizedEvent.type) {
      case EventType.RUN_STARTED: {
        activeRunId = runId;
        turn.status = "running";
        turn.title = `轮次 ${runId.slice(0, 8)}`;
        mergeEventMeta(turn, normalizedEvent);
        return;
      }
      case EventType.RUN_FINISHED: {
        turn.status =
          (pendingConfirmationCountByRun.get(runId) || 0) > 0
            ? "blocked"
            : "finished";
        mergeEventMeta(turn, normalizedEvent);
        if (activeRunId === runId) {
          activeRunId = undefined;
        }
        return;
      }
      case EventType.RUN_ERROR: {
        const errorMessage = "message" in normalizedEvent ? String(normalizedEvent.message || "") : "";
        if (isNonCriticalError(errorMessage)) {
          turn.status = turn.status === "error" ? "finished" : turn.status;
          return;
        }
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `error:${runId}:${normalizeTimestamp(normalizedEvent.timestamp)}`,
          type: "error",
          parentId: turn.id,
          threadId: turn.threadId,
          runId,
          timestamp: normalizedEvent.timestamp,
          sourceOrder: eventIndex,
          title: "运行错误",
          status: "error",
          payload: {
            message: errorMessage,
            code: "code" in normalizedEvent ? normalizedEvent.code : "",
          },
          sourceEventTypes: [eventType],
        });
        addChild(turn, node);
        return;
      }
      case EventType.TEXT_MESSAGE_START:
      case EventType.TEXT_MESSAGE_CONTENT:
      case EventType.TEXT_MESSAGE_END: {
        if (!messageId) return;
        const role =
          normalizedEvent.type === EventType.TEXT_MESSAGE_START && "role" in normalizedEvent
            ? normalizeRole(normalizedEvent.role)
            : (messageRoleById.get(messageId) ||
                ledgerByMessageId.get(messageId)?.resolvedRole ||
                "assistant");
        if (normalizedEvent.type === EventType.TEXT_MESSAGE_START && role) {
          messageRoleById.set(messageId, role);
          messageMetaById.set(messageId, {
            threadId: turn.threadId,
            runId,
            timestamp: normalizeTimestamp(normalizedEvent.timestamp),
            sourceOrder: eventIndex,
          });
          return;
        }

        const meta = messageMetaById.get(messageId) || {
          threadId: turn.threadId,
          runId,
          timestamp: normalizeTimestamp(normalizedEvent.timestamp),
          sourceOrder: eventIndex,
        };
        messageMetaById.set(messageId, meta);
        const canonicalMessageId =
          canonicalMessageIdByRelatedId.get(messageId) || messageId;

        const delta =
          normalizedEvent.type === EventType.TEXT_MESSAGE_CONTENT && "delta" in normalizedEvent
            ? String(normalizedEvent.delta || "")
            : "";
        const eventAuthor = getEventAuthor(normalizedEvent);
        const existingNodeId =
          messageNodeIndex.get(canonicalMessageId) || messageNodeIndex.get(messageId);
        const matchedNodeId =
          !existingNodeId && isAssistantLikeRole(role) && delta
            ? findMatchingTextNodeId(nodeIndex, {
                threadId: meta.threadId,
                runId: meta.runId,
                role:
                  role === "developer" || role === "tool"
                    ? "assistant"
                    : role,
                content: delta,
                timestamp: normalizeTimestamp(normalizedEvent.timestamp),
                author: eventAuthor,
              })
            : null;
        const nodeId = matchedNodeId || existingNodeId || `message:${canonicalMessageId}`;
        const authorPayload = eventAuthor ? { author: eventAuthor } : {};
        const node = upsertNode(nodeIndex, roots, turns, {
          id: nodeId,
          type: "text",
          parentId: turn.id,
          threadId: meta.threadId,
          runId: meta.runId,
          messageId: canonicalMessageId,
          timestamp: meta.timestamp,
          sourceOrder: meta.sourceOrder,
          title: role === "user" ? "用户消息" : "助手消息",
          role,
          payload: delta
            ? { content: delta, streaming: true, ...authorPayload }
            : { streaming: true, ...authorPayload },
          sourceEventTypes: [eventType],
          relatedMessageIds: [canonicalMessageId, messageId],
        });
        mergeEventMeta(node, normalizedEvent);
        node.messageId = canonicalMessageId;
        if (role) {
          node.role = role;
          node.title = role === "user" ? "用户消息" : "助手消息";
          messageRoleById.set(messageId, role);
        }
        if (eventAuthor && !node.payload.author) {
          node.payload.author = eventAuthor;
        }
        if (delta) {
          const existing = String(node.payload.content || "");
          node.payload.content = accumulateTextContent(existing, delta);
        }
        node.payload.streaming =
          ledgerByMessageId.get(canonicalMessageId)?.streaming ??
          !node.sourceEventTypes.includes(String(EventType.TEXT_MESSAGE_END));
        messageNodeIndex.set(canonicalMessageId, node.id);
        messageNodeIndex.set(messageId, node.id);
        if (matchedNodeId && matchedNodeId !== `message:${canonicalMessageId}`) {
          node.messageId = node.messageId || messageId;
        }
        if (node.role && isAssistantLikeRole(node.role)) {
          assistantMessageByRun.set(meta.runId, node.id);
        }
        attachNode(nodeIndex, roots, turns, node.id, turn.id);
        return;
      }
      case EventType.TOOL_CALL_START:
      case EventType.TOOL_CALL_ARGS:
      case EventType.TOOL_CALL_END: {
        const toolCallId = getEventToolCallId(normalizedEvent);
        if (!toolCallId) return;
        const parentMessageNodeId = chooseParentMessageId(
          assistantMessageByRun,
          runId,
          messageId,
          messageNodeIndex,
        );
        const parentId = parentMessageNodeId || turn.id;
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `tool:${toolCallId}`,
          type: "tool-call",
          parentId,
          threadId: turn.threadId,
          runId,
          messageId,
          toolCallId,
          timestamp: normalizedEvent.timestamp,
          sourceOrder: eventIndex,
          title:
            normalizedEvent.type === EventType.TOOL_CALL_START &&
            "toolCallName" in normalizedEvent &&
            typeof normalizedEvent.toolCallName === "string"
              ? normalizedEvent.toolCallName
              : "工具调用",
          status:
            normalizedEvent.type === EventType.TOOL_CALL_END ? "done" : "running",
          payload: {},
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        if (
          normalizedEvent.type === EventType.TOOL_CALL_START &&
          "toolCallName" in normalizedEvent &&
          typeof normalizedEvent.toolCallName === "string"
        ) {
          node.title = normalizedEvent.toolCallName;
          node.payload.toolCallName = normalizedEvent.toolCallName;
          if (normalizedEvent.toolCallName === "ui.confirmation") {
            const nextCount = (pendingConfirmationCountByRun.get(runId) || 0) + 1;
            pendingConfirmationCountByRun.set(runId, nextCount);
            turn.status = "blocked";
          }
        }
        if (normalizedEvent.type === EventType.TOOL_CALL_ARGS && "delta" in normalizedEvent) {
          node.payload.args = `${String(node.payload.args || "")}${String(
            normalizedEvent.delta || "",
          )}`;
        }
        toolNodeIndex.set(toolCallId, node.id);
        attachNode(nodeIndex, roots, turns, node.id, parentId);
        return;
      }
      case EventType.TOOL_CALL_RESULT: {
        const toolCallId = getEventToolCallId(normalizedEvent);
        if (!toolCallId) return;
        const toolNodeId = toolNodeIndex.get(toolCallId);
        const parentId = toolNodeId || turn.id;
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `tool-result:${toolCallId}`,
          type: "tool-result",
          parentId,
          threadId: turn.threadId,
          runId,
          messageId,
          toolCallId,
          timestamp: normalizedEvent.timestamp,
          sourceOrder: eventIndex,
          title: "工具结果",
          status: "completed",
          payload: {
            content: "content" in normalizedEvent ? normalizedEvent.content : "",
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        if ((pendingConfirmationCountByRun.get(runId) || 0) > 0) {
          pendingConfirmationCountByRun.set(
            runId,
            Math.max(0, (pendingConfirmationCountByRun.get(runId) || 0) - 1),
          );
          if (turn.status === "blocked") {
            turn.status = "running";
          }
        }
        attachNode(nodeIndex, roots, turns, node.id, parentId);
        return;
      }
      case EventType.MESSAGES_SNAPSHOT: {
        return;
      }
      case EventType.ACTIVITY_SNAPSHOT: {
        const parentId =
          chooseParentMessageId(
            assistantMessageByRun,
            runId,
            messageId,
            messageNodeIndex,
          ) || turn.id;
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `activity:${runId}:${normalizeTimestamp(normalizedEvent.timestamp)}:${messageId || "none"}`,
          type: "activity",
          parentId,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: normalizedEvent.timestamp,
          sourceOrder: eventIndex,
          title:
            "activityType" in normalizedEvent &&
            typeof normalizedEvent.activityType === "string"
              ? normalizedEvent.activityType
              : "活动",
          payload: {
            content: "content" in normalizedEvent ? normalizedEvent.content : {},
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        attachNode(nodeIndex, roots, turns, node.id, parentId);
        return;
      }
      case EventType.STATE_DELTA: {
        const parentId =
          chooseParentMessageId(
            assistantMessageByRun,
            runId,
            messageId,
            messageNodeIndex,
          ) || turn.id;
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `state-delta:${runId}:${normalizeTimestamp(normalizedEvent.timestamp)}:${messageId || "none"}`,
          type: "state-delta",
          parentId,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: normalizedEvent.timestamp,
          sourceOrder: eventIndex,
          title: "状态增量",
          payload: {
            delta: "delta" in normalizedEvent ? normalizedEvent.delta : [],
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        attachNode(nodeIndex, roots, turns, node.id, parentId);
        return;
      }
      case EventType.STATE_SNAPSHOT: {
        const parentId =
          chooseParentMessageId(
            assistantMessageByRun,
            runId,
            messageId,
            messageNodeIndex,
          ) || turn.id;
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `state-snapshot:${runId}:${normalizeTimestamp(normalizedEvent.timestamp)}:${messageId || "none"}`,
          type: "state-snapshot",
          parentId,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: normalizedEvent.timestamp,
          sourceOrder: eventIndex,
          title: "状态快照",
          payload: {
            snapshot: "snapshot" in normalizedEvent ? normalizedEvent.snapshot : {},
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        attachNode(nodeIndex, roots, turns, node.id, parentId);
        return;
      }
      case EventType.STEP_STARTED:
      case EventType.STEP_FINISHED: {
        const stepId =
          "stepId" in normalizedEvent && typeof normalizedEvent.stepId === "string"
            ? normalizedEvent.stepId
            : `step-${normalizeTimestamp(normalizedEvent.timestamp)}`;
        const baseParentId =
          chooseParentMessageId(
            assistantMessageByRun,
            runId,
            messageId,
            messageNodeIndex,
          ) || turn.id;
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `step:${stepId}`,
          type: "step",
          parentId: baseParentId,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: normalizedEvent.timestamp,
          sourceOrder: eventIndex,
          title:
            normalizedEvent.type === EventType.STEP_STARTED &&
            "stepName" in normalizedEvent &&
            typeof normalizedEvent.stepName === "string"
              ? normalizedEvent.stepName
              : `步骤 ${stepId}`,
          status: normalizedEvent.type === EventType.STEP_FINISHED ? "done" : "running",
          payload: {
            result:
              normalizedEvent.type === EventType.STEP_FINISHED &&
              "result" in normalizedEvent
                ? normalizedEvent.result
                : undefined,
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        attachNode(nodeIndex, roots, turns, node.id, baseParentId);
        upsertNode(nodeIndex, roots, turns, {
          id: `reasoning:${stepId}`,
          type: "reasoning",
          parentId: node.id,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: normalizedEvent.timestamp,
          sourceOrder: eventIndex,
          title: "推理阶段",
          status: node.status,
          summary:
            normalizedEvent.type === EventType.STEP_STARTED
              ? `阶段开始：${node.title}`
              : `阶段完成：${node.title}`,
          payload: {
            stepId,
            phase:
              normalizedEvent.type === EventType.STEP_STARTED ? "started" : "finished",
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        addChild(node, nodeIndex.get(`reasoning:${stepId}`)!);
        return;
      }
      case EventType.RAW: {
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `raw:${runId}:${normalizeTimestamp(normalizedEvent.timestamp)}`,
          type: "raw",
          parentId: turn.id,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: normalizedEvent.timestamp,
          sourceOrder: eventIndex,
          title: "原始事件",
          payload: {
            data: "data" in normalizedEvent ? normalizedEvent.data : {},
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        addChild(turn, node);
        return;
      }
      case EventType.CUSTOM: {
        const eventTypeName = getCustomEventType(normalizedEvent) || "custom";
        if (eventTypeName === "ne.a2ui.link") {
          const data = asRecord(getCustomEventData(normalizedEvent));
          if (
            data &&
            typeof data.childId === "string" &&
            typeof data.parentId === "string"
          ) {
            pendingLinks.push({
              childId: data.childId,
              parentId: data.parentId,
            });
          }
          return;
        }
        if (eventTypeName === "ne.a2ui.reasoning") {
          return;
        }
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `custom:${runId}:${eventTypeName}:${normalizeTimestamp(normalizedEvent.timestamp)}`,
          type: "custom",
          parentId: turn.id,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: normalizedEvent.timestamp,
          sourceOrder: eventIndex,
          title: eventTypeName,
          payload: {
            data: getCustomEventData(normalizedEvent),
            eventType: eventTypeName,
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        addChild(turn, node);
        return;
      }
      default: {
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `event:${runId}:${eventType}:${normalizeTimestamp(normalizedEvent.timestamp)}`,
          type: "event",
          parentId: turn.id,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: normalizedEvent.timestamp,
          sourceOrder: eventIndex,
          title: eventType,
          payload: { event: normalizedEvent },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        addChild(turn, node);
      }
    }
  });

  const mergedFallbackMessages = [
    ...fallbackMessages,
    ...effectiveMessageLedger
      .filter((entry) => !fallbackMessages.some((message) => message.id === entry.id))
      .map((entry) =>
        createAgUiMessage({
          id: entry.id,
          role:
            entry.resolvedRole === "user" ||
            entry.resolvedRole === "system" ||
            entry.resolvedRole === "tool"
              ? entry.resolvedRole
              : "assistant",
          content: entry.content,
          createdAt: entry.createdAt,
          author: entry.author,
          runId: entry.runId,
          threadId: entry.threadId,
          streaming: entry.streaming,
        }),
      ),
  ];

  mergedFallbackMessages.forEach((message, fallbackIndex) => {
    const messageId = message.id;
    const canonicalMessageId =
      canonicalMessageIdByRelatedId.get(messageId) || messageId;
    if (messageNodeIndex.has(canonicalMessageId) || messageNodeIndex.has(messageId)) {
      const existingNodeId =
        messageNodeIndex.get(canonicalMessageId) || messageNodeIndex.get(messageId);
      const existingNode = existingNodeId ? nodeIndex.get(existingNodeId) : null;
      const snapshotMessage =
        ledgerByMessageId.get(canonicalMessageId) || ledgerByMessageId.get(messageId);
      if (
        existingNode &&
        snapshotMessage &&
        existingNode.type === "text"
      ) {
        finalizeTextNodeFromCanonicalMessage(existingNode, {
          content: snapshotMessage.content,
          streaming: snapshotMessage.streaming,
          resolvedRole: snapshotMessage.resolvedRole,
          sourceEventTypes: snapshotMessage.sourceEventTypes,
          relatedMessageIds: snapshotMessage.relatedMessageIds,
          author: snapshotMessage.author,
        });
        messageNodeIndex.set(canonicalMessageId, existingNode.id);
        snapshotMessage.relatedMessageIds.forEach((relatedMessageId) => {
          messageNodeIndex.set(relatedMessageId, existingNode.id);
        });
      }
      return;
    }
    const runId = getMessageRunId(message);
    const threadId = getMessageThreadId(message) || DEFAULT_THREAD_ID;
    const timestamp = getMessageTimestamp(message);
    const role = normalizeRole(message.role);
    const content = normalizeMessageContent(message).trim();
    const snapshotMessage =
      ledgerByMessageId.get(canonicalMessageId) || ledgerByMessageId.get(messageId);
    const duplicateNode = [...nodeIndex.values()].find((node) => {
      if (node.type !== "text" || node.role !== role) {
        return false;
      }
      // user 消息跳过 streaming 守卫：乐观消息 streaming=false，AGUI 节点经 TEXT_MESSAGE_END 后也为 false
      if (role !== "user" && node.payload.streaming !== true) {
        return false;
      }
      if (hasTechnicalChildren(node)) {
        return false;
      }
      const existingContent = String(node.payload.content || "").trim();
      const contentMatches =
        role === "assistant"
          ? (existingContent.startsWith(content) || content.startsWith(existingContent)) &&
            isEquivalentMessageContent(existingContent, content)
          : existingContent === content;
      if (!contentMatches) return false;
      // user 消息跳过 runId 匹配：乐观消息用前端 UUID，AGUI 事件用后端 UUID，必然不同
      const existingRunId = node.runId || undefined;
      // ISSUE-041: 任一侧为合成 runId（runId === threadId 或 DEFAULT_RUN_ID）时
      // 视为兼容，避免 hydrated fallback message 与 realtime text 节点身份割裂、
      // 走入 duplicateNode 不命中分支后再被新建为重复节点。
      const candidateNodeIsSynthetic = isSyntheticRunId({ runId: existingRunId, threadId: node.threadId });
      const incomingIsSynthetic = isSyntheticRunId({ runId, threadId });
      const runMatches =
        role === "user" ||
        existingRunId === runId ||
        existingRunId === DEFAULT_RUN_ID ||
        runId === DEFAULT_RUN_ID ||
        !existingRunId ||
        !runId ||
        candidateNodeIsSynthetic ||
        incomingIsSynthetic;
      if (!runMatches) {
        return false;
      }
      if (node.threadId !== threadId) {
        return false;
      }
      const timeWindow = role === "assistant" ? 30 : 5;
      return Math.abs(node.timestamp - timestamp) <= timeWindow;
    });
    if (duplicateNode) {
      finalizeTextNodeFromCanonicalMessage(duplicateNode, {
        content: snapshotMessage?.content || content,
        streaming: snapshotMessage?.streaming ?? (getMessageStreaming(message) === true),
        resolvedRole: snapshotMessage?.resolvedRole || role,
        sourceEventTypes: snapshotMessage?.sourceEventTypes || ["fallback.message"],
        relatedMessageIds: [
          ...(snapshotMessage?.relatedMessageIds || []),
          canonicalMessageId,
          messageId,
        ],
        author: snapshotMessage?.author,
      });
      duplicateNode.messageId = canonicalMessageId;
      if (!duplicateNode.relatedMessageIds.includes(messageId)) {
        duplicateNode.relatedMessageIds.push(messageId);
      }
      if (!duplicateNode.relatedMessageIds.includes(canonicalMessageId)) {
        duplicateNode.relatedMessageIds.push(canonicalMessageId);
      }
      messageNodeIndex.set(canonicalMessageId, duplicateNode.id);
      messageNodeIndex.set(messageId, duplicateNode.id);
      return;
    }

    // ISSUE-040 H3: 优先复用 ledger 中已有的 sourceOrder，避免把 snapshot-only
     // 消息（仅靠 MESSAGES_SNAPSHOT 进入 ledger、未走 TEXT_MESSAGE_START）误推
     // 到事件流末尾，从而破坏 compareLedgerEntriesByTime 的 tiebreaker。
    const fallbackSourceOrder =
      typeof snapshotMessage?.sourceOrder === "number"
        ? snapshotMessage.sourceOrder
        : orderedEvents.length + fallbackIndex;
    let fallbackTurn =
      (runId && turns.get(runId)) || findFallbackTurnByTimestamp(turns, timestamp);
    if (runId && !fallbackTurn) {
      ensureTurn(
        turns,
        roots,
        asAgUiEvent({
          type: EventType.RUN_STARTED,
          threadId,
          runId,
          timestamp,
        }),
        undefined,
        fallbackSourceOrder,
      );
      fallbackTurn = turns.get(runId) || null;
    }
    const parentId = fallbackTurn?.id ?? null;
    const node = upsertNode(nodeIndex, roots, turns, {
      id: `message:${canonicalMessageId}`,
      type: "text",
      parentId,
      threadId,
      runId: fallbackTurn?.runId || runId,
      messageId: canonicalMessageId,
      timestamp,
      sourceOrder: fallbackSourceOrder,
      title: role === "user" ? "用户消息" : "助手消息",
      role,
      payload: {
        content,
        streaming: getMessageStreaming(message) === true,
      },
      sourceEventTypes: snapshotMessage?.sourceEventTypes || ["fallback.message"],
      relatedMessageIds: snapshotMessage?.relatedMessageIds || [canonicalMessageId, messageId],
    });
    messageNodeIndex.set(canonicalMessageId, node.id);
    messageNodeIndex.set(messageId, node.id);
    (snapshotMessage?.relatedMessageIds || []).forEach((relatedMessageId) => {
      messageNodeIndex.set(relatedMessageId, node.id);
    });
    if (role === "assistant" && (fallbackTurn?.runId || runId)) {
      assistantMessageByRun.set(fallbackTurn?.runId || runId || DEFAULT_RUN_ID, node.id);
    }
    if (parentId) {
      attachNode(nodeIndex, roots, turns, node.id, parentId);
    }
  });

  pendingLinks.forEach((link) => {
    if (!nodeIndex.has(link.childId) || !nodeIndex.has(link.parentId)) {
      return;
    }
    attachNode(nodeIndex, roots, turns, link.childId, link.parentId);
  });

  const prunedRoots = collapseSyntheticTurnDuplicates(
    roots
    .map((node) => pruneNode(node))
    .filter((node): node is MutableNode => node !== null),
  );
  prunedRoots.sort((a, b) => {
    const timeDiff = a.timeRange.start - b.timeRange.start;
    if (timeDiff !== 0) {
      return timeDiff;
    }
    const sourceOrderDiff = a.sourceOrder - b.sourceOrder;
    if (sourceOrderDiff !== 0) {
      return sourceOrderDiff;
    }
    return a.id.localeCompare(b.id);
  });
  prunedRoots.forEach(sortNodeChildren);

  return {
    roots: prunedRoots,
    nodeIndex,
    messageNodeIndex,
    toolNodeIndex,
  };
}

export function buildNodeTimestampIndex(tree: ConversationTree): Map<string, number> {
  const result = new Map<string, number>();
  tree.nodeIndex.forEach((node) => {
    result.set(node.id, node.timeRange.end);
  });
  return result;
}

export function getNodeRelatedMessageIds(
  tree: ConversationTree,
  nodeId: string | null,
): string[] {
  if (!nodeId) {
    return [];
  }
  const node = tree.nodeIndex.get(nodeId);
  if (!node) {
    return [];
  }
  const messageIds = new Set<string>();
  const visit = (current: ConversationNode) => {
    current.relatedMessageIds.forEach((messageId) => messageIds.add(messageId));
    current.children.forEach(visit);
  };
  visit(node);
  return [...messageIds];
}
