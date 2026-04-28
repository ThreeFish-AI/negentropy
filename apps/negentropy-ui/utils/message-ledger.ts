import { EventType, type BaseEvent, type Message } from "@ag-ui/core";
import {
  createAgUiMessage,
  getEventAuthor,
  getEventDelta,
  getEventMessageId,
  getEventRole,
  getEventRunId,
  getEventThreadId,
  getEventToolCallId,
  getMessageAuthor,
  getMessageCreatedAt,
  getMessageRunId,
  getMessageStreaming,
  getMessageThreadId,
  type CanonicalMessageRole,
} from "@/types/agui";
import type { MessageLedgerEntry } from "@/types/common";
import {
  accumulateTextContent,
  getMessageIdentityKey,
  isEquivalentMessageContent,
  normalizeMessageContent,
} from "@/utils/message";
import { resolveMessageRole, shouldReplaceResolvedRole } from "@/utils/message-role-resolver";

type SnapshotMessage = {
  id: string;
  threadId: string;
  runId?: string;
  content: string;
  createdAt: Date;
  author?: string;
  resolvedRole: CanonicalMessageRole;
};

const DEFAULT_THREAD_ID = "default";
const DEFAULT_RUN_ID = "default-run";

function getLedgerIdentityKey(entry: Pick<MessageLedgerEntry, "id" | "threadId" | "runId">): string {
  return `${entry.threadId}|${entry.runId || DEFAULT_RUN_ID}|${entry.id}`;
}

export function isSemanticEquivalentEntry(
  left: Pick<
    MessageLedgerEntry,
    | "threadId"
    | "runId"
    | "resolvedRole"
    | "content"
    | "createdAt"
    | "streaming"
    | "origin"
    | "lifecycle"
  >,
  right: Pick<
    MessageLedgerEntry,
    | "threadId"
    | "runId"
    | "resolvedRole"
    | "content"
    | "createdAt"
    | "streaming"
    | "origin"
    | "lifecycle"
  >,
): boolean {
  if (left.threadId !== right.threadId) {
    return false;
  }
  if ((left.runId || DEFAULT_RUN_ID) !== (right.runId || DEFAULT_RUN_ID)) {
    return false;
  }
  if (left.resolvedRole !== right.resolvedRole) {
    return false;
  }
  if (left.resolvedRole !== "assistant" && left.resolvedRole !== "developer") {
    return false;
  }
  const origins = new Set([left.origin, right.origin]);
  const hasRealtime = origins.has("realtime");
  const hasHistorical = origins.has("snapshot") || origins.has("fallback");
  if (!hasRealtime || !hasHistorical) {
    return false;
  }

  const leftContent = left.content.trim();
  const rightContent = right.content.trim();
  if (!leftContent || !rightContent) {
    return false;
  }
  if (
    !leftContent.startsWith(rightContent) &&
    !rightContent.startsWith(leftContent)
  ) {
      return false;
  }

  const maxWindowMs = 8_000;
  // 长耗时回复（如多段落 / 列表型答复）下，realtime 取首个 partial 时间戳、
  // hydration 取终态时间戳，两者跨度可能大于 8s。当 trim 后内容严格相等且
  // threadId+runId+role 已收敛时，可视为同一逻辑消息，跳过时间窗硬拒绝。
  const strictlyEqualContent = leftContent === rightContent;
  if (
    !strictlyEqualContent &&
    Math.abs(left.createdAt.getTime() - right.createdAt.getTime()) > maxWindowMs
  ) {
    return false;
  }

  if (
    left.lifecycle === "closed" &&
    right.lifecycle === "closed" &&
    left.origin !== "realtime" &&
    right.origin !== "realtime"
  ) {
    return false;
  }

  const realtimeEntry = left.origin === "realtime" ? left : right;
  const historicalEntry = realtimeEntry === left ? right : left;
  const realtimeContent = realtimeEntry.content.trim();
  const historicalContent = historicalEntry.content.trim();
  const historicalCompletesClosedRealtime =
    realtimeEntry.lifecycle === "closed" &&
    historicalEntry.lifecycle === "closed" &&
    historicalEntry.streaming === false &&
    historicalContent.length > realtimeContent.length &&
    historicalContent.startsWith(realtimeContent);
  if (
    realtimeEntry.lifecycle === "closed" &&
    historicalContent !== realtimeContent &&
    !historicalCompletesClosedRealtime
  ) {
    return false;
  }

  if (
    !left.streaming &&
    !right.streaming &&
    leftContent !== rightContent &&
    !historicalCompletesClosedRealtime
  ) {
    return false;
  }

  return isEquivalentMessageContent(leftContent, rightContent);
}

function findSemanticLedgerKey(
  entries: Map<string, MessageLedgerEntry>,
  candidate: Pick<
    MessageLedgerEntry,
    | "threadId"
    | "runId"
    | "resolvedRole"
    | "content"
    | "createdAt"
    | "streaming"
    | "origin"
    | "lifecycle"
  >,
): string | null {
  for (const [key, entry] of entries.entries()) {
    if (isSemanticEquivalentEntry(entry, candidate)) {
      return key;
    }
  }
  return null;
}

function normalizeTimestamp(value: unknown): Date {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000);
  }
  return new Date();
}

function extractSnapshotMessages(events: BaseEvent[]): SnapshotMessage[] {
  return events.flatMap((event) => {
    if (event.type !== EventType.MESSAGES_SNAPSHOT) {
      return [];
    }
    const messages =
      "messages" in event && Array.isArray(event.messages) ? event.messages : [];
    return messages.flatMap((message, index) => {
      if (typeof message !== "object" || message === null) {
        return [];
      }
      const record = message as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : undefined;
      if (!id) {
        return [];
      }
      const content =
        typeof record.content === "string"
          ? record.content
          : Array.isArray(record.content)
            ? record.content
                .map((part) =>
                  typeof part === "string" ? part : JSON.stringify(part),
                )
                .join("")
            : record.content
              ? JSON.stringify(record.content)
              : "";
      const normalizedContent = content.trim();
      if (!normalizedContent) {
        return [];
      }
      const resolved = resolveMessageRole({
        snapshotRole:
          typeof record.role === "string" ? record.role : undefined,
        author:
          typeof record.author === "string" ? record.author : undefined,
      });
      const fallbackTimestamp =
        typeof event.timestamp === "number" ? event.timestamp + index * 0.0001 : Date.now() / 1000;
      const createdAt =
        typeof record.createdAt === "string" || record.createdAt instanceof Date
          ? new Date(record.createdAt)
          : typeof record.timestamp === "number"
            ? new Date(record.timestamp * 1000)
            : new Date(fallbackTimestamp * 1000);

      return [
        {
          id,
          threadId:
            typeof record.threadId === "string" && record.threadId.trim()
              ? record.threadId
              : getEventThreadId(event) || DEFAULT_THREAD_ID,
          runId:
            typeof record.runId === "string" && record.runId.trim()
              ? record.runId
              : getEventRunId(event),
          content: normalizedContent,
          createdAt,
          author:
            typeof record.author === "string" ? record.author : undefined,
          resolvedRole: resolved.resolvedRole,
        },
      ];
    });
  });
}

export function buildMessageLedger(input: {
  events: BaseEvent[];
  fallbackMessages?: Message[];
}): MessageLedgerEntry[] {
  const { events, fallbackMessages = [] } = input;
  const entries = new Map<string, MessageLedgerEntry>();
  const snapshotMessages = extractSnapshotMessages(events);
  const snapshotMessageById = new Map(
    snapshotMessages.map((message) => [message.id, message] as const),
  );

  const upsertEntry = (
    key: string,
    next: Omit<
      MessageLedgerEntry,
      "sourceEventTypes" | "relatedMessageIds" | "sourceOrder"
    > & {
      sourceEventTypes?: string[];
      relatedMessageIds?: string[];
      sourceOrder?: number;
    },
  ) => {
    const existing = entries.get(key);
    if (!existing) {
      entries.set(key, {
        ...next,
        content: next.content,
        sourceEventTypes: next.sourceEventTypes || [],
        relatedMessageIds: next.relatedMessageIds || [],
        sourceOrder:
          next.sourceOrder !== undefined && Number.isFinite(next.sourceOrder)
            ? next.sourceOrder
            : Number.MAX_SAFE_INTEGER,
      });
      return;
    }

    if (shouldReplaceResolvedRole(existing.resolutionSource, next.resolutionSource)) {
      existing.resolvedRole = next.resolvedRole;
      existing.resolutionSource = next.resolutionSource;
    }
    if (next.content.length > existing.content.length) {
      existing.content = next.content;
    }
    if (next.createdAt.getTime() < existing.createdAt.getTime()) {
      existing.createdAt = next.createdAt;
    }
    existing.threadId = existing.threadId || next.threadId;
    existing.runId = existing.runId || next.runId;
    existing.author = existing.author || next.author;
    existing.streaming = existing.streaming && next.streaming;
    existing.lifecycle =
      existing.lifecycle === "closed" || next.lifecycle === "closed" ? "closed" : "open";
    if (existing.origin !== next.origin && next.origin !== "realtime") {
      existing.origin = next.origin;
    }
    if (next.sourceOrder !== undefined && Number.isFinite(next.sourceOrder)) {
      const existingOrder = existing.sourceOrder ?? Number.MAX_SAFE_INTEGER;
      if (next.sourceOrder < existingOrder) {
        existing.sourceOrder = next.sourceOrder;
      }
    }
    (next.sourceEventTypes || []).forEach((eventType) => {
      if (!existing.sourceEventTypes.includes(eventType)) {
        existing.sourceEventTypes.push(eventType);
      }
    });
    (next.relatedMessageIds || []).forEach((messageId) => {
      if (!existing.relatedMessageIds.includes(messageId)) {
        existing.relatedMessageIds.push(messageId);
      }
    });
  };

  const orderedEvents = [...events].sort((a, b) => {
    const timeDiff =
      (typeof a.timestamp === "number" ? a.timestamp : 0) -
      (typeof b.timestamp === "number" ? b.timestamp : 0);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return String(a.type).localeCompare(String(b.type));
  });

  orderedEvents.forEach((event, eventIndex) => {
    if (
      event.type !== EventType.TEXT_MESSAGE_START &&
      event.type !== EventType.TEXT_MESSAGE_CONTENT &&
      event.type !== EventType.TEXT_MESSAGE_END
    ) {
      return;
    }

    const messageId = getEventMessageId(event);
    if (!messageId) {
      return;
    }

    const threadId = getEventThreadId(event) || DEFAULT_THREAD_ID;
    const runId = getEventRunId(event);
    const key = `${threadId}|${runId || DEFAULT_RUN_ID}|${messageId}`;
    const existing = entries.get(key);
    const snapshotMessage = snapshotMessageById.get(messageId);
    const resolved = snapshotMessage
      ? {
          resolvedRole: snapshotMessage.resolvedRole,
          resolutionSource: "snapshot_role" as const,
        }
      : resolveMessageRole({
          explicitRole: getEventRole(event),
          author: getEventAuthor(event),
          hasToolCall: !!getEventToolCallId(event),
        });
    const nextContent =
      event.type === EventType.TEXT_MESSAGE_CONTENT
        ? accumulateTextContent(existing?.content || "", String(getEventDelta(event) || ""))
        : existing?.content || "";

    upsertEntry(key, {
      id: messageId,
      threadId,
      runId,
      resolvedRole: resolved.resolvedRole,
      resolutionSource: resolved.resolutionSource,
      content: nextContent,
      createdAt: normalizeTimestamp(event.timestamp),
      streaming: event.type !== EventType.TEXT_MESSAGE_END,
      lifecycle: event.type === EventType.TEXT_MESSAGE_END ? "closed" : "open",
      origin: "realtime",
      author: getEventAuthor(event),
      sourceEventTypes: [String(event.type)],
      relatedMessageIds: [messageId],
      sourceOrder: eventIndex,
    });
  });

  [
    ...fallbackMessages,
    ...snapshotMessages.map(
      (message) =>
        ({
          id: message.id,
          role: message.resolvedRole,
          content: message.content,
          createdAt: message.createdAt,
          runId: message.runId,
          threadId: message.threadId,
          author: message.author,
        }) as Message,
    ),
  ].forEach((message, fallbackIndex) => {
    const key = getMessageIdentityKey(message);
    const resolved = resolveMessageRole({
      explicitRole: typeof message.role === "string" ? message.role : undefined,
      author: getMessageAuthor(message),
    });
    upsertEntry(key, {
      id: message.id,
      threadId: getMessageThreadId(message) || DEFAULT_THREAD_ID,
      runId: getMessageRunId(message),
      resolvedRole: resolved.resolvedRole,
      resolutionSource: resolved.resolutionSource,
      content: normalizeMessageContent(message),
      createdAt: getMessageCreatedAt(message) || new Date(),
      streaming: getMessageStreaming(message) === true,
      lifecycle: getMessageStreaming(message) === true ? "open" : "closed",
      origin: snapshotMessageById.has(message.id) ? "snapshot" : "fallback",
      author: getMessageAuthor(message),
      sourceEventTypes: [snapshotMessageById.has(message.id) ? String(EventType.MESSAGES_SNAPSHOT) : "fallback.message"],
      relatedMessageIds: [message.id],
      // 事件序之后追加 fallback / snapshot，保留 origin 间稳定相对序。
      sourceOrder: orderedEvents.length + fallbackIndex,
    });
  });

  return [...entries.values()]
    .filter((entry) => entry.content.trim().length > 0)
    .sort(compareLedgerEntriesByTime);
}

function compareLedgerEntriesByTime(
  a: MessageLedgerEntry,
  b: MessageLedgerEntry,
): number {
  const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }
  const aOrder = a.sourceOrder ?? Number.MAX_SAFE_INTEGER;
  const bOrder = b.sourceOrder ?? Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) {
    return aOrder - bOrder;
  }
  return a.id.localeCompare(b.id);
}

export function mergeMessageLedger(
  baseEntries: MessageLedgerEntry[],
  incomingEntries: MessageLedgerEntry[],
): MessageLedgerEntry[] {
  const merged = new Map<string, MessageLedgerEntry>();

  [...baseEntries, ...incomingEntries].forEach((entry) => {
    const semanticKey =
      entry.content.trim().length > 0 ? findSemanticLedgerKey(merged, entry) : null;
    const key = semanticKey || getLedgerIdentityKey(entry);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...entry,
        sourceEventTypes: [...entry.sourceEventTypes],
        relatedMessageIds: [...entry.relatedMessageIds],
      });
      return;
    }

    if (shouldReplaceResolvedRole(existing.resolutionSource, entry.resolutionSource)) {
      existing.resolvedRole = entry.resolvedRole;
      existing.resolutionSource = entry.resolutionSource;
    }
    if (entry.content.length > existing.content.length) {
      existing.content = entry.content;
    }
    if (entry.createdAt.getTime() < existing.createdAt.getTime()) {
      existing.createdAt = entry.createdAt;
    }
    existing.threadId = existing.threadId || entry.threadId;
    existing.runId = existing.runId || entry.runId;
    existing.author = existing.author || entry.author;
    existing.streaming = existing.streaming && entry.streaming;
    existing.lifecycle =
      existing.lifecycle === "closed" || entry.lifecycle === "closed" ? "closed" : "open";
    if (existing.origin === "realtime" || entry.origin === "realtime") {
      existing.origin = "realtime";
    } else if (existing.origin !== entry.origin) {
      existing.origin = entry.origin;
    }
    if (entry.sourceOrder !== undefined && Number.isFinite(entry.sourceOrder)) {
      const existingOrder = existing.sourceOrder ?? Number.MAX_SAFE_INTEGER;
      if (entry.sourceOrder < existingOrder) {
        existing.sourceOrder = entry.sourceOrder;
      }
    }
    if (!existing.relatedMessageIds.includes(entry.id)) {
      existing.relatedMessageIds.push(entry.id);
    }
    entry.sourceEventTypes.forEach((eventType) => {
      if (!existing.sourceEventTypes.includes(eventType)) {
        existing.sourceEventTypes.push(eventType);
      }
    });
    entry.relatedMessageIds.forEach((messageId) => {
      if (!existing.relatedMessageIds.includes(messageId)) {
        existing.relatedMessageIds.push(messageId);
      }
    });
  });

  return [...merged.values()].sort(compareLedgerEntriesByTime);
}

export function ledgerEntriesToMessages(entries: MessageLedgerEntry[]): Message[] {
  return [...entries]
    .sort(compareLedgerEntriesByTime)
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
      runId: entry.runId,
      threadId: entry.threadId,
      author: entry.author,
      streaming: entry.streaming,
    }),
  );
}
