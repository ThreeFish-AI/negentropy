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
  getMessageThreadId,
  type CanonicalMessageRole,
} from "@/types/agui";
import type { MessageLedgerEntry } from "@/types/common";
import { accumulateTextContent, getMessageIdentityKey, normalizeMessageContent } from "@/utils/message";
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
    next: Omit<MessageLedgerEntry, "sourceEventTypes" | "relatedMessageIds"> & {
      sourceEventTypes?: string[];
      relatedMessageIds?: string[];
    },
  ) => {
    const existing = entries.get(key);
    if (!existing) {
      entries.set(key, {
        ...next,
        content: next.content,
        sourceEventTypes: next.sourceEventTypes || [],
        relatedMessageIds: next.relatedMessageIds || [],
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

  orderedEvents.forEach((event) => {
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
      author: getEventAuthor(event),
      sourceEventTypes: [String(event.type)],
      relatedMessageIds: [messageId],
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
  ].forEach((message) => {
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
      streaming: false,
      author: getMessageAuthor(message),
      sourceEventTypes: ["fallback.message"],
      relatedMessageIds: [message.id],
    });
  });

  return [...entries.values()]
    .filter((entry) => entry.content.trim().length > 0)
    .sort((a, b) => {
      const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return a.id.localeCompare(b.id);
    });
}

export function mergeMessageLedger(
  baseEntries: MessageLedgerEntry[],
  incomingEntries: MessageLedgerEntry[],
): MessageLedgerEntry[] {
  const merged = new Map<string, MessageLedgerEntry>();

  [...baseEntries, ...incomingEntries].forEach((entry) => {
    const key = getLedgerIdentityKey(entry);
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

  return [...merged.values()].sort((a, b) => {
    const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return a.id.localeCompare(b.id);
  });
}

export function ledgerEntriesToMessages(entries: MessageLedgerEntry[]): Message[] {
  return [...entries]
    .sort((a, b) => {
      const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return a.id.localeCompare(b.id);
    })
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
