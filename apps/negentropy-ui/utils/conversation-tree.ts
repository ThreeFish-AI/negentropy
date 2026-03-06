import { EventType, type BaseEvent, type Message } from "@ag-ui/core";
import type {
  BuildConversationTreeOptions,
  ConversationNode,
  ConversationNodeType,
  ConversationTree,
} from "@/types/a2ui";

type MutableNode = ConversationNode;

type LinkInstruction = {
  childId: string;
  parentId: string;
};

type CustomPayload = {
  eventType?: string;
  data?: unknown;
};

const DEFAULT_THREAD_ID = "default";
const DEFAULT_RUN_ID = "default";

function normalizeRole(value: unknown): "user" | "assistant" | "system" {
  if (value === "user") return "user";
  if (value === "system") return "system";
  return "assistant";
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
  title: string;
  status?: string;
  role?: "user" | "assistant" | "system";
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
    title: input.title,
    status: input.status,
    role: input.role,
    summary: input.summary,
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
  if ("messageId" in event && typeof event.messageId === "string") {
    node.messageId = event.messageId;
    if (!node.relatedMessageIds.includes(event.messageId)) {
      node.relatedMessageIds.push(event.messageId);
    }
  }
}

function ensureTurn(
  turns: Map<string, MutableNode>,
  roots: MutableNode[],
  event: BaseEvent,
): MutableNode {
  const runId =
    "runId" in event && typeof event.runId === "string"
      ? event.runId
      : DEFAULT_RUN_ID;
  const existing = turns.get(runId);
  if (existing) {
    mergeEventMeta(existing, event);
    return existing;
  }

  const turn = createNode({
    id: `turn:${runId}`,
    type: "turn",
    threadId:
      "threadId" in event && typeof event.threadId === "string"
        ? event.threadId
        : DEFAULT_THREAD_ID,
    runId,
    timestamp: event.timestamp,
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
  childId: string,
  parentId: string | null,
) {
  const child = nodeIndex.get(childId);
  if (!child) return;

  if (child.parentId && nodeIndex.has(child.parentId)) {
    removeChild(nodeIndex.get(child.parentId)!, childId);
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
  const parent = nodeIndex.get(parentId);
  if (parent) {
    addChild(parent, child);
  } else {
    roots.push(child);
  }
}

function chooseParentMessageId(
  assistantByRun: Map<string, string>,
  runId: string,
): string | null {
  return assistantByRun.get(runId) || null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function formatJson(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function getMessageTimestamp(message: Message): number {
  const createdAt = (message as { createdAt?: Date }).createdAt;
  return createdAt instanceof Date ? createdAt.getTime() / 1000 : Date.now() / 1000;
}

export function buildConversationTree(
  options: BuildConversationTreeOptions,
): ConversationTree {
  const { events, fallbackMessages = [] } = options;
  const roots: MutableNode[] = [];
  const nodeIndex = new Map<string, MutableNode>();
  const messageNodeIndex = new Map<string, string>();
  const toolNodeIndex = new Map<string, string>();
  const turns = new Map<string, MutableNode>();
  const assistantMessageByRun = new Map<string, string>();
  const pendingLinks: LinkInstruction[] = [];

  const orderedEvents = [...events].sort((a, b) => {
    const timeDiff = normalizeTimestamp(a.timestamp) - normalizeTimestamp(b.timestamp);
    if (timeDiff !== 0) return timeDiff;
    return String(a.type).localeCompare(String(b.type));
  });

  orderedEvents.forEach((event) => {
    const turn = ensureTurn(turns, roots, event);
    const runId = turn.runId || DEFAULT_RUN_ID;
    const messageId =
      "messageId" in event && typeof event.messageId === "string"
        ? event.messageId
        : undefined;
    const eventType = String(event.type);

    switch (event.type) {
      case EventType.RUN_STARTED: {
        turn.status = "running";
        turn.title = `轮次 ${runId.slice(0, 8)}`;
        mergeEventMeta(turn, event);
        return;
      }
      case EventType.RUN_FINISHED: {
        turn.status = "finished";
        mergeEventMeta(turn, event);
        return;
      }
      case EventType.RUN_ERROR: {
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `error:${runId}:${normalizeTimestamp(event.timestamp)}`,
          type: "error",
          parentId: turn.id,
          threadId: turn.threadId,
          runId,
          timestamp: event.timestamp,
          title: "运行错误",
          status: "error",
          payload: {
            message: "message" in event ? event.message : "",
            code: "code" in event ? event.code : "",
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
          event.type === EventType.TEXT_MESSAGE_START && "role" in event
            ? normalizeRole(event.role)
            : undefined;
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `message:${messageId}`,
          type: "text",
          parentId: turn.id,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: event.timestamp,
          title: role === "user" ? "用户消息" : "助手消息",
          role,
          payload: {
            content: "",
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: [messageId],
        });
        mergeEventMeta(node, event);
        if (role) {
          node.role = role;
          node.title = role === "user" ? "用户消息" : "助手消息";
        }
        if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
          const delta = "delta" in event ? String(event.delta || "") : "";
          const existing = String(node.payload.content || "");
          node.payload.content =
            delta.length >= existing.length || existing.length === 0
              ? delta
              : `${existing}${delta}`;
        }
        messageNodeIndex.set(messageId, node.id);
        if (node.role === "assistant") {
          assistantMessageByRun.set(runId, node.id);
        }
        addChild(turn, node);
        return;
      }
      case EventType.TOOL_CALL_START:
      case EventType.TOOL_CALL_ARGS:
      case EventType.TOOL_CALL_END: {
        const toolCallId =
          "toolCallId" in event && typeof event.toolCallId === "string"
            ? event.toolCallId
            : undefined;
        if (!toolCallId) return;
        const parentMessageNodeId = chooseParentMessageId(
          assistantMessageByRun,
          runId,
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
          timestamp: event.timestamp,
          title:
            event.type === EventType.TOOL_CALL_START &&
            "toolCallName" in event &&
            typeof event.toolCallName === "string"
              ? event.toolCallName
              : "工具调用",
          status:
            event.type === EventType.TOOL_CALL_END ? "done" : "running",
          payload: {
            args: "",
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        if (
          event.type === EventType.TOOL_CALL_START &&
          "toolCallName" in event &&
          typeof event.toolCallName === "string"
        ) {
          node.title = event.toolCallName;
          node.payload.toolCallName = event.toolCallName;
        }
        if (event.type === EventType.TOOL_CALL_ARGS && "delta" in event) {
          node.payload.args = `${String(node.payload.args || "")}${String(
            event.delta || "",
          )}`;
        }
        toolNodeIndex.set(toolCallId, node.id);
        attachNode(nodeIndex, roots, node.id, parentId);
        return;
      }
      case EventType.TOOL_CALL_RESULT: {
        const toolCallId =
          "toolCallId" in event && typeof event.toolCallId === "string"
            ? event.toolCallId
            : undefined;
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
          timestamp: event.timestamp,
          title: "工具结果",
          status: "completed",
          payload: {
            content: "content" in event ? event.content : "",
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        attachNode(nodeIndex, roots, node.id, parentId);
        return;
      }
      case EventType.ACTIVITY_SNAPSHOT: {
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `activity:${runId}:${normalizeTimestamp(event.timestamp)}:${messageId || "none"}`,
          type: "activity",
          parentId: turn.id,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: event.timestamp,
          title:
            "activityType" in event && typeof event.activityType === "string"
              ? event.activityType
              : "活动",
          payload: {
            content: "content" in event ? event.content : {},
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        addChild(turn, node);
        return;
      }
      case EventType.STATE_DELTA: {
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `state-delta:${runId}:${normalizeTimestamp(event.timestamp)}:${messageId || "none"}`,
          type: "state-delta",
          parentId: turn.id,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: event.timestamp,
          title: "状态增量",
          payload: {
            delta: "delta" in event ? event.delta : [],
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        addChild(turn, node);
        return;
      }
      case EventType.STATE_SNAPSHOT: {
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `state-snapshot:${runId}:${normalizeTimestamp(event.timestamp)}:${messageId || "none"}`,
          type: "state-snapshot",
          parentId: turn.id,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: event.timestamp,
          title: "状态快照",
          payload: {
            snapshot: "snapshot" in event ? event.snapshot : {},
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        addChild(turn, node);
        return;
      }
      case EventType.STEP_STARTED:
      case EventType.STEP_FINISHED: {
        const stepId =
          "stepId" in event && typeof event.stepId === "string"
            ? event.stepId
            : `step-${normalizeTimestamp(event.timestamp)}`;
        const baseParentId =
          chooseParentMessageId(assistantMessageByRun, runId) || turn.id;
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `step:${stepId}`,
          type: "step",
          parentId: baseParentId,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: event.timestamp,
          title:
            event.type === EventType.STEP_STARTED &&
            "stepName" in event &&
            typeof event.stepName === "string"
              ? event.stepName
              : `步骤 ${stepId}`,
          status: event.type === EventType.STEP_FINISHED ? "done" : "running",
          payload: {
            result:
              event.type === EventType.STEP_FINISHED && "result" in event
                ? event.result
                : undefined,
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        attachNode(nodeIndex, roots, node.id, baseParentId);
        upsertNode(nodeIndex, roots, turns, {
          id: `reasoning:${stepId}`,
          type: "reasoning",
          parentId: node.id,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: event.timestamp,
          title: "推理阶段",
          status: node.status,
          summary:
            event.type === EventType.STEP_STARTED
              ? `阶段开始：${node.title}`
              : `阶段完成：${node.title}`,
          payload: {
            stepId,
            phase:
              event.type === EventType.STEP_STARTED ? "started" : "finished",
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        addChild(node, nodeIndex.get(`reasoning:${stepId}`)!);
        return;
      }
      case EventType.RAW: {
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `raw:${runId}:${normalizeTimestamp(event.timestamp)}`,
          type: "raw",
          parentId: turn.id,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: event.timestamp,
          title: "原始事件",
          payload: {
            data: "data" in event ? event.data : {},
          },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        addChild(turn, node);
        return;
      }
      case EventType.CUSTOM: {
        const customEvent = event as BaseEvent & CustomPayload;
        const eventTypeName =
          typeof customEvent.eventType === "string"
            ? customEvent.eventType
            : "custom";
        if (eventTypeName === "ne.a2ui.link") {
          const data = asRecord(customEvent.data);
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
        }
        const node = upsertNode(nodeIndex, roots, turns, {
          id: `custom:${runId}:${eventTypeName}:${normalizeTimestamp(event.timestamp)}`,
          type: "custom",
          parentId: turn.id,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: event.timestamp,
          title: eventTypeName,
          payload: {
            data: customEvent.data,
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
          id: `event:${runId}:${eventType}:${normalizeTimestamp(event.timestamp)}`,
          type: "event",
          parentId: turn.id,
          threadId: turn.threadId,
          runId,
          messageId,
          timestamp: event.timestamp,
          title: eventType,
          payload: { event },
          sourceEventTypes: [eventType],
          relatedMessageIds: messageId ? [messageId] : [],
        });
        addChild(turn, node);
      }
    }
  });

  fallbackMessages.forEach((message) => {
    const messageId = message.id;
    if (messageNodeIndex.has(messageId)) {
      return;
    }
    const runId =
      typeof (message as { runId?: unknown }).runId === "string"
        ? String((message as { runId?: unknown }).runId)
        : undefined;
    if (runId) {
      ensureTurn(
        turns,
        roots,
        {
          type: EventType.RUN_STARTED,
          threadId: DEFAULT_THREAD_ID,
          runId,
          timestamp: getMessageTimestamp(message),
        } as BaseEvent,
      );
    }
    const parentId = runId ? `turn:${runId}` : null;
    const role = normalizeRole(message.role);
    const node = upsertNode(nodeIndex, roots, turns, {
      id: `message:${messageId}`,
      type: "text",
      parentId,
      threadId: DEFAULT_THREAD_ID,
      runId,
      messageId,
      timestamp: getMessageTimestamp(message),
      title: role === "user" ? "用户消息" : "助手消息",
      role,
      payload: {
        content:
          typeof message.content === "string"
            ? message.content
            : formatJson(message.content),
      },
      sourceEventTypes: ["fallback.message"],
      relatedMessageIds: [messageId],
    });
    messageNodeIndex.set(messageId, node.id);
    if (role === "assistant" && runId) {
      assistantMessageByRun.set(runId, node.id);
    }
    if (parentId) {
      attachNode(nodeIndex, roots, node.id, parentId);
    }
  });

  pendingLinks.forEach((link) => {
    if (!nodeIndex.has(link.childId) || !nodeIndex.has(link.parentId)) {
      return;
    }
    attachNode(nodeIndex, roots, link.childId, link.parentId);
  });

  const sortNodes = (nodes: MutableNode[]) => {
    nodes.sort((a, b) => {
      const timeDiff = a.timeRange.start - b.timeRange.start;
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);

  return {
    roots,
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
