import { type BaseEvent, EventType, type Message } from "@ag-ui/core";
import type { AdkEventPayload } from "@/lib/adk";
import { adkEventsToMessages, adkEventsToSnapshot } from "@/lib/adk";
import { mapAdkPayloadToNormalizedAguiEvents } from "@/utils/agui-normalization";
import type { ConnectionState } from "@/types/common";

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
  const threadId =
    "threadId" in event && typeof event.threadId === "string"
      ? event.threadId
      : "";
  const runId =
    "runId" in event && typeof event.runId === "string" ? event.runId : "";
  const messageId =
    "messageId" in event && typeof event.messageId === "string"
      ? event.messageId
      : "";
  const toolCallId =
    "toolCallId" in event && typeof event.toolCallId === "string"
      ? event.toolCallId
      : "";
  const timestamp = normalizeTimestamp(event.timestamp);

  switch (event.type) {
    case EventType.TEXT_MESSAGE_START:
      return [
        type,
        threadId,
        runId,
        messageId,
        "role" in event ? String(event.role || "") : "",
      ].join("|");
    case EventType.TEXT_MESSAGE_CONTENT:
      return [
        type,
        threadId,
        runId,
        messageId,
        "delta" in event ? String(event.delta || "") : "",
      ].join("|");
    case EventType.TEXT_MESSAGE_END:
      return [type, threadId, runId, messageId].join("|");
    case EventType.TOOL_CALL_START:
      return [
        type,
        threadId,
        runId,
        toolCallId,
        "toolCallName" in event ? String(event.toolCallName || "") : "",
      ].join("|");
    case EventType.TOOL_CALL_ARGS:
      return [
        type,
        threadId,
        runId,
        toolCallId,
        "delta" in event ? String(event.delta || "") : "",
      ].join("|");
    case EventType.TOOL_CALL_END:
      return [type, threadId, runId, toolCallId].join("|");
    case EventType.TOOL_CALL_RESULT:
      return [
        type,
        threadId,
        runId,
        toolCallId,
        "content" in event ? String(event.content || "") : "",
      ].join("|");
    case EventType.RUN_STARTED:
    case EventType.RUN_FINISHED:
      return [type, threadId, runId].join("|");
    case EventType.RUN_ERROR:
      return [
        type,
        threadId,
        runId,
        "code" in event ? String(event.code || "") : "",
        "message" in event ? String(event.message || "") : "",
      ].join("|");
    case EventType.CUSTOM:
      return [
        type,
        threadId,
        runId,
        "eventType" in event ? String(event.eventType || "") : "",
        JSON.stringify("data" in event ? event.data : null),
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

export function mergeMessages(baseMessages: Message[], incomingMessages: Message[]): Message[] {
  const merged = new Map<string, Message>();

  [...baseMessages, ...incomingMessages].forEach((message) => {
    const existing = merged.get(message.id);
    if (!existing) {
      merged.set(message.id, message);
      return;
    }

    const existingContent =
      typeof existing.content === "string"
        ? existing.content
        : JSON.stringify(existing.content);
    const incomingContent =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);

    if (incomingContent.length >= existingContent.length) {
      merged.set(message.id, { ...existing, ...message });
    }
  });

  return [...merged.values()].sort((a, b) => {
    const aTime =
      a.createdAt instanceof Date ? a.createdAt.getTime() : Number.MAX_SAFE_INTEGER;
    const bTime =
      b.createdAt instanceof Date ? b.createdAt.getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return a.id.localeCompare(b.id);
  });
}

export function hydrateSessionDetail(
  payloads: AdkEventPayload[],
  sessionId: string,
): HydratedSessionDetail {
  const runBuckets = new Map<string, BaseEvent[]>();

  payloads.forEach((payload) => {
    const runId = fallbackRunId(payload, sessionId);
    const threadId = fallbackThreadId(payload, sessionId);
    const events = mapAdkPayloadToNormalizedAguiEvents(payload, {
      threadId,
      runId,
    });
    const bucket = runBuckets.get(runId) || [];
    bucket.push(...events);
    runBuckets.set(runId, bucket);
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
    const threadId =
      "threadId" in first && typeof first.threadId === "string"
        ? first.threadId
        : sessionId;

    if (!hasRunStarted) {
      ordered.unshift({
        type: EventType.RUN_STARTED,
        threadId,
        runId,
        timestamp: Math.max(0, normalizeTimestamp(first.timestamp) - 0.001),
      } as BaseEvent);
    }

    if (!hasRunFinished && !hasRunError) {
      const last = ordered[ordered.length - 1];
      ordered.push({
        type: EventType.RUN_FINISHED,
        threadId,
        runId,
        result: "completed_from_history",
        timestamp: normalizeTimestamp(last.timestamp) + 0.001,
      } as BaseEvent);
    }

    return ordered;
  });

  const messages = adkEventsToMessages(payloads);
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
      return "delta" in event && String(event.delta || "").trim().length > 0;
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
    const runId =
      "runId" in event && typeof event.runId === "string"
        ? event.runId
        : "default";
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
      "toolCallName" in event &&
      event.toolCallName === "ui.confirmation"
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
