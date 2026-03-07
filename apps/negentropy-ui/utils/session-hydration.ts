import { type BaseEvent, EventType, type Message } from "@ag-ui/core";
import type { AdkEventPayload } from "@/lib/adk";
import {
  AdkMessageStreamNormalizer,
  adkEventsToSnapshot,
  aguiEventsToMessages,
} from "@/lib/adk";
import { normalizeAguiEvent, resolveEventRunAndThread } from "@/utils/agui-normalization";
import type { ConnectionState } from "@/types/common";
import {
  asAgUiEvent,
  getCustomEventData,
  getCustomEventType,
  getEventCode,
  getEventContent,
  getEventDelta,
  getEventErrorMessage,
  getEventMessageId,
  getEventRunId,
  getEventThreadId,
  getEventToolCallId,
  getEventToolCallName,
  getMessageCreatedAt,
  type AgUiMessage,
} from "@/types/agui";
import { getMessageIdentityKey, normalizeMessageContent } from "@/utils/message";

export type HydratedSessionDetail = {
  events: BaseEvent[];
  messages: Message[];
  snapshot: Record<string, unknown> | null;
};

function normalizeTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Date.now() / 1000;
}

function fallbackRunId(payload: AdkEventPayload, sessionId: string): string {
  return payload.runId || payload.threadId || sessionId;
}

function fallbackThreadId(payload: AdkEventPayload, sessionId: string): string {
  return payload.threadId || sessionId;
}

function eventKey(event: BaseEvent): string {
  const type = String(event.type);
  const threadId = getEventThreadId(event) || "";
  const runId = getEventRunId(event) || "";
  const messageId = getEventMessageId(event) || "";
  const toolCallId = getEventToolCallId(event) || "";
  const timestamp = normalizeTimestamp(event.timestamp);

  switch (event.type) {
    case EventType.TEXT_MESSAGE_START:
      return [
        type,
        threadId,
        runId,
        messageId,
        String((event as Record<string, unknown>).role || ""),
      ].join("|");
    case EventType.TEXT_MESSAGE_CONTENT:
      return [
        type,
        threadId,
        runId,
        messageId,
        String(getEventDelta(event) || ""),
      ].join("|");
    case EventType.TEXT_MESSAGE_END:
      return [type, threadId, runId, messageId].join("|");
    case EventType.TOOL_CALL_START:
      return [
        type,
        threadId,
        runId,
        toolCallId,
        String(getEventToolCallName(event) || ""),
      ].join("|");
    case EventType.TOOL_CALL_ARGS:
      return [
        type,
        threadId,
        runId,
        toolCallId,
        String(getEventDelta(event) || ""),
      ].join("|");
    case EventType.TOOL_CALL_END:
      return [type, threadId, runId, toolCallId].join("|");
    case EventType.TOOL_CALL_RESULT:
      return [
        type,
        threadId,
        runId,
        toolCallId,
        String(getEventContent(event) || ""),
      ].join("|");
    case EventType.RUN_STARTED:
    case EventType.RUN_FINISHED:
      return [type, threadId, runId].join("|");
    case EventType.RUN_ERROR:
      return [
        type,
        threadId,
        runId,
        String(getEventCode(event) || ""),
        String(getEventErrorMessage(event) || ""),
      ].join("|");
    case EventType.CUSTOM:
      return [
        type,
        threadId,
        runId,
        String(getCustomEventType(event) || ""),
        JSON.stringify(getCustomEventData(event) ?? null),
      ].join("|");
    default:
      return [type, threadId, runId, messageId, toolCallId, String(timestamp)].join(
        "|",
      );
  }
}

export function mergeEvents(baseEvents: BaseEvent[], incomingEvents: BaseEvent[]): BaseEvent[] {
  const merged = new Map<string, BaseEvent>();
  [...baseEvents, ...incomingEvents].forEach((event) => {
    merged.set(eventKey(event), event);
  });

  return [...merged.values()].sort((a, b) => {
    const timeDiff = normalizeTimestamp(a.timestamp) - normalizeTimestamp(b.timestamp);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return eventKey(a).localeCompare(eventKey(b));
  });
}

export function hasSameEventSequence(left: BaseEvent[], right: BaseEvent[]): boolean {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (eventKey(left[index]!) !== eventKey(right[index]!)) {
      return false;
    }
  }
  return true;
}

export function mergeMessages(baseMessages: Message[], incomingMessages: Message[]): Message[] {
  const merged = new Map<string, AgUiMessage>();

  [...baseMessages, ...incomingMessages].forEach((message) => {
    const timedMessage = message as AgUiMessage;
    const key = getMessageIdentityKey(message);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, timedMessage);
      return;
    }

    const existingContent = normalizeMessageContent(existing);
    const incomingContent = normalizeMessageContent(message);
    const existingStreaming = existing.streaming === true;
    const incomingStreaming = timedMessage.streaming === true;

    if (
      incomingContent.length > existingContent.length ||
      (incomingContent.length === existingContent.length &&
        existingStreaming &&
        !incomingStreaming)
    ) {
      merged.set(key, { ...existing, ...timedMessage } as AgUiMessage);
    }
  });

  return [...merged.values()].sort((a, b) => {
    const aTime = getMessageCreatedAt(a)?.getTime() || Number.MAX_SAFE_INTEGER;
    const bTime = getMessageCreatedAt(b)?.getTime() || Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return a.id.localeCompare(b.id);
  });
}

export function hasSameMessageSequence(left: Message[], right: Message[]): boolean {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftMessage = left[index] as AgUiMessage;
    const rightMessage = right[index] as AgUiMessage;
    if (getMessageIdentityKey(leftMessage) !== getMessageIdentityKey(rightMessage)) {
      return false;
    }
    if (normalizeMessageContent(leftMessage) !== normalizeMessageContent(rightMessage)) {
      return false;
    }
    if ((leftMessage.streaming === true) !== (rightMessage.streaming === true)) {
      return false;
    }
  }

  return true;
}

export function hydrateSessionDetail(
  payloads: AdkEventPayload[],
  sessionId: string,
): HydratedSessionDetail {
  const runBuckets = new Map<string, BaseEvent[]>();
  const runNormalizers = new Map<string, AdkMessageStreamNormalizer>();

  payloads.forEach((payload) => {
    const runId = fallbackRunId(payload, sessionId);
    const threadId = fallbackThreadId(payload, sessionId);
    const normalizer =
      runNormalizers.get(runId) || new AdkMessageStreamNormalizer();
    runNormalizers.set(runId, normalizer);
    const events = normalizer.consume(payload, { threadId, runId }).map((event) =>
      normalizeAguiEvent(resolveEventRunAndThread(event, { threadId, runId })),
    );
    const bucket = runBuckets.get(runId) || [];
    bucket.push(...events);
    runBuckets.set(runId, bucket);
  });

  runBuckets.forEach((events, runId) => {
    const normalizer = runNormalizers.get(runId);
    if (!normalizer) {
      return;
    }
    const threadId =
      events.reduce<string | null>((resolvedThreadId, event) => {
        if (resolvedThreadId) {
          return resolvedThreadId;
        }
        return getEventThreadId(event) || null;
      }, null) || sessionId;
    events.push(
      ...normalizer
        .flushRun(runId, threadId, normalizeTimestamp(events[events.length - 1]?.timestamp) + 0.001)
        .map((event) =>
          normalizeAguiEvent(resolveEventRunAndThread(event, { threadId, runId })),
        ),
    );
  });

  const normalizedEvents = [...runBuckets.entries()].flatMap(([runId, events]) => {
    const ordered = [...events].sort((a, b) => {
      const timeDiff = normalizeTimestamp(a.timestamp) - normalizeTimestamp(b.timestamp);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return eventKey(a).localeCompare(eventKey(b));
    });

    if (ordered.length === 0) {
      return ordered;
    }

    const first = ordered[0];
    const hasRunStarted = ordered.some((event) => event.type === EventType.RUN_STARTED);
    const hasRunFinished = ordered.some((event) => event.type === EventType.RUN_FINISHED);
    const hasRunError = ordered.some((event) => event.type === EventType.RUN_ERROR);
    const threadId = getEventThreadId(first) || sessionId;

    if (!hasRunStarted) {
      ordered.unshift(asAgUiEvent({
        type: EventType.RUN_STARTED,
        threadId,
        runId,
        timestamp: Math.max(0, normalizeTimestamp(first.timestamp) - 0.001),
      }));
    }

    if (!hasRunFinished && !hasRunError) {
      const last = ordered[ordered.length - 1];
      ordered.push(asAgUiEvent({
        type: EventType.RUN_FINISHED,
        threadId,
        runId,
        result: "completed_from_history",
        timestamp: normalizeTimestamp(last.timestamp) + 0.001,
      }));
    }

    return ordered;
  });

  const messages = aguiEventsToMessages(normalizedEvents);
  const snapshot = adkEventsToSnapshot(payloads) || null;

  return {
    events: mergeEvents([], normalizedEvents),
    messages,
    snapshot,
  };
}

export type DerivedRunState = {
  runId: string;
  status: "streaming" | "blocked" | "completed" | "error";
  startedAt?: number;
  finishedAt?: number;
  pendingConfirmationCount: number;
  hasRenderableOutput: boolean;
};

function isRenderableEvent(event: BaseEvent): boolean {
  switch (event.type) {
    case EventType.TEXT_MESSAGE_CONTENT:
      return String(getEventDelta(event) || "").trim().length > 0;
    case EventType.TOOL_CALL_START:
    case EventType.TOOL_CALL_RESULT:
    case EventType.ACTIVITY_SNAPSHOT:
    case EventType.STATE_DELTA:
    case EventType.STATE_SNAPSHOT:
    case EventType.RUN_ERROR:
      return true;
    default:
      return false;
  }
}

export function deriveRunStates(events: BaseEvent[]): DerivedRunState[] {
  const states = new Map<string, DerivedRunState>();

  events.forEach((event) => {
    const runId = getEventRunId(event) || "default";
    const current = states.get(runId) || {
      runId,
      status: "streaming" as const,
      pendingConfirmationCount: 0,
      hasRenderableOutput: false,
    };

    if (event.type === EventType.RUN_STARTED) {
      current.startedAt = normalizeTimestamp(event.timestamp);
      current.status = "streaming";
    }

    if (event.type === EventType.RUN_FINISHED) {
      current.finishedAt = normalizeTimestamp(event.timestamp);
      current.status = current.pendingConfirmationCount > 0 ? "blocked" : "completed";
    }

    if (event.type === EventType.RUN_ERROR) {
      current.finishedAt = normalizeTimestamp(event.timestamp);
      current.status = "error";
    }

    if (
      event.type === EventType.TOOL_CALL_START &&
      getEventToolCallName(event) === "ui.confirmation"
    ) {
      current.pendingConfirmationCount += 1;
      current.status = "blocked";
    }

    if (event.type === EventType.TOOL_CALL_RESULT && current.pendingConfirmationCount > 0) {
      current.pendingConfirmationCount -= 1;
      if (current.status === "blocked") {
        current.status = current.finishedAt ? "completed" : "streaming";
      }
    }

    if (isRenderableEvent(event)) {
      current.hasRenderableOutput = true;
    }

    states.set(runId, current);
  });

  return [...states.values()].sort((a, b) => {
    const aTime = a.finishedAt ?? a.startedAt ?? 0;
    const bTime = b.finishedAt ?? b.startedAt ?? 0;
    return aTime - bTime;
  });
}

export function deriveConnectionState(events: BaseEvent[]): ConnectionState {
  const runStates = deriveRunStates(events);
  const current = runStates[runStates.length - 1];

  if (!current) {
    return "idle";
  }
  if (current.status === "error") {
    return "error";
  }
  if (current.status === "blocked") {
    return "blocked";
  }
  if (current.status === "streaming") {
    return "streaming";
  }
  return "idle";
}
